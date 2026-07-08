from pydantic import BaseModel, field_validator
from typing import Optional
from app.utils.sanitize import sanitize_text, sanitize_email


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

    @field_validator("name", "email")
    @classmethod
    def clean_strings(cls, v, info):
        if info.field_name == "email":
            return sanitize_email(v)
        return sanitize_text(v, 100)
