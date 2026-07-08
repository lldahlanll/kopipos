from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from app.database import get_db
from app.models import Modifier, ModifierGroup, User
from app.schemas.modifier import (
    ModifierCreate, ModifierUpdate, ModifierResponse,
    ModifierGroupCreate, ModifierGroupUpdate, ModifierGroupResponse
)
from app.utils.auth import get_current_user, require_owner, require_pos_access

router = APIRouter(prefix="/api/modifiers", tags=["Modifiers"])

# --- Modifier Groups CRUD ---

@router.get("/groups", response_model=List[ModifierGroupResponse])
def list_modifier_groups(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access)
):
    q = db.query(ModifierGroup).options(selectinload(ModifierGroup.modifiers))
    if active_only:
        q = q.filter(ModifierGroup.status == "active")
    # Order modifier groups globally by sort_order and name
    return q.order_by(ModifierGroup.sort_order.asc(), ModifierGroup.name.asc()).all()

@router.post("/groups", response_model=ModifierGroupResponse, status_code=201)
def create_modifier_group(
    data: ModifierGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    group = ModifierGroup(
        name=data.name,
        selection_type=data.selection_type,
        required=data.required if data.required is not None else False,
        min_select=data.min_select if data.min_select is not None else 0,
        max_select=data.max_select if data.max_select is not None else 1,
        sort_order=data.sort_order if data.sort_order is not None else 0,
        status=data.status if data.status is not None else "active"
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.get("/groups/{id}", response_model=ModifierGroupResponse)
def get_modifier_group(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access)
):
    group = db.query(ModifierGroup).options(selectinload(ModifierGroup.modifiers)).filter(ModifierGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Modifier group tidak ditemukan")
    return group

@router.put("/groups/{id}", response_model=ModifierGroupResponse)
def update_modifier_group(
    id: int,
    data: ModifierGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    group = db.query(ModifierGroup).filter(ModifierGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Modifier group tidak ditemukan")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(group, field, value)
        
    db.commit()
    db.refresh(group)
    return group

@router.delete("/groups/{id}")
def delete_modifier_group(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    group = db.query(ModifierGroup).filter(ModifierGroup.id == id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Modifier group tidak ditemukan")
    
    db.delete(group)
    db.commit()
    return {"message": "Modifier group berhasil dihapus permanen"}


# --- Sub-Modifier CRUD ---

@router.get("", response_model=List[ModifierResponse])
def list_modifiers(
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access)
):
    q = db.query(Modifier)
    if active_only:
        q = q.filter(Modifier.status == "active")
    # Return modifiers ordered globally by modifier_group_id, then sort_order, then name
    return q.order_by(Modifier.modifier_group_id.asc(), Modifier.sort_order.asc(), Modifier.name.asc()).all()

@router.post("/groups/{group_id}/modifiers", response_model=ModifierResponse, status_code=201)
def create_modifier_in_group(
    group_id: int,
    data: ModifierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    group = db.query(ModifierGroup).filter(ModifierGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Modifier group tidak ditemukan")
    
    m = Modifier(
        modifier_group_id=group_id,
        name=data.name,
        price_adjustment=data.price_adjustment if data.price_adjustment is not None else 0.0,
        sort_order=data.sort_order if data.sort_order is not None else 0,
        status=data.status if data.status is not None else "active",
        is_out_of_stock=data.is_out_of_stock if data.is_out_of_stock is not None else False
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m

@router.put("/{id}", response_model=ModifierResponse)
def update_modifier(
    id: int,
    data: ModifierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    m = db.query(Modifier).filter(Modifier.id == id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Modifier tidak ditemukan")
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(m, field, value)
        
    db.commit()
    db.refresh(m)
    return m

@router.delete("/{id}")
def delete_modifier(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    m = db.query(Modifier).filter(Modifier.id == id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Modifier tidak ditemukan")
    db.delete(m)
    db.commit()
    return {"message": "Modifier dihapus permanen"}
