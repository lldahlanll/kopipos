from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Category, User, Product
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.utils.auth import get_current_user, require_owner, require_pos_access

router = APIRouter(prefix="/api/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
def list_categories(active_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    q = db.query(Category)
    if active_only:
        q = q.filter(Category.is_active == True)
    # Order by sort_order first, then name
    return q.order_by(Category.sort_order.asc(), Category.name.asc()).all()

@router.post("", response_model=CategoryResponse, status_code=201)
def create_category(data: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = Category(
        name=data.name,
        sort_order=data.sort_order if data.sort_order is not None else 0
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

@router.put("/{id}", response_model=CategoryResponse)
def update_category(id: int, data: CategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    if data.name is not None: cat.name = data.name
    if data.sort_order is not None: cat.sort_order = data.sort_order
    if data.is_active is not None: cat.is_active = data.is_active
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{id}")
def delete_category(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    
    # Check for products
    has_products = db.query(Product).filter(Product.category_id == id).first()
    if has_products:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus kategori yang memiliki produk. Gunakan fitur nonaktifkan atau hapus produknya.")

    db.delete(cat)
    db.commit()
    return {"message": "Kategori dihapus permanen"}
