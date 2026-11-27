from sqlalchemy import Table, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="cashier")
    # Hash bcrypt dari PIN supervisor 4 digit (lihat utils/auth.find_supervisor_by_pin)
    pin = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    products = relationship("Product", back_populates="category", order_by="Product.sort_order")


class ProductModifierGroup(Base):
    __tablename__ = "product_modifier_groups"
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    modifier_group_id = Column(Integer, ForeignKey("modifier_groups.id", ondelete="CASCADE"), primary_key=True)
    sort_order = Column(Integer, default=0, nullable=False)

    product = relationship("Product", back_populates="product_modifier_groups")
    modifier_group = relationship("ModifierGroup", back_populates="product_modifier_groups")


class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Float, nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    is_recommended = Column(Boolean, default=False)
    is_bestseller = Column(Boolean, default=False)
    is_favorite = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    category = relationship("Category", back_populates="products")
    product_modifier_groups = relationship(
        "ProductModifierGroup",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductModifierGroup.sort_order"
    )

    @property
    def modifier_groups(self):
        return [pmg.modifier_group for pmg in self.product_modifier_groups]



class ModifierGroup(Base):
    __tablename__ = "modifier_groups"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    selection_type = Column(String(20), nullable=False, default="radio")  # "radio" or "checkbox"
    required = Column(Boolean, default=False)
    min_select = Column(Integer, default=0)
    max_select = Column(Integer, default=1)
    sort_order = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="active")  # "active" or "inactive"
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    modifiers = relationship(
        "Modifier",
        back_populates="modifier_group",
        cascade="all, delete-orphan",
        order_by="Modifier.sort_order"
    )
    product_modifier_groups = relationship(
        "ProductModifierGroup",
        back_populates="modifier_group",
        cascade="all, delete-orphan"
    )

    @property
    def is_active(self) -> bool:
        return self.status == "active"


