from datetime import date
from sqlalchemy.orm import Session
from app.models import Order

def gen_order_num(db: Session) -> str:
    today = date.today()
    prefix = f"KP-{today.strftime('%Y%m%d')}-"
    last = db.query(Order).filter(Order.order_number.like(f"{prefix}%")).order_by(Order.id.desc()).first()
    num = int(last.order_number.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{num:03d}"
