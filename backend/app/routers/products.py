from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session, joinedload, selectinload
from app.database import get_db
from app.models import Product, Category, User, ModifierGroup, ProductModifierGroup
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.utils.auth import get_current_user, require_owner, require_pos_access
import os, shutil, uuid

router = APIRouter(prefix="/api/products", tags=["Products"])

@router.get("", response_model=List[ProductResponse])
def list_products(category_id: Optional[int] = None, active_only: bool = False, search: Optional[str] = None, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    q = db.query(Product).options(
        selectinload(Product.product_modifier_groups).selectinload(ProductModifierGroup.modifier_group).selectinload(ModifierGroup.modifiers)
    )
    if category_id: q = q.filter(Product.category_id == category_id)
    if active_only: q = q.filter(Product.is_active == True)
    if search: q = q.filter(Product.name.ilike(f"%{search}%"))
    
    # Sort products by sort_order first, then name
    return q.order_by(Product.sort_order.asc(), Product.name.asc()).all()

@router.get("/{id}", response_model=ProductResponse)
def get_product(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    p = db.query(Product).options(
        selectinload(Product.product_modifier_groups).selectinload(ProductModifierGroup.modifier_group).selectinload(ModifierGroup.modifiers)
    ).filter(Product.id == id).first()
    if not p: raise HTTPException(status_code=404, detail="Tidak ditemukan")
    return p

@router.post("", response_model=ProductResponse, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    if not db.query(Category).filter(Category.id == data.category_id).first():
        raise HTTPException(status_code=400, detail="Kategori tidak ditemukan")
    
    p = Product(
        category_id=data.category_id,
        name=data.name,
        description=data.description,
        base_price=data.base_price,
        sort_order=data.sort_order if data.sort_order is not None else 0,
        image_url=data.image_url,
        is_recommended=data.is_recommended if data.is_recommended is not None else False,
        is_bestseller=data.is_bestseller if data.is_bestseller is not None else False,
        is_favorite=data.is_favorite if data.is_favorite is not None else False
    )
    db.add(p)
    db.flush()
    
    if data.modifier_group_ids:
        # Check that groups exist
        count = db.query(ModifierGroup).filter(ModifierGroup.id.in_(data.modifier_group_ids)).count()
        if count != len(data.modifier_group_ids):
            raise HTTPException(status_code=400, detail="Satu atau lebih modifier group ID tidak ditemukan")
        
        for idx, gid in enumerate(data.modifier_group_ids):
            db.add(ProductModifierGroup(product_id=p.id, modifier_group_id=gid, sort_order=idx))
            
    db.commit()
    db.refresh(p)
    return p

@router.put("/{id}", response_model=ProductResponse)
def update_product(id: int, data: ProductUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(status_code=404, detail="Tidak ditemukan")
    
    update_dict = data.model_dump(exclude_unset=True)
    if "modifier_group_ids" in update_dict:
        mg_ids = update_dict.pop("modifier_group_ids")
        # delete existing relations
        db.query(ProductModifierGroup).filter(ProductModifierGroup.product_id == p.id).delete()
        if mg_ids:
            # Check groups exist
            count = db.query(ModifierGroup).filter(ModifierGroup.id.in_(mg_ids)).count()
            if count != len(mg_ids):
                raise HTTPException(status_code=400, detail="Satu atau lebih modifier group ID tidak ditemukan")
            for idx, gid in enumerate(mg_ids):
                db.add(ProductModifierGroup(product_id=p.id, modifier_group_id=gid, sort_order=idx))
                
    for field, value in update_dict.items():
        setattr(p, field, value)
        
    db.commit()
    db.refresh(p)
    return p

@router.delete("/{id}")
def delete_product(id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    from app.models import OrderItem
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(status_code=404, detail="Tidak ditemukan")
    
    # Check for order items
    has_orders = db.query(OrderItem).filter(OrderItem.product_id == id).first()
    if has_orders:
        raise HTTPException(status_code=400, detail="Tidak bisa menghapus produk yang sudah pernah dipesan. Gunakan fitur nonaktifkan.")

    db.delete(p)
    db.commit()
    return {"message": "Produk dihapus permanen"}

# Upload image dir
from app.config import settings as _app_settings
UPLOAD_DIR = os.path.join(_app_settings.UPLOADS_DIR, "products")

@router.post("/{id}/image")
def upload_product_image(
    id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    p = db.query(Product).filter(Product.id == id).first()
    if not p: raise HTTPException(status_code=404, detail="Tidak ditemukan")

    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung (jpg, png, webp)")

    MAX_BYTES = 5 * 1024 * 1024
    contents = file.file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File terlalu besar (maks 5 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    if p.image_url:
        old_path = os.path.join(UPLOAD_DIR, os.path.basename(p.image_url))
        if os.path.exists(old_path):
            os.remove(old_path)

    p.image_url = f"/uploads/products/{filename}"
    db.commit()
    return {"image_url": p.image_url}
