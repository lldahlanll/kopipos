from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Order, OrderItem, Product, Modifier, User, Shift, OrderAuditLog, OrderRefund, OrderRefundItem, IdempotencyKey
from app.schemas.order import OrderCreate, OrderResponse, OrderListResponse, OrderVoidRequest, OrderRefundRequest, BulkReviewRequest
from app.utils.auth import get_current_user, require_pos_access, require_owner
from app.limiter import limiter
from app.services import OrderService

router = APIRouter(prefix="/api/orders", tags=["Orders"])

from app.utils.order import gen_order_num as _gen_order_num


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
        cutoff = datetime.utcnow() - timedelta(minutes=5)
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
        q = q.filter(Order.cashier_id == current_user.id)
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
    """Ambil order self-order yang belum dikonfirmasi kasir."""
    return db.query(Order).filter(Order.status == "pending", Order.source == "self_order").order_by(Order.created_at.asc()).all()

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

@router.patch("/{id}/confirm", response_model=OrderResponse)
def confirm_order(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == id, Order.status == "pending").first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan atau sudah diproses")
    
    active_shift = db.query(Shift).filter(Shift.cashier_id == current_user.id, Shift.status == "open").first()
    if not active_shift:
        raise HTTPException(status_code=400, detail="Shift belum dibuka (No active shift)")

    order.status = "confirmed"
    order.cashier_id = current_user.id
    order.shift_id = active_shift.id
    db.commit()
    db.refresh(order)
    return order

@router.patch("/{id}/status", response_model=OrderResponse)
def update_order_status(id: int, status: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    valid_statuses = {"confirmed", "preparing", "ready", "paid", "cancelled", "voided", "refunded", "partially_refunded"}
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Status tidak valid")
    
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # H-2: cashier may only update orders assigned to them
    if current_user.role == "cashier" and order.cashier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Tidak diizinkan mengubah order ini")
    if current_user.role == "kitchen" and status not in {"preparing", "ready", "paid"}:
        raise HTTPException(status_code=403, detail="Peran dapur hanya diizinkan memperbarui status ke preparing, ready, atau paid")
    
    order.status = status
    db.commit()
    db.refresh(order)
    return order

@router.post("/{id}/void", response_model=OrderResponse)
def void_order(id: int, payload: OrderVoidRequest, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    order = db.query(Order).options(
        joinedload(Order.shift),
        joinedload(Order.refunds)
    ).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    
    # Check supervisor PIN
    supervisor = db.query(User).filter(User.role.in_(["owner", "supervisor"]), User.pin == payload.supervisor_pin).first()
    if not supervisor:
        raise HTTPException(status_code=401, detail="Supervisor PIN tidak valid")
        
    # Check exclusivity and status
    if order.status == "voided":
        raise HTTPException(status_code=400, detail="Order sudah divoid")
    if order.status in ("refunded", "partially_refunded") or len(order.refunds) > 0:
        raise HTTPException(status_code=400, detail="Order yang sudah direfund tidak dapat divoid")
    if order.shift and order.shift.status != "open":
        raise HTTPException(status_code=400, detail="Void hanya diizinkan sebelum shift ditutup")
        
    order.status = "voided"
    
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
def refund_order(id: int, payload: OrderRefundRequest, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    order = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.refunds).joinedload(OrderRefund.items)
    ).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
        
    # Check supervisor PIN
    supervisor = db.query(User).filter(User.role.in_(["owner", "supervisor"]), User.pin == payload.supervisor_pin).first()
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

