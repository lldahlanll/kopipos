import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { getProducts } from '../api/products';
import { getCategories } from '../api/categories';
import { getModifiers } from '../api/modifiers';
import { getActiveShift, startShift, endShift } from '../api/shifts';
import { createOrder } from '../api/orders';
import { createExpense } from '../api/expenses';
import client from '../api/client';
import {
  saveOfflineOrder,
  getOfflineQueue,
  removeOfflineOrder,
  updateOfflineOrder,
  getOfflineQueueCount,
} from '../utils/offlineQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

const POSContext = createContext();

export function POSProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [modifiers, setModifiers] = useState([]);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('pos_cart');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);
  const [orderType, setOrderType] = useState('dine_in');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0); // nominal Rp

  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);

  // Success modal & loading state
  const [lastOrder, setLastOrder] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Guard anti-double-submit instan (tidak menunggu React re-render)
  const isSubmittingRef = useRef(false);
  // UUID checkout key — di-reset setiap kali cart dikosongkan / order sukses
  const checkoutKeyRef = useRef(crypto.randomUUID());

  // ── Offline Mode ──────────────────────────────────────────
  const { isOnline, isBrowserOnline, checkNow: checkConnection } = useOnlineStatus();
  const [offlineQueue, setOfflineQueue] = useState(() => getOfflineQueue());
  const [isSyncing, setIsSyncing] = useState(false);
  // track last online state to trigger sync when coming back online
  const wasOnlineRef = useRef(isOnline);

  /** Refresh local offlineQueue state dari localStorage */
  const refreshQueue = useCallback(() => {
    setOfflineQueue(getOfflineQueue());
  }, []);

  /**
   * Sinkronisasi semua order dalam antrian ke server.
   * Dipanggil otomatis saat koneksi pulih, atau manual oleh user.
   */
  const syncOfflineQueue = useCallback(async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    const toastId = toast.loading(`Menyinkronkan ${queue.length} order offline…`, { id: 'sync-toast' });

    try {
      // Coba kirim sekaligus via bulk endpoint
      const payload = queue.map(item => ({
        tmp_id: item.tmpId,
        order: item.payload,
      }));

      const res = await client.post('/orders/bulk-sync', payload);
      const results = res.data;

      let successCount = 0;
      let failCount = 0;

      results.forEach(result => {
        if (result.success) {
          removeOfflineOrder(result.tmp_id);
          successCount++;
        } else {
          updateOfflineOrder(result.tmp_id, {
            attempts: (queue.find(q => q.tmpId === result.tmp_id)?.attempts || 0) + 1,
            lastError: result.error,
          });
          failCount++;
        }
      });

      refreshQueue();

      if (failCount === 0) {
        toast.success(`✅ ${successCount} order berhasil disinkronkan!`, { id: toastId, duration: 4000 });
      } else {
        toast.error(`⚠️ ${successCount} berhasil, ${failCount} gagal. Cek antrian offline.`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      toast.error('Gagal sinkronisasi. Akan dicoba ulang saat online.', { id: toastId });
      console.error('[OfflineSync] Bulk sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, refreshQueue]);

  // Auto-sync saat koneksi pulih dari offline
  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;

    if (isOnline && !wasOnline) {
      // Koneksi baru saja pulih
      const queueCount = getOfflineQueueCount();
      if (queueCount > 0) {
        // Delay kecil agar koneksi benar-benar stabil
        setTimeout(() => syncOfflineQueue(), 1500);
      }
    }
  }, [isOnline, syncOfflineQueue]);

  const refreshActiveShift = useCallback(async () => {
    try {
      const res = await getActiveShift();
      setActiveShift(res.data);
      if (res.data && res.data.expenses) {
        setExpenses(res.data.expenses);
      } else {
        setExpenses([]);
      }
      return res.data;
    } catch (err) {
      console.error("Gagal memperbarui shift aktif:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshActiveShift().finally(() => setShiftLoading(false));

    getCategories(true).then(r => setCategories(r.data)).catch(() => toast.error("Gagal memuat kategori"));
    getProducts({ active_only: true }).then(r => setProducts(r.data)).catch(() => toast.error("Gagal memuat produk"));
    getModifiers(true).then(r => setModifiers(r.data)).catch(() => toast.error("Gagal memuat modifiers"));
  }, [refreshActiveShift]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCat && p.category_id !== selectedCat) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [products, selectedCat, search]);

  const addToCart = (product, mods = []) => {
    const cartKey = `${product.id}-${mods.map(m => m.id).sort().join(',')}`;
    const existingIdx = cart.findIndex(item => item.cartKey === cartKey);

    let unitPrice = product.base_price;
    mods.forEach(m => { unitPrice += m.price_adjustment; });

    if (existingIdx >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIdx].quantity + 1;
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: newQty,
        subtotal: newQty * unitPrice,
      };
      setCart(updated);
    } else {
      setCart([...cart, {
        cartKey,
        product_id: product.id,
        product_name: product.name,
        modifier_ids: mods.map(m => m.id),
        modifier_names: mods.map(m => m.name).join(', ') || null,
        unit_price: unitPrice,
        quantity: 1,
        subtotal: unitPrice,
      }]);
    }
    toast.success(`${product.name} ditambahkan`);
  };

  const updateQty = (idx, delta) => {
    const updated = [...cart];
    const newQty = updated[idx].quantity + delta;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx] = {
        ...updated[idx],
        quantity: newQty,
        subtotal: newQty * updated[idx].unit_price,
      };
    }
    setCart(updated);
  };

  const removeItem = (idx) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Keranjang kosong!");
      return;
    }
    // Lapisan 1: Guard instan — blokir sebelum React sempat re-render
    if (isSubmitting || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const payload = {
      order_type: orderType,
      payment_method: paymentMethod,
      customer_name: customerName || null,
      notes: notes || null,
      discount: discount || 0,
      items: cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        modifier_ids: item.modifier_ids.length > 0 ? item.modifier_ids : null,
      })),
    };

    // ── Mode Offline ──
    if (!isOnline) {
      if (paymentMethod !== 'cash') {
        toast.error('Mode offline: hanya pembayaran Tunai (Cash) yang tersedia.');
        setIsSubmitting(false);
        return;
      }
      try {
        const queuedItem = saveOfflineOrder(payload);
        refreshQueue();

        // Buat "order lokal" untuk ditampilkan di success modal
        const localOrder = {
          id: null,
          order_number: queuedItem.tmpId,
          order_type: orderType,
          payment_method: paymentMethod,
          customer_name: customerName || null,
          subtotal: cartTotal,
          discount: discount || 0,
          total: cartFinalTotal,
          items: cart,
          _isOffline: true,
        };

        setLastOrder(localOrder);
        setShowSuccess(true);
        setCart([]);
        setCustomerName('');
        setNotes('');
        setDiscount(0);
        toast.success(`Order disimpan offline (${queuedItem.tmpId})`, { duration: 5000 });
      } catch (err) {
        toast.error(err.message || 'Gagal menyimpan order offline');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // ── Mode Online (normal) ──
    try {
      // Lapisan 2: Kirim idempotency key ke backend (UUID unik per sesi checkout)
      const res = await createOrder(payload, checkoutKeyRef.current);
      setLastOrder(res.data);
      setShowSuccess(true);
      setCart([]);
      setCustomerName('');
      setNotes('');
      setDiscount(0);
      // Generate UUID baru untuk sesi checkout berikutnya
      checkoutKeyRef.current = crypto.randomUUID();
      toast.success("Order berhasil dibuat!");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat order');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleSplitCheckout = async (splitCart, remainingCart, splitPaymentMethod) => {
    if (splitCart.length === 0) return;
    // Lapisan 1: Guard instan — blokir sebelum React sempat re-render
    if (isSubmitting || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    // UUID unik per split checkout
    const splitKey = crypto.randomUUID();

    const splitTotal = splitCart.reduce((sum, item) => sum + item.subtotal, 0);

    const payload = {
      order_type: orderType, // Inherit from main cart
      payment_method: splitPaymentMethod,
      customer_name: customerName ? `${customerName} (Split)` : null,
      notes: notes ? `${notes} (Split)` : null,
      discount: 0, // Split bill doesn't inherit discount for simplicity
      items: splitCart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        modifier_ids: item.modifier_ids.length > 0 ? item.modifier_ids : null,
      })),
    };

    if (!isOnline) {
      if (splitPaymentMethod !== 'cash') {
        toast.error('Mode offline: hanya pembayaran Tunai (Cash) yang tersedia.');
        setIsSubmitting(false);
        return;
      }
      try {
        const queuedItem = saveOfflineOrder(payload);
        refreshQueue();

        const localOrder = {
          id: null,
          order_number: queuedItem.tmpId,
          order_type: orderType,
          payment_method: splitPaymentMethod,
          customer_name: payload.customer_name,
          subtotal: splitTotal,
          discount: 0,
          total: splitTotal,
          items: splitCart,
          _isOffline: true,
        };

        setLastOrder(localOrder);
        setShowSuccess(true);
        setCart(remainingCart);
        toast.success(`Split Order disimpan offline (${queuedItem.tmpId})`, { duration: 5000 });
      } catch (err) {
        toast.error(err.message || 'Gagal menyimpan split order offline');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      // Lapisan 2: Kirim idempotency key ke backend
      const res = await createOrder(payload, splitKey);
      setLastOrder(res.data);
      setShowSuccess(true);
      setCart(remainingCart);
      toast.success("Split Order berhasil dibuat!");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal membuat split order');
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  const handleStartShift = async (openingBalance) => {
    try {
      const res = await startShift({ opening_balance: parseFloat(openingBalance) || 0 });
      setActiveShift(res.data);
      setExpenses([]);
      toast.success("Shift berhasil dimulai");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal memulai shift');
    }
  };

  const handleEndShift = async (closingActual) => {
    try {
      await endShift(activeShift.id, { closing_actual: parseFloat(closingActual) || 0 });
      setActiveShift(null);
      setExpenses([]);
      toast.success("Shift telah diakhiri");
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengakhiri shift');
      throw err;
    }
  };

  const handleAddExpense = async (amount, description) => {
    if (!activeShift) return;
    try {
      const res = await createExpense(activeShift.id, { amount: parseFloat(amount), description });
      setExpenses([...expenses, res.data]);
      toast.success("Pengeluaran berhasil dicatat");
      return res.data;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mencatat pengeluaran');
      throw err;
    }
  };

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.subtotal, 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  
  useEffect(() => {
    if (discount > 0 && cartTotal < discount) {
      setDiscount(0);
    }
  }, [cartTotal, discount]);

  const cartFinalTotal = Math.max(cartTotal - discount, 0);


  // Self Order
  const [incomingOrders, setIncomingOrders] = useState([]);

  const fetchIncomingOrders = async () => {
    try {
      if (window.location.port === '5174') {
        setIncomingOrders([]);
        return;
      }
      const res = await client.get('/orders/incoming/pending');
      setIncomingOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch incoming orders', err);
    }
  };

  useEffect(() => {
    if (activeShift && isOnline) {
      fetchIncomingOrders();
      const interval = setInterval(() => {
        if (!document.hidden) fetchIncomingOrders();
      }, 10000); // Polling setiap 10 detik jika aktif
      return () => clearInterval(interval);
    }
  }, [activeShift, isOnline]);

  const confirmOrder = async (id) => {
    try {
      const res = await client.patch(`/orders/${id}/confirm`);
      toast.success('Order berhasil dikonfirmasi');
      fetchIncomingOrders();
      // Munculkan modal sukses agar kasir bisa mencetak struk fisik
      setLastOrder(res.data);
      setShowSuccess(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal konfirmasi order');
    }
  };

  return (
    <POSContext.Provider value={{
      categories, products, modifiers,
      selectedCat, setSelectedCat,
      search, setSearch,
      filteredProducts,
      cart, addToCart, updateQty, removeItem, cartTotal, cartCount, cartFinalTotal,
      discount, setDiscount,
      orderType, setOrderType,
      paymentMethod, setPaymentMethod,
      customerName, setCustomerName,
      notes, setNotes,
      handleCheckout, handleSplitCheckout,
      activeShift, shiftLoading, handleStartShift, handleEndShift, refreshActiveShift,
      expenses, handleAddExpense,
      lastOrder, showSuccess, setShowSuccess,
      isSubmitting,
      incomingOrders, confirmOrder, fetchIncomingOrders,
      // Offline
      isOnline, isBrowserOnline,
      offlineQueue, isSyncing,
      syncOfflineQueue, checkConnection,
    }}>
      {children}
    </POSContext.Provider>
  );
}

export function usePOS() {
  return useContext(POSContext);
}
