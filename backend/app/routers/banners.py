"""Banner self-order: promo toko dan iklan partner.

Dikelola Owner dan tim Promo. Pelanggan hanya melihat banner yang sedang tayang
lewat /api/public/banners.
"""
import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.config import settings as _app_settings
from app.database import get_db
from app.models import Banner, Promo, User
from app.schemas.banner import BannerCreate, BannerOut, BannerPublic, BannerUpdate, check_banner_values
from app.services import BannerService
from app.utils.auth import require_promo_manager

router = APIRouter(prefix="/api/banners", tags=["Banners"])
public_router = APIRouter(prefix="/api/public", tags=["Public"])

UPLOAD_DIR = os.path.join(_app_settings.UPLOADS_DIR, "banners")
ALLOWED_EXT = (".jpg", ".jpeg", ".png", ".webp")
MAX_BYTES = 5 * 1024 * 1024


def _out(banner: Banner) -> BannerOut:
    data = BannerOut.model_validate(banner)
    data.is_running = BannerService.is_running(banner)
    return data


def _get(db: Session, banner_id: int) -> Banner:
    banner = db.query(Banner).options(joinedload(Banner.promo)).filter(Banner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner tidak ditemukan")
    return banner


def _check_promo_exists(db: Session, promo_id: Optional[int]):
    if promo_id and not db.query(Promo.id).filter(Promo.id == promo_id).first():
        raise HTTPException(status_code=400, detail="Promo tidak ditemukan")


def _remove_image(image_url: Optional[str]):
    if image_url and image_url.startswith("/uploads/banners/"):
        path = os.path.join(UPLOAD_DIR, os.path.basename(image_url))
        if os.path.exists(path):
            os.remove(path)


@router.get("", response_model=List[BannerOut])
def list_banners(db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    banners = (
        db.query(Banner).options(joinedload(Banner.promo))
        .order_by(Banner.is_active.desc(), Banner.sort_order.asc(), Banner.id.desc())
        .all()
    )
    return [_out(b) for b in banners]


@router.post("", response_model=BannerOut, status_code=201)
def create_banner(data: BannerCreate, db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    _check_promo_exists(db, data.promo_id)
    values = data.model_dump()
    if data.kind == "promo":
        values.update(link_url=None, sponsor_name=None)
    banner = Banner(**values, created_by=current_user.id)
    db.add(banner)
    db.commit()
    return _out(_get(db, banner.id))


@router.put("/{banner_id}", response_model=BannerOut)
def update_banner(banner_id: int, data: BannerUpdate, db: Session = Depends(get_db),
                  current_user: User = Depends(require_promo_manager)):
    banner = _get(db, banner_id)
    changes = data.model_dump(exclude_unset=True)
    merged = {k: changes.get(k, getattr(banner, k)) for k in
              ("kind", "promo_id", "link_url", "placement", "starts_at", "ends_at")}
    if merged["kind"] == "partner" and "kind" in changes and "promo_id" not in changes:
        merged["promo_id"] = changes["promo_id"] = None  # pindah dari promo ke partner
    try:
        check_banner_values(**merged)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    _check_promo_exists(db, merged["promo_id"])
    if merged["kind"] == "promo":
        changes.update(link_url=None, sponsor_name=None)

    for field, value in changes.items():
        setattr(banner, field, value)
    db.commit()
    db.expire_all()
    return _out(_get(db, banner_id))


@router.delete("/{banner_id}")
def delete_banner(banner_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    banner = _get(db, banner_id)
    image_url = banner.image_url
    db.delete(banner)
    db.commit()
    _remove_image(image_url)
    return {"message": "Banner dihapus"}


@router.post("/{banner_id}/image", response_model=BannerOut)
def upload_banner_image(banner_id: int, file: UploadFile = File(...), db: Session = Depends(get_db),
                        current_user: User = Depends(require_promo_manager)):
    banner = _get(db, banner_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung (jpg, png, webp)")
    contents = file.file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File terlalu besar (maks 5 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        f.write(contents)

    old = banner.image_url
    banner.image_url = f"/uploads/banners/{filename}"
    db.commit()
    _remove_image(old)
    return _out(_get(db, banner_id))


@router.delete("/{banner_id}/image", response_model=BannerOut)
def delete_banner_image(banner_id: int, db: Session = Depends(get_db),
                        current_user: User = Depends(require_promo_manager)):
    banner = _get(db, banner_id)
    old = banner.image_url
    banner.image_url = None
    db.commit()
    _remove_image(old)
    return _out(_get(db, banner_id))


@public_router.get("/banners", response_model=List[BannerPublic])
def list_public_banners(placement: Optional[str] = Query(None, pattern="^(menu|status)$"),
                        db: Session = Depends(get_db)):
    """Banner yang sedang tayang untuk halaman self-order (tanpa login)."""
    return BannerService.running(db, placement)
