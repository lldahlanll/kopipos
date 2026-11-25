import { formatRupiah } from './format';

/**
 * Perkiraan diskon untuk ditampilkan di POS. Angka final SELALU dihitung
 * ulang oleh server (PromoService.calculate_discount) — rumus harus sama.
 * Mengembalikan { discount, error } — error berisi alasan promo tidak berlaku.
 */
export function calcPromoDiscount(promo, subtotal) {
  if (!promo) return { discount: 0, error: null };
  if (subtotal < (promo.min_purchase || 0)) {
    return { discount: 0, error: `Minimal belanja ${formatRupiah(promo.min_purchase)}` };
  }
  let discount = promo.discount_type === 'percent'
    ? (subtotal * promo.value) / 100
    : promo.value;
  if (promo.discount_type === 'percent' && promo.max_discount) {
    discount = Math.min(discount, promo.max_discount);
  }
  return { discount: Math.round(Math.min(discount, subtotal)), error: null };
}

export function describePromo(promo) {
  const main = promo.discount_type === 'percent'
    ? `${promo.value}%${promo.max_discount ? ` (maks ${formatRupiah(promo.max_discount)})` : ''}`
    : formatRupiah(promo.value);
  return promo.min_purchase > 0 ? `${main} · min. ${formatRupiah(promo.min_purchase)}` : main;
}
