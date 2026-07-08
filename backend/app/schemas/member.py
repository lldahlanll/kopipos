from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
import re

class MemberRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=9, max_length=20)
    pin: str = Field(..., min_length=6, max_length=6, description="PIN harus 6 digit angka")

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        cleaned = re.sub(r"\D", "", v)
        if not (9 <= len(cleaned) <= 15):
            raise ValueError("Nomor HP harus terdiri dari 9 hingga 15 digit angka")
        return cleaned

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v):
        if not v.isdigit():
            raise ValueError("PIN harus terdiri dari angka saja")
        return v

class MemberLogin(BaseModel):
    phone: str
    pin: str

class MemberOut(BaseModel):
    id: int
    name: str
    phone: str
    points: int
    created_at: datetime

    class Config:
        from_attributes = True

class MemberAuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    member: MemberOut
