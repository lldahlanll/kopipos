from datetime import datetime
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, field_validator, model_validator

from app.utils.sanitize import sanitize_text

BANNER_KINDS = ("promo", "partner")
PLACEMENTS = ("menu", "status", "both")


def check_banner_values(kind, promo_id, link_url, placement, starts_at, ends_at):
    """Aturan bersama untuk create & update (dipanggil setelah nilai digabung)."""
    if kind not in BANNER_KINDS:
        raise ValueError("Jenis banner harus 'promo' atau 'partner'")
    if placement not in PLACEMENTS:
        raise ValueError("Posisi banner harus 'menu', 'status', atau 'both'")
    if kind == "promo" and not promo_id:
        raise ValueError("Banner promo harus memilih promo")
    if kind == "partner" and promo_id:
        raise ValueError("Banner partner tidak boleh terhubung ke promo")
    if starts_at and ends_at and ends_at <= starts_at:
        raise ValueError("Waktu selesai harus setelah waktu mulai")


def _clean_link(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v = v.strip()
    if not v:
        return None
    parsed = urlparse(v)
    # Hanya tautan web biasa; tolak javascript:, data:, dll.
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("Tautan harus diawali http:// atau https://")
    return v[:500]


class BannerBase(BaseModel):
    @field_validator("title", check_fields=False)
    @classmethod
    def clean_title(cls, v):
        if v is None:
            return v
        v = sanitize_text(v, 80)
        if len(v) < 2:
            raise ValueError("Judul banner minimal 2 karakter")
        return v

    @field_validator("subtitle", "sponsor_name", check_fields=False)
    @classmethod
    def clean_optional(cls, v, info):
        if v is None:
            return v
        v = sanitize_text(v, 160 if info.field_name == "subtitle" else 80)
        return v or None

    @field_validator("link_url", check_fields=False)
    @classmethod
    def clean_link(cls, v):
        return _clean_link(v)


class BannerCreate(BannerBase):
    kind: str
    title: str
    subtitle: Optional[str] = None
    sponsor_name: Optional[str] = None
    link_url: Optional[str] = None
    promo_id: Optional[int] = None
    placement: str = "menu"
    sort_order: int = 0
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_all(self):
        check_banner_values(self.kind, self.promo_id, self.link_url, self.placement,
                            self.starts_at, self.ends_at)
        return self


class BannerUpdate(BannerBase):
    kind: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    sponsor_name: Optional[str] = None
    link_url: Optional[str] = None
    promo_id: Optional[int] = None
    placement: Optional[str] = None
    sort_order: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: Optional[bool] = None


class BannerPromo(BaseModel):
    """Data promo yang aman ditampilkan ke pelanggan."""
    id: int
    name: str
    discount_type: str
    value: float
    max_discount: Optional[float] = None
    min_purchase: float
    ends_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BannerOut(BaseModel):
    id: int
    kind: str
    title: str
    subtitle: Optional[str] = None
    sponsor_name: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    promo_id: Optional[int] = None
    promo: Optional[BannerPromo] = None
    placement: str
    sort_order: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    is_active: bool
    is_running: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BannerPublic(BaseModel):
    id: int
    kind: str
    title: str
    subtitle: Optional[str] = None
    sponsor_name: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    promo: Optional[BannerPromo] = None
    placement: str

    class Config:
        from_attributes = True
