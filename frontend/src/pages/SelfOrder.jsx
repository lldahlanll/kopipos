import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPublicMenu, getStoreInfo, createSelfOrder, getMemberProfile, getMemberOrders } from '../api/selfOrder';
import { Search, ShoppingCart, Plus, PlusCircle, AlertTriangle, Lock, User, ClipboardList, X } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import toast from 'react-hot-toast';

import SelfOrderProductSheet from '../components/selforder/SelfOrderProductSheet';
import SelfOrderCart from '../components/selforder/SelfOrderCart';
import SelfOrderCheckout from '../components/selforder/SelfOrderCheckout';
import MemberAuth from '../components/selforder/MemberAuth';
import { loadMidtransSnap } from '../utils/midtrans';

export default function SelfOrder() {
  const navigate = useNavigate();
  const [menuData, setMenuData] = useState({ categories: [], products: [], modifiers: [] });
  const [storeInfo, setStoreInfo] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [member, setMember] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [tableNum, setTableNum] = useState(null);

  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Guard anti-double-submit: useRef tidak menyebabkan re-render, jadi lebih cepat dari useState
  const isSubmittingRef = useRef(false);

  // For Cart Animation
  const [cartPulse, setCartPulse] = useState(false);

  const [showMyOrders, setShowMyOrders] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const fetchMyOrders = async () => {
    if (!localStorage.getItem('member_token')) return;
    setLoadingOrders(true);
    try {
      const res = await getMemberOrders();
      setMyOrders(res.data);
    } catch (err) {
      console.error('Gagal mengambil riwayat pesanan', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const table = searchParams.get('table');
    if (table) {
      setTableNum(table);
      localStorage.setItem('selfOrder_tableNumber', table);
    }

    const checkAuthAndLoad = async () => {
      setAuthChecking(true);
      const token = localStorage.getItem('member_token');
      if (token) {
        try {
          const profileRes = await getMemberProfile();
          setMember(profileRes.data);
          getMemberOrders().then(res => setMyOrders(res.data)).catch(() => {});
        } catch (err) {
          console.error('Member session invalid', err);
          localStorage.removeItem('member_token');
          localStorage.removeItem('member_profile');
          setMember(null);
        }
      }
      setAuthChecking(false);

      Promise.all([
        getStoreInfo(),
        getPublicMenu()
      ]).then(([infoRes, menuRes]) => {
        setStoreInfo(infoRes.data);
        setMenuData(menuRes.data);
        if (menuRes.data.categories.length > 0 || menuRes.data.products.some(p => p.is_recommended || p.is_bestseller || p.is_favorite)) {
          // Determine the first active category prioritizing virtual ones
          if (menuRes.data.products.some(p => p.is_recommended)) setActiveCategory(prev => prev === null ? 'virtual_recommended' : prev);
          else if (menuRes.data.products.some(p => p.is_bestseller)) setActiveCategory(prev => prev === null ? 'virtual_bestseller' : prev);
          else if (menuRes.data.products.some(p => p.is_favorite)) setActiveCategory(prev => prev === null ? 'virtual_favorite' : prev);
          else setActiveCategory(prev => prev === null ? menuRes.data.categories[0].id : prev);
        }
        if (infoRes.data.theme_color) {
          document.documentElement.style.setProperty('--color-primary', infoRes.data.theme_color);
        }
      }).catch(err => {
        console.error('Gagal memuat data toko', err);
      }).finally(() => {
        setLoading(false);
      });
    };

    checkAuthAndLoad();

    const interval = setInterval(() => {
      if (!document.hidden) {
        getPublicMenu().then(res => setMenuData(res.data)).catch(() => {});
        if (localStorage.getItem('member_token')) {
          getMemberProfile().then(res => setMember(res.data)).catch(() => {});
          getMemberOrders().then(res => setMyOrders(res.data)).catch(() => {});
        }
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      document.documentElement.style.removeProperty('--color-primary');
    };
  }, []);

  useEffect(() => {
    if (storeInfo.midtrans_client_key) {
      loadMidtransSnap(storeInfo.midtrans_client_key, storeInfo.midtrans_is_production);
    }
  }, [storeInfo.midtrans_client_key, storeInfo.midtrans_is_production]);

  const handleAddToCart = (item) => {
    const cartKey = `${item.product.id}-${item.variant?.id || 0}-${item.modifiers.map(m => m.id).sort().join(',')}-${item.notes}`;
    const existingIdx = cart.findIndex(c => c.cartKey === cartKey);
    
    let unitPrice = item.product.base_price;
    if (item.variant) unitPrice += item.variant.price_adjustment;
    item.modifiers.forEach(m => { unitPrice += m.price_adjustment; });

    if (existingIdx >= 0) {
      const newCart = [...cart];
      const newQty = newCart[existingIdx].qty + item.qty;
      newCart[existingIdx] = {
        ...newCart[existingIdx],
        qty: newQty,
        subtotal: newQty * unitPrice,
      };
      setCart(newCart);
    } else {
      setCart([...cart, { ...item, cartKey, unitPrice, subtotal: unitPrice * item.qty }]);
    }
    
    // Trigger pulse animation
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 300);
    
    toast.success(`${item.product.name} ditambahkan!`, {
      style: { borderRadius: '12px', background: 'var(--bg-surface-2)', color: 'var(--text-primary)' }
    });
  };

  const handleQuickAdd = (p, e) => {
    e.stopPropagation();
    if (p.variants && p.variants.length > 0) {
      setSelectedProduct(p);
    } else {
      handleAddToCart({
        product: p,
        variant: null,
        modifiers: [],
        qty: 1,
        notes: ''
      });
    }
  };

  const handleBuyNow = (item) => {
    handleAddToCart(item);
    setShowCart(false);
    setShowCheckout(true);
  };

  const handleUpdateCartQty = (idx, delta) => {
    const newCart = [...cart];
    const newQty = newCart[idx].qty + delta;
    if (newQty <= 0) {
      newCart.splice(idx, 1);
      if (newCart.length === 0) setShowCart(false);
    } else {
      newCart[idx] = {
        ...newCart[idx],
        qty: newQty,
        subtotal: newQty * newCart[idx].unitPrice,
      };
    }
    setCart(newCart);
  };

  const handleRemoveFromCart = (idx) => {
    const newCart = [...cart];
    newCart.splice(idx, 1);
    setCart(newCart);
    if (newCart.length === 0) setShowCart(false);
  };

  const handleSubmitOrder = async (checkoutData) => {
    // Lapisan 1: Guard instan — blokir sebelum React sempat re-render
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    try {
      const payload = {
        customer_name: checkoutData.customerName,
        order_type: checkoutData.orderType,
        payment_method: checkoutData.paymentMethod,
        notes: checkoutData.tableNumber ? `Meja: ${checkoutData.tableNumber}` : null,
        redeem_points: checkoutData.redeemPoints || 0,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.qty,
          variant_id: item.variant?.id || null,
          modifier_ids: item.modifiers.length > 0 ? item.modifiers.map(m => m.id) : null
        }))
      };
      
      // Lapisan 2: Kirim idempotency key ke backend (UUID unik per sesi checkout)
      const res = await createSelfOrder(payload, checkoutData.idempotencyKey);
      toast.success('Pesanan berhasil dibuat!');
      setCart([]);
      
      // Refresh points
      try {
        const profileRes = await getMemberProfile();
        setMember(profileRes.data);
      } catch (err) {
        console.error('Gagal memuat ulang profil member', err);
      }

      if (res.data.payment_token) {
        if (window.snap) {
          window.snap.pay(res.data.payment_token, {
            onSuccess: (result) => {
              toast.success('Pembayaran berhasil!');
              navigate(`/order/status/${res.data.id}`);
            },
            onPending: (result) => {
              toast.success('Pembayaran sedang ditunda.');
              navigate(`/order/status/${res.data.id}`);
            },
            onError: (result) => {
              toast.error('Pembayaran gagal!');
              navigate(`/order/status/${res.data.id}`);
            },
            onClose: () => {
              toast.error('Popup pembayaran ditutup.');
              navigate(`/order/status/${res.data.id}`);
            }
          });
        } else {
          toast.error('Midtrans Snap SDK belum dimuat. Mengarahkan ke halaman status...');
          navigate(`/order/status/${res.data.id}`);
        }
      } else {
        navigate(`/order/status/${res.data.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat pesanan');
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  if (authChecking) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-body">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-bold text-text-secondary animate-pulse">Memeriksa Keanggotaan...</span>
        </div>
      </div>
    );
  }

  if (!member) {
    return <MemberAuth onAuthSuccess={(profile) => setMember(profile)} />;
  }

  if (loading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-body text-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm font-bold text-text-secondary animate-pulse">Memuat Menu...</span>
        </div>
      </div>
    );
  }

  // Construct virtual categories
  const virtualCategories = [];
  if (menuData.products.some(p => p.is_recommended)) virtualCategories.push({ id: 'virtual_recommended', name: '⭐ Rekomendasi' });
  if (menuData.products.some(p => p.is_bestseller)) virtualCategories.push({ id: 'virtual_bestseller', name: '🔥 Terlaris' });
  if (menuData.products.some(p => p.is_favorite)) virtualCategories.push({ id: 'virtual_favorite', name: '❤️ Menu Fav' });

  const activeCatIds = new Set(menuData.products.map(p => p.category_id));
  const validCategories = menuData.categories.filter(c => activeCatIds.has(c.id));
  const displayCategories = [...virtualCategories, ...validCategories];

  const filteredProducts = menuData.products.filter(p => {
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (!searchQuery && activeCategory) {
      if (activeCategory === 'virtual_recommended') return p.is_recommended;
      if (activeCategory === 'virtual_bestseller') return p.is_bestseller;
      if (activeCategory === 'virtual_favorite') return p.is_favorite;
      return p.category_id === activeCategory;
    }
    return true;
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-body overflow-hidden text-text-primary max-w-[500px] mx-auto relative shadow-2xl border-x border-white/5">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 bg-surface/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {storeInfo.store_logo ? (
              <img src={storeInfo.store_logo} alt="Logo" className="h-10 rounded-xl shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-black text-sm shadow-sm">
                {storeInfo.store_name ? storeInfo.store_name.substring(0,2).toUpperCase() : 'KP'}
              </div>
            )}
            <div className="flex flex-col">
              <span className="font-black text-[15px] text-text-primary leading-tight">
                Halo, {member ? member.name.split(' ')[0] : 'Pelanggan'}! 👋
              </span>
              {member ? (
                <span className="text-[11px] font-black text-amber-500 flex items-center gap-1 select-none">
                  🪙 {member.points} Poin
                </span>
              ) : (
                <span className="text-[11px] font-bold text-primary">{storeInfo.store_name || "KopiPOS"}</span>
              )}
            </div>
          </div>
          
          {member && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setShowMyOrders(true);
                  fetchMyOrders();
                }}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-secondary transition-all active:scale-95 border border-white/5 relative"
                title="Pesanan Saya"
              >
                <ClipboardList size={16} />
                {myOrders.some(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)) && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
              <button 
                onClick={() => {
                  if (window.confirm('Keluar dari akun member?')) {
                    localStorage.removeItem('member_token');
                    localStorage.removeItem('member_profile');
                    setMember(null);
                    setMyOrders([]);
                    toast.success('Berhasil keluar');
                  }
                }}
                className="w-9 h-9 rounded-full bg-white/5 hover:bg-danger/10 hover:text-danger flex items-center justify-center text-text-secondary transition-all active:scale-95 border border-white/5"
                title="Keluar Member"
              >
                <User size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#0f1219]">
        {/* Search */}
        <div className="px-5 pt-5 pb-2">
          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              className="w-full py-3.5 pl-12 pr-4 rounded-2xl bg-surface-2 border border-white/5 text-text-primary font-medium text-[15px] transition-all outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 focus:bg-surface placeholder-text-muted shadow-sm" 
              placeholder="Mau minum apa hari ini?" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        {!searchQuery && (
          <div className="flex overflow-x-auto gap-3 px-5 py-4 no-scrollbar">
            {displayCategories.map(c => {
              const isActive = activeCategory === c.id;
              return (
                <button 
                  key={c.id} 
                  className={`px-5 py-2.5 rounded-full whitespace-nowrap text-[14px] font-bold transition-all shrink-0 border ${isActive ? 'bg-primary text-white border-primary shadow-[0_4px_16px_rgba(200,162,122,0.4)] scale-105' : 'bg-surface-2 text-text-secondary border-white/5 hover:border-white/10 hover:bg-surface-3 hover:text-white active:scale-95'}`}
                  onClick={() => setActiveCategory(c.id)}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Product Grid */}
        <div className="grid grid-cols-2 gap-4 px-5 pb-32 pt-2">
          {filteredProducts.map(p => (
            <div 
              key={p.id} 
              className="bg-surface border border-white/5 rounded-3xl overflow-hidden cursor-pointer shadow-sm transition-all hover:border-white/10 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] flex flex-col group relative" 
              onClick={() => setSelectedProduct(p)}
            >
              {/* Badges */}
              {p.is_recommended && (
                <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider z-10 flex items-center gap-0.5 select-none">
                  ⭐ Recs
                </span>
              )}
              {!p.is_recommended && p.is_bestseller && (
                <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider z-10 flex items-center gap-0.5 select-none">
                  🔥 Best
                </span>
              )}
              {!p.is_recommended && !p.is_bestseller && p.is_favorite && (
                <span className="absolute top-2.5 left-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-md shadow-md uppercase tracking-wider z-10 flex items-center gap-0.5 select-none">
                  ❤️ Fav
                </span>
              )}

              <div className="aspect-square w-full bg-surface-2 relative overflow-hidden">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface-3 to-surface-2 text-primary/40 relative">
                    <span className="text-[42px] leading-none select-none">☕</span>
                    <span className="text-[9px] font-bold text-text-muted mt-2 tracking-wider uppercase bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                      No Photo
                    </span>
                  </div>
                )}
                {/* Floating Add Button Overlay */}
                <button 
                  type="button"
                  onClick={(e) => handleQuickAdd(p, e)}
                  className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center backdrop-blur-md shadow-lg opacity-90 hover:opacity-100 hover:scale-105 active:scale-95 transition-all z-10 border border-white/10"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between bg-gradient-to-b from-surface to-surface-2">
                <h4 className="text-[14px] font-bold text-text-primary mb-1.5 leading-snug line-clamp-2 group-hover:text-primary transition-colors">{p.name}</h4>
                <div className="text-[15px] font-black text-primary">{formatRupiah(p.base_price)}</div>
              </div>
            </div>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-2 text-center py-12 px-4">
              <div className="w-20 h-20 mx-auto bg-surface-2 rounded-full flex items-center justify-center mb-4 text-text-muted">
                <Search size={32} />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">Pencarian Tidak Ditemukan</h3>
              <p className="text-sm text-text-muted">Maaf, menu yang Anda cari tidak tersedia.</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Cart Button */}
      {cart.length > 0 && !showCart && !showCheckout && (
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-body via-body/90 to-transparent pointer-events-none z-30">
          <div 
            className={`pointer-events-auto w-full bg-gradient-to-r from-primary to-accent rounded-2xl p-4 flex items-center justify-between text-white shadow-[0_8px_32px_rgba(200,162,122,0.4)] cursor-pointer transition-all active:scale-[0.98] ${cartPulse ? 'scale-[1.02] ring-4 ring-primary/30' : 'hover:scale-[1.02]'}`} 
            onClick={() => setShowCart(true)}
          >
            <div className="flex items-center gap-4">
              <div className="relative bg-white/20 p-2.5 rounded-xl">
                <ShoppingCart size={22} />
                <div className="absolute -top-2 -right-2 bg-danger text-white text-[12px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-primary shadow-sm">
                  {cartItemCount}
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-white/80">Total Pesanan</span>
                <span className="text-[16px] font-black leading-tight">{formatRupiah(cartTotal)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/20 px-4 py-2 rounded-xl text-[13px] font-bold">
              Keranjang <span className="text-lg leading-none">→</span>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && (
        <SelfOrderProductSheet 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
        />
      )}

      {showCart && (
        <SelfOrderCart 
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={handleUpdateCartQty}
          onRemoveItem={handleRemoveFromCart}
          onCheckout={() => { setShowCart(false); setShowCheckout(true); }}
        />
      )}

      {showCheckout && (
        <SelfOrderCheckout
          cart={cart}
          onBack={() => { setShowCheckout(false); setShowCart(true); }}
          onSubmit={handleSubmitOrder}
          loading={submitting}
          tableLocked={!!tableNum}
          tableNum={tableNum}
          member={member}
        />
      )}

      {showMyOrders && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowMyOrders(false)}
          />
          
          {/* Bottom Sheet */}
          <div 
            className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto bg-surface rounded-t-3xl z-[101] flex flex-col max-h-[80vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300 border-x border-t border-white/5"
          >
            {/* Handle */}
            <div className="flex justify-center p-3 shrink-0">
              <div className="w-10 h-1.5 bg-white/10 rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b border-white/5 flex justify-between items-center shrink-0">
              <h3 className="text-xl font-bold text-text-primary">Pesanan Saya</h3>
              <button 
                onClick={() => setShowMyOrders(false)} 
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-secondary hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">
              {loadingOrders ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm font-medium text-text-secondary">Memuat pesanan...</span>
                </div>
              ) : myOrders.length === 0 ? (
                <div className="text-center py-12">
                  <span className="text-4xl">📭</span>
                  <p className="text-sm font-bold text-text-secondary mt-3">Belum ada riwayat pesanan</p>
                  <p className="text-xs text-text-muted mt-1">Silakan pilih menu dan buat pesanan pertama Anda.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {myOrders.map(order => {
                    let statusLabel = 'Menunggu';
                    let statusColor = 'bg-yellow-500/12 text-yellow-500 border-yellow-500/20';
                    switch (order.status) {
                      case 'pending':
                        statusLabel = 'Menunggu Konfirmasi';
                        statusColor = 'bg-yellow-500/12 text-yellow-500 border-yellow-500/20';
                        break;
                      case 'confirmed':
                        statusLabel = 'Diterima';
                        statusColor = 'bg-blue-500/12 text-blue-500 border-blue-500/20';
                        break;
                      case 'preparing':
                        statusLabel = 'Sedang Dibuat';
                        statusColor = 'bg-orange-500/12 text-orange-500 border-orange-500/20';
                        break;
                      case 'ready':
                        statusLabel = 'Siap Diambil';
                        statusColor = 'bg-green-500/12 text-green-500 border-green-500/20 animate-pulse';
                        break;
                      case 'paid':
                        statusLabel = 'Selesai';
                        statusColor = 'bg-gray-500/12 text-gray-400 border-gray-500/20';
                        break;
                      case 'cancelled':
                        statusLabel = 'Dibatalkan';
                        statusColor = 'bg-red-500/12 text-red-500 border-red-500/20';
                        break;
                    }

                    return (
                      <div 
                        key={order.id}
                        onClick={() => {
                          setShowMyOrders(false);
                          navigate(`/order/status/${order.id}`);
                        }}
                        className="p-4 rounded-2xl bg-surface-2 border border-white/5 hover:border-white/10 transition-all cursor-pointer flex flex-col gap-2 hover:bg-surface-3 active:scale-[0.99]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-text-primary">{order.order_number}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 border rounded-full ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-text-secondary mt-1">
                          <span>{new Date(order.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                          <span className="font-black text-primary">{formatRupiah(order.total)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
