from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas.auth import UserResponse, RegisterRequest
from app.utils.auth import require_owner, hash_password
from pydantic import BaseModel, field_validator

router = APIRouter(prefix="/api/users", tags=["Users"])

from app.utils.sanitize import sanitize_text, sanitize_email

class UserUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None
    role: str | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, v):
        if v is None:
            return v
        return sanitize_text(v, 100)

    @field_validator("email")
    @classmethod
    def clean_email(cls, v):
        if v is None:
            return v
        return sanitize_email(v)

@router.get("", response_model=List[UserResponse])
def get_users(db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    return db.query(User).all()

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(request: RegisterRequest, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(
        name=request.name,
        email=request.email,
        password_hash=hash_password(request.password),
        role=request.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, request: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    if request.email and request.email != user.email:
        if db.query(User).filter(User.email == request.email).first():
            raise HTTPException(status_code=400, detail="Email sudah terdaftar")
        user.email = request.email
        
    if request.name:
        user.name = request.name
    if request.role:
        user.role = request.role
    if request.password:
        user.password_hash = hash_password(request.password)
    if request.is_active is not None:
        if user.id == current_user.id and not request.is_active:
            raise HTTPException(status_code=400, detail="Tidak dapat menonaktifkan akun sendiri")
        user.is_active = request.is_active
        
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    
    # Soft delete: nonaktifkan user agar riwayat transaksi tetap terjaga
    user.is_active = False
    db.commit()
    return {"message": "User berhasil dinonaktifkan"}
