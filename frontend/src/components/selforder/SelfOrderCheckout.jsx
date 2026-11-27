import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Loader } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import {
  NO_DISCOUNT, POINT_VALUE, discountFor, maxRedeemablePoints, optionSummary, pointsEarned, promoTerms,
} from '../../utils/selfOrder';
import { calcPromoDiscount } from '../../utils/promo';
import { ProductThumb, Stepper } from './ui';

function Card({ title, hint, children }) {
  return (
    <section className="mx-[18px] mt-3 p-4 bg-paper border border-line rounded-2xl">
      <h2 className="m-0 font-bold text-[17px]">{title}</h2>
      {hint && <p className="mt-1 mb-2 text-[12.5px] text-ink-soft">{hint}</p>}
      {children}
    </section>
  );
}

function Choice({ name, checked, onChange, title, sub, amount, disabled }) {
  return (
    <label className={`flex items-center gap-3 min-h-14 px-3 py-2 mt-1.5 rounded-xl border transition-colors ${checked ? 'border-brand bg-brand-soft border-[1.5px]' : 'border-line'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-ink-faint'}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} disabled={disabled} className="w-5 h-5 m-0 accent-brand shrink-0" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-semibold text-[14px]">{title}</span>
        {sub && <span className="text-[12px] text-ink-soft">{sub}</span>}
      </span>
      {amount ? <span className="font-bold text-[14px] tabular-nums">{amount}</span> : null}
    </label>
  );
}

export default function SelfOrderCheckout({
  cart, member, storeInfo, tableNum, tableLocked, promos, discount, onDiscountChange,
  onQty, onBack, onSubmit, loading,
}) {
  const [orderType, setOrderType] = useState('dine_in');
  const [tableNumber, setTableNumber] = useState(() => tableNum || localStorage.getItem('selfOrder_tableNumber') || '');
  const canQris = !!storeInfo.midtrans_client_key;
  const [paymentMethod, setPaymentMethod] = useState('cashier');
  const idempotencyKey = useRef(crypto.randomUUID());
  const top = useRef(null);

  useEffect(() => {
    top.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';  // halaman menu di belakang tidak ikut tergulir
    return () => { document.body.style.overflow = prev; };
  }, []);

  const subtotal = cart.reduce((s, c) => s + c.subtotal, 0);
  const points = member?.points || 0;
  const redeemable = maxRedeemablePoints(points, subtotal);
  const cut = discountFor(discount, subtotal, promos, points);
  const total = Math.max(subtotal - cut.amount, 0);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);

  const needsTable = orderType === 'dine_in' && !tableNumber.trim();
  const problem = cart.length === 0 ? 'Pesananmu masih kosong.'
    : cut.error ? `${cut.error}. Pilih potongan lain atau tambah pesanan.`
    : needsTable ? 'Isi nomor meja dulu.'
    : null;

  const submit = () => {
    if (problem || loading) return;
    if (orderType === 'dine_in') localStorage.setItem('selfOrder_tableNumber', tableNumber.trim());
    onSubmit({
      orderType,
      paymentMethod,
      tableNumber: orderType === 'dine_in' ? tableNumber.trim() : null,
      promoId: discount.kind === 'promo' ? discount.promoId : null,
      redeemPoints: discount.kind === 'points' ? cut.points : 0,
      idempotencyKey: idempotencyKey.current,
    });
  };

  return (
    <div className="so-root fixed inset-0 z-[90] overflow-y-auto">
      <div className="max-w-[560px] mx-auto min-h-full flex flex-col md:border-x md:border-line">
        <header className="sticky top-0 z-10 bg-cream flex items-center gap-2 px-2.5 py-2 border-b border-line">
          <button ref={top} type="button" onClick={onBack} aria-label="Kembali ke menu" className="w-11 h-11 flex items-center justify-center text-ink rounded-full hover:bg-sand outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <ChevronLeft size={22} strokeWidth={2.2} />
          </button>
          <h1 className="m-0 flex-1 font-bold text-[20px]">Pesanan kamu</h1>
          {orderType === 'dine_in' && tableNumber && <span className="text-[13px] text-ink-soft pr-2">Meja {tableNumber}</span>}
        </header>

        <section className="px-[18px] pt-1.5" aria-label="Daftar pesanan">
          {cart.map(item => (
            <div key={item.cartKey} className="flex gap-3 py-3.5 border-b border-line items-center">
              <ProductThumb src={item.product.image_url} className="w-14 h-14 rounded-[10px] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[14.5px] leading-snug">{item.product.name}</div>
                <div className="text-[12px] text-ink-soft mt-0.5">{optionSummary(item) || 'Tanpa tambahan'}</div>
                {item.notes && <div className="text-[12px] text-ink-soft italic">“{item.notes}”</div>}
                <div className="font-bold text-[14px] mt-1 tabular-nums">{formatRupiah(item.subtotal)}</div>
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
          <button type="button" onClick={onBack} className="inline-flex items-center min-h-11 text-[14px] font-bold text-brand hover:underline">
            + Tambah menu lain
          </button>
        </section>

        <Card title="Atas nama">
          <p className="mt-2 text-[15px] font-semibold">{member?.name}</p>
          <p className="text-[12.5px] text-ink-soft">Nama ini yang dipanggil barista.</p>
          <div role="radiogroup" aria-label="Tipe pesanan" className="grid grid-cols-2 gap-2 mt-3">
            {[['dine_in', 'Makan di sini'], ['takeaway', 'Bawa pulang']].map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={orderType === id}
                onClick={() => setOrderType(id)}
                className={`min-h-12 rounded-[10px] font-semibold text-[14px] border transition-colors ${orderType === id ? 'bg-ink text-white border-ink' : 'border-line-strong hover:border-ink-faint'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {orderType === 'dine_in' && (
            tableLocked ? (
              <p className="mt-2.5 text-[12.5px] text-ink-soft">Meja {tableNumber}, dari QR di mejamu.</p>
            ) : (
              <div className="mt-3">
                <label htmlFor="so-meja" className="block text-[13px] font-semibold text-ink-soft">Nomor meja</label>
                <input
                  id="so-meja"
                  inputMode="numeric"
                  maxLength={10}
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  placeholder="Lihat angka di mejamu"
                  className="box-border w-full h-12 mt-1.5 px-3 border border-line-strong rounded-[10px] text-[15px] bg-paper-2 outline-none focus:border-brand"
                />
              </div>
            )
          )}
        </Card>

        <Card title="Potongan harga" hint="Pilih satu: promo atau tukar poin.">
          {promos.map(p => {
            const { discount: amt, error } = calcPromoDiscount(p, subtotal);
            const checked = discount.kind === 'promo' && discount.promoId === p.id;
            return (
              <Choice
                key={p.id}
                name="so-hemat"
                checked={checked}
                onChange={() => onDiscountChange({ kind: 'promo', promoId: p.id })}
                title={p.name}
                sub={error || promoTerms(p) || 'Promo dari banner'}
                amount={!error && amt > 0 ? `−${formatRupiah(amt)}` : null}
                disabled={!!error && !checked}
              />
            );
          })}
          {points > 0 && (
            <Choice
              name="so-hemat"
              checked={discount.kind === 'points'}
              onChange={() => onDiscountChange({ kind: 'points' })}
              title={redeemable === points ? `Tukar ${points} poin` : `Tukar ${redeemable} dari ${points} poin`}
              sub={`1 poin = ${formatRupiah(POINT_VALUE)}`}
              amount={redeemable > 0 ? `−${formatRupiah(redeemable * POINT_VALUE)}` : null}
              disabled={redeemable === 0}
            />
          )}
          <Choice
            name="so-hemat"
            checked={discount.kind === 'none'}
            onChange={() => onDiscountChange(NO_DISCOUNT)}
            title="Tanpa potongan"
            sub={points > 0 ? 'Simpan poin untuk nanti' : null}
          />
        </Card>

        <Card title="Bayar">
          <Choice
            name="so-bayar"
            checked={paymentMethod === 'cashier'}
            onChange={() => setPaymentMethod('cashier')}
            title="Bayar di kasir"
            sub="Tunai, QRIS, atau transfer saat ambil pesanan"
          />
          {canQris && (
            <Choice
              name="so-bayar"
              checked={paymentMethod === 'qris'}
              onChange={() => setPaymentMethod('qris')}
              title="QRIS sekarang"
              sub="Bayar dari HP, pesanan langsung diproses"
            />
          )}
        </Card>

        <section className="mx-[18px] mt-3 px-0.5 py-1 text-[14px]" aria-label="Ringkasan">
          <div className="flex justify-between py-1"><span className="text-ink-soft">Subtotal · {itemCount} item</span><span className="tabular-nums">{formatRupiah(subtotal)}</span></div>
          {cut.amount > 0 && (
            <div className="flex justify-between py-1"><span className="text-ink-soft">{cut.label}</span><span className="tabular-nums">−{formatRupiah(cut.amount)}</span></div>
          )}
          <div className="flex justify-between pt-2 mt-1 border-t border-dashed border-line-strong font-bold text-[17px]"><span>Total</span><span className="tabular-nums">{formatRupiah(total)}</span></div>
          {pointsEarned(total) > 0 && (
            <div className="mt-1.5 text-[12.5px] text-brand font-semibold">+{pointsEarned(total)} poin setelah pesanan dibayar</div>
          )}
        </section>

        <div className="h-6 flex-1" />
        <div className="sticky bottom-0 px-[18px] pt-3 pb-[max(18px,env(safe-area-inset-bottom))] bg-cream border-t border-line">
          {problem && <p className="mb-2 text-[12.5px] text-[#8A2C2C] font-medium" role="status">{problem}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={!!problem || loading}
            className="w-full flex items-center justify-between min-h-14 px-[18px] rounded-[14px] bg-brand text-white font-bold text-[16px] disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition"
          >
            <span className="flex items-center gap-2">
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Mengirim pesanan…' : 'Pesan sekarang'}
            </span>
            <span className="tabular-nums">{formatRupiah(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
