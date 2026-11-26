import logging
from typing import List, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
import math
from datetime import datetime
from typing import Optional
from app.models import Product, Modifier, ModifierGroup, Order, OrderItem, OrderItemModifier, OrderAuditLog, Promo
from app.utils.order import insert_order_with_number

class ValidationService:
    @staticmethod
    def validate_order_items(items, db: Session):
        # Import models inside to avoid circular reference issues if any
        from app.models import ProductModifierGroup
        
        # 1. Load active products with their associated groups
        product_ids = [item.product_id for item in items]
        products = {
            p.id: p for p in db.query(Product)
            .options(joinedload(Product.product_modifier_groups).joinedload(ProductModifierGroup.modifier_group))
            .filter(Product.id.in_(product_ids), Product.is_active == True)
            .all()
        }
        
        # 2. Extract selected modifier IDs in a single flat list
        modifier_ids = []
        for item in items:
            if item.modifier_ids:
                modifier_ids.extend(item.modifier_ids)
                
        # 3. Load all selected modifier records and their parent groups
        modifiers = {
            m.id: m for m in db.query(Modifier)
            .options(joinedload(Modifier.modifier_group))
            .filter(Modifier.id.in_(modifier_ids))
            .all()
        } if modifier_ids else {}

        # Validate each item
        for item in items:
            product = products.get(item.product_id)
            if not product:
                raise HTTPException(status_code=400, detail=f"Produk ID {item.product_id} tidak valid atau tidak aktif")
            
            # Map selected modifier IDs to loaded Modifier objects
            selected_mods = []
            for mid in (item.modifier_ids or []):
                m = modifiers.get(mid)
                if not m:
                    raise HTTPException(status_code=400, detail=f"Modifier ID {mid} tidak valid")
                selected_mods.append(m)
                
            # Check modifier statuses & out of stock
            for m in selected_mods:
                if m.status != "active":
                    raise HTTPException(status_code=400, detail=f"Modifier {m.name} tidak aktif")
                if m.is_out_of_stock:
                    raise HTTPException(status_code=400, detail=f"Modifier '{m.name}' sedang habis (out of stock)")
            
            # Group selected modifiers by their modifier_group_id
            mods_by_group = {}
            for m in selected_mods:
                mods_by_group.setdefault(m.modifier_group_id, []).append(m)
                
            # Verify they belong to modifier groups linked to this product
            linked_group_ids = {pmg.modifier_group_id for pmg in product.product_modifier_groups}
            
            for group_id, group_mods in mods_by_group.items():
                if group_id not in linked_group_ids:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Modifier group ID {group_id} tidak terkait dengan produk {product.name}"
                    )
            
            # Validate constraints for each group linked to the product
            for pmg in product.product_modifier_groups:
                group = pmg.modifier_group
                # If the group configuration is inactive, skip it (no selections allowed / validated)
                if group.status != "active":
                    if group.id in mods_by_group:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Modifier group '{group.name}' tidak aktif tetapi terdapat pilihan modifier"
                        )
                    continue
                
                selected_in_group = mods_by_group.get(group.id, [])
                count = len(selected_in_group)
                
                # Check required / selection counts
                if group.selection_type == "radio":
                    if group.required and count != 1:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Modifier group '{group.name}' wajib memilih 1 opsi"
                        )
                    if not group.required and count > 1:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Modifier group '{group.name}' hanya boleh memilih maksimal 1 opsi"
                        )
                elif group.selection_type == "checkbox":
                    if group.required and count < group.min_select:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Modifier group '{group.name}' memerlukan minimal {group.min_select} pilihan"
                        )
                    if count > group.max_select:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Modifier group '{group.name}' membolehkan maksimal {group.max_select} pilihan"
                        )

        return products, modifiers


class PricingService:
    @staticmethod
    def calculate_item_unit_price(base_price: float, modifiers: List[Modifier]) -> float:
        return base_price + sum(m.price_adjustment for m in modifiers)

    @staticmethod
    def calculate_order_totals(subtotal: float, discount: float) -> Tuple[float, float]:
        final_discount = max(discount, 0.0)
        total = max(subtotal - final_discount, 0.0)
        return final_discount, total


