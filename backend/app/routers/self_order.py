import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional
import time
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func
from app.database import get_db
from app.models import Product, Category, Modifier, Member, Order, OrderItem, OrderItemModifier, Shift, ProductModifierGroup, ModifierGroup, Setting, IdempotencyKey
from app.schemas.order import LastOrderItems, OrderItemCreate, OrderStatusResponse, SelfOrderCreate
from app.utils.auth import get_current_member
from app.limiter import limiter
from app.services import BannerService, PromoService, ValidationService, PricingService, MIDTRANS_PUBLIC_ERROR
from app.utils.order import add_member_points, insert_order_with_number, lock_order, redeem_member_points

router = APIRouter(prefix="/api/public", tags=["Public"])

@router.get("/store-info")
def get_store_info(db: Session = Depends(get_db)):
    settings_records = db.query(Setting).filter(Setting.key.in_(["store_name", "store_logo", "theme_color"])).all()
    from app.config import settings as app_settings
    result = {
        "store_name": "KopiPOS Coffee Shop",
        "store_logo": "",
        "theme_color": "#c8a27a",
        "midtrans_client_key": app_settings.MIDTRANS_CLIENT_KEY or "",
        "midtrans_is_production": app_settings.MIDTRANS_IS_PRODUCTION
    }
    for s in settings_records:
        result[s.key] = s.value
    return result

@router.get("/menu")
def get_public_menu(db: Session = Depends(get_db)):
    products = db.query(Product).options(
        selectinload(Product.product_modifier_groups).selectinload(ProductModifierGroup.modifier_group).selectinload(ModifierGroup.modifiers)
    ).filter(Product.is_active == True).all()
    
    active_cat_ids = {p.category_id for p in products if p.category_id is not None}
    categories = db.query(Category).filter(Category.is_active == True, Category.id.in_(active_cat_ids)).order_by(Category.sort_order.asc(), Category.name.asc()).all()
    modifiers = db.query(Modifier).filter(Modifier.status == "active").all()
    
    # Calculate bestsellers automatically
    now_ts = time.time()
    if now_ts > _bestseller_cache["expires_at"]:
        cutoff = datetime.now() - timedelta(days=30)
        top_items = (
            db.query(OrderItem.product_id, func.sum(OrderItem.quantity).label("total_qty"))
            .join(Order, Order.id == OrderItem.order_id)
            .filter(Order.status == "paid", Order.created_at >= cutoff)
            .group_by(OrderItem.product_id)
            .order_by(func.sum(OrderItem.quantity).desc())
            .limit(6)
            .all()
        )
        _bestseller_cache["ids"] = {r.product_id for r in top_items if r.total_qty > 0}
        _bestseller_cache["expires_at"] = now_ts + 900

    bestseller_ids = _bestseller_cache["ids"]

    if bestseller_ids:
        for p in products:
            p.is_bestseller = (p.id in bestseller_ids)
    
    mapped_products = []
    for p in products:
        variants = []
        p_modifiers = []
        
        pmgs = sorted(p.product_modifier_groups, key=lambda x: x.sort_order)
        size_group = None
        for pmg in pmgs:
            g = pmg.modifier_group
            if g.status != "active":
                continue
            g_name_lower = g.name.lower()
            if "size" in g_name_lower or "ukuran" in g_name_lower:
                size_group = g
                break
                
        if not size_group:
            for pmg in pmgs:
                g = pmg.modifier_group
                if g.status != "active":
                    continue
                if g.required and g.selection_type == "radio":
                    size_group = g
                    break
                    
        prod_groups = []
        for pmg in pmgs:
            g = pmg.modifier_group
            if g.status != "active":
                continue
            
            group_mods = [m for m in g.modifiers if m.status == "active"]
            if g == size_group:
                variants.extend(group_mods)
            else:
                p_modifiers.extend(group_mods)

            prod_groups.append({
                "id": g.id,
                "name": g.name,
                "selection_type": g.selection_type,
                "required": g.required,
                "min_select": g.min_select,
                "max_select": g.max_select,
                "sort_order": pmg.sort_order,
                "modifiers": [
                    {
                        "id": m.id,
                        "modifier_group_id": m.modifier_group_id,
                        "name": m.name,
                        "price_adjustment": m.price_adjustment,
                        "sort_order": m.sort_order,
                        "status": m.status,
                        "is_out_of_stock": m.is_out_of_stock,
                        "is_active": m.status == "active",
                    }
                    for m in sorted(group_mods, key=lambda x: x.sort_order)
                ]
            })
        
        mapped_products.append({
            "id": p.id,
            "category_id": p.category_id,
            "name": p.name,
            "description": p.description,
            "base_price": p.base_price,
            "sort_order": p.sort_order,
            "image_url": p.image_url,
            "is_active": p.is_active,
            "is_recommended": p.is_recommended,
            "is_bestseller": getattr(p, "is_bestseller", False),
            "is_favorite": p.is_favorite,
            "modifier_groups": prod_groups,
            "variants": [
                {
                    "id": m.id,
                    "modifier_group_id": m.modifier_group_id,
                    "name": m.name,
                    "price_adjustment": m.price_adjustment,
                    "sort_order": m.sort_order,
                    "status": m.status,
                    "is_out_of_stock": m.is_out_of_stock,
                    "is_active": m.status == "active",
                }
                for m in variants
            ],
            "modifiers": [
                {
                    "id": m.id,
                    "modifier_group_id": m.modifier_group_id,
                    "name": m.name,
                    "price_adjustment": m.price_adjustment,
                    "sort_order": m.sort_order,
                    "status": m.status,
                    "is_out_of_stock": m.is_out_of_stock,
                    "is_active": m.status == "active",
                }
                for m in p_modifiers
            ],
            "created_at": p.created_at,
            "updated_at": p.updated_at
        })
    
    return {
        "categories": categories,
        "products": mapped_products,
        "modifiers": modifiers
    }

