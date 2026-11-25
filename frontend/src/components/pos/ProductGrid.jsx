import { useState } from 'react';
import { Search, ShoppingCart, X, Plus, Coffee, Receipt, Zap } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import { formatRupiah } from '../../utils/format';
import { useNavigate } from 'react-router-dom';

// Kosong = path relatif (/uploads/...) → diproxy oleh Vite (dev) / nginx (prod).
const API_BASE = import.meta.env.VITE_API_URL || '';

function ProductImage({ src, name }) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-2 to-surface-3">
        <Coffee size={36} className="opacity-30 text-primary" />
      </div>
    );
  }
  return (
    <img
      src={src.startsWith('http') ? src : `${API_BASE}${src}`}
      alt={name}
      onError={() => setError(true)}
      className="w-full h-full object-cover block"
    />
  );
}

export default function ProductGrid() {
  const { filteredProducts, search, setSearch, addToCart, modifiers } = usePOS();
  const navigate = useNavigate();

  const [showVariantModal, setShowVariantModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  const [selectedModifiers, setSelectedModifiers] = useState([]);

  const handleProductClick = (product) => {
    const activeGroups = (product.modifier_groups || []).filter(g => g.status === 'active');
    if (activeGroups.length > 0) {
      setPendingProduct(product);
      setSelectedModifiers([]);
      setShowVariantModal(true);
    } else {
      addToCart(product);
    }
  };

  const confirmVariantModal = () => {
    addToCart(pendingProduct, selectedModifiers);
    setShowVariantModal(false);
    setPendingProduct(null);
  };

  const handleModifierSelect = (group, mod) => {
    if (mod.is_out_of_stock) return;

    const isSelected = selectedModifiers.some(sm => sm.id === mod.id);

    if (group.selection_type === 'radio') {
      if (isSelected) {
        if (!group.required) {
          // Optional radio can be deselected
          setSelectedModifiers(prev => prev.filter(sm => sm.id !== mod.id));
        }
      } else {
        // Remove other selected options from this same group, then add mod
        setSelectedModifiers(prev => [
          ...prev.filter(sm => sm.modifier_group_id !== group.id),
          mod
        ]);
      }
    } else if (group.selection_type === 'checkbox') {
      if (isSelected) {
        setSelectedModifiers(prev => prev.filter(sm => sm.id !== mod.id));
      } else {
        const selectedInGroup = selectedModifiers.filter(sm => sm.modifier_group_id === group.id);
        if (selectedInGroup.length < group.max_select) {
          setSelectedModifiers(prev => [...prev, mod]);
        } else {
          // If max select is 1 (unlikely but possible), behave like radio
          if (group.max_select === 1) {
            setSelectedModifiers(prev => [
              ...prev.filter(sm => sm.modifier_group_id !== group.id),
              mod
            ]);
          } else {
            alert(`Maksimal memilih ${group.max_select} untuk ${group.name}`);
          }
        }
      }
    }
  };

  // Dynamic price calculation
  const currentUnitPrice = pendingProduct
    ? pendingProduct.base_price + selectedModifiers.reduce((sum, m) => sum + m.price_adjustment, 0)
    : 0;

  // Validation
  const activeGroups = pendingProduct
    ? (pendingProduct.modifier_groups || []).filter(g => g.status === 'active')
    : [];

  const isSelectionValid = activeGroups.every(g => {
    const selectedInGroup = selectedModifiers.filter(sm => sm.modifier_group_id === g.id);
    const count = selectedInGroup.length;
    if (g.required) {
      return count >= g.min_select && count <= g.max_select;
    } else {
      return count === 0 || (count >= g.min_select && count <= g.max_select);
    }
  });

  return (
    <div className="w-full h-full flex flex-col">
      {/* ── Search Bar ── */}
      <div className="sticky top-0 z-10 flex gap-3 items-center px-4 md:px-6 lg:px-8 py-3.5 bg-gradient-to-b from-body to-transparent backdrop-blur-md border-b border-white/5">
        <div className="relative flex-1 min-w-0">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
          <input
            className="w-full pl-10 pr-9 h-10 rounded-[10px] text-[14px] font-medium transition-shadow flex items-center bg-surface border border-white/10 text-text-primary outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 placeholder:text-text-muted/70"
            placeholder="Cari menu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors rounded-full p-0.5 hover:bg-white/10 text-text-muted"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          className="flex items-center justify-center h-[42px] gap-2 px-4 rounded-xl font-semibold text-[13px] transition-all shrink-0 hover:bg-white/10 active:scale-95 bg-surface border border-white/10 text-text-secondary"
          onClick={() => navigate('/transactions')}
          title="Riwayat Transaksi"
        >
          <Receipt size={16} />
          <span className="hidden lg:inline">Transaksi</span>
        </button>
      </div>

      {/* ── Product Grid ── */}
      {filteredProducts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-text-muted">
          <ShoppingCart size={52} className="mb-4 opacity-20" />
          <p className="text-lg font-semibold">Tidak ada menu ditemukan</p>
          <p className="text-sm mt-1 opacity-70">Coba kata kunci lain</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4 pb-8 px-4 md:px-6 lg:px-8 py-4">
          {filteredProducts.map(product => {
            const activeGroupCount = product.modifier_groups?.filter(g => g.status === 'active').length || 0;
            return (
              <div
                key={product.id}
                className="group flex flex-col bg-surface border border-white/5 rounded-2xl overflow-hidden cursor-pointer transition-colors duration-200 hover:bg-surface-2 hover:border-white/15"
                onClick={() => handleProductClick(product)}
              >
                {/* Image */}
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-surface-2 border-b border-white/5">
                  <div className="w-full h-full transition-transform duration-300 group-hover:scale-105 group-hover:opacity-60">
                    <ProductImage src={product.image_url} name={product.name} />
                  </div>
                  {/* Overlay shimmer on hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-surface-2/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                  {/* Modifier group badge */}
                  {activeGroupCount > 0 && (
                    <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-black/65 backdrop-blur-[4px] text-primary border border-primary/25">
                      <Zap size={9} />
                      {activeGroupCount} OPT
                    </div>
                  )}

                  {/* Add icon on hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl bg-primary text-white">
                      <Plus size={20} />
                    </div>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="font-bold text-[14px] leading-tight mb-1 text-text-primary line-clamp-2 transition-colors group-hover:text-primary">{product.name}</p>
                  <p className="font-bold text-[13px] text-text-muted">{formatRupiah(product.base_price)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Variant/Modifier Modal ── */}
      {showVariantModal && pendingProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/65 backdrop-blur-[6px]"
          onClick={() => setShowVariantModal(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-surface border border-white/10 max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-white/5">
              {pendingProduct.image_url && (
                <img
                  src={pendingProduct.image_url.startsWith('http') ? pendingProduct.image_url : `${API_BASE}${pendingProduct.image_url}`}
                  alt={pendingProduct.name}
                  className="w-14 h-14 object-cover rounded-xl shadow-md flex-shrink-0"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg leading-tight text-text-primary">{pendingProduct.name}</h3>
                {pendingProduct.description && (
                  <p className="text-xs mt-0.5 line-clamp-2 text-text-muted">{pendingProduct.description}</p>
                )}
                <p className="text-sm font-bold mt-1 text-primary">{formatRupiah(pendingProduct.base_price)}</p>
              </div>
              <button
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/10 text-text-muted"
                onClick={() => setShowVariantModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-6 divide-y divide-white/5">
              {activeGroups.map((group, idx) => (
                <div key={group.id} className={idx > 0 ? "pt-5" : ""}>
                  <div className="flex justify-between items-baseline mb-3">
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-text-primary">
                      {group.name}
                    </label>
                    <span className="text-[10px] font-semibold text-text-muted">
                      {group.required ? (
                        <span className="text-primary font-bold">Wajib</span>
                      ) : (
                        <span>Opsional</span>
                      )}
                      {group.selection_type === 'checkbox' && (
                        <span> (Min: {group.min_select}, Maks: {group.max_select})</span>
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {group.modifiers.filter(m => m.status === 'active').map(m => {
                      const isSelected = selectedModifiers.some(sm => sm.id === m.id);
                      return (
                        <button
                          key={m.id}
                          disabled={m.is_out_of_stock}
                          className={`px-4 py-3 rounded-xl border transition-all text-xs font-semibold flex flex-col justify-between text-left relative ${
                            m.is_out_of_stock
                              ? 'bg-white/5 border-dashed border-white/5 opacity-40 cursor-not-allowed text-text-muted'
                              : isSelected
                                ? 'shadow-[0_0_16px_rgba(200,162,122,0.25)] bg-primary/10 border-primary text-primary'
                                : 'hover:bg-white/10 bg-white/5 border-white/10 text-text-secondary'
                          }`}
                          onClick={() => handleModifierSelect(group, m)}
                        >
                          <span className="font-bold">{m.name}</span>
                          <span className="block text-[10px] opacity-75 mt-1 font-normal">
                            {m.is_out_of_stock ? 'Habis (Out of Stock)' : m.price_adjustment > 0 ? `+${formatRupiah(m.price_adjustment)}` : 'Free'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 flex gap-3 border-t border-white/10 bg-white/5">
              <button
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-colors hover:bg-white/10 active:scale-95 bg-white/5 border border-white/10 text-text-secondary"
                onClick={() => setShowVariantModal(false)}
              >
                Batal
              </button>
              <button
                className="flex-[2] py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 hover:shadow-[0_6px_24px_rgba(200,162,122,0.4)] active:scale-[0.98] bg-gradient-to-br from-primary to-accent text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                onClick={confirmVariantModal}
                disabled={!isSelectionValid}
              >
                <Plus size={18} />
                Tambah ({formatRupiah(currentUnitPrice)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