def _as_local_aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Datetime dari DB bisa naive (SQLite) atau aware (PostgreSQL); samakan ke aware."""
    if dt is None:
        return None
    return dt.astimezone() if dt.tzinfo is None else dt


class PromoService:
    @staticmethod
    def is_running(promo: Promo, now: Optional[datetime] = None) -> bool:
        now = now or datetime.now().astimezone()
        if not promo.is_active:
            return False
        starts, ends = _as_local_aware(promo.starts_at), _as_local_aware(promo.ends_at)
        if starts and now < starts:
            return False
        if ends and now > ends:
            return False
        return True

    @staticmethod
    def calculate_discount(promo: Promo, subtotal: float, enforce_schedule: bool = True) -> float:
        """Hitung diskon Rp dari promo. HTTP 400 jika promo tidak berlaku untuk order ini."""
        if enforce_schedule and not PromoService.is_running(promo):
            raise HTTPException(status_code=400, detail=f"Promo '{promo.name}' sedang tidak berlaku")
        if subtotal < (promo.min_purchase or 0):
            raise HTTPException(
                status_code=400,
                detail=f"Promo '{promo.name}' butuh minimal belanja Rp {promo.min_purchase:,.0f}",
            )
        if promo.discount_type == "percent":
            discount = subtotal * promo.value / 100.0
            if promo.max_discount:
                discount = min(discount, promo.max_discount)
        else:
            discount = promo.value
        # Pembulatan setengah ke atas, sama dengan Math.round di POS (utils/promo.js)
        return float(math.floor(min(discount, subtotal) + 0.5))


class OrderService:
    @staticmethod
    def create_order(data, cashier_id: int, shift_id: int, db: Session, enforce_promo_schedule: bool = True) -> Order:
        # 0. Diskon hanya lewat promo yang diatur Owner / tim Promo
        if data.discount and data.discount > 0:
            raise HTTPException(
                status_code=400,
                detail="Diskon manual tidak diizinkan. Pilih promo yang sudah diatur Owner atau tim Promo.",
            )
        promo = None
        if data.promo_id is not None:
            promo = db.query(Promo).filter(Promo.id == data.promo_id).first()
            if not promo:
                raise HTTPException(status_code=400, detail="Promo tidak ditemukan")

        # 1. Validation
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
            
        # Calculate final totals (diskon dihitung server dari promo, bukan dari klien)
        promo_discount = PromoService.calculate_discount(promo, subtotal, enforce_promo_schedule) if promo else 0.0
        discount, total = PricingService.calculate_order_totals(subtotal, promo_discount)
        
        # Create Order object
        order = Order(
            cashier_id=cashier_id,
            shift_id=shift_id,
            order_type=data.order_type,
            payment_method=data.payment_method,
            customer_name=data.customer_name,
            notes=data.notes,
            subtotal=subtotal,
            discount=discount,
            total=total,
            status="paid",
            promo_id=promo.id if promo else None,
            promo_name=promo.name if promo else None,
        )
        
        # Nomor order unik; bentrok karena order bersamaan → coba nomor berikutnya
        insert_order_with_number(db, order)
                    
        # Save order items and modifier snapshots
        for oi in order_items:
            oi.order_id = order.id
            db.add(oi)
            
        db.flush()
        
        # Audit logging
        log_created = OrderAuditLog(
            order_id=order.id,
            event="created",
            cashier_id=cashier_id,
            details=f"Order created with type: {order.order_type.upper().replace('_', ' ')}"
                    + (f". Promo: {promo.name} (−Rp {discount:,.0f})" if promo else "")
        )
        log_paid = OrderAuditLog(
            order_id=order.id,
            event="payment_success",
            cashier_id=cashier_id,
            details=f"Payment success via {order.payment_method.upper()}. Total: Rp {order.total:,.0f}"
        )
        db.add(log_created)
        db.add(log_paid)
        
        db.commit()
        db.refresh(order)
        return order


logger = logging.getLogger("kopipos.midtrans")
MIDTRANS_PUBLIC_ERROR = "Pembayaran QRIS sedang tidak dapat diproses. Silakan coba lagi atau pilih Bayar di Kasir."


class MidtransService:
    @staticmethod
    def get_headers() -> dict:
        import base64
        from app.config import settings
        if not settings.MIDTRANS_SERVER_KEY or settings.MIDTRANS_SERVER_KEY.startswith("SB-Mid-server-YOUR_"):
            logger.error("MIDTRANS_SERVER_KEY belum diisi di .env — pembayaran QRIS online tidak bisa dipakai")
            raise HTTPException(status_code=400, detail="Pembayaran QRIS online belum tersedia. Silakan pilih Bayar di Kasir.")
        
        auth_string = f"{settings.MIDTRANS_SERVER_KEY}:"
        auth_base64 = base64.b64encode(auth_string.encode("utf-8")).decode("utf-8")
        
        return {
            "Authorization": f"Basic {auth_base64}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    @staticmethod
    def create_transaction(
        order_id: str,
        gross_amount: float,
        customer_details: dict = None,
        item_details: list = None
    ) -> dict:
        import httpx
        from app.config import settings
        url = "https://app.midtrans.com/snap/v1/transactions" if settings.MIDTRANS_IS_PRODUCTION else "https://app.sandbox.midtrans.com/snap/v1/transactions"
        
        payload = {
            "transaction_details": {
                "order_id": order_id,
                "gross_amount": int(gross_amount)
            },
            "credit_card": {
                "secure": True
            }
        }
        if customer_details:
            payload["customer_details"] = customer_details
        if item_details:
            payload["item_details"] = item_details
            
        headers = MidtransService.get_headers()
        
        # Detail error Midtrans (bisa memuat info akun/merchant) hanya dicatat di
        # log server; pelanggan cukup mendapat pesan umum.
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as e:
            logger.error("Midtrans tidak dapat dihubungi untuk order %s: %r", order_id, e)
            raise HTTPException(status_code=502, detail=MIDTRANS_PUBLIC_ERROR)
        if response.status_code != 201:
            logger.error("Midtrans menolak transaksi order %s (HTTP %s): %s",
                         order_id, response.status_code, response.text[:1000])
            raise HTTPException(status_code=502, detail=MIDTRANS_PUBLIC_ERROR)
        return response.json()
