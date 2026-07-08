"""
print_router.py — Endpoint cetak struk thermal printer via jaringan (TCP/IP) atau USB
Menggunakan library python-escpos: https://python-escpos.readthedocs.io/
"""

import socket
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
import base64
import os
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization

from app.database import get_db
from app.models import Order, Setting, User
from app.utils.auth import get_current_user, require_pos_access
from app.limiter import limiter

router = APIRouter(prefix="/api/print", tags=["Print"])

# ─── Constants ────────────────────────────────────────────────────────────────

PAPER_WIDTH_58 = 32   # karakter per baris untuk kertas 58mm
PAPER_WIDTH_80 = 48   # karakter per baris untuk kertas 80mm
DEFAULT_WIDTH   = PAPER_WIDTH_58

ESC = b'\x1B'
GS  = b'\x1D'

# ESC/POS Commands
INIT             = ESC + b'@'
CUT_PARTIAL      = GS  + b'V\x41\x03'
ALIGN_LEFT       = ESC + b'a\x00'
ALIGN_CENTER     = ESC + b'a\x01'
BOLD_ON          = ESC + b'E\x01'
BOLD_OFF         = ESC + b'E\x00'
DOUBLE_SIZE_ON   = GS  + b'!\x11'
DOUBLE_SIZE_OFF  = GS  + b'!\x00'
LF               = b'\n'

# ─── Schemas ─────────────────────────────────────────────────────────────────

class PrintRequest(BaseModel):
    order_id: int
    printer_ip: Optional[str] = None    # override setting jika diisi
    printer_port: Optional[int] = None  # override setting jika diisi
    printer_type: Optional[str] = None  # "network" | "usb"
    paper_width: Optional[int] = 58     # 58 atau 80 (mm)

class PrintResponse(BaseModel):
    success: bool
    message: str

# ─── ESC/POS Builder ─────────────────────────────────────────────────────────

def fmt_rp(amount: float) -> str:
    """Format rupiah tanpa library eksternal"""
    return f"Rp {int(amount):,}".replace(",", ".")

def row_lr(left: str, right: str, width: int = DEFAULT_WIDTH) -> bytes:
    """Teks kiri–kanan dalam satu baris"""
    max_left = width - len(right) - 1
    left = left[:max_left - 1] + "." if len(left) > max_left else left
    spaces = width - len(left) - len(right)
    return (left + " " * max(1, spaces) + right + "\n").encode("cp437", errors="replace")

def divider(char: str = "-", width: int = DEFAULT_WIDTH) -> bytes:
    return (char * width + "\n").encode("cp437", errors="replace")

