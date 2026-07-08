from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime

class ModifierCreate(BaseModel):
    name: str
    price_adjustment: Optional[float] = 0.0
    sort_order: Optional[int] = 0
    status: Optional[str] = "active"
    is_out_of_stock: Optional[bool] = False

class ModifierUpdate(BaseModel):
    name: Optional[str] = None
    price_adjustment: Optional[float] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None
    is_out_of_stock: Optional[bool] = None

class ModifierResponse(BaseModel):
    id: int
    modifier_group_id: int
    name: str
    price_adjustment: float
    sort_order: int
    status: str
    is_out_of_stock: bool
    is_active: bool
    
    class Config:
        from_attributes = True

class ModifierGroupCreate(BaseModel):
    name: str
    selection_type: str = "radio" # "radio" or "checkbox"
    required: Optional[bool] = False
    min_select: Optional[int] = 0
    max_select: Optional[int] = 1
    sort_order: Optional[int] = 0
    status: Optional[str] = "active"

    @field_validator("selection_type")
    @classmethod
    def validate_selection_type(cls, v):
        if v not in ("radio", "checkbox"):
            raise ValueError("selection_type must be either 'radio' or 'checkbox'")
        return v

class ModifierGroupUpdate(BaseModel):
    name: Optional[str] = None
    selection_type: Optional[str] = None
    required: Optional[bool] = None
    min_select: Optional[int] = None
    max_select: Optional[int] = None
    sort_order: Optional[int] = None
    status: Optional[str] = None

class ModifierGroupResponse(BaseModel):
    id: int
    name: str
    selection_type: str
    required: bool
    min_select: int
    max_select: int
    sort_order: int
    status: str
    is_active: bool
    modifiers: List[ModifierResponse] = []
    
    class Config:
        from_attributes = True
