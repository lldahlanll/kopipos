from datetime import datetime, date, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Order, OrderItem, Product, Modifier, User, Shift, OrderAuditLog, OrderRefund, OrderRefundItem, IdempotencyKey
from app.schemas.order import OrderCreate, OrderResponse, OrderListResponse, OrderVoidRequest, OrderRefundRequest, BulkReviewRequest, OrderConfirm
from app.utils.auth import get_current_user, require_pos_access, require_owner, find_supervisor_by_pin
from app.limiter import limiter
from app.services import OrderService

router = APIRouter(prefix="/api/orders", tags=["Orders"])

from app.utils.order import add_member_points, lock_order


@router.post("", response_model=OrderResponse, status_code=201)
@limiter.limit("30/minute")
def create_order(request: Request, data: OrderCreate, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Order harus memiliki minimal 1 item")
    if data.order_type not in ("dine_in", "takeaway"):
        raise HTTPException(status_code=400, detail="Order type invalid")
    if data.payment_method not in ("cash", "qris", "transfer"):
        raise HTTPException(status_code=400, detail="Payment method invalid")

    active_shift = db.query(Shift).filter(Shift.cashier_id == current_user.id, Shift.status == "open").first()
    if not active_shift:
        raise HTTPException(status_code=400, detail="Shift belum dibuka (No active shift)")

    # ── Idempotency Check: cegah double order saat jaringan lemah ──
    idempotency_key = request.headers.get("X-Idempotency-Key")
    actor_id = f"cashier_{current_user.id}"
    if idempotency_key:
        from datetime import timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
        existing = (
            db.query(IdempotencyKey)
            .filter(
                IdempotencyKey.key == idempotency_key,
                IdempotencyKey.actor_id == actor_id,
                IdempotencyKey.created_at >= cutoff,
            )
            .first()
        )
        if existing and existing.order_id:
            order = db.query(Order).options(
                joinedload(Order.items),
                joinedload(Order.audit_logs),
                joinedload(Order.refunds),
            ).filter(Order.id == existing.order_id).first()
            if order:
                return order  # kembalikan order yang sudah dibuat sebelumnya

    # Delegate core order logic to OrderService
    order = OrderService.create_order(data, cashier_id=current_user.id, shift_id=active_shift.id, db=db)

    # Simpan idempotency key setelah order berhasil dibuat
    if idempotency_key:
        try:
            idem = IdempotencyKey(key=idempotency_key, actor_id=actor_id, order_id=order.id)
            db.add(idem)
            db.commit()
        except Exception:
            db.rollback()  # jangan gagalkan order hanya karena key sudah ada

    return order


@router.get("", response_model=List[OrderListResponse])
def list_orders(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    cashier_id: Optional[int] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access)
):
    q = db.query(Order).options(
        joinedload(Order.cashier),
        joinedload(Order.shift),
        joinedload(Order.refunds)
    )
    
    if current_user.role == 'cashier':
        from sqlalchemy import or_
        q = q.filter(or_(Order.cashier_id == current_user.id, Order.source == "self_order"))
        # Cashier is locked to the last 7 days of transactions
        seven_days_ago = datetime.now().date() - timedelta(days=7)
        seven_days_ago_dt = datetime(seven_days_ago.year, seven_days_ago.month, seven_days_ago.day, 0, 0, 0)
        if date_from:
            req_date = datetime.strptime(date_from, "%Y-%m-%d")
            if req_date < seven_days_ago_dt:
                date_from_dt = seven_days_ago_dt
            else:
                date_from_dt = req_date
        else:
            date_from_dt = seven_days_ago_dt
        q = q.filter(Order.created_at >= date_from_dt)
    else:
        if date_from:
            q = q.filter(Order.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
            
    if date_to:
        q = q.filter(Order.created_at <= datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59))
        
    if status:
        q = q.filter(Order.status == status)
        
    if payment_method:
        q = q.filter(Order.payment_method == payment_method)
        
    if cashier_id and current_user.role in ('owner', 'supervisor'):
        q = q.filter(Order.cashier_id == cashier_id)
        
    return q.order_by(Order.created_at.desc()).offset(offset).limit(limit).all()

