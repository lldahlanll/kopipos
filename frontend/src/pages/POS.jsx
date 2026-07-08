import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { POSProvider, usePOS } from '../context/POSContext';
import CategoryList from '../components/pos/CategoryList';
import ProductGrid from '../components/pos/ProductGrid';
import CartSidebar from '../components/pos/CartSidebar';
import {
  X, CheckCircle, Printer, Monitor, Loader,
  Wifi, WifiOff, RefreshCw, Bell,
  AlertTriangle, User, Clock, LayoutGrid,
  ShoppingCart, Receipt, LogOut,
} from 'lucide-react';
import { getSettings } from '../api/settings';
import { printOrderViaBackend } from '../api/print';
import { formatRupiah } from '../utils/format';
import { connectQZ, printReceipt } from '../utils/qzPrint';
import { getActiveOrders, updateOrderStatus } from '../api/orders';
import toast from 'react-hot-toast';

function POSContent() {
  const {
    activeShift, shiftLoading, handleStartShift, handleEndShift, refreshActiveShift,
    expenses, handleAddExpense,
    lastOrder, showSuccess, setShowSuccess,
    incomingOrders, confirmOrder,
    isOnline, isBrowserOnline,
    offlineQueue, isSyncing,
    syncOfflineQueue,
    cartCount,
  } = usePOS();

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [activeOrders, setActiveOrders] = useState([]);
  const [showReadyModal, setShowReadyModal] = useState(false);

  const fetchActiveOrders = async () => {
    try {
      const res = await getActiveOrders();
      setActiveOrders(res.data);
    } catch (err) {
      console.error("Gagal memuat antrean pesanan", err);
    }
  };

  useEffect(() => {
    if (activeShift) {
      fetchActiveOrders();
      const interval = setInterval(() => {
        if (!document.hidden) fetchActiveOrders();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeShift]);

  const [openingBalance, setOpeningBalance] = useState('');
  const [closingActual, setClosingActual] = useState('');
  const [showEndShiftModal, setShowEndShiftModal] = useState(false);

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  const [storeSettings, setStoreSettings] = useState({});
  const [qzReady, setQzReady] = useState(false);
  const [posPrinting, setPosPrinting] = useState(false);
  const [posNetworkPrinting, setPosNetworkPrinting] = useState(false);
  const [showIncomingModal, setShowIncomingModal] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);

  const isOwner = user?.role === 'owner';

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    getSettings().then(r => setStoreSettings(r.data)).catch(() => { });
    connectQZ().then(() => setQzReady(true)).catch(() => setQzReady(false));
  }, []);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  if (shiftLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-body">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeShift) {
    const presets = [100000, 200000, 300000, 500000];
    return (
      <div className="h-screen w-full flex items-center justify-center bg-body px-4">
        <div className="bg-surface/90 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.6)] w-full max-w-md text-center animate-in relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(200,162,122,0.15)_0%,transparent_50%)] pointer-events-none" />
          
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white mx-auto mb-5 shadow-lg relative">
            <LayoutGrid size={32} />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-success border-2 border-surface"></span>
            </span>
          </div>

          <h2 className="text-2xl font-bold text-text-primary mb-1">Buka Shift Kasir</h2>
          <p className="text-text-muted text-xs mb-6">Masukkan saldo awal modal laci kasir sebelum mulai melayani pelanggan.</p>
          
          {/* Active Operator and Start Time Info */}
          <div className="bg-surface-2/60 border border-white/5 rounded-xl p-3.5 mb-6 text-left space-y-2 text-xs">
            <div className="flex justify-between items-center text-text-secondary">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Operator Aktif</span>
              <span className="font-semibold text-text-primary flex items-center gap-1">
                <User size={12} className="text-primary" />
                {user?.name || 'Kasir'} ({user?.role || 'Staff'})
              </span>
            </div>
            <div className="flex justify-between items-center text-text-secondary border-t border-white/5 pt-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Waktu Buka</span>
              <span className="font-mono font-semibold text-primary">
                {clock.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
                <span className="text-text-primary">
                  {clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </span>
            </div>
          </div>

          <div className="text-left mb-6">
            <label className="text-[10px] font-bold uppercase tracking-wider mb-2 block text-text-secondary">Saldo Awal Modal (Rp)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-text-muted">Rp</span>
              <input
                type="number"
                className="w-full bg-surface-2 border border-white/10 rounded-xl pl-11 pr-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="0"
                value={openingBalance}
                onChange={e => setOpeningBalance(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quick Balance Presets */}
            <div className="grid grid-cols-4 gap-1.5 mt-3">
              {presets.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setOpeningBalance(val.toString())}
                  className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all ${
                    openingBalance === val.toString()
                      ? 'bg-primary/20 text-primary border-primary'
                      : 'bg-surface-2 text-text-muted border-white/5 hover:bg-white/5 hover:text-text-primary'
                  }`}
                >
                  {val / 1000}K
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            {user?.role === 'owner' ? (
              <button className="flex-1 py-3 px-4 bg-surface-2 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-text-secondary hover:text-white transition-colors" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            ) : (
              <button 
                className="flex-1 py-3 px-4 bg-surface-2 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-text-secondary hover:text-white transition-colors" 
                onClick={() => {
                  if (window.confirm('Apakah Anda yakin ingin keluar dari sistem POS?')) {
                    logout();
                  }
                }}
              >
                Logout
              </button>
            )}
            <button
              className="flex-[2] py-3 px-4 rounded-xl font-bold text-text-inverse bg-gradient-to-r from-primary to-accent hover:shadow-[0_12px_32px_rgba(200,162,122,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200 relative z-10"
              onClick={() => handleStartShift(openingBalance)}
            >
              Buka Shift
            </button>
          </div>
        </div>
      </div>
    );
  }

  const connStatus = !isBrowserOnline ? 'offline' : !isOnline ? 'weak' : 'online';
  const hasOfflineBanner = connStatus !== 'online' || offlineQueue.length > 0;

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden bg-body text-text-primary">
      {/* Offline sync banner removed, integrated into right-side badge */}

      <header
        className="flex-shrink-0 h-[62px] md:h-[68px] flex items-center justify-between px-4 md:px-6 lg:px-8 z-20 bg-surface/95 border-b border-white/5 backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold shadow-lg flex-shrink-0 bg-gradient-to-br from-primary to-accent text-text-inverse">
            ☕
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[14px] leading-tight truncate max-w-[130px] sm:max-w-[180px] text-text-primary">
              {storeSettings.store_name || 'KopiPOS'}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-medium text-text-muted">
              <Clock size={10} className="shrink-0" />
              <span className="truncate">Shift: {activeShift.opened_by || user?.name || 'Kasir'}</span>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col items-center flex-shrink-0">
          <span className="font-mono text-xl font-black tracking-tight text-text-primary -tracking-[0.02em]">
            {clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-[10px] font-medium text-text-muted">
            {clock.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${connStatus === 'online' ? 'bg-success/10 text-success border-success/20' : connStatus === 'weak' ? 'bg-warning/10 text-warning border-warning/20 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.3)]' : 'bg-danger/10 text-danger border-danger/20 animate-pulse shadow-[0_0_12px_rgba(248,113,113,0.3)]'}`}>
            {connStatus === 'offline' ? <WifiOff size={14} /> : <Wifi size={14} />}
            <span>{connStatus === 'online' ? 'Online' : connStatus === 'weak' ? 'Lemah' : 'Offline'}</span>
            {offlineQueue.length > 0 && (
              <button 
                onClick={syncOfflineQueue} 
                disabled={!isOnline}
                className={`ml-1 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/20 hover:bg-black/30 transition-colors ${isSyncing ? 'animate-spin' : ''} ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Sinkronkan Data Offline"
              >
                <RefreshCw size={10} />
                <span>{offlineQueue.length}</span>
              </button>
            )}
          </div>

          <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/5 border border-white/10 ${qzReady ? 'text-text-secondary' : 'text-text-muted'}`}>
            <Printer size={14} />
            <span>{qzReady ? 'Printer' : 'No Printer'}</span>
          </div>

          {incomingOrders.length > 0 && (
            <button
              className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm shadow-lg transition-all hover:scale-105 animate-pulse bg-accent text-white"
              onClick={() => setShowIncomingModal(true)}
            >
              <Bell size={15} />
              <span>{incomingOrders.length} Baru</span>
            </button>
          )}

          <button
            className="lg:hidden relative flex items-center gap-1.5 px-2.5 py-2 rounded-xl transition-all hover:bg-white/10 bg-white/5 border border-white/10"
            onClick={() => setShowMobileCart(true)}
          >
            <ShoppingCart size={18} className="text-text-secondary" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-primary text-text-inverse">
                {cartCount}
              </span>
            )}
          </button>

          {activeShift && (
            <button
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:bg-white/10 bg-white/5 border border-white/10 text-text-secondary relative active:scale-95 cursor-pointer"
              onClick={() => {
                setShowReadyModal(true);
                fetchActiveOrders();
              }}
            >
              <CheckCircle size={14} className="text-success" />
              <span className="hidden md:inline">Antrean Siap</span>
              {activeOrders.filter(o => o.status === 'ready').length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-success text-white animate-pulse">
                  {activeOrders.filter(o => o.status === 'ready').length}
                </span>
              )}
            </button>
          )}

          {!isOwner ? (
            <button
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:bg-white/10 bg-white/5 border border-white/10 text-text-secondary"
              onClick={() => navigate('/transactions')}
            >
              <Receipt size={14} />
              <span className="hidden md:inline">Transaksi</span>
            </button>
          ) : (
            <button
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-bold transition-all hover:bg-white/10 bg-white/5 border border-white/10 text-text-secondary"
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10">
            <div className="w-6 h-6 shrink-0 rounded-full flex items-center justify-center bg-primary/15 text-primary">
              <User size={12} />
            </div>
            <span className="text-[12px] font-bold truncate max-w-[80px] text-text-secondary pr-1">
              {user?.name || 'Kasir'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-body relative">
          <CategoryList />
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden no-scrollbar">
            <ProductGrid />
          </div>
        </div>

        {showMobileCart && (
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowMobileCart(false)} />
        )}

        <aside className={`
          fixed inset-y-0 right-0 z-50 w-full max-w-[400px]
          lg:relative lg:inset-auto lg:z-10 lg:w-[360px] xl:w-[420px]
          flex-shrink-0 border-l border-white/5 bg-surface
          flex flex-col shadow-[-8px_0_32px_rgba(0,0,0,0.3)]
          transform transition-transform duration-300 ease-out
          ${showMobileCart ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          <div className="lg:hidden flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-surface-2 shrink-0">
            <div className="flex items-center gap-2 font-bold text-sm">
              <ShoppingCart size={16} />
              Keranjang
              {cartCount > 0 && (
                <span className="bg-primary text-text-inverse text-xs font-bold px-2 py-0.5 rounded-full">{cartCount}</span>
              )}
            </div>
            <button className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors" onClick={() => setShowMobileCart(false)}>
              <X size={18} />
            </button>
          </div>

          <CartSidebar
            onEndShiftClick={async () => {
              await refreshActiveShift();
              setShowMobileCart(false);
              setShowEndShiftModal(true);
            }}
            onExpenseClick={() => { setShowMobileCart(false); setShowExpenseModal(true); }}
            onCheckoutSuccess={() => setShowMobileCart(false)}
          />
        </aside>
      </div>

      {showIncomingModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowIncomingModal(false)}>
          <div className="w-full max-w-xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bell size={20} className="text-accent" />
                <span>Pesanan Self-Order Baru</span>
              </h3>
              <button className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors" onClick={() => setShowIncomingModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {incomingOrders.length === 0 ? (
                <div className="text-center py-12 text-text-muted flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 text-text-muted">
                    <Bell size={28} />
                  </div>
                  <p className="font-medium">Tidak ada pesanan baru.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {incomingOrders.map(order => (
                    <div key={order.id} className="bg-surface-2 p-5 rounded-2xl border border-primary/30 hover:border-primary/60 transition-colors shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="font-bold text-lg text-text-primary leading-tight">{order.customer_name || 'Pelanggan'}</div>
                          <div className="text-sm font-medium text-text-muted mt-1">{order.order_number} • {order.order_type === 'dine_in' ? '🍽 Dine In' : '🥡 Takeaway'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-black text-primary">{formatRupiah(order.total)}</div>
                          <div className="inline-block mt-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-warning/10 text-warning border border-warning/20">
                            {order.payment_method === 'cashier' ? 'Bayar di Kasir' : order.payment_method}
                          </div>
                        </div>
                      </div>
                      {order.notes && (
                        <div className="text-[13px] italic font-medium p-3 rounded-xl bg-danger/10 text-danger border border-danger/20 mb-4">
                          <span className="font-bold">Catatan:</span> {order.notes}
                        </div>
                      )}
                      <button
                        className="w-full py-3.5 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        onClick={() => {
                          confirmOrder(order.id);
                          if (incomingOrders.length === 1) setShowIncomingModal(false);
                        }}
                      >
                        <CheckCircle size={18} />
                        Konfirmasi &amp; Terima Pesanan
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSuccess && lastOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowSuccess(false)}>
          <div className="bg-surface border border-border rounded-3xl w-[95%] max-w-sm shadow-2xl p-8 text-center relative" onClick={e => e.stopPropagation()}>
            <div className="w-20 h-20 mx-auto bg-success/15 text-success rounded-full flex items-center justify-center mb-6">
              <CheckCircle size={48} />
            </div>
            <h2 className="text-2xl font-extrabold text-text-primary mb-2">
              {lastOrder._isOffline ? '📦 Tersimpan Offline!' : '✅ Order Berhasil!'}
            </h2>
            <p className="text-sm font-semibold text-text-secondary mb-4">{lastOrder.order_number}</p>
            {lastOrder._isOffline && (
              <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1 bg-warning/15 text-warning rounded-full text-xs font-bold mb-4">
                <WifiOff size={12} /> Akan disinkronkan saat online
              </div>
            )}
            <div className="text-3xl font-black text-primary mb-2">{formatRupiah(lastOrder.total)}</div>
            <p className="text-xs font-medium text-text-muted mb-8 uppercase tracking-wider">
              {lastOrder.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'} · {lastOrder.payment_method.toUpperCase()}
            </p>

            <div className="flex flex-col gap-3">
              <button className="w-full py-3 px-4 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl text-sm font-bold text-text-primary transition-all" onClick={() => setShowSuccess(false)}>Order Baru</button>
              
              <button
                className="w-full py-3 px-4 bg-gradient-to-r from-primary to-primary-dark text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgba(200,162,122,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-primary-hover hover:to-primary hover:-translate-y-px"
                disabled={posPrinting || !qzReady}
                onClick={async () => {
                  setPosPrinting(true);
                  try {
                    await printReceipt(lastOrder, storeSettings, storeSettings.default_printer || null);
                  } catch (err) {
                    alert('Gagal cetak QZ: ' + (err.message || 'Error'));
                  } finally {
                    setPosPrinting(false);
                  }
                }}
              >
                {posPrinting ? <Loader size={18} className="animate-spin" /> : <Printer size={18} />}
                {posPrinting ? 'Mencetak...' : qzReady ? 'Cetak QZ' : 'QZ Offline'}
              </button>

              {!lastOrder._isOffline && isOnline && (
                <button
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-[0_4px_12px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px"
                  disabled={posNetworkPrinting}
                  onClick={async () => {
                    setPosNetworkPrinting(true);
                    try {
                      await printOrderViaBackend(lastOrder.id, {
                        printerIp: storeSettings.printer_ip || undefined,
                        printerPort: storeSettings.printer_port ? parseInt(storeSettings.printer_port) : undefined,
                        printerType: storeSettings.printer_type || 'network',
                        paperWidth: storeSettings.paper_width ? parseInt(storeSettings.paper_width) : 58,
                      });
                    } catch (err) {
                      alert('Gagal cetak Network: ' + (err.response?.data?.detail || err.message || 'Error'));
                    } finally {
                      setPosNetworkPrinting(false);
                    }
                  }}
                >
                  {posNetworkPrinting ? <Loader size={18} className="animate-spin" /> : <Wifi size={18} />}
                  {posNetworkPrinting ? 'Mencetak...' : 'Network Printer'}
                </button>
              )}

              {!lastOrder._isOffline && (
                <button
                  className="w-full py-3 px-4 bg-surface-2 hover:bg-surface-3 border border-border rounded-xl text-sm font-bold text-text-primary transition-all flex items-center justify-center gap-2"
                  onClick={() => { setShowSuccess(false); navigate(`/transactions/${lastOrder.id}`); }}
                >
                  <Monitor size={18} /> Lihat Nota
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowExpenseModal(false)}>
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <h3 className="text-lg font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                  <Receipt size={16} />
                </div>
                Catat Pengeluaran
              </h3>
              <button className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors" onClick={() => setShowExpenseModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-text-muted">Nominal (Rp)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-text-muted">Rp</span>
                  <input
                    type="number"
                    className="w-full bg-surface-2 border border-white/10 rounded-xl pl-10 pr-4 py-3 font-bold text-text-primary focus:outline-none focus:border-warning focus:ring-2 focus:ring-warning/20 transition-all"
                    placeholder="15000"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-text-muted">Keterangan</label>
                <input
                  type="text"
                  className="w-full bg-surface-2 border border-white/10 rounded-xl px-4 py-3 font-medium text-text-primary focus:outline-none focus:border-warning focus:ring-2 focus:ring-warning/20 transition-all"
                  placeholder="Beli es batu, galon air..."
                  value={expenseDescription}
                  onChange={e => setExpenseDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex gap-3">
              <button
                className="flex-1 py-3 px-4 rounded-xl font-bold text-text-secondary bg-surface-2 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setShowExpenseModal(false)}
              >
                Batal
              </button>
              <button
                className="flex-1 py-3 px-4 rounded-xl font-bold text-black bg-warning hover:shadow-[0_0_24px_rgba(251,191,36,0.4)] active:scale-[0.98] transition-all"
                onClick={async () => {
                  if (!expenseAmount || !expenseDescription) return;
                  await handleAddExpense(expenseAmount, expenseDescription);
                  setShowExpenseModal(false);
                  setExpenseAmount('');
                  setExpenseDescription('');
                }}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {showEndShiftModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setShowEndShiftModal(false)}>
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
              <h3 className="text-lg font-bold flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-danger/10 text-danger flex items-center justify-center">
                  <LogOut size={16} />
                </div>
                Akhiri Shift Kasir
              </h3>
              <button className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-colors" onClick={() => setShowEndShiftModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-surface-2 border border-white/5 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3 text-xs border-b border-white/5 pb-3">
                  <span className="font-medium text-text-secondary">Waktu Mulai Shift</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {activeShift.started_at ? new Date(activeShift.started_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-3 text-sm pt-1">
                  <span className="font-medium text-text-secondary">Saldo Awal (Modal)</span>
                  <span className="font-bold text-text-primary">{formatRupiah(activeShift.opening_balance)}</span>
                </div>
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="font-medium text-text-secondary">Total Penjualan Tunai</span>
                  <span className="font-bold text-success">+ {formatRupiah(activeShift.cash_sales || 0)}</span>
                </div>
                <div className="flex justify-between items-center mb-3 text-sm">
                  <span className="font-medium text-text-secondary">Pengeluaran Petty Cash</span>
                  <span className="font-bold text-danger">- {formatRupiah(totalExpenses)}</span>
                </div>
                <div className="pt-3 pb-2 border-t border-white/10 flex justify-between items-center text-sm">
                  <span className="font-bold text-text-primary">Ekspektasi Uang di Laci</span>
                  <span className="font-extrabold text-primary text-base">
                    {formatRupiah((activeShift.opening_balance || 0) + (activeShift.cash_sales || 0) - totalExpenses)}
                  </span>
                </div>
                <div className="pt-2 border-t border-white/5 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-warning shrink-0 mt-0.5" />
                  <p className="text-[11px] font-medium text-text-muted leading-relaxed">
                    Sistem menghitung saldo harapan berdasarkan transaksi tunai dan pengeluaran. Silakan hitung uang fisik aktual yang ada di laci saat ini.
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-text-muted">Uang Aktual di Laci Kasir</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-text-muted">Rp</span>
                  <input
                    type="number"
                    className="w-full bg-surface-2 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-lg font-bold text-text-primary focus:outline-none focus:border-danger focus:ring-2 focus:ring-danger/20 transition-all"
                    placeholder="Hitung uang di laci..."
                    value={closingActual}
                    onChange={e => setClosingActual(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex gap-3">
              <button
                className="flex-1 py-3 px-4 rounded-xl font-bold text-text-secondary bg-surface-2 border border-white/10 hover:bg-white/10 hover:text-white transition-colors"
                onClick={() => setShowEndShiftModal(false)}
              >
                Batal
              </button>
              <button
                className="flex-[1.5] py-3 px-4 rounded-xl font-bold text-white bg-danger hover:shadow-[0_0_24px_rgba(248,113,113,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                onClick={async () => {
                  await handleEndShift(closingActual);
                  setShowEndShiftModal(false);
                  setOpeningBalance('');
                  setClosingActual('');
                }}
              >
                <LogOut size={16} />
                Tutup Kasir
              </button>
            </div>
          </div>
        </div>
      )}

      {showReadyModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/65 backdrop-blur-[6px]"
          onClick={() => setShowReadyModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl bg-surface border border-white/10 max-h-[85vh] animate-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} className="text-success" />
                <h3 className="font-bold text-base text-text-primary">Antrean & Penyerahan Pesanan</h3>
              </div>
              <button
                className="w-8 h-8 flex items-center justify-center rounded-full transition-colors hover:bg-white/10 text-text-muted cursor-pointer border-none bg-transparent"
                onClick={() => setShowReadyModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {activeOrders.filter(o => o.status === 'ready' || o.status === 'preparing').length === 0 ? (
                <div className="text-center py-12 text-text-muted">
                  <span className="text-3xl block mb-2">☕</span>
                  <p className="text-sm font-semibold">Belum ada antrean aktif</p>
                  <p className="text-xs mt-1">Pesanan baru akan muncul di sini setelah dikonfirmasi.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Ready Section */}
                  {activeOrders.filter(o => o.status === 'ready').map(order => (
                    <div 
                      key={order.id} 
                      className="p-4 rounded-xl border border-success/30 bg-success/5 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-black text-sm text-text-primary">{order.order_number}</div>
                          <div className="text-xs text-text-secondary mt-0.5">{order.customer_name || 'Pelanggan'}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-success/20 text-success border border-success/30 uppercase tracking-wider">
                          Siap Diambil
                        </span>
                      </div>

                      {/* Items */}
                      <div className="text-xs text-text-secondary bg-white/5 p-2 rounded-lg space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.product_name}</span>
                          </div>
                        ))}
                      </div>

                      {/* Complete button */}
                      <button
                        onClick={async () => {
                          try {
                            await updateOrderStatus(order.id, 'paid');
                            toast.success(`Pesanan ${order.order_number} diserahkan!`);
                            fetchActiveOrders();
                          } catch (err) {
                            toast.error("Gagal menyerahkan pesanan");
                          }
                        }}
                        className="w-full py-2.5 px-3 rounded-lg bg-success hover:bg-green-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border-none cursor-pointer"
                      >
                        <CheckCircle size={14} />
                        Serahkan & Selesaikan
                      </button>
                    </div>
                  ))}

                  {/* Preparing Section */}
                  {activeOrders.filter(o => o.status === 'preparing').map(order => (
                    <div 
                      key={order.id} 
                      className="p-4 rounded-xl border border-warning/20 bg-warning/5 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-sm text-text-primary">{order.order_number}</div>
                          <div className="text-xs text-text-secondary mt-0.5">{order.customer_name || 'Pelanggan'}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-warning/20 text-warning border border-warning/30 uppercase tracking-wider">
                          Sedang Dibuat
                        </span>
                      </div>

                      {/* Items */}
                      <div className="text-xs text-text-secondary bg-white/5 p-2 rounded-lg space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>{item.quantity}x {item.product_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-end">
              <button
                className="px-4 py-2 rounded-xl font-bold text-xs transition-colors hover:bg-white/10 bg-white/5 border border-white/10 text-text-secondary cursor-pointer"
                onClick={() => setShowReadyModal(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function POS() {
  return (
    <POSProvider>
      <POSContent />
    </POSProvider>
  );
}
