from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings, EFFECTIVE_SECRET_KEY
from app.database import get_db
from app.models import User, Member

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, EFFECTIVE_SECRET_KEY, algorithm=settings.ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, EFFECTIVE_SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        # Token member (self-order) memakai SECRET_KEY yang sama dengan token staf.
        # Tanpa cek ini, member dengan id=N bisa bertindak sebagai User id=N.
        if payload.get("role") == "member":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def require_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Owner access required"
        )
    return current_user


def require_roles(allowed_roles: list[str]):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak. Peran '{current_user.role}' tidak memiliki izin ini."
            )
        return current_user
    return role_checker


require_pos_access = require_roles(["owner", "cashier"])


# ── PIN Supervisor ───────────────────────────────────────────────────────────
# PIN disimpan sebagai hash bcrypt (sama seperti password).
PIN_PATTERN = r"^\d{4}$"


def is_hashed(value: Optional[str]) -> bool:
    return bool(value) and value.startswith("$2")


def find_supervisor_by_pin(db: Session, pin: str) -> Optional[User]:
    """Cari owner/supervisor aktif yang PIN-nya cocok. None jika tidak ada."""
    if not pin:
        return None
    candidates = db.query(User).filter(
        User.role.in_(["owner", "supervisor"]),
        User.is_active == True,  # noqa: E712
        User.pin.isnot(None),
    ).all()
    for u in candidates:
        if is_hashed(u.pin) and verify_password(pin, u.pin):
            return u
    return None


member_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/member/login")

def get_current_member(
    token: str = Depends(member_oauth2_scheme), db: Session = Depends(get_db)
) -> Member:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sesi member tidak valid atau kedaluwarsa",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, EFFECTIVE_SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        member_id = payload.get("sub")
        role = payload.get("role")
        if member_id is None or role != "member":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    member = db.query(Member).filter(Member.id == int(member_id)).first()
    if member is None:
        raise credentials_exception
    return member

