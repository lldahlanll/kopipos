"""
sync.py – Endpoint untuk sinkronisasi bulk order dari mode offline.
Menerima array order, memproses satu per satu, dan mengembalikan
hasil tiap item (sukses/gagal) agar frontend bisa membersihkan queue.
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Order, User, Shift
from app.schemas.order import OrderCreate
from app.utils.auth import get_current_user, require_pos_access
from pydantic import BaseModel
from app.limiter import limiter
from app.services import OrderService

router = APIRouter(prefix="/api/orders", tags=["Sync"])

class BulkSyncItem(BaseModel):
    tmp_id: str          # nomor sementara dari frontend (TMP-YYYYMMDD-XXX)
    order: OrderCreate   # payload order lengkap

class BulkSyncResult(BaseModel):
    tmp_id: str
    success: bool
    order_number: str | None = None
    order_id: int | None = None
    error: str | None = None

@router.post("/bulk-sync", response_model=List[BulkSyncResult])
@limiter.limit("10/minute")
def bulk_sync_orders(
    request: Request,
    items: List[BulkSyncItem],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access),
):
    """
    Terima daftar order offline dan proses satu per satu.
    Order yang gagal tidak menghentikan proses order berikutnya.
    Response berisi status sukses/gagal tiap item.
    """
    if not items:
        return []

    active_shift = (
        db.query(Shift)
        .filter(Shift.cashier_id == current_user.id, Shift.status == "open")
        .first()
    )

    results: List[BulkSyncResult] = []

    for sync_item in items:
        tmp_id = sync_item.tmp_id
        data = sync_item.order

        try:
            if not active_shift:
                raise ValueError("Shift belum dibuka (No active shift)")
            
            # Delegate order creation to OrderService to apply all validation rules & snapshooting
            order = OrderService.create_order(data, cashier_id=current_user.id, shift_id=active_shift.id, db=db)
            
            results.append(
                BulkSyncResult(
                    tmp_id=tmp_id,
                    success=True,
                    order_number=order.order_number,
                    order_id=order.id,
                )
            )

        except Exception as exc:
            db.rollback()
            err_msg = getattr(exc, "detail", str(exc))
            results.append(
                BulkSyncResult(
                    tmp_id=tmp_id,
                    success=False,
                    error=err_msg,
                )
            )

    return results
