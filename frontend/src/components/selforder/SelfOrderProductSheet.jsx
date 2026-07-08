import { useState, useEffect } from 'react';
import { X, Minus, Plus } from 'lucide-react';
import { formatRupiah } from '../../utils/format';
import toast from 'react-hot-toast';

export default function SelfOrderProductSheet({ product, onClose, onAddToCart, onBuyNow }) {
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);
  const [notes, setNotes] = useState('');

  // Default variant & required modifiers jika ada
  const activeGroups = product?.modifier_groups || [];
  const sizeGroup = activeGroups.find(g => 
    (g.name.toLowerCase().includes('size') || g.name.toLowerCase().includes('ukuran'))
  ) || activeGroups.find(g => g.required && g.selection_type === 'radio');

  useEffect(() => {
    if (!product) return;

    // Set default variant (size)
    if (sizeGroup && sizeGroup.modifiers?.length > 0) {
      setSelectedVariant(sizeGroup.modifiers[0]);
    } else if (product.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    } else {
      setSelectedVariant(null);
    }

    // Set default selections for other REQUIRED groups to ensure valid default order
    const initialModifiers = [];
    activeGroups.forEach(g => {
      if (g.id === sizeGroup?.id) return; // handled as variant
      if (g.required && g.modifiers?.length > 0) {
        initialModifiers.push(g.modifiers[0]);
      }
    });
    setSelectedModifiers(initialModifiers);
  }, [product]);

  if (!product) return null;

  const handleModifierSelect = (group, mod) => {
    if (mod.is_out_of_stock) return;

    if (group.id === sizeGroup?.id) {
      setSelectedVariant(mod);
      return;
    }

    const isSelected = selectedModifiers.some(sm => sm.id === mod.id);

    if (group.selection_type === 'radio') {
      if (isSelected) {
        if (!group.required) {
          setSelectedModifiers(selectedModifiers.filter(sm => sm.id !== mod.id));
        }
      } else {
        setSelectedModifiers([
          ...selectedModifiers.filter(sm => sm.modifier_group_id !== group.id),
          mod
        ]);
      }
    } else if (group.selection_type === 'checkbox') {
      if (isSelected) {
        const selectedInGroup = selectedModifiers.filter(sm => sm.modifier_group_id === group.id);
        if (group.required && selectedInGroup.length <= group.min_select) {
          toast.error(`Wajib memilih minimal ${group.min_select} opsi untuk ${group.name}`);
          return;
        }
        setSelectedModifiers(selectedModifiers.filter(sm => sm.id !== mod.id));
      } else {
        const selectedInGroup = selectedModifiers.filter(sm => sm.modifier_group_id === group.id);
        if (selectedInGroup.length < group.max_select) {
          setSelectedModifiers([...selectedModifiers, mod]);
        } else {
          if (group.max_select === 1) {
            setSelectedModifiers([
              ...selectedModifiers.filter(sm => sm.modifier_group_id !== group.id),
              mod
            ]);
          } else {
            toast.error(`Maksimal memilih ${group.max_select} opsi untuk ${group.name}`);
          }
        }
      }
    }
  };

  const handleModifierToggle = (mod) => {
    if (selectedModifiers.some(m => m.id === mod.id)) {
      setSelectedModifiers(selectedModifiers.filter(m => m.id !== mod.id));
    } else {
      setSelectedModifiers([...selectedModifiers, mod]);
    }
  };

  const isSelectionValid = activeGroups.every(g => {
    if (g.id === sizeGroup?.id) {
      return selectedVariant !== null;
    }

    const selectedInGroup = selectedModifiers.filter(sm => sm.modifier_group_id === g.id);
    const count = selectedInGroup.length;
    if (g.required) {
      return count >= g.min_select && count <= g.max_select;
    } else {
      return count === 0 || (count >= g.min_select && count <= g.max_select);
    }
  });

  const handleAddToCart = () => {
    if (!isSelectionValid) return;
    onAddToCart({
      product,
      variant: selectedVariant,
      modifiers: selectedModifiers,
      qty,
      notes
    });
    onClose();
  };

  const handleBuyNow = () => {
    if (!isSelectionValid) return;
    if (onBuyNow) {
      onBuyNow({
        product,
        variant: selectedVariant,
        modifiers: selectedModifiers,
        qty,
        notes
      });
    }
    onClose();
  };

  // Kalkulasi total per item
  let unitPrice = product.base_price;
  if (selectedVariant) unitPrice += selectedVariant.price_adjustment;
  selectedModifiers.forEach(m => { unitPrice += m.price_adjustment; });
  const totalPrice = unitPrice * qty;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-surface rounded-t-3xl z-[101] flex flex-col max-h-[90vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 border-x border-t border-white/5"
      >
        {/* Handle */}
        <div className="flex justify-center p-3 shrink-0">
          <div className="w-10 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-white/5 flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-xl font-bold text-text-primary mb-1">{product.name}</h3>
            <p className="text-lg font-black text-primary">{formatRupiah(product.base_price)}</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body scrollable */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Modifier Groups (Size, Sugar, Ice, Milk, Topping, etc.) */}
          {product.modifier_groups && product.modifier_groups.length > 0 ? (
            product.modifier_groups.map(group => {
              const activeModifiers = group.modifiers?.filter(m => m.is_active) || [];
              if (activeModifiers.length === 0) return null;

              const isSizeGrp = group.id === sizeGroup?.id;

              return (
                <div key={group.id} className="mb-6 animate-in fade-in duration-200">
                  <div className="flex justify-between items-baseline mb-3">
                    <h4 className="text-xs font-black text-text-secondary uppercase tracking-wider">
                      {group.name} {group.required && <span className="text-danger">*</span>}
                    </h4>
                    <span className="text-[10px] font-bold text-text-muted">
                      {group.required ? (
                        <span className="text-primary font-bold">Wajib</span>
                      ) : (
                        <span>Opsional</span>
                      )}
                      {group.selection_type === 'checkbox' && (
                        <span> (Maks: {group.max_select})</span>
                      )}
                    </span>
                  </div>
                  
                  <div className="flex flex-col gap-2.5">
                    {activeModifiers.map(m => {
                      const isSelected = isSizeGrp 
                        ? selectedVariant?.id === m.id
                        : selectedModifiers.some(sm => sm.id === m.id);

                      return (
                        <div 
                          key={m.id} 
                          onClick={() => handleModifierSelect(group, m)}
                          className={`flex items-center justify-between p-4 border rounded-2xl transition-all cursor-pointer active:scale-[0.99] ${m.is_out_of_stock ? 'opacity-40 cursor-not-allowed bg-surface-2 border-dashed border-white/5' : isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-white/5 bg-surface-2 hover:border-white/10 hover:bg-surface-3'}`}
                        >
                          <div className="flex items-center gap-3">
                            {group.selection_type === 'radio' || isSizeGrp ? (
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'border-primary' : 'border-text-muted'}`}>
                                {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                              </div>
                            ) : (
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'border-primary bg-primary text-white' : 'border-text-muted'}`}>
                                {isSelected && (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            )}
                            <span className={`text-[15px] font-bold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{m.name}</span>
                          </div>
                          <span className={`text-[13px] font-bold ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                            {m.is_out_of_stock ? 'Habis' : m.price_adjustment > 0 ? `+${formatRupiah(m.price_adjustment)}` : 'Free'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <>
              {/* Legacy Flat Variants */}
              {product.variants?.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold mb-3 text-text-secondary uppercase tracking-wider">Pilih Ukuran / Varian</h4>
                  <div className="flex flex-col gap-3">
                    {product.variants.filter(v => v.is_active).map(v => {
                      const isSelected = selectedVariant?.id === v.id;
                      return (
                        <div 
                          key={v.id} 
                          onClick={() => setSelectedVariant(v)}
                          className={`flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-white/5 bg-surface-2 hover:border-white/10 hover:bg-surface-3'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary' : 'border-text-muted'}`}>
                              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                            </div>
                            <span className={`text-[15px] font-bold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{v.name}</span>
                          </div>
                          {v.price_adjustment > 0 && <span className={`text-[13px] font-bold ${isSelected ? 'text-primary' : 'text-text-muted'}`}>+{formatRupiah(v.price_adjustment)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legacy Flat Modifiers */}
              {product.modifiers?.filter(m => m.is_active).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-bold mb-3 text-text-secondary uppercase tracking-wider">Pilih Tambahan / Modifier (Opsional)</h4>
                  <div className="flex flex-col gap-3">
                    {product.modifiers.filter(m => m.is_active).map(m => {
                      const isSelected = selectedModifiers.some(sm => sm.id === m.id);
                      return (
                        <div 
                          key={m.id} 
                          onClick={() => handleModifierToggle(m)}
                          className={`flex items-center justify-between p-4 border rounded-xl transition-all cursor-pointer active:scale-[0.98] ${isSelected ? 'border-primary bg-primary/10 shadow-md' : 'border-white/5 bg-surface-2 hover:border-white/10 hover:bg-surface-3'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary text-white' : 'border-text-muted'}`}>
                              {isSelected && (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`text-[15px] font-bold ${isSelected ? 'text-primary' : 'text-text-primary'}`}>{m.name}</span>
                          </div>
                          {m.price_adjustment > 0 && <span className={`text-[13px] font-bold ${isSelected ? 'text-primary' : 'text-text-muted'}`}>+{formatRupiah(m.price_adjustment)}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Notes */}
          <div className="mb-6">
            <h4 className="text-xs font-black text-text-secondary uppercase tracking-wider mb-3">Catatan Tambahan (Opsional)</h4>
            <textarea
              className="w-full bg-surface-2 border border-white/5 rounded-xl p-4 text-[14px] text-text-primary placeholder-text-muted focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all resize-none animate-in fade-in duration-200"
              rows="2"
              placeholder="Contoh: Gula dikit, es dipisah..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          {/* Qty */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <button 
              onClick={() => setQty(Math.max(1, qty - 1))} 
              disabled={qty <= 1} 
              className="w-12 h-12 rounded-full bg-surface-2 border border-white/5 text-text-primary flex items-center justify-center hover:bg-surface-3 disabled:opacity-50 disabled:hover:bg-surface-2 transition-colors active:scale-95 cursor-pointer"
            >
              <Minus size={22} />
            </button>
            <span className="text-2xl font-black min-w-[40px] text-center">{qty}</span>
            <button 
              onClick={() => setQty(qty + 1)} 
              className="w-12 h-12 rounded-full bg-surface-2 border border-white/5 text-text-primary flex items-center justify-center hover:bg-surface-3 transition-colors active:scale-95 cursor-pointer"
            >
              <Plus size={22} />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/5 bg-surface shrink-0 pb-8 sm:pb-5">
          <div className="flex gap-3">
            <button 
              disabled={!isSelectionValid}
              className="flex-1 bg-surface-2 border border-white/10 hover:bg-white/5 text-text-secondary hover:text-white py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              onClick={handleAddToCart}
            >
              + Keranjang
            </button>
            <button 
              disabled={!isSelectionValid}
              className="flex-[2] bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] text-white py-3.5 px-4 rounded-xl flex justify-between items-center transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none cursor-pointer" 
              onClick={handleBuyNow}
            >
              <span className="font-bold text-sm">Beli Sekarang</span>
              <span className="font-black text-sm">{formatRupiah(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
