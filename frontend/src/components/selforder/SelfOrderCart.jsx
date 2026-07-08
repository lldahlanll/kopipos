import { X, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { formatRupiah } from '../../utils/format';

export default function SelfOrderCart({ cart, onClose, onUpdateQty, onRemoveItem, onCheckout }) {
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-surface rounded-t-3xl z-[101] flex flex-col h-[85vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 border-x border-t border-white/5"
      >
        {/* Handle */}
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-10 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-white/5 flex justify-between items-center shrink-0">
          <h3 className="text-xl font-bold flex items-center gap-2 text-text-primary">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ShoppingCart size={16} />
            </div>
            Keranjang
          </h3>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4">
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                <ShoppingCart size={40} className="opacity-20" />
              </div>
              <p className="font-medium">Keranjang masih kosong</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {cart.map((item, idx) => (
                <div key={item.cartKey} className="flex gap-4 bg-surface-2 p-4 rounded-2xl border border-white/5 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[15px] font-bold text-text-primary mb-1 truncate">{item.product.name}</h4>
                    <div className="flex flex-col gap-0.5">
                      {item.variant && <span className="text-[12px] font-medium text-text-muted bg-white/5 w-fit px-2 py-0.5 rounded-md">Varian: {item.variant.name}</span>}
                      {item.modifiers.length > 0 && <span className="text-[12px] font-medium text-text-muted bg-white/5 w-fit px-2 py-0.5 rounded-md mt-1">Ekstra: {item.modifiers.map(m => m.name).join(', ')}</span>}
                      {item.notes && <span className="text-[12px] text-warning italic mt-1.5">"{item.notes}"</span>}
                    </div>
                    <div className="text-[14px] font-black text-primary mt-3">{formatRupiah(item.subtotal)}</div>
                  </div>
                  
                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button 
                      onClick={() => onRemoveItem(idx)} 
                      className="p-2 text-danger/70 hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    
                    <div className="flex items-center gap-3 bg-surface border border-white/5 p-1 rounded-xl shadow-inner mt-2">
                      <button 
                        onClick={() => onUpdateQty(idx, -1)} 
                        className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-text-primary hover:bg-surface-3 transition-colors active:scale-95"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-[14px] font-bold min-w-[20px] text-center">{item.qty}</span>
                      <button 
                        onClick={() => onUpdateQty(idx, 1)} 
                        className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-colors active:scale-95"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-5 border-t border-white/5 bg-surface shrink-0 pb-8 sm:pb-5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[15px] font-bold text-text-secondary">Total Pembayaran</span>
              <span className="text-xl font-black text-primary">{formatRupiah(cartTotal)}</span>
            </div>
            <button 
              className="w-full bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] text-white p-4 rounded-xl font-bold text-[15px] transition-all active:scale-[0.98]" 
              onClick={onCheckout}
            >
              Lanjut ke Checkout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
