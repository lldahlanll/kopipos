from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.schemas.member import MemberRegister, MemberLogin, MemberOut, MemberAuthResponse
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_member
from app.limiter import limiter

router = APIRouter(prefix="/api/member", tags=["Member"])

@router.post("/register", response_model=MemberAuthResponse, status_code=201)
@limiter.limit("5/minute")
def register_member(request: Request, data: MemberRegister, db: Session = Depends(get_db)):
    # Check if phone already registered
    existing = db.query(models.Member).filter(models.Member.phone == data.phone).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Nomor HP sudah terdaftar sebagai member"
        )
    
    new_member = models.Member(
        name=data.name,
        phone=data.phone,
        password_hash=hash_password(data.pin), # Using PIN as the password
        points=0
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    # Auto-login after registration
    access_token = create_access_token(data={"sub": str(new_member.id), "role": "member"})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "member": new_member
    }

@router.post("/login", response_model=MemberAuthResponse)
@limiter.limit("10/minute")
def login_member(request: Request, data: MemberLogin, db: Session = Depends(get_db)):
    member = db.query(models.Member).filter(models.Member.phone == data.phone).first()
    if not member or not verify_password(data.pin, member.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Nomor HP atau PIN salah"
        )
    
    access_token = create_access_token(data={"sub": str(member.id), "role": "member"})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "member": member
    }

@router.get("/profile", response_model=MemberOut)
def get_member_profile(current_member: models.Member = Depends(get_current_member)):
    return current_member