class Modifier(Base):
    __tablename__ = "modifiers"
    id = Column(Integer, primary_key=True, index=True)
    modifier_group_id = Column(Integer, ForeignKey("modifier_groups.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    price_adjustment = Column(Float, default=0.0)
    sort_order = Column(Integer, default=0, nullable=False)
    status = Column(String(20), default="active")  # "active" or "inactive"
    is_out_of_stock = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    modifier_group = relationship("ModifierGroup", back_populates="modifiers")

    @property
    def is_active(self) -> bool:
        return self.status == "active"




class Member(Base):
    __tablename__ = "members"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)
    points = Column(Integer, default=0)
    password_hash = Column(String(255), nullable=False)
    # Penguncian login setelah PIN salah berturut-turut (lihat routers/member.py)
    failed_login_attempts = Column(Integer, nullable=False, default=0, server_default="0")
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Shift(Base):
    __tablename__ = "shifts"
    id = Column(Integer, primary_key=True, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    opening_balance = Column(Float, nullable=False, default=0.0)
    closing_expected = Column(Float, nullable=True)
    closing_actual = Column(Float, nullable=True)
    status = Column(String(20), default="open")
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    cashier = relationship("User")
    orders = relationship("Order", back_populates="shift")
    expenses = relationship("ShiftExpense", back_populates="shift", cascade="all, delete-orphan")

    # Status order yang uangnya sudah diterima kasir. Refund dikurangi terpisah
    # lewat cash_refunds (uang keluar dari laci saat refund dilakukan).
    CASH_COLLECTED_STATUSES = ("confirmed", "preparing", "ready", "paid", "partially_refunded", "refunded")

    @property
    def cash_sales(self) -> float:
        """Total order tunai yang dibayar selama shift ini (sebelum refund)."""
        return sum(
            o.total for o in self.orders
            if o.payment_method == "cash" and o.status in self.CASH_COLLECTED_STATUSES
        )

    @property
    def cash_refunds(self) -> float:
        """Refund tunai yang dikeluarkan kasir shift ini selama shift berjalan."""
        from sqlalchemy.orm import object_session
        session = object_session(self)
        if session is None or self.started_at is None:
            return 0.0
        q = session.query(func.coalesce(func.sum(OrderRefund.amount), 0.0)).filter(
            OrderRefund.refund_method == "cash",
            OrderRefund.cashier_id == self.cashier_id,
            OrderRefund.created_at >= self.started_at,
        )
        if self.ended_at is not None:
            q = q.filter(OrderRefund.created_at <= self.ended_at)
        return float(q.scalar() or 0.0)

    @property
    def total_expenses(self) -> float:
        return sum(e.amount for e in self.expenses)

    @property
    def expected_cash(self) -> float:
        """Uang yang seharusnya ada di laci: modal + penjualan tunai − refund tunai − pengeluaran."""
        return self.opening_balance + self.cash_sales - self.cash_refunds - self.total_expenses

class Promo(Base):
    """Promo/diskon yang diatur Owner atau tim Promo; kasir hanya bisa memilihnya."""
    __tablename__ = "promos"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    discount_type = Column(String(10), nullable=False)  # "percent" | "nominal"
    value = Column(Float, nullable=False)                # persen (1–100) atau Rupiah
    max_discount = Column(Float, nullable=True)          # batas Rp untuk diskon persen
    min_purchase = Column(Float, nullable=False, default=0.0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Banner(Base):
    """Banner di halaman self-order pelanggan.

    kind="promo"   → mengiklankan promo toko; mengetuknya memasang promo di keranjang.
                     Promo hanya bisa dipakai pelanggan di self-order jika punya
                     banner promo yang sedang tayang.
    kind="partner" → iklan pihak lain (ditandai "Disponsori"), boleh punya tautan keluar.
    """
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    kind = Column(String(10), nullable=False)              # "promo" | "partner"
    title = Column(String(80), nullable=False)
    subtitle = Column(String(160), nullable=True)
    sponsor_name = Column(String(80), nullable=True)       # untuk banner partner
    image_url = Column(String(255), nullable=True)
    link_url = Column(String(500), nullable=True)          # untuk banner partner (http/https)
    promo_id = Column(Integer, ForeignKey("promos.id", ondelete="CASCADE"), nullable=True)
    placement = Column(String(10), nullable=False, default="menu")  # "menu" | "status" | "both"
    sort_order = Column(Integer, nullable=False, default=0)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    promo = relationship("Promo")


class ShiftExpense(Base):
    __tablename__ = "shift_expenses"
    id = Column(Integer, primary_key=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    shift = relationship("Shift", back_populates="expenses")


class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    shift_id = Column(Integer, ForeignKey("shifts.id"), nullable=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=True, index=True)
    order_type = Column(String(20), nullable=False)
    payment_method = Column(String(20), nullable=False)
    subtotal = Column(Float, nullable=False)
    discount = Column(Float, default=0)
    total = Column(Float, nullable=False)
    status = Column(String(20), default="paid", index=True)
    source = Column(String(20), default="cashier")  # "cashier" | "self_order"
    customer_name = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_reviewed = Column(Boolean, default=False)
    payment_token = Column(String(100), nullable=True)
    payment_url = Column(String(255), nullable=True)
    points_redeemed = Column(Integer, default=0, nullable=False)
    points_earned = Column(Integer, default=0, nullable=False)
    # Promo yang dipakai (diskon POS hanya boleh lewat promo). promo_name = snapshot
    # nama saat transaksi, agar riwayat tetap benar meski promo diubah/dihapus.
    promo_id = Column(Integer, ForeignKey("promos.id", ondelete="SET NULL"), nullable=True)
    promo_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    cashier = relationship("User", foreign_keys=[cashier_id])
    shift = relationship("Shift", back_populates="orders")
    member = relationship("Member")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    audit_logs = relationship("OrderAuditLog", back_populates="order", cascade="all, delete-orphan")
    refunds = relationship("OrderRefund", back_populates="order", cascade="all, delete-orphan")

    @property
    def cashier_name(self):
        return self.cashier.name if self.cashier else None

    @property
    def shift_number(self):
        if not self.shift:
            return None
        date_str = self.shift.started_at.strftime("%Y%m%d") if self.shift.started_at else ""
        return f"SFT-{date_str}-{self.shift.id:02d}"

    @property
    def shift_started_at(self):
        return self.shift.started_at if self.shift else None

    @property
    def shift_ended_at(self):
        return self.shift.ended_at if self.shift else None

    @property
    def refunded_amount(self):
        return sum(r.amount for r in self.refunds)

    @property
    def net_total(self):
        return max(self.total - self.refunded_amount, 0.0)


class OrderItem(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_name = Column(String(100), nullable=False)
    base_price = Column(Float, nullable=False, default=0.0)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    variant_name = Column(String(100), nullable=True)
    modifier_names = Column(String(255), nullable=True)
    subtotal = Column(Float, nullable=False)
    
    order = relationship("Order", back_populates="items")
    modifiers = relationship("OrderItemModifier", back_populates="order_item", cascade="all, delete-orphan")


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifiers"
    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id", ondelete="CASCADE"), nullable=False)
    modifier_group_name = Column(String(100), nullable=False)
    modifier_name = Column(String(100), nullable=False)
    price_adjustment = Column(Float, nullable=False, default=0.0)

    order_item = relationship("OrderItem", back_populates="modifiers")



class Setting(Base):
    __tablename__ = "settings"
    key = Column(String(50), primary_key=True, index=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class OrderAuditLog(Base):
    __tablename__ = "order_audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    event = Column(String(50), nullable=False)  # created, payment_success, printed, synced, refunded, voided
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="audit_logs")
    cashier = relationship("User", foreign_keys=[cashier_id])
    supervisor = relationship("User", foreign_keys=[supervisor_id])


class OrderRefund(Base):
    __tablename__ = "order_refunds"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    refund_number = Column(String(50), unique=True, nullable=False, index=True)
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    supervisor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    refund_method = Column(String(20), nullable=False)  # cash, qris, voucher
    reason_code = Column(String(100), nullable=False)
    notes = Column(Text, nullable=True)
    amount = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="refunds")
    cashier = relationship("User", foreign_keys=[cashier_id])
    supervisor = relationship("User", foreign_keys=[supervisor_id])
    items = relationship("OrderRefundItem", back_populates="refund", cascade="all, delete-orphan")


class OrderRefundItem(Base):
    __tablename__ = "order_refund_items"
    id = Column(Integer, primary_key=True, index=True)
    refund_id = Column(Integer, ForeignKey("order_refunds.id"), nullable=False)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    refund = relationship("OrderRefund", back_populates="items")
    order_item = relationship("OrderItem")


class IdempotencyKey(Base):
    """Mencegah double order: menyimpan UUID per sesi checkout selama 5 menit."""
    __tablename__ = "idempotency_keys"
    id         = Column(Integer, primary_key=True, index=True)
    key        = Column(String(100), unique=True, nullable=False, index=True)
    actor_id   = Column(String(50), nullable=False)   # "cashier_<id>" atau "member_<id>"
    order_id   = Column(Integer, ForeignKey("orders.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", foreign_keys=[order_id])
