from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.utils.sanitize import sanitize_text

DISCOUNT_TYPES = ("percent", "nominal")


def check_promo_values(discount_type, value, max_discount, min_purchase, starts_at, ends_at):
    """Aturan bersama untuk create & update (dipanggil setelah nilai digabung)."""
    if discount_type not in DISCOUNT_TYPES:
        raise ValueError("Jenis diskon harus 'percent' atau 'nominal'")
    if value is None or value <= 0:
        raise ValueError("Nilai diskon harus lebih dari 0")
    if discount_type == "percent" and value > 100:
        raise ValueError("Diskon persen maksimal 100")
    if max_discount is not None and max_discount <= 0:
        raise ValueError("Batas maksimal diskon harus lebih dari 0")
    if min_purchase is not None and min_purchase < 0:
        raise ValueError("Minimal belanja tidak boleh negatif")
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValueError("Waktu selesai harus setelah waktu mulai")


class PromoBase(BaseModel):
    @field_validator("name", check_fields=False)
    @classmethod
    def clean_name(cls, v):
        if v is None:
            return v
        v = sanitize_text(v, 100)
        if len(v) < 2:
            raise ValueError("Nama promo minimal 2 karakter")
        return v


class PromoCreate(PromoBase):
    name: str
    discount_type: str
    value: float
    max_discount: Optional[float] = None
    min_purchase: float = Field(0.0, ge=0)
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_all(self):
        check_promo_values(self.discount_type, self.value, self.max_discount,
                           self.min_purchase, self.starts_at, self.ends_at)
        return self


class PromoUpdate(PromoBase):
    name: Optional[str] = None
    discount_type: Optional[str] = None
    value: Optional[float] = None
    max_discount: Optional[float] = None
    min_purchase: Optional[float] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class PromoOut(BaseModel):
    id: int
    name: str
    discount_type: str
    value: float
    max_discount: Optional[float] = None
    min_purchase: float
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool
    is_running: bool = False  # aktif DAN dalam periode berlaku saat ini
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