_bestseller_cache = {
    "ids": set(),
    "expires_at": 0
}

@router.post("/orders", response_model=OrderStatusResponse, status_code=201)
@limiter.limit("20/minute")
def create_self_order(
    request: Request, 
    data: SelfOrderCreate, 
    db: Session = Depends(get_db),
    current_member: Member = Depends(get_current_member)
):
    if not data.items:
        raise HTTPException(status_code=400, detail="Order harus memiliki minimal 1 item")
    if data.order_type not in ("dine_in", "takeaway"):
        raise HTTPException(status_code=400, detail="Order type invalid")

    # ── Idempotency Check: cegah double order saat jaringan lemah ──
    idempotency_key = request.headers.get("X-Idempotency-Key")
    actor_id = f"member_{current_member.id}"
    if idempotency_key:
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
            order = db.query(Order).filter(
                Order.id == existing.order_id,
                Order.source == "self_order"
            ).first()
            if order:
                return order  # kembalikan order yang sudah dibuat sebelumnya

    # Pre-process items: copy variant_id into modifier_ids list
    for item in data.items:
        if item.variant_id:
            if not item.modifier_ids:
                item.modifier_ids = []
            if item.variant_id not in item.modifier_ids:
                item.modifier_ids.append(item.variant_id)

    # 1. Validation using Service Layer
    products, modifiers = ValidationService.validate_order_items(data.items, db)

    # 2. Build order items & snapshots
    order_items = []
    subtotal = 0.0

    for item in data.items:
        product = products.get(item.product_id)
        selected_mods = [modifiers.get(mid) for mid in (item.modifier_ids or [])]
        
        # Calculate unit price
        unit_price = PricingService.calculate_item_unit_price(product.base_price, selected_mods)
        item_subtotal = unit_price * item.quantity
        subtotal += item_subtotal
        
        # Form modifier names string for backward compatibility with print/reports
        mod_names_str = ", ".join(m.name for m in selected_mods) if selected_mods else None
        
        # Create OrderItem object
        oi = OrderItem(
            product_id=product.id,
            product_name=product.name,
            base_price=product.base_price,
            quantity=item.quantity,
            unit_price=unit_price,
            variant_name=None, # Deprecated
            modifier_names=mod_names_str, # Backward compatibility
            subtotal=item_subtotal
        )
        
        # Create snapshots for OrderItemModifier
        for m in selected_mods:
            group_name = m.modifier_group.name if m.modifier_group else "Pilihan"
            oi.modifiers.append(OrderItemModifier(
                modifier_group_name=group_name,
                modifier_name=m.name,
                price_adjustment=m.price_adjustment
            ))
        order_items.append(oi)

    # Potongan: promo dari banner ATAU tukar poin, tidak bisa keduanya
    discount_val = 0.0
    redeem_points_actual = 0
    promo = None
    if data.promo_id is not None:
        if data.redeem_points and data.redeem_points > 0:
            raise HTTPException(status_code=400, detail="Pilih salah satu: promo atau tukar poin")
        promo = BannerService.self_order_promo(db, data.promo_id)
        discount_val = PromoService.calculate_discount(promo, subtotal)
    elif data.redeem_points and data.redeem_points > 0:
        if current_member.points < data.redeem_points:
            raise HTTPException(status_code=400, detail="Saldo poin tidak mencukupi")
        
        discount_val = float(data.redeem_points * 500)
        if discount_val > subtotal:
            discount_val = subtotal
            redeem_points_actual = int(subtotal // 500)
        else:
            redeem_points_actual = data.redeem_points

    final_total = max(subtotal - discount_val, 0.0)

    earned_points = int(final_total // 10000)

    order = Order(
        order_type=data.order_type,
        payment_method=data.payment_method,
        customer_name=current_member.name,
        notes=data.notes,
        source="self_order",
        status="pending",
        subtotal=subtotal,
        discount=discount_val,
        total=final_total,
        member_id=current_member.id,
        points_redeemed=redeem_points_actual,
        points_earned=earned_points,
        promo_id=promo.id if promo else None,
        promo_name=promo.name if promo else None,
    )
    # Nomor order dibuat dulu (retry-nya me-rollback session), baru poin dipotong.
    insert_order_with_number(db, order)

    # Potong poin yang ditukar sekarang (ditahan sampai order selesai/batal), tapi
    # poin yang didapat baru ditambahkan setelah dibayar. Atomik: dua order
    # bersamaan tidak bisa memakai saldo poin yang sama.
    if redeem_points_actual and not redeem_member_points(db, current_member.id, redeem_points_actual):
        db.rollback()
        raise HTTPException(status_code=400, detail="Saldo poin tidak mencukupi")

    for oi in order_items:
        oi.order_id = order.id
        db.add(oi)

    if data.payment_method == "qris":
        from app.services import MidtransService
        try:
            # Build customer details
            customer_details = {
                "first_name": current_member.name or "Pelanggan Self Order",
                "phone": current_member.phone or ""
            }
            
            # Build item details
            item_details = []
            for oi in order_items:
                name = oi.product_name
                if oi.modifier_names:
                    name += f" ({oi.modifier_names})"
                
                # Truncate item name to 50 characters to prevent Midtrans validation error
                if len(name) > 50:
                    name = name[:47] + "..."
                    
                item_details.append({
                    "id": f"prod-{oi.product_id}",
                    "price": int(oi.unit_price),
                    "quantity": oi.quantity,
                    "name": name
                })
            
            # Add discount as a negative price item to keep totals matching
            if discount_val > 0:
                item_details.append({
                    "id": "discount",
                    "price": -int(discount_val),
                    "quantity": 1,
                    "name": (f"Promo {promo.name}" if promo else "Diskon Poin")[:50]
                })
                
            snap_res = MidtransService.create_transaction(
                order_id=order.order_number,
                gross_amount=order.total,
                customer_details=customer_details,
                item_details=item_details
            )
            order.payment_token = snap_res.get("token")
            order.payment_url = snap_res.get("redirect_url")
        except HTTPException as he:
            db.rollback()
            raise he
        except Exception:
            db.rollback()
            logging.getLogger("kopipos.midtrans").exception("Gagal membuat transaksi Midtrans untuk order %s", order.order_number)
            raise HTTPException(status_code=502, detail=MIDTRANS_PUBLIC_ERROR)

    db.commit()
    db.refresh(order)

    # Simpan idempotency key setelah order berhasil di-commit
    if idempotency_key:
        try:
            idem = IdempotencyKey(key=idempotency_key, actor_id=actor_id, order_id=order.id)
            db.add(idem)
            db.commit()
        except Exception:
            db.rollback()  # jangan gagalkan order hanya karena key sudah ada

    return order

@router.get("/orders/{id}/status", response_model=OrderStatusResponse)
def get_self_order_status(id: int, db: Session = Depends(get_db), current_member: Member = Depends(get_current_member)):
    # Hanya pemilik pesanan yang boleh melihat statusnya (berisi nama, total,
    # dan link pembayaran). Pesanan member lain dijawab 404 — sama dengan id
    # yang tidak ada — agar id yang berurutan tidak bisa ditebak satu per satu.
    order = db.query(Order).filter(
        Order.id == id,
        Order.source == "self_order",
        Order.member_id == current_member.id,
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return order

@router.get("/orders/last-items", response_model=LastOrderItems)
def get_last_order_items(db: Session = Depends(get_db), current_member: Member = Depends(get_current_member)):
    """Item dari pesanan terakhir yang tidak batal, untuk "Pesan lagi" di menu."""
    order = (
        db.query(Order)
        .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
        .filter(Order.member_id == current_member.id, Order.status != "cancelled")
        .order_by(Order.created_at.desc(), Order.id.desc())
        .first()
    )
    if not order:
        return LastOrderItems()
    return LastOrderItems(ordered_at=order.created_at, items=order.items[:3])

@router.get("/orders", response_model=List[OrderStatusResponse])
def get_member_orders(db: Session = Depends(get_db), current_member: Member = Depends(get_current_member)):
    # Hanya tampilkan pesanan hari ini agar tidak menumpuk
    # Menggunakan zona waktu Jakarta (UTC+7) agar konsisten dengan hari lokal
    from datetime import timezone, timedelta
    tz_jakarta = timezone(timedelta(hours=7))
    today_start = datetime.now(tz_jakarta).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(Order).filter(
        Order.member_id == current_member.id,
        Order.created_at >= today_start
    ).order_by(Order.created_at.desc()).all()


@router.post("/payments/midtrans-callback")
def midtrans_callback(payload: dict, db: Session = Depends(get_db)):
    from app.config import settings
    from app.models import OrderAuditLog
    import hashlib
    import hmac
    
    order_id = payload.get("order_id")
    status_code = payload.get("status_code")
    gross_amount = payload.get("gross_amount")
    signature_key = payload.get("signature_key")
    transaction_status = payload.get("transaction_status")
    
    if not all([order_id, status_code, gross_amount, signature_key]):
        raise HTTPException(status_code=400, detail="Payload tidak valid")
        
    server_key = settings.MIDTRANS_SERVER_KEY or ""
    raw_str = f"{order_id}{status_code}{gross_amount}{server_key}"
    calculated_sig = hashlib.sha512(raw_str.encode("utf-8")).hexdigest()
    
    # Perbandingan waktu-konstan agar signature tidak bisa ditebak lewat selisih waktu respons
    if not hmac.compare_digest(calculated_sig, str(signature_key)):
        raise HTTPException(status_code=403, detail="Tanda tangan tidak sah (Signature invalid)")
        
    # Midtrans bisa mengirim notifikasi yang sama lebih dari sekali, bahkan bersamaan
    lock_order(db, order_number=order_id)
    order = db.query(Order).filter(Order.order_number == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
        
    if transaction_status in ("settlement", "capture"):
        if order.status == "pending":
            order.status = "confirmed"
            # Add earned points to member
            if order.member_id and order.points_earned > 0:
                add_member_points(db, order.member_id, order.points_earned)
            log_paid = OrderAuditLog(
                order_id=order.id,
                event="payment_success",
                details=f"Pembayaran Midtrans berhasil via {payload.get('payment_type', 'online')}. Status: {transaction_status}"
            )
            db.add(log_paid)
    elif transaction_status in ("deny", "expire", "cancel"):
        if order.status == "pending":
            order.status = "cancelled"
            # Refund redeemed points back to member
            if order.member_id and order.points_redeemed > 0:
                add_member_points(db, order.member_id, order.points_redeemed)
            log_failed = OrderAuditLog(
                order_id=order.id,
                event="payment_failed",
                details=f"Pembayaran Midtrans gagal/dibatalkan. Status: {transaction_status}"
            )
            db.add(log_failed)
            
    db.commit()
    return {"status": "success", "message": "Callback processed"}
