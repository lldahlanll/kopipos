// Helper bersama untuk halaman self-order pelanggan.
import { formatRupiah } from './format';
import { calcPromoDiscount } from './promo';

export const DEFAULT_BRAND = '#2F5D50';
export const POINT_VALUE = 500;          // 1 poin = Rp 500 (sama dengan server)
export const EARN_PER = 10000;           // 1 poin per Rp 10.000 total (sama dengan server)

// ── Warna tema ──────────────────────────────────────────────────────────────
const hexToRgb = (hex) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
};
const luminance = ([r, g, b]) => {
  const ch = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const toHex = (rgb) => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

/**
 * Warna tema toko yang aman untuk tombol bertulisan putih (kontras ≥ 4.5:1).
 * Warna terang (mis. krem/emas) digelapkan sedikit demi sedikit, rona tetap sama.
 */
export function readableBrand(hex) {
  let rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_BRAND;
  for (let i = 0; i < 40; i++) {
    if ((1.05) / (luminance(rgb) + 0.05) >= 4.5) return toHex(rgb);
    rgb = rgb.map(v => v * 0.94);
  }
  return DEFAULT_BRAND;
}

// ── Sapaan ──────────────────────────────────────────────────────────────────
export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 11) return 'Pagi';
  if (h < 15) return 'Siang';
  if (h < 18) return 'Sore';
  return 'Malam';
}
export const firstName = (name) => (name || '').trim().split(/\s+/)[0] || '';

// ── Produk & pilihan ────────────────────────────────────────────────────────
/** Grup "ukuran" dikirim sebagai variant_id (sama dengan aturan server di /public/menu). */
export function findSizeGroup(product) {
  const groups = product?.modifier_groups || [];
  return groups.find(g => /size|ukuran/i.test(g.name)) ||
    groups.find(g => g.required && g.selection_type === 'radio') || null;
}

export const activeModifiers = (group) => (group.modifiers || []).filter(m => m.is_active);

/** Produk perlu dibuka dulu (ada pilihan) atau bisa langsung ditambah. */
export const needsOptions = (product) =>
  (product.modifier_groups || []).some(g => activeModifiers(g).length > 0) ||
  (product.variants || []).length > 0;

export function unitPriceOf(product, variant, modifiers) {
  let price = product.base_price;
  if (variant) price += variant.price_adjustment;
  modifiers.forEach(m => { price += m.price_adjustment; });
  return price;
}

/** Pilihan valid menurut aturan grup (wajib, min/maks). */
export function isSelectionValid(product, variant, modifiers) {
  const sizeGroup = findSizeGroup(product);
  return (product.modifier_groups || []).every(g => {
    if (activeModifiers(g).length === 0) return true;
    if (g.id === sizeGroup?.id) return variant !== null;
    const count = modifiers.filter(m => m.modifier_group_id === g.id).length;
    if (g.required) return count >= g.min_select && count <= g.max_select;
    return count === 0 || (count >= g.min_select && count <= g.max_select);
  });
}

export const productTag = (p) =>
  p.is_bestseller ? 'Paling sering dipesan' : p.is_recommended ? 'Rekomendasi' : p.is_favorite ? 'Favorit' : '';

export const optionSummary = (item) => {
  const parts = [];
  if (item.variant) parts.push(item.variant.name);
  item.modifiers.forEach(m => parts.push(m.name));
  return parts.join(' · ');
};

// ── Keranjang ───────────────────────────────────────────────────────────────
export function makeCartLine({ product, variant, modifiers, qty, notes }) {
  const unitPrice = unitPriceOf(product, variant, modifiers);
  const cartKey = `${product.id}-${variant?.id || 0}-${modifiers.map(m => m.id).sort().join(',')}-${notes || ''}`;
  return { product, variant, modifiers, qty, notes: notes || '', cartKey, unitPrice, subtotal: unitPrice * qty };
}

export function addLine(cart, line) {
  const idx = cart.findIndex(c => c.cartKey === line.cartKey);
  if (idx < 0) return [...cart, line];
  const next = [...cart];
  const qty = next[idx].qty + line.qty;
  next[idx] = { ...next[idx], qty, subtotal: qty * next[idx].unitPrice };
  return next;
}

export function changeQty(cart, cartKey, delta) {
  return cart.flatMap(c => {
    if (c.cartKey !== cartKey) return [c];
    const qty = c.qty + delta;
    return qty <= 0 ? [] : [{ ...c, qty, subtotal: qty * c.unitPrice }];
  });
}

const CART_KEY = 'selfOrder_cart';
const PROMO_KEY = 'selfOrder_promo';
const REORDER_KEY = 'selfOrder_reorder';

export function saveCart(cart) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(cart.map(c => ({
    product_id: c.product.id, variant_id: c.variant?.id || null,
    modifier_ids: c.modifiers.map(m => m.id), qty: c.qty, notes: c.notes,
  }))));
}

