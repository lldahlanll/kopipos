import { useState, useEffect } from 'react';
import {
  ShoppingCart, Minus, Plus, Trash2, CheckCircle,
  LogOut, Receipt, Tag, CreditCard, Banknote, QrCode
} from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/format';
import SplitBillModal from './SplitBillModal';
import { getAvailablePromos } from '../../api/promos';
import { describePromo } from '../../utils/promo';

const QUICK_AMOUNTS = [5000, 10000, 20000, 50000, 100000];

function roundUpToNearest(total) {
  return Math.ceil(total / 5000) * 5000;
}

// ── Payment method config
const PAYMENT_METHODS = [
  { id: 'cash',     label: 'Cash',     Icon: Banknote,    colorClass: 'text-success border-success bg-success/10' },
  { id: 'qris',     label: 'QRIS',     Icon: QrCode,      colorClass: 'text-[#a855f7] border-[#a855f7]/40 bg-[#a855f7]/10' },
  { id: 'transfer', label: 'Transfer', Icon: CreditCard,   colorClass: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
];

export default function CartSidebar({ onEndShiftClick, onExpenseClick, onCheckoutSuccess }) {
  const {
    cart, cartCount, cartTotal, cartFinalTotal,
    updateQty, removeItem,
    orderType, setOrderType,
    paymentMethod, setPaymentMethod,
    customerName, setCustomerName,
    notes, setNotes,
    discount, selectedPromo, setSelectedPromo, promoError,
    handleCheckout, isSubmitting
  } = usePOS();

  const [cashReceived, setCashReceived] = useState('');
  const [promos, setPromos] = useState([]);

  // Promo yang sedang berlaku (diatur Owner / tim Promo). Kasir hanya memilih.
  const loadPromos = () => getAvailablePromos()
    .then(r => {
      setPromos(r.data);
      // Promo terpilih sudah tidak berlaku lagi → lepaskan
      if (selectedPromo && !r.data.some(p => p.id === selectedPromo.id)) setSelectedPromo(null);
    })
    .catch(() => {}); // offline: tetap pakai daftar terakhir
  useEffect(() => { loadPromos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [showSplitBill, setShowSplitBill] = useState(false);

  const cashAmount = parseFloat(cashReceived) || 0;
  const change = cashAmount - cartFinalTotal;
  const isCashEnough = cashAmount >= cartFinalTotal;

  const handlePaymentChange = (method) => {
    setPaymentMethod(method);
    setCashReceived('');
  };

  const addQuickAmount = (amount) => {
    const current = parseFloat(cashReceived) || 0;
    setCashReceived(String(current + amount));
  };

  const handleExactAmount = () => {
    setCashReceived(String(roundUpToNearest(cartFinalTotal)));
  };

  const handlePromoChange = (e) => {
    const id = Number(e.target.value);
    setSelectedPromo(promos.find(p => p.id === id) || null);
  };

  const onCheckout = () => {
    if (paymentMethod === 'cash' && cashReceived !== '' && !isCashEnough) return;
    handleCheckout();
    setCashReceived('');
    onCheckoutSuccess?.();
  };

  const activePayment = PAYMENT_METHODS.find(p => p.id === paymentMethod);

  return (
    <div className="flex flex-col h-full text-text-primary bg-surface/80 backdrop-blur-xl">
      {/* ── Sidebar Header ── */}
      <div className="flex-shrink-0 flex justify-between items-center px-4 h-[56px] md:h-[62px] border-b border-white/5 bg-surface gap-4 overflow-x-auto no-scrollbar shadow-sm z-10">
        <div className="flex items-center relative flex-shrink-0 mr-2 ml-1 mt-0.5">
          <ShoppingCart size={24} className="text-primary" />
          {cartCount > 0 && (
            <span key={cartCount} className="absolute -top-2.5 -right-2.5 min-w-[20px] h-[20px] flex items-center justify-center text-[11px] font-bold px-1 rounded-full bg-red-500 text-white animate-pop shadow-md border-2 border-[#202330]">
              {cartCount}
            </span>
          )}
        </div>
        <div className="flex gap-2 ml-auto flex-shrink-0 items-center">
          <button
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:bg-white/10 active:scale-95 bg-white/5 border border-white/10 text-text-secondary whitespace-nowrap shadow-sm"
            onClick={onExpenseClick}
            title="Catat Pengeluaran"
          >
            <Receipt size={16} />
            <span className="hidden sm:inline">Petty Cash</span>
          </button>
          <button
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:bg-red-500/20 active:scale-95 bg-danger/10 border border-danger/20 text-danger whitespace-nowrap shadow-sm"
            onClick={onEndShiftClick}
            title="Akhiri Shift"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Tutup</span>
          </button>
        </div>
      </div>

      {/* ── Cart Items ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0 space-y-2 custom-scrollbar">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-50 py-12">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4 bg-white/5">
              <ShoppingCart size={38} className="text-text-muted" />
            </div>
            <p className="font-bold text-sm text-text-muted">Keranjang kosong</p>
            <p className="text-xs mt-1 text-text-muted">Pilih menu untuk memulai</p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div
              key={item.cartKey}
              className="flex flex-col rounded-xl p-3 transition-all bg-white/5 border border-white/5"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm leading-tight text-text-primary">
                    {item.product_name}
                  </div>
                  {(item.variant_name || item.modifier_names) && (
                    <div className="text-[11px] mt-0.5 font-medium text-text-muted">
                      {item.variant_name && <span>{item.variant_name}</span>}
                      {item.modifier_names && <span> · {item.modifier_names}</span>}
                    </div>
                  )}
                </div>
                <div className="font-bold text-sm flex-shrink-0 text-primary">
                  {formatRupiah(item.subtotal)}
                </div>
              </div>

              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                {/* Qty controls */}
                <div className="flex items-center overflow-hidden rounded-xl bg-surface-2 border border-white/10">
                  <button
                    className="px-2.5 py-2 transition-colors hover:bg-white/10 active:bg-white/20 text-text-secondary"
                    onClick={() => updateQty(idx, -1)}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-8 text-center text-sm font-bold py-1.5 bg-surface-3 text-text-primary">
                    {item.quantity}
                  </span>
                  <button
                    className="px-2.5 py-2 transition-colors bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => updateQty(idx, 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Delete */}
                <button
                  className="p-2 rounded-xl transition-all hover:scale-110 active:scale-95 text-danger/60 hover:text-danger"
                  onClick={() => removeItem(idx)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}

        {/* ── Form Section (when cart has items) ── */}
        {cart.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-4">

            {/* Customer & Notes */}
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-muted">
                  Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all outline-none bg-surface-2 border border-white/10 text-text-primary focus:border-primary"
                  placeholder="Nama pelanggan..."
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-muted">
                  Catatan (Opsional)
                </label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm transition-all outline-none bg-surface-2 border border-white/10 text-text-primary focus:border-primary"
                  placeholder="Tanpa es, ekstra pedas..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-muted">
                Tipe Order
              </label>
              <div className="flex gap-1 p-1 rounded-2xl bg-surface-2 border border-white/5">
                {[
                  { id: 'dine_in', label: '🍽 Dine In' },
                  { id: 'takeaway', label: '🥡 Takeaway' },
                ].map(t => (
                  <button
                    key={t.id}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all border ${orderType === t.id ? 'bg-white/10 text-text-primary border-white/10 shadow-sm' : 'bg-transparent text-text-secondary border-transparent'}`}
                    onClick={() => setOrderType(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5 text-text-muted">
                Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-surface-2 border border-white/5">
                {PAYMENT_METHODS.map(({ id, label, Icon, colorClass }) => {
                  const isActive = paymentMethod === id;
                  return (
                    <button
                      key={id}
                      className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl transition-all text-[12px] font-bold border ${isActive ? `${colorClass} shadow-sm` : 'bg-transparent border-transparent text-text-secondary hover:bg-white/5 hover:border-white/10'}`}
                      onClick={() => handlePaymentChange(id)}
                    >
                      <Icon size={18} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Promo — diskon hanya dari promo yang diatur Owner / tim Promo */}
            <div className={`p-3.5 rounded-xl transition-all border ${discount > 0 ? 'bg-success/5 border-success/20' : promoError ? 'bg-danger/5 border-danger/20' : 'bg-white/5 border-white/5'}`}>
              <label htmlFor="pos-promo" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest mb-2.5 text-text-muted">
                <Tag size={12} />
                Promo
              </label>
              {promos.length === 0 && !selectedPromo ? (
                <div className="text-xs text-text-muted">Tidak ada promo yang berlaku saat ini.</div>
              ) : (
                <select
                  id="pos-promo"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none transition-all bg-surface-2 border border-white/10 text-text-primary focus:border-primary"
                  value={selectedPromo ? selectedPromo.id : ''}
                  onChange={handlePromoChange}
                  onFocus={loadPromos}
                >
                  <option value="">Tanpa promo</option>
                  {promos.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {describePromo(p)}</option>
                  ))}
                </select>
              )}

              {selectedPromo && promoError && (
                <div className="mt-2 text-xs font-bold text-danger">{promoError}</div>
              )}
              {discount > 0 && (
                <div className="mt-2 text-xs font-bold flex items-center gap-1.5 text-success">
                  <CheckCircle size={12} />
                  Diskon {formatRupiah(discount)} diterapkan
                </div>
              )}
            </div>

            {/* Cash Calculator */}
            {paymentMethod === 'cash' && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <label className="block text-[10px] font-bold uppercase tracking-widest mb-3 text-text-muted">
                  💵 Uang Diterima
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_AMOUNTS.map(amt => (
                    <button
                      key={amt}
                      onClick={() => addQuickAmount(amt)}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 bg-surface-2 border border-white/10 text-text-secondary hover:text-text-primary"
                    >
                      +{formatRupiah(amt)}
                    </button>
                  ))}
                  <button
                    onClick={handleExactAmount}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 bg-primary/10 border border-primary/20 text-primary"
                  >
                    Pas
                  </button>
                </div>

                <input
                  type="number"
                  className="w-full px-4 py-3 rounded-xl text-sm font-bold outline-none transition-all mb-2.5 bg-surface-2 border border-white/10 text-text-primary focus:border-primary focus:ring-4 focus:ring-primary/20"
                  placeholder="Masukkan nominal..."
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                />

                <div className={`flex justify-between items-center p-3 rounded-xl border ${cashReceived === '' ? 'bg-transparent border-transparent' : isCashEnough ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                  <span className="text-xs font-bold text-text-secondary">Kembalian</span>
                  <span className={`font-black text-base ${cashReceived === '' ? 'text-text-muted' : isCashEnough ? 'text-success' : 'text-danger'}`}>
                    {cashReceived === '' ? '—' : isCashEnough ? formatRupiah(change) : `Kurang ${formatRupiah(Math.abs(change))}`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Cart Footer / Checkout ── */}
      {cart.length > 0 && (
        <div className="flex-shrink-0 p-4 border-t border-white/10 bg-black/15 backdrop-blur-xl space-y-3">
          {/* Subtotal / Discount breakdown */}
          {discount > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-text-secondary">
                <span>Subtotal</span>
                <span>{formatRupiah(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-success">
                <span>Diskon{selectedPromo ? ` (${selectedPromo.name})` : ''}</span>
                <span>− {formatRupiah(discount)}</span>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dashed border-white/10 my-4" />

          {/* Grand Total */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5 text-text-muted">Total</div>
              <div className={`text-2xl font-black tracking-tight ${discount > 0 ? 'text-primary' : 'text-text-primary'}`}>
                {formatRupiah(cartFinalTotal)}
              </div>
            </div>
            {activePayment && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${activePayment.colorClass}`}>
                <activePayment.Icon size={13} />
                {activePayment.label}
              </div>
            )}
          </div>

          {/* Split Bill */}
          <button
            className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/10 active:scale-[0.98] bg-white/5 border border-white/10 text-text-secondary"
            onClick={() => setShowSplitBill(true)}
          >
            Split Bill
          </button>

          {/* Checkout Button */}
          <button
            className="w-full h-14 rounded-xl font-semibold text-[16px] text-text-inverse bg-primary hover:bg-primary-hover transition-colors flex items-center justify-between px-6 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.1)] active:scale-[0.98]"
            onClick={onCheckout}
            disabled={isSubmitting || (paymentMethod === 'cash' && cashReceived !== '' && !isCashEnough)}
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2 mx-auto">
                <span className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                <span>Memproses...</span>
              </div>
            ) : (
              <>
                <span>Pay</span>
                <span>{formatRupiah(cartFinalTotal)}</span>
              </>
            )}
          </button>
        </div>
      )}

      {showSplitBill && (
        <SplitBillModal onClose={() => setShowSplitBill(false)} />
      )}
    </div>
  );
}
