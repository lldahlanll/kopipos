from datetime import date

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Member, Order

ORDER_NUMBER_ATTEMPTS = 5


def gen_order_num(db: Session) -> str:
    today = date.today()
    prefix = f"KP-{today.strftime('%Y%m%d')}-"
    last = db.query(Order).filter(Order.order_number.like(f"{prefix}%")).order_by(Order.id.desc()).first()
    num = int(last.order_number.split("-")[-1]) + 1 if last else 1
    return f"{prefix}{num:03d}"


def insert_order_with_number(db: Session, order: Order) -> None:
    """Simpan order baru dengan nomor urut harian yang unik.

    Dua order yang dibuat bersamaan bisa membaca nomor terakhir yang sama;
    yang kalah kena unique constraint lalu mencoba nomor berikutnya.
    Retry memakai rollback penuh, jadi panggil SEBELUM ada perubahan lain
    di session (validasi/baca data saja yang boleh terjadi sebelumnya).
    """
    for _ in range(ORDER_NUMBER_ATTEMPTS):
        order.order_number = gen_order_num(db)
        db.add(order)
        try:
            db.flush()
            return
        except IntegrityError:
            db.rollback()
    raise HTTPException(status_code=503, detail="Sistem sedang sibuk membuat nomor order, silakan coba lagi")


# ── Poin member ──────────────────────────────────────────────────────────────
# Diubah langsung di database (UPDATE ... SET points = points ± n), bukan
# baca-ubah-tulis di Python, agar dua request bersamaan tidak saling menimpa.

def add_member_points(db: Session, member_id: int, delta: int) -> None:
    """Tambah (delta > 0) atau kurangi (delta < 0) poin secara atomik."""
    if not member_id or not delta:
        return
    db.query(Member).filter(Member.id == member_id).update(
        {Member.points: Member.points + delta}, synchronize_session="fetch")


def redeem_member_points(db: Session, member_id: int, amount: int) -> bool:
    """Potong poin hanya jika saldonya cukup — atomik. False jika tidak cukup."""
    if amount <= 0:
        return True
    updated = db.query(Member).filter(Member.id == member_id, Member.points >= amount).update(
        {Member.points: Member.points - amount}, synchronize_session="fetch")
    return updated == 1


def lock_order(db: Session, order_id: int = None, order_number: str = None) -> None:
    """Kunci baris order sampai transaksi selesai (PostgreSQL: SELECT ... FOR UPDATE).

    Dipanggil sebelum membaca order yang statusnya akan diubah, supaya dua
    proses bersamaan (mis. callback Midtrans terkirim dua kali, atau kasir dan
    callback di saat yang sama) tidak sama-sama melihat status lama dan
    menambah/mengembalikan poin dua kali. Di SQLite (test) tidak berpengaruh.
    """
    q = db.query(Order.id)
    q = q.filter(Order.id == order_id) if order_id is not None else q.filter(Order.order_number == order_number)
    q.with_for_update().first()
