from app.database import SessionLocal
from app.models import User
from app.utils.auth import hash_password


def seed_admin():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "owner@kopipos.com").first()
        if not existing:
            import os
            owner_pwd = os.environ.get("SEED_OWNER_PASSWORD", "owner123")
            kasir_pwd = os.environ.get("SEED_CASHIER_PASSWORD", "kasir123")
            kitchen_pwd = os.environ.get("SEED_KITCHEN_PASSWORD", "dapur123")
            db.add(User(name="Owner KopiPOS", email="owner@kopipos.com", password_hash=hash_password(owner_pwd), role="owner"))
            db.add(User(name="Kasir KopiPOS", email="kasir@kopipos.com", password_hash=hash_password(kasir_pwd), role="cashier"))
            db.add(User(name="Dapur KopiPOS", email="dapur@kopipos.com", password_hash=hash_password(kitchen_pwd), role="kitchen"))
            db.commit()
            print(f"✅ Seed: owner@kopipos.com (pwd: {owner_pwd}), kasir@kopipos.com (pwd: {kasir_pwd}), dapur@kopipos.com (pwd: {kitchen_pwd})")
        else:
            print("ℹ️  Seed users exist")
    finally:
        db.close()
