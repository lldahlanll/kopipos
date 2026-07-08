from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.database import engine, Base
from app.routers import auth, categories, products, modifiers, orders, reports, shifts, settings, users, self_order, member
from app.routers import print_router
from app.routers import sync as sync_router
from app.seed import seed_admin
from contextlib import asynccontextmanager
from app.limiter import limiter
import app.models  # noqa
import os

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    
    # Auto-migrate orders table to add payment_token and payment_url columns if missing
    from sqlalchemy import text
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE orders ADD COLUMN payment_token VARCHAR(100)"))
            conn.commit()
            print("[KopiPOS] ➕ Column orders.payment_token added successfully or already exists")
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE orders ADD COLUMN payment_url VARCHAR(255)"))
            conn.commit()
            print("[KopiPOS] ➕ Column orders.payment_url added successfully or already exists")
        except Exception:
            pass
        # Buat tabel idempotency_keys jika belum ada (untuk prevent double order)
        try:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS idempotency_keys (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key VARCHAR(100) UNIQUE NOT NULL,
                    actor_id VARCHAR(50) NOT NULL,
                    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
                    created_at DATETIME DEFAULT (datetime('now'))
                )
            """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_idempotency_keys_key ON idempotency_keys (key)"))
            conn.commit()
            print("[KopiPOS] ✅ Table idempotency_keys ready")
        except Exception as e:
            print(f"[KopiPOS] idempotency_keys migration note: {e}")

    seed_admin()
    # ── Startup log ──
    from app.config import settings, EFFECTIVE_SECRET_KEY
    env_label = "🟢 PRODUCTION" if settings.APP_ENV == "production" else "🟡 DEVELOPMENT"
    print(f"\n{'='*55}")
    print(f"  KopiPOS v1.0  |  Mode: {env_label}")
    print(f"  DB  : {settings.DATABASE_URL[:40]}...")
    print(f"  Key : {'[dari .env]' if settings.SECRET_KEY else '[auto-generated / default]'}")
    print(f"{'='*55}\n")
    yield

app = FastAPI(title="KopiPOS API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "http://kopipos.ephinu.my.id",
    "https://kopipos.ephinu.my.id",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"http://192\.168\.\d+\.\d+(:\d+)?",  # izinkan semua IP lokal 192.168.x.x
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(modifiers.router)
app.include_router(orders.router)
app.include_router(reports.router)
app.include_router(shifts.router)
app.include_router(settings.router)
app.include_router(users.router)
app.include_router(print_router.router)
app.include_router(self_order.router)
app.include_router(member.router)
app.include_router(sync_router.router)

@app.get("/api/health", tags=["Health"])
def health():
    return {"status": "ok", "app": "KopiPOS"}

# Serve uploaded product images
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "public", "uploads")
if not os.path.isdir(uploads_dir):
    os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Serve React Frontend Build
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

    @app.exception_handler(404)
    async def custom_404_handler(request: Request, exc):
        # Fallback for React Router SPA
        if request.url.path.startswith("/api/"):
            from fastapi.responses import JSONResponse
            # Harus return JSONResponse, bukan dictionary biasa
            detail = getattr(exc, "detail", "Not Found")
            return JSONResponse({"detail": detail}, status_code=404)
        return FileResponse(os.path.join(frontend_dist, "index.html"))

