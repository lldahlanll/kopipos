from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
elif settings.DATABASE_URL.startswith("postgresql") and settings.APP_TIMEZONE:
    # Datetime naive dari Python (datetime.now()) ditafsirkan sesuai zona waktu
    # session — samakan dengan zona waktu proses agar filter tanggal tidak bergeser.
    connect_args = {"options": f"-c timezone={settings.APP_TIMEZONE}"}

engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
