import os
import secrets
import time
from typing import Optional
from pydantic_settings import BaseSettings

env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
default_db = "sqlite:///" + os.path.join(os.path.dirname(os.path.dirname(__file__)), "kopipos.db")

# File untuk menyimpan SECRET_KEY yang di-auto-generate (mode production)
# File ini TIDAK boleh di-commit ke git (sudah ada di .gitignore)
_SECRET_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".secret_key")

# Key default untuk development — JANGAN pakai di production!
_DEV_DEFAULT_KEY = "dev-only-insecure-key-kopipos-not-for-production"


class Settings(BaseSettings):
    DATABASE_URL: str = default_db
    # "development" atau "production"
    APP_ENV: str = "development"
    # Opsional — jika tidak diisi, akan di-resolve otomatis sesuai APP_ENV
    SECRET_KEY: Optional[str] = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    SHOP_NAME: str = "KopiPOS Coffee Shop"
    
    # URL Publik Aplikasi (digunakan untuk CORS dan konfigurasi lain yang butuh domain)
    # Lokal : http://localhost:8000
    # Server: https://kopipos.ephinu.my.id
    APP_URL: Optional[str] = None

    # Zona waktu toko. Dipakai untuk "hari ini" (nomor order, laporan, shift)
    # dan zona waktu session PostgreSQL.
    APP_TIMEZONE: str = "Asia/Jakarta"

    # Midtrans Integration
    MIDTRANS_SERVER_KEY: Optional[str] = None
    MIDTRANS_CLIENT_KEY: Optional[str] = None
    MIDTRANS_IS_PRODUCTION: bool = False

    class Config:
        env_file = env_path
        extra = "ignore"


def _resolve_secret_key(app_env: str, provided_key: Optional[str]) -> str:
    """
    Resolusi SECRET_KEY satu kali saat startup berdasarkan mode:

    [development]
      - Jika SECRET_KEY ada di .env → pakai itu
      - Jika tidak ada → pakai key default bawaan (aman untuk dev lokal)

    [production]
      - Jika SECRET_KEY ada di .env → pakai itu (direkomendasikan)
      - Jika tidak ada → auto-generate key acak & simpan ke file .secret_key
        sehingga konsisten antar-restart server
    """
    # Prioritas tertinggi: key yang diisi manual di .env
    if provided_key:
        return provided_key

    if app_env == "production":
        # Coba baca dari file persistensi (agar tidak berubah setiap restart)
        if os.path.exists(_SECRET_KEY_FILE):
            key = open(_SECRET_KEY_FILE).read().strip()
            if key:
                print(f"[KopiPOS] 🔑 SECRET_KEY dibaca dari file: {_SECRET_KEY_FILE}")
                return key

        # Belum ada → generate baru dan simpan ke file
        key = secrets.token_hex(32)
        with open(_SECRET_KEY_FILE, "w") as f:
            f.write(key)
        print(
            f"[KopiPOS] 🔑 SECRET_KEY baru di-generate otomatis dan disimpan ke:\n"
            f"         {_SECRET_KEY_FILE}\n"
            f"         (Hapus file ini jika ingin generate ulang, atau isi SECRET_KEY di .env)"
        )
        return key

    # Development mode: key statis bawaan
    print(
        "[KopiPOS] ⚠️  Mode DEVELOPMENT — SECRET_KEY menggunakan default bawaan.\n"
        "          Set APP_ENV=production di .env untuk mode produksi."
    )
    return _DEV_DEFAULT_KEY


# ── Singleton settings & resolved key ────────────────────────────────────────
settings = Settings()

# Samakan zona waktu proses dengan toko, agar date.today()/datetime.now()
# tidak memakai UTC dari container (hari baru jam 07:00 WIB).
if settings.APP_TIMEZONE and hasattr(time, "tzset"):
    os.environ["TZ"] = settings.APP_TIMEZONE
    time.tzset()

# EFFECTIVE_SECRET_KEY di-resolve SATU KALI saat modul pertama kali diimport.
# Gunakan konstanta ini di seluruh aplikasi (bukan settings.SECRET_KEY).
EFFECTIVE_SECRET_KEY: str = _resolve_secret_key(settings.APP_ENV, settings.SECRET_KEY)
