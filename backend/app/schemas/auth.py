import re
from pydantic import BaseModel, field_validator
from typing import Optional
from app.utils.sanitize import sanitize_text, sanitize_email

VALID_ROLES = {"owner", "cashier", "kitchen", "supervisor", "promo"}


def _validate_pin(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return None
    if not re.fullmatch(r"\d{4}", v):
        raise ValueError("PIN harus 4 digit angka")
    if v in {"0000", "1111", "1234", "4321", "9999"}:
        raise ValueError("PIN terlalu mudah ditebak, pilih kombinasi lain")
    return v


class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def clean_email(cls, v):
        return sanitize_email(v)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    class Config:
        from_attributes = True


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str = "cashier"
    pin: Optional[str] = None

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v):
        return _validate_pin(v)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in VALID_ROLES:
            raise ValueError(f"Role harus salah satu dari: {', '.join(sorted(VALID_ROLES))}")
        return v

    @field_validator("name", "email")
    @classmethod
    def clean_strings(cls, v, info):
        if info.field_name == "email":
            return sanitize_email(v)
        return sanitize_text(v, 100)