def center_text(text: str, width: int = DEFAULT_WIDTH) -> bytes:
    pad = max(0, (width - len(text)) // 2)
    return (" " * pad + text + "\n").encode("cp437", errors="replace")

def build_receipt(order: Order, settings: dict, paper_width: int = 58) -> bytes:
    """
    Build ESC/POS byte stream dari data order
    """
    width = PAPER_WIDTH_80 if paper_width >= 80 else PAPER_WIDTH_58

    store_name    = settings.get("store_name", "KopiPOS Coffee Shop")
    store_address = settings.get("store_address", "")
    store_phone   = settings.get("store_phone", "")
    wifi_ssid     = settings.get("wifi_ssid", "")
    wifi_pass     = settings.get("wifi_password", "")
    receipt_footer = settings.get("receipt_footer", "")

    # Format tanggal
    date_str = "-"
    if order.created_at:
        date_str = order.created_at.strftime("%d/%m/%Y %H:%M")

    order_type = "Dine In" if order.order_type == "dine_in" else "Takeaway"
    pay_method = (order.payment_method or "").upper()
    cashier    = order.cashier.name if order.cashier else "-"

    data = bytearray()

    # Init
    data += INIT

    # ── Header ──────────────────────────────────────────────────
    data += ALIGN_CENTER
    data += BOLD_ON + DOUBLE_SIZE_ON
    data += store_name.encode("cp437", errors="replace") + LF
    data += DOUBLE_SIZE_OFF + BOLD_OFF

    if store_address:
        data += store_address.encode("cp437", errors="replace") + LF
    if store_phone:
        data += f"Telp: {store_phone}".encode("cp437", errors="replace") + LF

    data += LF

    # ── Info Order ───────────────────────────────────────────────
    data += ALIGN_LEFT
    data += divider("=", width)
    data += row_lr("No. Order", order.order_number, width)
    if order.customer_name:
        data += row_lr("Pelanggan", order.customer_name, width)
    data += row_lr("Kasir", cashier, width)
    data += row_lr("Tanggal", date_str, width)
    data += row_lr("Tipe", order_type, width)
    data += divider("-", width)

    # ── Items ────────────────────────────────────────────────────
    for item in order.items:
        item_total = fmt_rp(item.subtotal)
        data += BOLD_ON
        data += row_lr(item.product_name, item_total, width)
        data += BOLD_OFF

        detail = f"  {item.quantity}x {fmt_rp(item.unit_price)}"
        if item.variant_name:
            detail += f" | {item.variant_name}"
        if item.modifier_names:
            detail += f" | {item.modifier_names}"
        data += (detail + "\n").encode("cp437", errors="replace")

    data += divider("-", width)

    # ── Subtotal & Total ─────────────────────────────────────────
    data += row_lr("Subtotal", fmt_rp(order.subtotal), width)
    if order.discount and order.discount > 0:
        data += row_lr("Diskon", f"- {fmt_rp(order.discount)}", width)

    data += BOLD_ON
    data += divider("=", width)
    data += row_lr("TOTAL", fmt_rp(order.total), width)
    data += divider("=", width)
    data += BOLD_OFF

    data += row_lr("Metode Bayar", pay_method, width)
    data += divider("=", width)

    # ── Footer ───────────────────────────────────────────────────
    data += ALIGN_CENTER
    data += LF
    if receipt_footer:
        for line in receipt_footer.split("\n"):
            data += (line.strip() + "\n").encode("cp437", errors="replace")
    else:
        data += "Terima kasih atas kunjungan Anda!\n".encode("cp437", errors="replace")
        data += "Semoga hari Anda menyenangkan :)\n".encode("cp437", errors="replace")

    if wifi_ssid and wifi_pass:
        data += LF
        data += divider("-", width)
        data += f"WiFi : {wifi_ssid}\n".encode("cp437", errors="replace")
        data += f"Pass : {wifi_pass}\n".encode("cp437", errors="replace")
        data += divider("-", width)

    data += LF + LF + LF

    # ── Cut ──────────────────────────────────────────────────────
    data += CUT_PARTIAL

    return bytes(data)

# ─── Printer Backends ─────────────────────────────────────────────────────────

def send_to_network_printer(data: bytes, ip: str, port: int = 9100, timeout: int = 5):
    """Kirim ESC/POS data ke printer via TCP/IP (LAN/WiFi)"""
    try:
        with socket.create_connection((ip, port), timeout=timeout) as sock:
            sock.sendall(data)
    except socket.timeout:
        raise RuntimeError(f"Koneksi ke printer {ip}:{port} timeout ({timeout}s)")
    except ConnectionRefusedError:
        raise RuntimeError(f"Printer {ip}:{port} menolak koneksi. Pastikan printer menyala dan IP benar.")
    except OSError as e:
        raise RuntimeError(f"Gagal terhubung ke printer {ip}:{port} — {e}")

def send_to_usb_printer(data: bytes, vendor_id: int = None, product_id: int = None):
    """Kirim ESC/POS data ke printer USB (menggunakan python-escpos Usb)"""
    try:
        from escpos.printer import Usb
        # Jika vendor_id tidak diisi, coba auto-detect Epson (04b8) atau Xprinter (28e9)
        if not vendor_id:
            for vid, pid in [(0x04b8, None), (0x28e9, None), (0x0dd4, None)]:
                try:
                    p = Usb(vid, pid or 0x0202)
                    p._raw(data)
                    p.close()
                    return
                except Exception:
                    continue
            raise RuntimeError("Printer USB tidak ditemukan. Coba isi Vendor ID & Product ID secara manual.")
        else:
            p = Usb(vendor_id, product_id or 0x0202)
            p._raw(data)
            p.close()
    except ImportError:
        raise RuntimeError("python-escpos tidak terinstall dengan benar.")

# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.post("", response_model=PrintResponse)
@limiter.limit("20/minute")
def print_receipt(
    request: Request,
    req: PrintRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access),
):
    """
    Cetak struk order ke thermal printer via jaringan (LAN/WiFi) atau USB.

    - **order_id**: ID order yang akan dicetak
    - **printer_ip**: IP printer (opsional, diambil dari Settings jika kosong)
    - **printer_port**: Port printer TCP, default 9100
    - **printer_type**: "network" atau "usb"
    - **paper_width**: 58 atau 80 (mm), default 58
    """
    # Ambil order dari DB
    order = (
        db.query(Order)
        .options(joinedload(Order.items), joinedload(Order.cashier))
        .filter(Order.id == req.order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    # Ambil settings toko
    settings_rows = db.query(Setting).all()
    settings = {s.key: s.value for s in settings_rows}

    # Tentukan konfigurasi printer
    printer_type = req.printer_type or settings.get("printer_type", "network")
    printer_ip   = req.printer_ip   or settings.get("printer_ip", "")
    printer_port = req.printer_port or int(settings.get("printer_port", 9100))
    paper_width  = req.paper_width or 58

    # Build ESC/POS data
    receipt_data = build_receipt(order, settings, paper_width)

    # Kirim ke printer
    try:
        if printer_type == "usb":
            send_to_usb_printer(receipt_data)
        else:
            # Network printer (default)
            if not printer_ip:
                raise HTTPException(
                    status_code=400,
                    detail="IP printer belum diatur. Silakan atur di Settings → Pengaturan Printer."
                )
            send_to_network_printer(receipt_data, printer_ip, printer_port)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return PrintResponse(
        success=True,
        message=f"Struk order {order.order_number} berhasil dicetak ke printer {printer_ip or 'USB'}."
    )


@router.post("/test", response_model=PrintResponse)
def print_test_receipt(
    printer_ip: Optional[str] = None,
    printer_port: int = 9100,
    paper_width: int = 58,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_pos_access),
):
    """
    Cetak struk TEST ke printer — tidak perlu order nyata.
    """
    from datetime import datetime

    # Ambil settings
    settings_rows = db.query(Setting).all()
    settings = {s.key: s.value for s in settings_rows}

    ip   = printer_ip or settings.get("printer_ip", "")
    port = printer_port or int(settings.get("printer_port", 9100))

    if not ip:
        raise HTTPException(
            status_code=400,
            detail="IP printer belum diatur. Silakan atur di Settings → Pengaturan Printer."
        )

    # Buat order dummy
    class DummyItem:
        product_name  = "Americano"
        quantity      = 1
        unit_price    = 25000
        subtotal      = 25000
        variant_name  = "Hot"
        modifier_names = "Extra Shot"

    class DummyCashier:
        name = "Admin"

    class DummyOrder:
        order_number  = "TEST-001"
        customer_name = "Test Customer"
        created_at    = datetime.now()
        order_type    = "dine_in"
        payment_method = "cash"
        subtotal      = 25000
        discount      = 0
        total         = 25000
        items         = [DummyItem()]
        cashier       = DummyCashier()

    receipt_data = build_receipt(DummyOrder(), settings, paper_width)

    try:
        send_to_network_printer(receipt_data, ip, port)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return PrintResponse(success=True, message=f"Test print berhasil dikirim ke {ip}:{port}")

@router.get("/qz/sign")
def sign_qz_message(request: str, current_user: User = Depends(require_pos_access)):
    """
    Sign message from QZ Tray using the private key.
    Required for suppressing the untrusted website warning.
    """
    private_key_path = (
        os.environ.get("QZ_PRIVATE_KEY_PATH")
        or os.path.join(os.path.dirname(__file__), "../../private-key.pem")
    )
    try:
        with open(private_key_path, "rb") as key_file:
            private_key = serialization.load_pem_private_key(
                key_file.read(),
                password=None,
            )
        signature = private_key.sign(
            request.encode('utf-8'),
            padding.PKCS1v15(),
            hashes.SHA512()
        )
        return base64.b64encode(signature).decode('utf-8')
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Private key file not found. Set QZ_PRIVATE_KEY_PATH env var.")
    except Exception as e:
        print(f"Error signing QZ message: {e}")
        raise HTTPException(status_code=500, detail="Failed to sign message")