# ── Route statis harus SEBELUM route dinamis /{id} agar tidak konflik ──
@router.get("/kitchen/active", response_model=List[OrderResponse])
def get_active_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Ambil semua order aktif untuk Kitchen Display System (KDS)."""
    return db.query(Order).options(joinedload(Order.items)).filter(
        Order.status.in_(["confirmed", "preparing", "ready"])
    ).order_by(Order.created_at.asc()).all()

@router.get("/incoming/pending", response_model=List[OrderListResponse])
def get_incoming_orders(db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    """Ambil order self-order yang belum dikonfirmasi kasir.

    Mencakup dua kategori:
    1. Order self-order dengan status 'pending' (semua metode pembayaran) yang masih
       menunggu konfirmasi atau pembayaran kasir.
    2. Order QRIS yang sudah dibayar via Midtrans (status=confirmed) tetapi
       belum diakui kasir (cashier_id IS NULL), sehingga kasir tetap mendapat
       notifikasi meski pembayaran sudah otomatis dikonfirmasi oleh callback.
    """
    from sqlalchemy import or_, and_

    return db.query(Order).filter(
        Order.source == "self_order",
        or_(
            # Kelompok 1: Semua order self-order yang masih pending
            # (cashier, transfer, cash, maupun qris yang belum dibayar)
            Order.status == "pending",
            # Kelompok 2: QRIS sudah dibayar (confirmed oleh callback Midtrans)
            # tapi kasir belum meng-acknowledge (cashier_id masih NULL)
            and_(
                Order.status == "confirmed",
                Order.payment_method == "qris",
                Order.cashier_id == None  # noqa: E711
            )
        )
    ).order_by(Order.created_at.asc()).all()


@router.post("/bulk-review")
def bulk_review(payload: BulkReviewRequest, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    db.query(Order).filter(Order.id.in_(payload.order_ids)).update({Order.is_reviewed: True}, synchronize_session=False)
    
    # Log audit log for each reviewed order
    for oid in payload.order_ids:
        log = OrderAuditLog(
            order_id=oid,
            event="reviewed",
            cashier_id=current_user.id,
            details=f"Marked reviewed by owner {current_user.name}"
        )
        db.add(log)
    db.commit()
    return {"detail": f"Berhasil meninjau {len(payload.order_ids)} order"}

@router.get("/{id}", response_model=OrderResponse)
def get_order(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.cashier),
        joinedload(Order.shift),
        joinedload(Order.audit_logs),
        joinedload(Order.refunds).joinedload(OrderRefund.items)
    ).filter(Order.id == id).first()
    if not order: raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return order

TENDER_METHODS = ("cash", "qris", "transfer")


@router.patch("/{id}/confirm", response_model=OrderResponse)
def confirm_order(id: int, payload: Optional[OrderConfirm] = None, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    """Konfirmasi order oleh kasir.

    Mendukung dua skenario:
    - Order pending (cashier/transfer): ubah status → confirmed, tambah poin, assign kasir & shift.
      Wajib punya shift aktif.
    - Order QRIS confirmed tanpa kasir: hanya assign kasir (poin sudah ditambahkan oleh
      Midtrans callback). Shift aktif bersifat opsional — jika tidak ada, shift_id dibiarkan NULL
      agar order tetap bisa di-acknowledge oleh kasir yang belum buka shift.
    """
    from sqlalchemy import or_, and_

    lock_order(db, order_id=id)  # cegah dua proses mengubah status/poin bersamaan
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.member)
    ).filter(
        Order.id == id,
        or_(
            Order.status == "pending",
            and_(
                Order.status == "confirmed",
                Order.payment_method == "qris",
                Order.cashier_id == None  # noqa: E711  — QRIS acknowledged by kasir
            )
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan atau sudah diproses")

    is_qris_already_paid = (
        order.status == "confirmed"
        and order.payment_method == "qris"
        and order.cashier_id is None
    )

    # QRIS yang belum dibayar hanya boleh dikonfirmasi oleh callback Midtrans.
    if order.status == "pending" and order.payment_method == "qris":
        raise HTTPException(status_code=400, detail="Order QRIS belum dibayar — tunggu konfirmasi pembayaran dari Midtrans")

    # "Bayar di Kasir": kasir wajib mencatat metode bayar sebenarnya, karena
    # hanya pembayaran tunai yang masuk hitungan kas laci saat tutup shift.
    tender = payload.payment_method if payload else None
    if order.payment_method == "cashier":
        if tender not in TENDER_METHODS:
            raise HTTPException(status_code=400, detail="Pilih metode pembayaran pelanggan: cash, qris, atau transfer")
    elif tender is not None:
        raise HTTPException(status_code=400, detail="Metode pembayaran order ini sudah ditentukan saat checkout")

    active_shift = db.query(Shift).filter(Shift.cashier_id == current_user.id, Shift.status == "open").first()

    if not is_qris_already_paid and not active_shift:
        # Order pending biasa (cashier/transfer) wajib ada shift aktif
        raise HTTPException(status_code=400, detail="Shift belum dibuka (No active shift)")

    if order.status == "pending":
        order.status = "confirmed"
        # Tambah poin yang didapat (hanya untuk order yang sebelumnya pending,
        # bukan QRIS confirmed — poin QRIS sudah ditambahkan via Midtrans callback)
        if order.member_id and order.points_earned > 0:
            add_member_points(db, order.member_id, order.points_earned)

    if order.payment_method == "cashier":
        order.payment_method = tender

    # Assign kasir untuk pencatatan (berlaku untuk pending dan QRIS confirmed)
    order.cashier_id = current_user.id
    # Assign shift jika ada (QRIS acknowledge boleh tanpa shift)
    if active_shift:
        order.shift_id = active_shift.id

    db.commit()
    db.refresh(order)
    return order

# Alur status yang boleh lewat endpoint /status (alur dapur → serah terima).
# Pembatalan order yang sudah dibayar, void, dan refund WAJIB lewat endpoint
# /void atau /refund yang meminta PIN supervisor.
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"cancelled"},           # tolak self-order yang belum dibayar
    "confirmed": {"preparing", "ready", "paid"},
    "preparing": {"ready", "paid"},
    "ready": {"paid"},
}
KITCHEN_ALLOWED_TARGETS = {"preparing", "ready", "paid"}


@router.patch("/{id}/status", response_model=OrderResponse)
def update_order_status(id: int, status: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    lock_order(db, order_id=id)  # cegah dua proses mengubah status/poin bersamaan
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.member)
    ).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # H-2: cashier may only update orders assigned to them (except if cashier is not assigned yet, i.e. None, e.g. for self-orders)
    if current_user.role == "cashier" and order.cashier_id is not None and order.cashier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Tidak diizinkan mengubah order ini")
    if current_user.role == "kitchen" and status not in KITCHEN_ALLOWED_TARGETS:
        raise HTTPException(status_code=403, detail="Peran dapur hanya diizinkan memperbarui status ke preparing, ready, atau paid")

    old_status = order.status
    if status not in ALLOWED_STATUS_TRANSITIONS.get(old_status, set()):
        raise HTTPException(
            status_code=400,
            detail=f"Perubahan status '{old_status}' → '{status}' tidak diizinkan. "
                   "Gunakan fitur Void/Refund (dengan PIN supervisor) untuk membatalkan order yang sudah dibayar.",
        )
    # QRIS pending masih bisa dibayar pelanggan kapan saja; pembatalannya ditangani
    # oleh callback Midtrans (expire/cancel) agar uang tidak masuk ke order yang batal.
    if old_status == "pending" and order.payment_method == "qris":
        raise HTTPException(status_code=400, detail="Order QRIS yang belum dibayar akan dibatalkan otomatis oleh Midtrans saat kedaluwarsa")

    order.status = status

    # pending → cancelled: kembalikan poin yang sudah dipakai member
    if old_status == "pending" and status == "cancelled" and order.member_id:
        add_member_points(db, order.member_id, order.points_redeemed)

    db.add(OrderAuditLog(
        order_id=order.id,
        event="status_changed",
        cashier_id=current_user.id,
        details=f"Status {old_status} → {status} oleh {current_user.name} ({current_user.role})",
    ))

    # If the cashier is marking a self-order (e.g. QRIS) as "paid" (completed/handed over) and there's no cashier assigned yet,
    # assign this cashier and their open shift to this order so it is correctly recorded.
    if current_user.role == "cashier" and status == "paid" and not order.cashier_id:
        order.cashier_id = current_user.id
        active_shift = db.query(Shift).filter(Shift.cashier_id == current_user.id, Shift.status == "open").first()
        if active_shift:
            order.shift_id = active_shift.id
            
    db.commit()
    db.refresh(order)
    return order

@router.post("/{id}/void", response_model=OrderResponse)
@limiter.limit("5/minute")
def void_order(request: Request, id: int, payload: OrderVoidRequest, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    lock_order(db, order_id=id)  # cegah dua proses mengubah status/poin bersamaan
    order = db.query(Order).options(
        joinedload(Order.shift),
        joinedload(Order.refunds),
        joinedload(Order.member)
    ).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # Check supervisor PIN
    supervisor = find_supervisor_by_pin(db, payload.supervisor_pin)
    if not supervisor:
        raise HTTPException(status_code=401, detail="Supervisor PIN tidak valid")
        
    # Check exclusivity and status
    if order.status == "voided":
        raise HTTPException(status_code=400, detail="Order sudah divoid")
    if order.status in ("refunded", "partially_refunded") or len(order.refunds) > 0:
        raise HTTPException(status_code=400, detail="Order yang sudah direfund tidak dapat divoid")
    if order.shift and order.shift.status != "open":
        raise HTTPException(status_code=400, detail="Void hanya diizinkan sebelum shift ditutup")
        
    old_status = order.status
    order.status = "voided"
    
    # Handle points modification
    if order.member_id:
        PAID_STATUSES = {"confirmed", "preparing", "ready", "paid"}
        if old_status == "pending":
            add_member_points(db, order.member_id, order.points_redeemed)
        elif old_status in PAID_STATUSES:
            add_member_points(db, order.member_id, order.points_redeemed - order.points_earned)
            
    # Audit log
    log = OrderAuditLog(
        order_id=order.id,
        event="voided",
        cashier_id=current_user.id,
        supervisor_id=supervisor.id,
        details=f"Voided by supervisor {supervisor.name}. Alasan: {payload.reason_code}. Catatan: {payload.notes or ''}"
    )
    db.add(log)
    db.commit()
    db.refresh(order)
    return order

@router.post("/{id}/refund", response_model=OrderResponse)
@limiter.limit("5/minute")
def refund_order(request: Request, id: int, payload: OrderRefundRequest, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    lock_order(db, order_id=id)  # cegah dua proses mengubah status/poin bersamaan
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.refunds).joinedload(OrderRefund.items),
        joinedload(Order.member)
    ).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # Check supervisor PIN
    supervisor = find_supervisor_by_pin(db, payload.supervisor_pin)
    if not supervisor:
        raise HTTPException(status_code=401, detail="Supervisor PIN tidak valid")
        
    # Check exclusivity
    if order.status == "voided":
        raise HTTPException(status_code=400, detail="Order yang sudah divoid tidak dapat direfund")
    if order.status == "refunded":
        raise HTTPException(status_code=400, detail="Order sudah direfund penuh")
        
    # Process return items
    refund_items = []
    
    # Map item_id -> {"item": OrderItem, "remaining_qty": int}
    order_items_map = {}
    for item in order.items:
        already_refunded = 0
        for ref in order.refunds:
            for ref_item in ref.items:
                if ref_item.order_item_id == item.id:
                    already_refunded += ref_item.quantity
        order_items_map[item.id] = {
            "item": item,
            "remaining_qty": item.quantity - already_refunded
        }
        
    if not payload.items:
        # Full refund: refund all remaining quantities
        for item_id, details in order_items_map.items():
            oi = details["item"]
            rem = details["remaining_qty"]
            if rem > 0:
                refund_items.append((oi, rem))
    else:
        # Partial refund: validate item selections
        for req_item in payload.items:
            if req_item.order_item_id not in order_items_map:
                raise HTTPException(status_code=400, detail=f"Item ID {req_item.order_item_id} tidak ditemukan dalam order ini")
            details = order_items_map[req_item.order_item_id]
            if req_item.quantity <= 0:
                raise HTTPException(status_code=400, detail="Kuantitas refund harus lebih dari 0")
            if req_item.quantity > details["remaining_qty"]:
                raise HTTPException(status_code=400, detail=f"Kuantitas refund untuk {details['item'].product_name} melebihi kuantitas tersisa ({details['remaining_qty']})")
            refund_items.append((details["item"], req_item.quantity))
            
    if not refund_items:
        raise HTTPException(status_code=400, detail="Tidak ada item yang dapat direfund")
        
    # Pro-rated discount factor
    discount_ratio = (order.discount / order.subtotal) if order.subtotal > 0 else 0.0
    
    subtotal_refunded = 0.0
    
    # Generate refund number
    refund_number = f"REF-{order.order_number}-{int(datetime.now().timestamp())}"
    
    # Create the refund record
    new_refund = OrderRefund(
        order_id=order.id,
        refund_number=refund_number,
        cashier_id=current_user.id,
        supervisor_id=supervisor.id,
        refund_method=payload.refund_method,
        reason_code=payload.reason_code,
        notes=payload.notes,
        amount=0.0
    )
    db.add(new_refund)
    db.flush() # get new_refund.id
    
    for item, qty in refund_items:
        item_subtotal = item.unit_price * qty
        subtotal_refunded += item_subtotal
        
        # Pro-rated discount on items
        item_discount = item_subtotal * discount_ratio
        net_item_refund = item_subtotal - item_discount
        
        ri = OrderRefundItem(
            refund_id=new_refund.id,
            order_item_id=item.id,
            quantity=qty,
            unit_price=item.unit_price,
            subtotal=net_item_refund
        )
        db.add(ri)
        
    net_total_refunded = subtotal_refunded * (1.0 - discount_ratio)
    new_refund.amount = max(net_total_refunded, 0.0)
    
    # Determine final order status
    total_remaining_qty = 0
    for item_id, details in order_items_map.items():
        refunded_now = 0
        for item, qty in refund_items:
            if item.id == item_id:
                refunded_now = qty
        total_remaining_qty += (details["remaining_qty"] - refunded_now)
        
    if total_remaining_qty == 0:
        order.status = "refunded"
        # Refund points_redeemed and deduct points_earned
        if order.member_id:
            add_member_points(db, order.member_id, order.points_redeemed - order.points_earned)
    else:
        order.status = "partially_refunded"
        
    # Write timeline audit log
    log = OrderAuditLog(
        order_id=order.id,
        event="refunded",
        cashier_id=current_user.id,
        supervisor_id=supervisor.id,
        details=f"Refund {new_refund.refund_number} (Rp {new_refund.amount:,.0f}) by supervisor {supervisor.name}. Alasan: {payload.reason_code}"
    )
    db.add(log)
    db.commit()
    db.refresh(order)
    return order

