import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Plus, CheckCircle, SplitSquareVertical, Banknote, QrCode, CreditCard, CheckSquare, Square } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/format';

export default function SplitBillModal({ onClose }) {
  const { cart, handleSplitCheckout } = usePOS();
  
  const [selectedQtys, setSelectedQtys] = useState(cart.map(() => 0));
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const updateQty = (idx, delta) => {
    const maxQty = cart[idx].quantity;
    const current = selectedQtys[idx];
    const newQty = Math.max(0, Math.min(maxQty, current + delta));
    
    const updated = [...selectedQtys];
    updated[idx] = newQty;
    setSelectedQtys(updated);
  };

  const toggleRow = (idx) => {
    const maxQty = cart[idx].quantity;
    const current = selectedQtys[idx];
    const updated = [...selectedQtys];
    
    if (current === maxQty) {
      updated[idx] = 0;
    } else {
      updated[idx] = maxQty;
    }
    setSelectedQtys(updated);
  };

  const selectAll = () => setSelectedQtys(cart.map(item => item.quantity));
  const clearAll = () => setSelectedQtys(cart.map(() => 0));

  const cartTotal = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const splitTotal = cart.reduce((sum, item, idx) => sum + (item.unit_price * selectedQtys[idx]), 0);
  const remainingTotal = cartTotal - splitTotal;
  const splitCount = selectedQtys.reduce((sum, qty) => sum + qty, 0);

  const onCheckout = async () => {
    if (splitCount === 0) return;
    
    const splitCart = [];
    const remainingCart = [];

    cart.forEach((item, idx) => {
      const selected = selectedQtys[idx];
      const remaining = item.quantity - selected;

      if (selected > 0) {
        splitCart.push({ ...item, quantity: selected, subtotal: item.unit_price * selected });
      }
      if (remaining > 0) {
        remainingCart.push({ ...item, quantity: remaining, subtotal: item.unit_price * remaining });
      }
    });

    await handleSplitCheckout(splitCart, remainingCart, paymentMethod);
    onClose();
  };

  const PAYMENT_METHODS = [
    { id: 'cash',     label: 'Cash',     Icon: Banknote,    colorClass: 'text-success border-success bg-success/10' },
    { id: 'qris',     label: 'QRIS',     Icon: QrCode,      colorClass: 'text-[#a855f7] border-[#a855f7]/40 bg-[#a855f7]/10' },
    { id: 'transfer', label: 'Transfer', Icon: CreditCard,  colorClass: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="w-full max-w-4xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0 bg-white/5">
          <h3 className="text-lg font-bold flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <SplitSquareVertical size={18} />
            </div>
            <div>
              <div className="leading-tight">Split Bill</div>
            </div>
          </h3>
          <button className="p-2.5 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Item Keranjang</span>
            <div className="flex gap-2">
              <button 
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" 
                onClick={selectAll}
              >
                Pilih Semua
              </button>
              <button 
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-danger/10 text-danger hover:bg-danger/20 transition-colors" 
                onClick={clearAll}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl p-2 bg-surface-2 min-h-[200px]">
            {cart.map((item, idx) => {
              const selectedQty = selectedQtys[idx];
              const isSelected = selectedQty > 0;
              const isFullySelected = selectedQty === item.quantity;
              
              return (
                <div 
                  key={item.cartKey} 
                  className={`flex items-center justify-between gap-3 mb-2 last:mb-0 p-3 rounded-xl transition-all border cursor-pointer ${isSelected ? 'bg-primary/10 border-primary/50' : 'bg-white/5 border-transparent hover:border-white/10'}`}
                  onClick={() => toggleRow(idx)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`flex-shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                      {isFullySelected ? <CheckSquare size={18} className="fill-primary/20" /> : <Square size={18} />}
                    </div>
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-[14px] text-text-primary leading-tight">{item.product_name}</div>
                      <div className="text-[11px] font-medium text-text-muted mt-1 flex flex-wrap gap-x-2">
                        {item.variant_name && <span>{item.variant_name}</span>}
                        {item.modifier_names && <span>• {item.modifier_names}</span>}
                      </div>
                      <div className="text-[12px] font-bold text-primary mt-1.5">
                        {formatRupiah(item.unit_price)} <span className="text-[10px] text-text-muted font-medium ml-1">(Maks: {item.quantity})</span>
                      </div>
                    </div>
                  </div>
                  
                  <div 
                    className="flex items-center bg-body border border-white/10 rounded-xl overflow-hidden shrink-0 shadow-inner"
                    onClick={(e) => e.stopPropagation()} 
                  >
                    <button 
                      className="px-3 py-2 text-text-secondary hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" 
                      onClick={() => updateQty(idx, -1)} 
                      disabled={selectedQty === 0}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-text-primary">
                      {selectedQty}
                    </span>
                    <button 
                      className="px-3 py-2 text-primary hover:bg-primary/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors" 
                      onClick={() => updateQty(idx, 1)} 
                      disabled={selectedQty === item.quantity}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 pt-5 border-t border-white/5 shrink-0">
            <label className="block text-xs font-bold uppercase tracking-wider mb-3 text-text-muted">Metode Pembayaran</label>
            <div className="grid grid-cols-3 gap-3 p-2 rounded-2xl bg-surface-2 border border-white/5">
              {PAYMENT_METHODS.map(({ id, label, Icon, colorClass }) => {
                const isActive = paymentMethod === id;
                return (
                  <button
                    key={id}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl transition-all text-[13px] font-bold border ${isActive ? `${colorClass} shadow-md` : 'bg-transparent border-transparent text-text-secondary hover:bg-white/5 hover:border-white/10'}`}
                    onClick={() => setPaymentMethod(id)}
                  >
                    <Icon size={22} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-5 bg-black/30 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-center sm:text-left w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-1">Tagihan Split</span>
              <div className="text-2xl font-black text-primary tracking-tight">{formatRupiah(splitTotal)}</div>
            </div>
            <div className="w-px h-10 bg-white/10 hidden sm:block"></div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted block mb-1">Sisa Nanti</span>
              <div className="text-lg font-bold text-text-secondary tracking-tight">{formatRupiah(remainingTotal)}</div>
            </div>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <button 
              className="flex-1 sm:flex-none py-3 px-6 rounded-xl font-bold text-text-secondary bg-surface-2 border border-white/10 hover:bg-white/10 hover:text-white transition-colors" 
              onClick={onClose}
            >
              Batal
            </button>
            <button 
              className="flex-[2] sm:flex-none py-3 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] disabled:opacity-50 disabled:shadow-none active:scale-[0.98] transition-all flex items-center justify-center gap-2" 
              onClick={onCheckout} 
              disabled={splitCount === 0}
            >
              <CheckCircle size={18} /> 
              Bayar Split
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
