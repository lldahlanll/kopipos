/**
 * qzPrint.js — Utility untuk cetak struk via QZ Tray
 * QZ Tray harus terinstall di komputer: https://qz.io/download/
 */

import qz from 'qz-tray';
import client from '../api/client';
import certTxt from '../assets/digital-certificate.txt?raw';

// ─── Koneksi ─────────────────────────────────────────────────────────────────

let isConnected = false;

/**
 * Cek apakah QZ Tray aktif & terhubung
 */
export function isQZConnected() {
  return isConnected;
}

/**
 * Hubungkan ke QZ Tray (WebSocket ws://localhost:8182)
 * @returns {Promise<boolean>} true jika berhasil
 */
export async function connectQZ() {
  if (isConnected && qz.websocket.isActive()) return true;

  try {
    qz.security.setCertificatePromise((resolve, reject) => resolve(certTxt));
    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      client.get(`/print/qz/sign?request=${encodeURIComponent(toSign)}`)
        .then(res => resolve(res.data))
        .catch(err => {
          console.error('QZ Sign Error', err);
          reject(err);
        });
    });

    const host = localStorage.getItem('qz_host') || 'localhost';
    await qz.websocket.connect({ host, retries: 2, delay: 1 });
    isConnected = true;
    return true;
  } catch (err) {
    isConnected = false;
    throw new Error('QZ Tray tidak terdeteksi. Pastikan sudah diinstall dan dijalankan.');
  }
}

/**
 * Putuskan koneksi QZ Tray
 */
export async function disconnectQZ() {
  if (qz.websocket.isActive()) {
    await qz.websocket.disconnect();
  }
  isConnected = false;
}

// ─── Printer ─────────────────────────────────────────────────────────────────

/**
 * Ambil daftar printer yang terpasang di komputer
 * @returns {Promise<string[]>} array nama printer
 */
export async function getPrinters() {
  try {
    await connectQZ();
    return await qz.printers.find();
  } catch {
    return [];
  }
}

/**
 * Cari printer POS thermal secara otomatis
 * (cari keyword umum: epson, xprinter, thermal, pos, receipt, star, bixolon)
 */
export async function findThermalPrinter() {
  const printers = await getPrinters();
  const keywords = ['epson', 'xprinter', 'thermal', 'pos', 'receipt', 'star', 'bixolon', 'citizen', 'tmt'];
  const thermal = printers.find(p =>
    keywords.some(k => p.toLowerCase().includes(k))
  );
  return thermal || printers[0] || null;
}

// ─── ESC/POS Builder ─────────────────────────────────────────────────────────

const ESC = '\x1B';
const GS  = '\x1D';

const CMD = {
  INIT:        ESC + '@',          // Initialize printer
  CUT:         GS  + 'V\x41\x03', // Partial cut
  ALIGN_LEFT:  ESC + 'a\x00',
  ALIGN_CENTER: ESC + 'a\x01',
  ALIGN_RIGHT: ESC + 'a\x02',
  BOLD_ON:     ESC + 'E\x01',
  BOLD_OFF:    ESC + 'E\x00',
  DOUBLE_HEIGHT_ON:  GS  + '!\x01',
  DOUBLE_HEIGHT_OFF: GS  + '!\x00',
  LF:          '\n',
};

const PAPER_WIDTH = 32; // karakter per baris untuk 58mm, atau 42 untuk 80mm

/**
 * Format teks kiri-kanan dalam 1 baris
 */
function rowLR(left, right, width = PAPER_WIDTH) {
  const maxLeft = width - right.length - 1;
  const truncLeft = left.length > maxLeft ? left.slice(0, maxLeft - 1) + '.' : left;
  const spaces = width - truncLeft.length - right.length;
  return truncLeft + ' '.repeat(Math.max(1, spaces)) + right + '\n';
}

/**
 * Garis pemisah
 */
function divider(char = '-', width = PAPER_WIDTH) {
  return char.repeat(width) + '\n';
}

/**
 * Teks tengah
 */
function center(text, width = PAPER_WIDTH) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text + '\n';
}

/**
 * Format rupiah tanpa library
 */
