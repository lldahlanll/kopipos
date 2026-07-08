from pydantic import BaseModel
from typing import List

class DailySummary(BaseModel):
    date: str
    total_revenue: float
    total_transactions: int
    total_items_sold: int

class PaymentSummaryItem(BaseModel):
    payment_method: str
    count: int
    total: float

class BestSellerItem(BaseModel):
    product_name: str
    total_qty: int
    total_revenue: float
