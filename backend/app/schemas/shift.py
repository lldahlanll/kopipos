from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.expense import ExpenseOut

class ShiftCreate(BaseModel):
    opening_balance: float

class ShiftClose(BaseModel):
    closing_actual: float

class ShiftOut(BaseModel):
    id: int
    cashier_id: int
    opening_balance: float
    closing_expected: Optional[float] = None
    closing_actual: Optional[float] = None
    status: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    cash_sales: float = 0.0
    total_expenses: float = 0.0
    expenses: List[ExpenseOut] = []

    class Config:
        from_attributes = True