/** Pulihkan keranjang dari sessionStorage memakai data menu terbaru (harga & stok). */
export function loadCart(products) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CART_KEY) || '[]');
    let cart = [];
    saved.forEach(s => {
      const product = products.find(p => p.id === s.product_id);
      if (!product) return;
      const all = (product.modifier_groups || []).flatMap(g => activeModifiers(g));
      const variant = s.variant_id ? all.find(m => m.id === s.variant_id) : null;
      const modifiers = s.modifier_ids.filter(id => id !== s.variant_id)
        .map(id => all.find(m => m.id === id)).filter(Boolean);
      if (s.variant_id && !variant) return;
      if (modifiers.length !== s.modifier_ids.filter(id => id !== s.variant_id).length) return;
      if ([variant, ...modifiers].some(m => m?.is_out_of_stock)) return;
      cart = addLine(cart, makeCartLine({ product, variant, modifiers, qty: s.qty, notes: s.notes }));
    });
    return cart;
  } catch {
    return [];
  }
}

/** Pilihan potongan: { kind: 'promo', promoId } | { kind: 'points' } | { kind: 'none' } */
export const NO_DISCOUNT = { kind: 'none' };
export const saveDiscount = (choice) => sessionStorage.setItem(PROMO_KEY, JSON.stringify(choice));
export const loadDiscount = () => {
  try { return JSON.parse(sessionStorage.getItem(PROMO_KEY) || 'null') || NO_DISCOUNT; } catch { return NO_DISCOUNT; }
};

export const queueReorder = (items) => sessionStorage.setItem(REORDER_KEY, JSON.stringify(items));
export const takeReorder = () => {
  const raw = sessionStorage.getItem(REORDER_KEY);
  sessionStorage.removeItem(REORDER_KEY);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
};

/**
 * Susun ulang item pesanan lama (snapshot nama pilihan) memakai menu sekarang.
 * Hasil: { line } bila bisa langsung ditambah, atau { product } bila pelanggan
 * perlu memilih ulang (pilihan berubah/habis), atau null bila produk tidak dijual lagi.
 */
export function rebuildOrderItem(products, item) {
  const product = products.find(p => p.id === item.product_id);
  if (!product) return null;
  const sizeGroup = findSizeGroup(product);
  let variant = null;
  const modifiers = [];
  for (const om of item.modifiers || []) {
    const group = (product.modifier_groups || []).find(g => g.name === om.modifier_group_name);
    const mod = group && activeModifiers(group).find(m => m.name === om.modifier_name && !m.is_out_of_stock);
    if (!mod) return { product };
    if (group.id === sizeGroup?.id) variant = mod; else modifiers.push(mod);
  }
  if (sizeGroup && activeModifiers(sizeGroup).length > 0 && !variant) return { product };
  if (!isSelectionValid(product, variant, modifiers)) return { product };
  return { line: makeCartLine({ product, variant, modifiers, qty: item.quantity || 1, notes: '' }) };
}

// ── Promo ───────────────────────────────────────────────────────────────────
export function promoTerms(promo) {
  const parts = [];
  if (promo.discount_type === 'percent' && promo.max_discount) parts.push(`Maks ${formatRupiah(promo.max_discount)}`);
  if (promo.min_purchase > 0) parts.push(`min. belanja ${formatRupiah(promo.min_purchase)}`);
  if (promo.ends_at) {
    parts.push('sampai ' + new Date(promo.ends_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
  }
  return parts.join(' · ');
}

export const promoHeadline = (promo) =>
  promo.discount_type === 'percent' ? `Diskon ${promo.value}%` : `Potongan ${formatRupiah(promo.value)}`;

/** Promo unik dari banner promo yang sedang tayang. */
export const promosFromBanners = (banners) => {
  const seen = new Map();
  banners.forEach(b => { if (b.kind === 'promo' && b.promo && !seen.has(b.promo.id)) seen.set(b.promo.id, b.promo); });
  return [...seen.values()];
};

export const maxRedeemablePoints = (points, subtotal) => Math.max(0, Math.min(points || 0, Math.floor(subtotal / POINT_VALUE)));

/**
 * Perkiraan potongan untuk ditampilkan. Angka final dihitung ulang server.
 * Hasil: { amount, label, promo?, points?, error? }
 */
export function discountFor(choice, subtotal, promos, memberPoints) {
  if (choice?.kind === 'promo') {
    const promo = promos.find(p => p.id === choice.promoId);
    if (!promo) return { amount: 0, label: null, error: 'Promo ini sudah tidak berlaku' };
    const { discount, error } = calcPromoDiscount(promo, subtotal);
    return { amount: discount, label: promo.name, promo, error };
  }
  if (choice?.kind === 'points') {
    const points = maxRedeemablePoints(memberPoints, subtotal);
    return { amount: points * POINT_VALUE, label: `Tukar ${points} poin`, points };
  }
  return { amount: 0, label: null };
}

export const pointsEarned = (total) => Math.floor(Math.max(total, 0) / EARN_PER);

// ── Status pesanan ──────────────────────────────────────────────────────────
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'preparing', 'ready'];

export function statusLabel(order) {
  switch (order.status) {
    case 'pending': return order.payment_method === 'qris' ? 'Menunggu pembayaran' : 'Menunggu konfirmasi';
    case 'confirmed': return 'Dikonfirmasi';
    case 'preparing': return 'Sedang dibuat';
    case 'ready': return 'Siap diambil';
    case 'paid': return 'Selesai';
    case 'cancelled': return 'Dibatalkan';
    default: return order.status;
  }
}
