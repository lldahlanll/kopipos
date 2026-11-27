from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from app.utils.sanitize import sanitize_text

class OrderItemCreate(BaseModel):
    product_id: int
    # Wajib positif: qty negatif bisa dipakai untuk memotong total order.
    quantity: int = Field(..., gt=0, le=999)
    variant_id: Optional[int] = None
    modifier_ids: Optional[List[int]] = None

class OrderCreate(BaseModel):
    order_type: str
    payment_method: str
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    # Diskon manual tidak lagi diterima (harus 0) — pakai promo_id.
    discount: Optional[float] = 0
    promo_id: Optional[int] = None
    items: List[OrderItemCreate]

    @field_validator("discount")
    @classmethod
    def discount_non_negative(cls, v):
        if v is not None and v < 0:
            raise ValueError("Discount tidak boleh negatif")
        return v

    @field_validator("customer_name", "notes")
    @classmethod
    def clean_text(cls, v):
        if v is None:
            return v
        return sanitize_text(v, 200)

class OrderItemModifierResponse(BaseModel):
    id: int
    modifier_group_name: str
    modifier_name: str
    price_adjustment: float
    class Config:
        from_attributes = True

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    base_price: float
    quantity: int
    unit_price: float
    variant_name: Optional[str] = None
    modifier_names: Optional[str] = None
    subtotal: float
    modifiers: List[OrderItemModifierResponse] = []
    class Config:
        from_attributes = True


class OrderAuditLogResponse(BaseModel):
    id: int
    order_id: int
    event: str
    cashier_id: Optional[int] = None
    supervisor_id: Optional[int] = None
    details: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class OrderRefundItemResponse(BaseModel):
    id: int
    refund_id: int
    order_item_id: int
    quantity: int
    unit_price: float
    subtotal: float
    class Config:
        from_attributes = True

class OrderRefundResponse(BaseModel):
    id: int
    order_id: int
    refund_number: str
    cashier_id: int
    supervisor_id: int
    refund_method: str
    reason_code: str
    notes: Optional[str] = None
    amount: float
    created_at: datetime
    items: List[OrderRefundItemResponse] = []
    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    order_number: str
    cashier_id: Optional[int] = None
    shift_id: Optional[int] = None
    order_type: str
    payment_method: str
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = "cashier"
    subtotal: float
    discount: float
    promo_name: Optional[str] = None
    total: float
    status: str
    created_at: Optional[datetime] = None
    items: List[OrderItemResponse] = []
    
    # New audit & shift properties
    cashier_name: Optional[str] = None
    shift_number: Optional[str] = None
    shift_started_at: Optional[datetime] = None
    shift_ended_at: Optional[datetime] = None
    refunded_amount: float = 0.0
    net_total: float = 0.0
    is_reviewed: Optional[bool] = False
    audit_logs: List[OrderAuditLogResponse] = []
    refunds: List[OrderRefundResponse] = []

    class Config:
        from_attributes = True

class OrderListResponse(BaseModel):
    id: int
    order_number: str
    cashier_id: Optional[int] = None
    shift_id: Optional[int] = None
    order_type: str
    payment_method: str
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = "cashier"
    total: float
    status: str
    created_at: Optional[datetime] = None
    
    # New properties
    cashier_name: Optional[str] = None
    shift_number: Optional[str] = None
    refunded_amount: float = 0.0
    net_total: float = 0.0
    is_reviewed: Optional[bool] = False

    class Config:
        from_attributes = True

class OrderVoidRequest(BaseModel):
    supervisor_pin: str
    reason_code: str
    notes: Optional[str] = None

class OrderRefundItemRequest(BaseModel):
    order_item_id: int
    quantity: int

class OrderRefundRequest(BaseModel):
    supervisor_pin: str
    reason_code: str
    notes: Optional[str] = None
    refund_method: str  # cash, qris, voucher
    items: List[OrderRefundItemRequest] = []

class BulkReviewRequest(BaseModel):
    order_ids: List[int]

class SelfOrderCreate(BaseModel):
    customer_name: str
    order_type: str
    payment_method: str = "cashier"
    notes: Optional[str] = None
    token: Optional[str] = None
    redeem_points: Optional[int] = 0
    promo_id: Optional[int] = None  # promo dari banner; tidak bisa digabung dengan tukar poin
    items: List[OrderItemCreate]

    @field_validator("customer_name", "notes")
    @classmethod
    def clean_text(cls, v):
        if v is None:
            return v
        return sanitize_text(v, 200)

class OrderStatusItemModifier(BaseModel):
    modifier_group_name: str
    modifier_name: str
    class Config:
        from_attributes = True

class OrderStatusItem(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float
    modifier_names: Optional[str] = None
    modifiers: List[OrderStatusItemModifier] = []
    class Config:
        from_attributes = True

class OrderStatusResponse(BaseModel):
    id: int
    order_number: str
    status: str
    customer_name: Optional[str] = None
    order_type: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    subtotal: float = 0
    discount: float = 0
    total: float
    promo_name: Optional[str] = None
    points_redeemed: int = 0
    points_earned: int = 0
    created_at: Optional[datetime] = None
    payment_token: Optional[str] = None
    payment_url: Optional[str] = None
    items: List[OrderStatusItem] = []
    class Config:
        from_attributes = True

class LastOrderItems(BaseModel):
    """Item dari pesanan terakhir member, untuk tombol "Pesan lagi"."""
    ordered_at: Optional[datetime] = None
    items: List[OrderStatusItem] = []

class OrderConfirm(BaseModel):
    payment_method: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str

