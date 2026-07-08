from typing import List, Tuple
from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.models import Product, Modifier, ModifierGroup, Order, OrderItem, OrderItemModifier, OrderAuditLog
from app.utils.order import gen_order_num as _gen_order_num

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


class OrderService:
    @staticmethod
    def create_order(data, cashier_id: int, shift_id: int, db: Session) -> Order:
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
            
        # Calculate final totals
        discount, total = PricingService.calculate_order_totals(subtotal, data.discount or 0.0)
        
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
            status="paid"
        )
        
        # Retry logic for concurrent duplicate order_number
        for attempt in range(5):
            order.order_number = _gen_order_num(db)
            db.add(order)
            try:
                db.flush()
                break
            except IntegrityError:
                db.rollback()
                if attempt == 4:
                    raise HTTPException(status_code=500, detail="Gagal membuat nomor order, coba lagi")
                    
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


class MidtransService:
    @staticmethod
    def get_headers() -> dict:
        import base64
        from app.config import settings
        if not settings.MIDTRANS_SERVER_KEY or settings.MIDTRANS_SERVER_KEY.startswith("SB-Mid-server-YOUR_"):
            raise HTTPException(status_code=400, detail="Metode pembayaran QRIS online belum dapat digunakan karena kunci server Midtrans (MIDTRANS_SERVER_KEY) belum dikonfigurasi di file .env")
        
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
        
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload, headers=headers)
            if response.status_code != 201:
                detail_msg = f"Midtrans API Error ({response.status_code}): {response.text}"
                raise HTTPException(status_code=502, detail=detail_msg)
            return response.json()
