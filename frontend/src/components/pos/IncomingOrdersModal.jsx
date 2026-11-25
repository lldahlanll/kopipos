import React from 'react';
import { X, CheckCircle, RefreshCw, Bell, Banknote, QrCode, Landmark } from 'lucide-react';
import { formatRupiah } from '../../utils/format';

// Metode yang bisa dipilih kasir saat pelanggan "Bayar di Kasir".
// Pilihan ini menentukan apakah uangnya masuk hitungan kas laci saat tutup shift.
const TENDER_OPTIONS = [
  { id: 'cash', label: 'Tunai', icon: Banknote },
  { id: 'qris', label: 'QRIS', icon: QrCode },
  { id: 'transfer', label: 'Transfer', icon: Landmark },
];

const PAYMENT_LABEL = {
  cashier: 'Bayar di Kasir',
  cash: 'Bayar Tunai',
  transfer: 'Transfer Bank',
};

function IncomingOrderCard({ order, onConfirm, onRefresh }) {
  const isQrisPaid = order.payment_method === 'qris' && order.status === 'confirmed';
  const isQrisPending = order.payment_method === 'qris' && order.status === 'pending';
  const isPayAtCashier = order.payment_method === 'cashier';

  const accent = isQrisPaid ? 'success' : isQrisPending ? 'warning' : 'primary';
  const borderCls = {
    success: 'border-success/40 hover:border-success/70',
    warning: 'border-warning/30 hover:border-warning/60',
    primary: 'border-primary/30 hover:border-primary/60',
  }[accent];
  const barCls = { success: 'bg-success', warning: 'bg-warning', primary: 'bg-primary' }[accent];

  return (
    <div className={`bg-surface-2 p-5 rounded-2xl border transition-colors shadow-lg relative overflow-hidden ${borderCls}`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${barCls}`} />

      {isQrisPaid && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-success/10 border border-success/20 rounded-xl text-[12px] font-bold text-success">
          <CheckCircle size={14} />
          Pembayaran QRIS sudah dikonfirmasi Midtrans — siap diproses
        </div>
      )}
      {isQrisPending && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 bg-warning/10 border border-warning/20 rounded-xl text-[12px] font-bold text-warning">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-warning animate-ping" />
            <Bell size={14} />
            Menunggu pelanggan menyelesaikan pembayaran QRIS…
          </div>
          <button
            onClick={onRefresh}
            title="Refresh status"
            aria-label="Refresh status pembayaran"
            className="ml-2 p-1 rounded-lg hover:bg-warning/20 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="font-bold text-lg text-text-primary leading-tight">{order.customer_name || 'Pelanggan'}</div>
          <div className="text-sm font-medium text-text-muted mt-1">{order.order_number} • {order.order_type === 'dine_in' ? '🍽 Dine In' : '🥡 Takeaway'}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-primary">{formatRupiah(order.total)}</div>
          <div className={`inline-block mt-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
            isQrisPaid ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
          }`}>
            {isQrisPaid ? '✓ QRIS Lunas' : isQrisPending ? '⏳ QRIS Belum Bayar' : (PAYMENT_LABEL[order.payment_method] || order.payment_method)}
          </div>
        </div>
      </div>

      {order.notes && (
        <div className="text-[13px] italic font-medium p-3 rounded-xl bg-danger/10 text-danger border border-danger/20 mb-4">
          <span className="font-bold">Catatan:</span> {order.notes}
        </div>
      )}

      {/* QRIS belum dibayar: tidak bisa dikonfirmasi manual — status berubah otomatis dari Midtrans */}
      {isQrisPending ? null : isPayAtCashier ? (
        <div>
          <div className="text-[12px] font-semibold text-text-secondary mb-2">Pelanggan membayar dengan:</div>
          <div className="grid grid-cols-3 gap-2">
            {TENDER_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className="py-3 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                onClick={() => onConfirm(order.id, id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          className={`w-full py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isQrisPaid ? 'bg-gradient-to-r from-success to-emerald-600 hover:shadow-[0_8px_24px_rgba(34,197,94,0.4)]' : 'bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)]'}`}
          onClick={() => onConfirm(order.id)}
        >
          <CheckCircle size={18} />
          {isQrisPaid ? 'Tandai Diterima & Proses' : 'Konfirmasi & Terima Pesanan'}
        </button>
      )}
    </div>
  );
}

export default function IncomingOrdersModal({ orders, onClose, onConfirm, onRefresh }) {
  const handleConfirm = (id, paymentMethod) => {
    onConfirm(id, paymentMethod);
    if (orders.length === 1) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-orders-title"
        className="w-full max-w-xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
          <h3 id="incoming-orders-title" className="text-lg font-bold flex items-center gap-2">
            <Bell size={20} className="text-accent" />
            <span>Pesanan Self-Order Baru</span>
          </h3>
          <button
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-text-muted flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-text-muted">
                <Bell size={28} />
              </div>
              <p className="font-medium">Tidak ada pesanan baru.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map(order => (
                <IncomingOrderCard key={order.id} order={order} onConfirm={handleConfirm} onRefresh={onRefresh} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
