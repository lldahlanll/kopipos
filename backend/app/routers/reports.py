from datetime import datetime, date, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, OrderItem, User
from app.schemas.report import DailySummary, PaymentSummaryItem, BestSellerItem
from app.utils.auth import require_owner

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _parse(d: Optional[str]) -> date:
    return datetime.strptime(d, "%Y-%m-%d").date() if d else date.today()


def _range(date_from: Optional[str], date_to: Optional[str]):
    """Return (start_dt, end_dt) covering full days for the given range."""
    start_date = _parse(date_from)
    end_date = _parse(date_to) if date_to else start_date
    start = datetime(start_date.year, start_date.month, start_date.day, 0, 0, 0)
    end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59)
    return start, end


# ── Single day (backwards-compat) ──────────────────────────────────────────
@router.get("/daily", response_model=DailySummary)
def daily_summary(
    date_str: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    t = _parse(date_str)
    start, end = datetime(t.year, t.month, t.day), datetime(t.year, t.month, t.day, 23, 59, 59)
    rev_tx = (
        db.query(
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
            func.count(Order.id).label("count")
        )
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .first()
    )
    total_items = (
        db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order)
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .scalar()
    )
    return DailySummary(
        date=t.isoformat(),
        total_revenue=float(rev_tx.revenue) if rev_tx else 0.0,
        total_transactions=int(rev_tx.count) if rev_tx else 0,
        total_items_sold=int(total_items),
    )


# ── Range summary ───────────────────────────────────────────────────────────
@router.get("/summary", response_model=DailySummary)
def range_summary(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    start, end = _range(date_from, date_to)
    rev_tx = (
        db.query(
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
            func.count(Order.id).label("count")
        )
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .first()
    )
    total_items = (
        db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order)
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .scalar()
    )
    return DailySummary(
        date=f"{date_from or date.today().isoformat()} s/d {date_to or date.today().isoformat()}",
        total_revenue=float(rev_tx.revenue) if rev_tx else 0.0,
        total_transactions=int(rev_tx.count) if rev_tx else 0,
        total_items_sold=int(total_items),
    )


@router.get("/payment-summary", response_model=List[PaymentSummaryItem])
def payment_summary(
    date_str: Optional[str] = Query(None, alias="date"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    if date_from or date_to:
        start, end = _range(date_from, date_to)
    else:
        t = _parse(date_str)
        start, end = datetime(t.year, t.month, t.day), datetime(t.year, t.month, t.day, 23, 59, 59)

    results = (
        db.query(
            Order.payment_method,
            func.count(Order.id).label("count"),
            func.coalesce(func.sum(Order.total), 0).label("total"),
        )
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .group_by(Order.payment_method)
        .all()
    )
    return [PaymentSummaryItem(payment_method=r.payment_method, count=r.count, total=float(r.total)) for r in results]


@router.get("/best-sellers", response_model=List[BestSellerItem])
def best_sellers(
    date_str: Optional[str] = Query(None, alias="date"),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    if date_from or date_to:
        start, end = _range(date_from, date_to)
    else:
        t = _parse(date_str)
        start, end = datetime(t.year, t.month, t.day), datetime(t.year, t.month, t.day, 23, 59, 59)

    results = (
        db.query(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("total_qty"),
            func.sum(OrderItem.subtotal).label("total_revenue"),
        )
        .join(Order)
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [
        BestSellerItem(product_name=r.product_name, total_qty=int(r.total_qty), total_revenue=float(r.total_revenue))
        for r in results
    ]


# ── Daily breakdown untuk chart omzet ──────────────────────────────────────
@router.get("/daily-breakdown")
def daily_breakdown(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner),
):
    """Returns list of {date, revenue, transactions} for each day in range."""
    start, end = _range(date_from, date_to)

    results = (
        db.query(
            func.date(Order.created_at).label("day"),
            func.coalesce(func.sum(Order.total), 0).label("revenue"),
            func.count(Order.id).label("transactions"),
        )
        .filter(Order.created_at >= start, Order.created_at <= end, Order.status == "paid")
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
        .all()
    )

    return [
        {"date": str(r.day), "revenue": float(r.revenue), "transactions": int(r.transactions)}
        for r in results
    ]
