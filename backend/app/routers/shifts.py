from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from datetime import datetime, date
from app import models
from app.database import get_db
from app.utils.auth import get_current_user, require_owner, require_pos_access
from app.limiter import limiter
from app.schemas.shift import ShiftCreate, ShiftOut, ShiftClose
from app.schemas.expense import ExpenseCreate, ExpenseOut
from sqlalchemy.sql import func

router = APIRouter(prefix="/api/shifts", tags=["Shifts"])

def _parse(d: Optional[str]) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date() if d else date.today()

def _range(date_from: Optional[str], date_to: Optional[str]):
    start_date = _parse(date_from)
    end_date = _parse(date_to) if date_to else start_date
    start = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
    return start, end

@router.post("/start", response_model=ShiftOut)
@limiter.limit("10/minute")
def start_shift(request: Request, shift: ShiftCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_pos_access)):
    active_shift = db.query(models.Shift).filter(
        models.Shift.cashier_id == current_user.id, 
        models.Shift.status == "open"
    ).first()
    
    if active_shift:
        raise HTTPException(status_code=400, detail="Active shift already exists for this user")
    
    new_shift = models.Shift(
        cashier_id=current_user.id,
        opening_balance=shift.opening_balance,
        status="open",
        started_at=datetime.now()
    )
    db.add(new_shift)
    db.commit()
    db.refresh(new_shift)
    return new_shift

@router.get("/active", response_model=Optional[ShiftOut])
def get_active_shift(db: Session = Depends(get_db), current_user: models.User = Depends(require_pos_access)):
    active_shift = db.query(models.Shift).filter(
        models.Shift.cashier_id == current_user.id, 
        models.Shift.status == "open"
    ).first()
    
    if not active_shift:
        return None
        
    return active_shift

@router.post("/{shift_id}/end", response_model=ShiftOut)
def end_shift(shift_id: int, shift_close: ShiftClose, db: Session = Depends(get_db), current_user: models.User = Depends(require_pos_access)):
    shift = db.query(models.Shift).filter(
        models.Shift.id == shift_id, 
        models.Shift.cashier_id == current_user.id
    ).first()
    
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found or unauthorized")
    if shift.status == "closed":
        raise HTTPException(status_code=400, detail="Shift is already closed")
    
    # Calculate expected closing balance from cash orders during this shift
    cash_orders_total = db.query(func.sum(models.Order.total)).filter(
        models.Order.shift_id == shift.id,
        models.Order.payment_method == "cash",
        models.Order.status == "paid"
    ).scalar() or 0.0

    expenses_total = db.query(func.sum(models.ShiftExpense.amount)).filter(
        models.ShiftExpense.shift_id == shift.id
    ).scalar() or 0.0

    shift.closing_expected = shift.opening_balance + cash_orders_total - expenses_total
    shift.closing_actual = shift_close.closing_actual
    shift.status = "closed"
    shift.ended_at = datetime.now()
    
    db.commit()
    db.refresh(shift)
    return shift

@router.post("/{shift_id}/expenses", response_model=ExpenseOut)
def add_shift_expense(shift_id: int, expense: ExpenseCreate, db: Session = Depends(get_db), current_user: models.User = Depends(require_pos_access)):
    shift = db.query(models.Shift).filter(
        models.Shift.id == shift_id, 
        models.Shift.cashier_id == current_user.id
    ).first()
    
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found or unauthorized")
    if shift.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot add expenses to a closed shift")
        
    new_expense = models.ShiftExpense(
        shift_id=shift.id,
        amount=expense.amount,
        description=expense.description
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return new_expense

@router.get("/history", response_model=List[ShiftOut])
def get_shift_history(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    cashier_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_owner)
):
    query = db.query(models.Shift).filter(models.Shift.status == "closed")
    
    if date_from or date_to:
        start, end = _range(date_from, date_to)
        query = query.filter(models.Shift.started_at >= start, models.Shift.started_at <= end)
        
    if cashier_id:
        query = query.filter(models.Shift.cashier_id == cashier_id)
        
    return query.order_by(models.Shift.started_at.desc()).all()
