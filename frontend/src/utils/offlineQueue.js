/**
 * offlineQueue.js
 * Mengelola antrian order yang belum tersinkronisasi ke server.
 * Order disimpan di localStorage dengan nomor sementara TMP-YYYYMMDD-XXX.
 */

const QUEUE_KEY = 'kopipos_offline_queue';
const MAX_QUEUE_SIZE = 100;

/**
 * Hasilkan nomor order sementara lokal
 */
function generateTmpOrderNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const existing = getOfflineQueue();
  const seq = (existing.length + 1).toString().padStart(3, '0');
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `TMP-${dateStr}-${seq}-${rand}`;
}

/**
 * Simpan order ke antrian offline
 * @param {Object} payload - Payload order yang akan dikirim ke API (items, orderType, dll)
 * @returns {Object} item antrian yang disimpan
 */
export function saveOfflineOrder(payload) {
  const queue = getOfflineQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    throw new Error(`Antrian offline penuh (maks ${MAX_QUEUE_SIZE} order). Harap sinkronisasi dulu.`);
  }

  const item = {
    tmpId: generateTmpOrderNumber(),
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };

  queue.push(item);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return item;
}

/**
 * Ambil semua order dalam antrian offline
 * @returns {Array} array item antrian
 */
export function getOfflineQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Hapus item dari antrian berdasarkan tmpId (setelah berhasil sync)
 * @param {string} tmpId
 */
export function removeOfflineOrder(tmpId) {
  const queue = getOfflineQueue().filter(item => item.tmpId !== tmpId);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Update metadata item (attempts, lastError) setelah gagal sync
 * @param {string} tmpId
 * @param {Object} updates
 */
export function updateOfflineOrder(tmpId, updates) {
  const queue = getOfflineQueue().map(item =>
    item.tmpId === tmpId ? { ...item, ...updates } : item
  );
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Hapus seluruh antrian offline
 */
export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

/**
 * Jumlah order dalam antrian
 * @returns {number}
 */
export function getOfflineQueueCount() {
  return getOfflineQueue().length;
}
