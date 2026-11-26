"""baseline: satukan dua cabang migrasi (skema per 26 Nov 2026)

Sebelum revisi ini repo punya dua head (17275dcee2e2 dan a1b2c3d4e5f6) dan
database produksi tercatat di revisi b170f98d73e9 yang tidak ada di repo,
sehingga `alembic upgrade` tidak bisa dipakai.

Skema saat ini dibentuk oleh `Base.metadata.create_all` + ALTER TABLE ringan
di `app/main.py` (lifespan) saat aplikasi start. Revisi ini TIDAK mengubah
skema; ia hanya menjadi titik awal yang sama untuk semua database:

- Database yang sudah berjalan:  alembic stamp --purge head
- Instalasi baru: jalankan aplikasi sekali (skema dibuat otomatis),
  lalu `alembic stamp head`.

Perubahan skema berikutnya dibuat sebagai revisi baru di atas revisi ini.

Revision ID: 0b5e11ae2026
Revises: 17275dcee2e2, a1b2c3d4e5f6
Create Date: 2026-11-26
"""
from typing import Sequence, Union

revision: str = "0b5e11ae2026"
down_revision: Union[str, Sequence[str], None] = ("17275dcee2e2", "a1b2c3d4e5f6")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
