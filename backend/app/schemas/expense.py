from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ExpenseCreate(BaseModel):
    amount: float
    description: str

class ExpenseOut(BaseModel):
    id: int
    shift_id: int
    amount: float
    description: str
    created_at: datetime

    class Config:
        from_attributes = True
