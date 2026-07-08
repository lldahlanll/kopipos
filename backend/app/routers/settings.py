from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Setting, User
from app.utils.auth import get_current_user, require_owner, require_pos_access
from app.schemas.setting import SettingUpdate
from typing import Dict
import os, shutil, uuid

router = APIRouter(prefix="/api/settings", tags=["Settings"])

@router.get("")
def get_settings(db: Session = Depends(get_db), current_user: User = Depends(require_pos_access)):
    settings_records = db.query(Setting).all()
    # Default values just in case
    result = {
        "store_name": "KopiPOS Coffee Shop",
        "store_address": "",
        "store_phone": "",
        "store_logo": "",
        "theme_color": "#c8a27a",
        "wifi_ssid": "",
        "wifi_password": "",
        "default_printer": "",
        "printer_ip": "",
        "printer_port": "9100",
        "printer_type": "network",  # "network" | "usb"
    }
    for s in settings_records:
        result[s.key] = s.value
    return result

ALLOWED_SETTING_KEYS = {
    "store_name", "store_address", "store_phone", "store_logo",
    "theme_color", "wifi_ssid", "wifi_password",
    "default_printer", "printer_ip", "printer_port", "printer_type",
    "paper_width", "tax_rate", "receipt_footer",
}

@router.put("")
def update_settings(data: SettingUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_owner)):
    # H-3: reject any key not in the explicit allowlist
    invalid_keys = [k for k in data.settings if k not in ALLOWED_SETTING_KEYS]
    if invalid_keys:
        raise HTTPException(status_code=400, detail=f"Key tidak diizinkan: {', '.join(invalid_keys)}")

    for key, value in data.settings.items():
        val_str = str(value) if value is not None else ""
        setting = db.query(Setting).filter(Setting.key == key).first()
        if setting:
            setting.value = val_str
        else:
            new_setting = Setting(key=key, value=val_str)
            db.add(new_setting)
    
    db.commit()
    return {"status": "success", "message": "Pengaturan berhasil disimpan"}

UPLOAD_DIR = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "frontend", "public", "uploads", "settings"
)

@router.post("/logo")
def upload_store_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_owner)
):
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
        raise HTTPException(status_code=400, detail="Format gambar tidak didukung (jpg, png, webp)")

    # H-4: enforce 5 MB size limit
    MAX_BYTES = 5 * 1024 * 1024
    contents = file.file.read(MAX_BYTES + 1)
    if len(contents) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File terlalu besar (maks 5 MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"logo_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    logo_url = f"/uploads/settings/{filename}"

    setting = db.query(Setting).filter(Setting.key == "store_logo").first()
    if setting:
        # Hapus logo lama jika ada (dan bukan string kosong)
        if setting.value and "uploads/settings/" in setting.value:
            old_path = os.path.join(UPLOAD_DIR, os.path.basename(setting.value))
            if os.path.exists(old_path):
                os.remove(old_path)
        setting.value = logo_url
    else:
        new_setting = Setting(key="store_logo", value=logo_url)
        db.add(new_setting)
        
    db.commit()
    return {"logo_url": logo_url}
