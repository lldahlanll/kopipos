# KopiPOS - POS Sederhana untuk Coffee Shop

KopiPOS adalah sistem Point of Sales (POS) berbasis web yang dirancang khusus untuk kedai kopi (coffee shop). Sistem ini dilengkapi dengan berbagai fitur kasir modern dan manajemen inventaris.

## Fitur Unggulan (New Updates)
- **Role-Based Access Control (RBAC)**: Pemisahan akses antara Owner (Dashboard & Settings) dan Kasir (POS).
- **Offline Support (PWA)**: Kasir dapat beroperasi meskipun tanpa koneksi internet (segera rilis).
- **State Management**: Menggunakan Zustand untuk manajemen keranjang yang lebih efisien.
- **Cetak Struk**: Mendukung printer thermal melalui browser print.
- **Pembayaran QRIS**: Integrasi mock pembayaran QRIS.
- **Manajemen Inventaris**: Pemotongan stok otomatis setiap transaksi.
- **Laporan Shift & Analitik**: Laporan penjualan dan grafik pendapatan.
- **Keamanan Lanjutan**: Rate Limiting pada endpoint Autentikasi dan Migrasi Database dengan Alembic.

## Quick Start

### 1. Backend (FastAPI)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Menjalankan Migrasi Database (Alembic)
alembic upgrade head

# Menjalankan Server
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

### 3. Buka Aplikasi
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs

### 4. Akun Default
| Role   | Email              | Password  |
|--------|--------------------|-----------|
| Owner  | owner@kopipos.com  | owner123  |
| Kasir  | kasir@kopipos.com  | kasir123  |

## Tech Stack
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic + SlowAPI
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Frontend**: React + Vite + Zustand + PWA
- **Auth**: JWT
