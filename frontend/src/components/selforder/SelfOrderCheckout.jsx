import { useState, useRef } from 'react';
import { ArrowLeft, User, MapPin, CreditCard, Send, Loader, Sparkles } from 'lucide-react';
import { formatRupiah } from '../../utils/format';

export default function SelfOrderCheckout({ cart, onBack, onSubmit, loading, tableLocked, tableNum, member }) {
  const [customerName, setCustomerName] = useState(() => member ? member.name : (localStorage.getItem('selfOrder_customerName') || ''));
  const [tableNumber, setTableNumber] = useState(() => tableLocked ? tableNum : (localStorage.getItem('selfOrder_tableNumber') || ''));
  const [orderType, setOrderType] = useState('dine_in'); // dine_in | takeaway
  const [paymentMethod, setPaymentMethod] = useState('qris'); // default to qris since default orderType is dine_in

  // UUID dibuat sekali saat komponen di-mount — tetap sama walau tombol diklik berkali-kali
  const idempotencyKey = useRef(crypto.randomUUID());

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const isValid = customerName.trim().length > 0 && (orderType === 'takeaway' || tableNumber.trim().length > 0);

  const [usePoints, setUsePoints] = useState(false);
  const pointsAvailable = member?.points || 0;
  const maxPointsToRedeem = Math.min(pointsAvailable, Math.floor(cartTotal / 500));
  const pointDiscount = usePoints ? maxPointsToRedeem * 500 : 0;
  const finalTotal = cartTotal - pointDiscount;

  const handleSubmit = () => {
    if (!isValid) return;
    
    // Save to local storage for future convenience
    localStorage.setItem('selfOrder_customerName', customerName);
    if (orderType === 'dine_in') {
      localStorage.setItem('selfOrder_tableNumber', tableNumber);
    }

    onSubmit({
      customerName,
      tableNumber: orderType === 'dine_in' ? tableNumber : null,
      orderType,
      paymentMethod,
      redeemPoints: usePoints ? maxPointsToRedeem : 0,
      idempotencyKey: idempotencyKey.current,
    });
  };

  return (
    <div className="fixed inset-0 max-w-[500px] mx-auto bg-body z-[110] flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl border-x border-white/5">
      {/* Header */}
      <div className="px-5 py-4 bg-surface/90 backdrop-blur-md border-b border-white/5 flex items-center gap-4 shrink-0 shadow-sm z-10">
        <button 
          onClick={onBack} 
          className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-text-primary hover:bg-white/10 transition-colors active:scale-95"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-bold text-text-primary">Checkout</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-24">
        {/* Info Pemesan */}
        <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-5 shadow-sm">
          <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2 text-text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <User size={16} />
            </div>
            Info Pemesan
          </h3>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2 block">
                Nama Panggilan <span className="text-danger">*</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-surface-2 border border-white/5 rounded-xl p-4 text-[15px] font-medium text-text-primary placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                placeholder="Masukkan nama Anda..."
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            {orderType === 'dine_in' && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                <label className="text-sm font-bold text-text-secondary uppercase tracking-wider mb-2 block">
                  Nomor Meja <span className="text-danger">*</span>
                </label>
                <input 
                  type="text" 
                  className={`w-full bg-surface-2 border border-white/5 rounded-xl p-4 text-[15px] font-medium text-text-primary placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all ${tableLocked ? 'opacity-60 cursor-not-allowed bg-surface-3' : ''}`}
                  placeholder="Contoh: 12"
                  value={tableNumber}
                  onChange={e => setTableNumber(e.target.value)}
                  disabled={tableLocked}
                />
                {tableLocked && (
                  <p className="text-[11px] text-primary/75 mt-1.5 font-medium">
                    🔒 Nomor meja terkunci otomatis sesuai QR Code meja Anda.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Tipe Pesanan */}
        <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-5 shadow-sm">
          <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2 text-text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <MapPin size={16} />
            </div>
            Tipe Pesanan
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                setOrderType('dine_in');
                setPaymentMethod('qris');
              }}
              className={`p-4 rounded-xl border text-[14px] font-bold transition-all active:scale-[0.98] ${orderType === 'dine_in' ? 'border-primary bg-primary/10 text-primary shadow-md' : 'border-white/5 bg-surface-2 text-text-primary hover:border-white/10 hover:bg-surface-3'}`}
            >
              Dine In
            </button>
            <button 
              onClick={() => setOrderType('takeaway')}
              className={`p-4 rounded-xl border text-[14px] font-bold transition-all active:scale-[0.98] ${orderType === 'takeaway' ? 'border-primary bg-primary/10 text-primary shadow-md' : 'border-white/5 bg-surface-2 text-text-primary hover:border-white/10 hover:bg-surface-3'}`}
            >
              Takeaway
            </button>
          </div>
        </div>

        {/* Metode Pembayaran */}
        <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-5 shadow-sm">
          <h3 className="text-[15px] font-bold mb-4 flex items-center gap-2 text-text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard size={16} />
            </div>
            Metode Pembayaran
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { id: 'cashier', name: 'Bayar di Kasir', desc: 'Pesan sekarang, bayar cash/kartu di kasir' },
              { id: 'qris', name: 'QRIS', desc: 'Scan barcode (konfirmasi kasir manual)' },
              { id: 'transfer', name: 'Transfer Bank', desc: 'Transfer manual ke rekening toko' }
            ].filter(method => {
              if (orderType === 'dine_in' && method.id === 'cashier') return false;
              return true;
            }).map(method => {
              const isSelected = paymentMethod === method.id;
              return (
                <label 
                  key={method.id} 
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex items-center p-4 border rounded-xl transition-all cursor-pointer active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-white/5 bg-surface-2 hover:border-white/10 hover:bg-surface-3'}`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 transition-colors shrink-0 ${isSelected ? 'border-primary' : 'border-text-muted'}`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className={`text-[15px] font-bold mb-0.5 ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{method.name}</div>
                    <div className="text-[12px] font-medium text-text-muted">{method.desc}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Loyalty Point Redemption */}
        {pointsAvailable > 0 && (
          <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-5 shadow-sm space-y-4">
            <h3 className="text-[15px] font-bold flex items-center gap-2 text-text-primary">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              Tukarkan Poin Loyalty
            </h3>
            <div className="flex items-center justify-between p-3.5 bg-surface-2 rounded-xl border border-white/5">
              <div>
                <div className="text-xs font-bold text-text-primary">Gunakan Poin Anda</div>
                <div className="text-[10px] font-medium text-text-muted mt-0.5">
                  Miliki 🪙 {pointsAvailable} Poin (Maks. Tukar: {maxPointsToRedeem} Poin)
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUsePoints(!usePoints)}
                disabled={maxPointsToRedeem === 0}
                className={`w-12 h-6 rounded-full p-1 transition-colors relative flex items-center ${usePoints ? 'bg-primary' : 'bg-white/10'} ${maxPointsToRedeem === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-200 ${usePoints ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            {usePoints && maxPointsToRedeem > 0 && (
              <p className="text-[11px] text-amber-500 font-medium leading-relaxed">
                🎉 Menggunakan {maxPointsToRedeem} Poin. Anda mendapatkan potongan harga senilai <strong>{formatRupiah(pointDiscount)}</strong>!
              </p>
            )}
          </div>
        )}

        {/* Rincian Total */}
        <div className="bg-surface p-5 rounded-2xl border border-white/5 mb-5 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-sm font-medium text-text-secondary">
            <span>Subtotal ({cart.length} item)</span>
            <span>{formatRupiah(cartTotal)}</span>
          </div>
          {pointDiscount > 0 && (
            <div className="flex justify-between items-center text-sm font-medium text-amber-500">
              <span>Diskon Poin</span>
              <span>-{formatRupiah(pointDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-4 mt-1 border-t border-dashed border-white/10">
            <span className="font-bold text-[16px] text-text-primary">Total Pembayaran</span>
            <span className="font-black text-[18px] text-primary">{formatRupiah(finalTotal)}</span>
          </div>
        </div>
      </div>

      {/* Footer Fixed */}
      <div className="p-5 bg-surface border-t border-white/5 shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.2)] z-10">
        <button 
          className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] text-white p-4 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98] disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 flex items-center justify-center gap-3" 
          onClick={handleSubmit} 
          disabled={!isValid || loading}
        >
          {loading ? (
            <Loader size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
          <span>{loading ? 'Memproses Pesanan...' : 'Kirim Pesanan Sekarang'}</span>
        </button>
        {!isValid && (
          <p className="text-center text-danger text-[12px] mt-3 font-medium animate-pulse">
            * Silakan lengkapi Info Pemesan (Nama & Nomor Meja) terlebih dahulu
          </p>
        )}
      </div>
    </div>
  );
}
