import { formatRupiah } from '../../utils/format';
import { NO_DISCOUNT, discountFor, optionSummary } from '../../utils/selfOrder';
import { ProductThumb, Stepper } from './ui';

/** Panel keranjang yang selalu terlihat di laptop (≥1024px). */
export default function SelfOrderCart({ cart, promos, discount, member, onQty, onDiscountChange, onCheckout }) {
  const subtotal = cart.reduce((s, c) => s + c.subtotal, 0);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const points = member?.points || 0;
  const cut = discountFor(discount, subtotal, promos, points);
  const total = Math.max(subtotal - cut.amount, 0);
  const suggested = discount.kind === 'none' ? promos[0] : null;

  return (
    <aside aria-label="Pesanan kamu" className="w-[360px] shrink-0 bg-paper border-l border-line flex flex-col sticky top-[75px] h-[calc(100dvh-75px)]">
      <div className="px-[22px] pt-5 pb-2 flex items-baseline justify-between">
        <h2 className="m-0 font-bold text-[20px]">Pesanan kamu</h2>
        <span className="text-[13px] text-ink-soft">{itemCount} item</span>
      </div>

      <div className="px-[22px] flex-1 overflow-y-auto min-h-0">
        {cart.length === 0 ? (
          <p className="mt-6 text-[14px] text-ink-soft leading-normal">Belum ada pesanan. Pilih menu, lalu tekan tombol + untuk menambah.</p>
        ) : cart.map(item => (
          <div key={item.cartKey} className="flex gap-3 py-3 border-b border-line-soft items-center">
            <ProductThumb src={item.product.image_url} className="w-12 h-12 rounded-[10px] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[14px] truncate">{item.product.name}</div>
              <div className="text-[12px] text-ink-soft truncate">{optionSummary(item) || 'Tanpa tambahan'}</div>
              <div className="font-bold text-[13.5px] tabular-nums">{formatRupiah(item.subtotal)}</div>
            </div>
            <Stepper
              value={item.qty}
              onDec={() => onQty(item.cartKey, -1)}
              onInc={() => onQty(item.cartKey, 1)}
              decLabel={item.qty === 1 ? `Hapus ${item.product.name}` : `Kurangi ${item.product.name}`}
              incLabel={`Tambah ${item.product.name}`}
            />
          </div>
        ))}

        {cart.length > 0 && discount.kind !== 'none' && (
          <div className="mt-3.5 p-3 rounded-xl bg-sunny-soft text-[13px] flex justify-between items-center gap-3">
            <span className="min-w-0">
              <strong className="block truncate">{cut.label || 'Promo'}</strong>
              {cut.error ? <span className="text-[#8A2C2C]">{cut.error}</span> : (
                <button
                  type="button"
                  className="text-ink-soft underline underline-offset-2 hover:text-ink"
                  onClick={() => onDiscountChange(discount.kind === 'promo' && points > 0 ? { kind: 'points' } : NO_DISCOUNT)}
                >
                  {discount.kind === 'promo' && points > 0 ? 'Ganti ke tukar poin' : 'Lepas potongan'}
                </button>
              )}
            </span>
            {cut.amount > 0 && <span className="font-bold tabular-nums">−{formatRupiah(cut.amount)}</span>}
          </div>
        )}
        {cart.length > 0 && suggested && (
          <button
            type="button"
            onClick={() => onDiscountChange({ kind: 'promo', promoId: suggested.id })}
            className="mt-3.5 w-full p-3 rounded-xl border border-dashed border-line-strong text-left text-[13px] hover:border-ink-faint"
          >
            Ada promo <strong>{suggested.name}</strong>. <span className="underline underline-offset-2">Pakai</span>
          </button>
        )}
      </div>

      <div className="px-[22px] pt-4 pb-[22px] border-t border-line text-[14px]">
        <div className="flex justify-between py-[3px]"><span className="text-ink-soft">Subtotal</span><span className="tabular-nums">{formatRupiah(subtotal)}</span></div>
        {cut.amount > 0 && <div className="flex justify-between py-[3px]"><span className="text-ink-soft">Potongan</span><span className="tabular-nums">−{formatRupiah(cut.amount)}</span></div>}
        <div className="flex justify-between pt-2 pb-3 font-bold text-[18px]"><span>Total</span><span className="tabular-nums">{formatRupiah(total)}</span></div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={cart.length === 0}
          className="w-full flex items-center justify-center min-h-[54px] rounded-[14px] bg-brand text-white font-bold text-[16px] disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          Lanjut ke pembayaran
        </button>
      </div>
    </aside>
  );
}
