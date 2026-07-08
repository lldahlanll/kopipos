from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse, RegisterRequest
from app.utils.auth import hash_password, verify_password, create_access_token, get_current_user, require_owner
from app.limiter import limiter

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, login_data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Akun tidak aktif")
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, reg_data: RegisterRequest, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    if db.query(User).filter(User.email == reg_data.email).first():
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    user = User(name=reg_data.name, email=reg_data.email, password_hash=hash_password(reg_data.password), role=reg_data.role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
