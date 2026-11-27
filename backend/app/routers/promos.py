"""Promo / diskon.

Hanya Owner (kepala toko) dan peran Promo yang boleh membuat & mengubah promo.
Kasir hanya bisa melihat promo yang sedang berlaku untuk dipilih di POS;
besar diskonnya selalu dihitung ulang di server (lihat PromoService).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Banner, Order, Promo, User
from app.schemas.promo import PromoCreate, PromoOut, PromoUpdate, check_promo_values
from app.services import PromoService
from app.utils.auth import require_pos_access, require_promo_manager

router = APIRouter(prefix="/api/promos", tags=["Promos"])


def _out(promo: Promo) -> PromoOut:
    data = PromoOut.model_validate(promo)
    data.is_running = PromoService.is_running(promo)
    return data


@router.get("", response_model=List[PromoOut])
def list_promos(db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    promos = db.query(Promo).order_by(Promo.is_active.desc(), Promo.created_at.desc(), Promo.id.desc()).all()
    return [_out(p) for p in promos]


@router.get("/available", response_model=List[PromoOut])
def list_available_promos(db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    """Promo yang bisa dipilih kasir sekarang (aktif dan dalam periode berlaku)."""
    promos = db.query(Promo).filter(Promo.is_active == True).order_by(Promo.name.asc()).all()  # noqa: E712
    return [_out(p) for p in promos if PromoService.is_running(p)]


@router.post("", response_model=PromoOut, status_code=201)
def create_promo(data: PromoCreate, db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    promo = Promo(**data.model_dump(), created_by=current_user.id)
    db.add(promo)
    db.commit()
    db.refresh(promo)
    return _out(promo)


@router.put("/{promo_id}", response_model=PromoOut)
def update_promo(promo_id: int, data: PromoUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    promo = db.query(Promo).filter(Promo.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo tidak ditemukan")

    changes = data.model_dump(exclude_unset=True)
    merged = {k: changes.get(k, getattr(promo, k)) for k in
              ("discount_type", "value", "max_discount", "min_purchase", "starts_at", "ends_at")}
    try:
        check_promo_values(**merged)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    for field, value in changes.items():
        setattr(promo, field, value)
    db.commit()
    db.refresh(promo)
    return _out(promo)


@router.delete("/{promo_id}")
def delete_promo(promo_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_promo_manager)):
    promo = db.query(Promo).filter(Promo.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promo tidak ditemukan")
    if db.query(Order.id).filter(Order.promo_id == promo_id).first():
        raise HTTPException(
            status_code=400,
            detail="Promo sudah dipakai di transaksi. Nonaktifkan saja agar riwayat tetap utuh.",
        )
    # Banner promonya ikut terhapus (tidak bergantung pada ON DELETE CASCADE di DB)
    db.query(Banner).filter(Banner.promo_id == promo_id).delete(synchronize_session=False)
    db.delete(promo)
    db.commit()
    return {"message": "Promo dihapus"}
