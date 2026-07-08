from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.modifier import ModifierGroupResponse

class ProductCreate(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None
    base_price: float
    sort_order: Optional[int] = 0
    image_url: Optional[str] = None
    is_recommended: Optional[bool] = False
    is_bestseller: Optional[bool] = False
    is_favorite: Optional[bool] = False
    modifier_group_ids: Optional[List[int]] = None

class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    sort_order: Optional[int] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_recommended: Optional[bool] = None
    is_bestseller: Optional[bool] = None
    is_favorite: Optional[bool] = None
    modifier_group_ids: Optional[List[int]] = None

class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str] = None
    base_price: float
    sort_order: int
    image_url: Optional[str] = None
    is_active: bool
    is_recommended: Optional[bool] = False
    is_bestseller: Optional[bool] = False
    is_favorite: Optional[bool] = False
    modifier_groups: List[ModifierGroupResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