function formatRp(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

// ─── Build Struk ─────────────────────────────────────────────────────────────

/**
 * Generate array ESC/POS commands untuk struk order
 * @param {Object} order - data order dari API
 * @param {Object} settings - data settings toko dari API
 * @returns {string[]} array of ESC/POS command strings
 */
export function buildReceiptCommands(order, settings = {}) {
  const storeName    = settings.store_name    || 'KopiPOS Coffee Shop';
  const storeAddress = settings.store_address || '';
  const storePhone   = settings.store_phone   || '';
  const wifiSSID     = settings.wifi_ssid     || '';
  const wifiPass     = settings.wifi_password || '';

  const date = order.created_at
    ? new Date(order.created_at).toLocaleString('id-ID', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '-';

  const orderType = order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway';
  const payMethod = (order.payment_method || '').toUpperCase();

  let data = '';

  // Init
  data += CMD.INIT;

  // ── Header ──
  data += CMD.ALIGN_CENTER;
  data += CMD.BOLD_ON;
  data += CMD.DOUBLE_HEIGHT_ON;
  data += storeName + '\n';
  data += CMD.DOUBLE_HEIGHT_OFF;
  data += CMD.BOLD_OFF;

  if (storeAddress) data += storeAddress + '\n';
  if (storePhone)   data += 'Telp: ' + storePhone + '\n';
  data += CMD.LF;

  // ── Info Order ──
  data += CMD.ALIGN_LEFT;
  data += divider('=');
  data += rowLR('No. Order', order.order_number);
  if (order.customer_name) data += rowLR('Pelanggan', order.customer_name);
  data += rowLR('Tanggal', date);
  data += rowLR('Tipe', orderType);
  data += rowLR('Kasir', order.cashier_name || '-');
  data += divider('-');

  // ── Items ──
  for (const item of order.items || []) {
    const itemName = item.product_name;
    const itemTotal = formatRp(item.subtotal);

    data += CMD.BOLD_ON;
    data += rowLR(itemName, itemTotal);
    data += CMD.BOLD_OFF;

    let detail = '  ' + item.quantity + 'x ' + formatRp(item.unit_price);
    if (item.variant_name)   detail += ' | ' + item.variant_name;
    if (item.modifier_names) detail += ' | ' + item.modifier_names;
    data += detail + '\n';
  }

  data += divider('-');

  // ── Subtotal & Total ──
  data += rowLR('Subtotal', formatRp(order.subtotal));
  if (order.discount > 0) {
    data += rowLR('Diskon', '- ' + formatRp(order.discount));
  }

  data += CMD.BOLD_ON;
  data += divider('=');
  data += rowLR('TOTAL', formatRp(order.total));
  data += divider('=');
  data += CMD.BOLD_OFF;

  data += rowLR('Metode Bayar', payMethod);
  data += divider('=');

  // ── Footer ──
  data += CMD.ALIGN_CENTER;
  data += CMD.LF;
  data += 'Terima kasih atas kunjungan Anda!\n';
  data += 'Semoga hari Anda menyenangkan :)\n';

  if (wifiSSID && wifiPass) {
    data += CMD.LF;
    data += divider('-');
    data += 'WiFi: ' + wifiSSID + '\n';
    data += 'Pass: ' + wifiPass + '\n';
    data += divider('-');
  }

  data += CMD.LF;
  data += CMD.LF;
  data += CMD.LF;

  // ── Cut ──
  data += CMD.CUT;

  return [data];
}

// ─── Main Print Function ──────────────────────────────────────────────────────

/**
 * Cetak struk ke printer thermal via QZ Tray
 * @param {Object} order - data order
 * @param {Object} settings - data settings toko
 * @param {string|null} printerName - nama printer (null = auto-detect)
 * @returns {Promise<void>}
 */
export async function printReceipt(order, settings = {}, printerName = null) {
  await connectQZ();

  const printer = printerName || await findThermalPrinter();
  if (!printer) {
    throw new Error('Printer tidak ditemukan. Pastikan printer terhubung dan driver terinstall.');
  }

  const config = qz.configs.create(printer);
  const commands = buildReceiptCommands(order, settings);

  await qz.print(config, commands);
}

/**
 * Cetak struk test (dummy data)
 */
export async function printTestReceipt(settings = {}, printerName = null) {
  const dummyOrder = {
    order_number: 'TEST-001',
    customer_name: 'Test Customer',
    created_at: new Date().toISOString(),
    order_type: 'dine_in',
    payment_method: 'cash',
    cashier_name: 'Admin',
    subtotal: 57000,
    discount: 2000,
    total: 55000,
    items: [
      {
        product_name: 'Americano',
        quantity: 1,
        unit_price: 25000,
        subtotal: 25000,
        variant_name: 'Hot',
        modifier_names: null,
      },
      {
        product_name: 'Caffe Latte',
        quantity: 1,
        unit_price: 32000,
        subtotal: 32000,
        variant_name: 'Iced',
        modifier_names: 'Extra Shot',
      },
    ],
  };

  await printReceipt(dummyOrder, settings, printerName);
}
