import { useState, useEffect } from 'react';
import { getActiveOrders, updateOrderStatus } from '../api/orders';
import { RefreshCw, CheckCircle, Play, Check, ArrowLeft, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function KitchenDisplay() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const navigate = useNavigate();
  const { logout } = useAuth();


  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari sistem Dapur?')) {
      logout();
      navigate('/login');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await getActiveOrders();
      setOrders(res.data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch active orders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      if (!document.hidden) fetchOrders();
    }, 10000); // Auto refresh 10s if active
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id, currentStatus) => {
    let nextStatus = '';
    if (currentStatus === 'confirmed') nextStatus = 'preparing';
    else if (currentStatus === 'preparing') nextStatus = 'ready';
    else if (currentStatus === 'ready') nextStatus = 'paid';

    if (!nextStatus) return;

    try {
      const updatedOrders = orders.map(o => o.id === id ? { ...o, status: nextStatus } : o);
      if (nextStatus === 'paid') {
        setOrders(updatedOrders.filter(o => o.id !== id));
      } else {
        setOrders(updatedOrders);
      }

      await updateOrderStatus(id, nextStatus);
      toast.success(`Status pesanan diupdate ke: ${nextStatus === 'preparing' ? 'Sedang Dibuat' : nextStatus === 'ready' ? 'Siap Diambil' : 'Selesai'}`);
    } catch (err) {
      toast.error('Gagal update status pesanan');
      fetchOrders(); // Revert on fail
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-body">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const newOrders = orders.filter(o => o.status === 'confirmed');
  const prepOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const TicketCard = ({ order }) => (
    <div className={`bg-surface border shadow-md rounded-xl overflow-hidden transition-all relative flex flex-col ${order.status === 'preparing' ? 'border-warning shadow-[0_4px_12px_rgba(251,191,36,0.15)]' : order.status === 'ready' ? 'border-success shadow-[0_4px_12px_rgba(74,222,128,0.15)]' : 'border-border'}`}>
      <div className="p-3 sm:p-4 flex justify-between items-start border-b border-border bg-surface-2">
        <div>
          <div className="text-lg sm:text-xl font-black text-text-primary m-0">{order.order_number}</div>
          <div className="text-sm font-medium text-text-secondary mt-1 line-clamp-1">{order.customer_name || 'Pelanggan'}</div>
        </div>
        <div className="text-right">
          <div className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider mb-2 ${order.order_type === 'dine_in' ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-surface-3 text-text-secondary border border-border'}`}>
            {order.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
          </div>
          <div className="text-xs font-medium text-text-muted">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
      </div>
      
      <div className="p-3 sm:p-4 flex-1 flex flex-col gap-3">
        <ul className="list-none p-0 m-0 flex flex-col gap-3">
          {order.items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-3 text-sm">
              <span className="font-bold text-text-primary bg-surface-3 px-2 py-0.5 rounded-md text-xs">{item.quantity}x</span>
              <div>
                <div className="font-semibold text-text-primary leading-tight">{item.product_name}</div>
                {item.variant_name && <div className="text-xs text-text-muted mt-0.5 ml-1">└ {item.variant_name}</div>}
                {item.modifier_names && <div className="text-xs text-text-muted mt-0.5 ml-1">└ {item.modifier_names}</div>}
              </div>
            </li>
          ))}
        </ul>
        {order.notes && (
          <div className="text-[13px] bg-danger/10 text-danger p-2.5 rounded-lg border border-danger/20 italic mt-auto">
            <span className="font-bold">Catatan:</span> {order.notes}
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 pt-0 mt-auto">
        {order.status === 'confirmed' && (
          <button className="w-full py-2.5 px-4 bg-gradient-to-br from-primary to-primary-dark hover:from-primary-hover hover:to-primary text-white rounded-lg font-bold transition-all shadow-[0_4px_12px_rgba(200,162,122,0.3)] hover:-translate-y-px flex items-center justify-center gap-2" onClick={() => handleUpdateStatus(order.id, order.status)}>
            <Play size={16} /> Mulai Buat
          </button>
        )}
        {order.status === 'preparing' && (
          <button className="w-full py-2.5 px-4 bg-warning hover:bg-[#d97706] text-black rounded-lg font-bold transition-all shadow-[0_4px_12px_rgba(251,191,36,0.3)] hover:-translate-y-px flex items-center justify-center gap-2 border-none" onClick={() => handleUpdateStatus(order.id, order.status)}>
            <Check size={16} /> Selesai Dibuat
          </button>
        )}
        {order.status === 'ready' && (
          <button className="w-full py-2.5 px-4 bg-success hover:bg-green-600 text-white rounded-lg font-bold transition-all shadow-[0_4px_12px_rgba(74,222,128,0.3)] hover:-translate-y-px flex items-center justify-center gap-2 border-none" onClick={() => handleUpdateStatus(order.id, order.status)}>
            <CheckCircle size={16} /> Serahkan (Selesai)
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-body overflow-hidden text-text-primary">
      <div className="flex-shrink-0 flex items-center justify-between p-4 bg-surface border-b border-border shadow-sm z-10 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button className="inline-flex items-center justify-center p-2 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-text-primary m-0">Kitchen Display System</h2>
            <p className="text-sm text-text-muted mt-0.5">Total: {orders.length} pesanan aktif</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-text-muted hidden sm:inline mr-2">Update terakhir: {lastUpdated.toLocaleTimeString()}</span>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 transition-all" onClick={fetchOrders}>
            <RefreshCw size={16} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-danger/10 text-danger border-danger/20 hover:bg-danger/20 transition-all" onClick={handleLogout} title="Logout">
            <LogOut size={16} /> <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-x-auto p-4 sm:p-6 gap-4 sm:gap-6 bg-body">
        <div className="flex-1 flex flex-col min-w-[320px] bg-surface/50 border border-border rounded-xl overflow-hidden shadow-sm @container">
          <div className="p-4 bg-surface border-b border-border text-center">
            <h3 className="text-lg font-bold text-text-primary m-0">Pesanan Baru ({newOrders.length})</h3>
            <div className="h-1 rounded-full mt-2 mx-auto w-12 bg-text-muted" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-3 sm:gap-4 content-start">
              {newOrders.map(o => <TicketCard key={o.id} order={o} />)}
              {newOrders.length === 0 && <div className="col-span-full text-center p-8 text-text-muted font-medium border-2 border-dashed border-border rounded-xl">Kosong</div>}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-[320px] bg-surface/50 border border-border rounded-xl overflow-hidden shadow-sm @container">
          <div className="p-4 bg-surface border-b border-border text-center">
            <h3 className="text-lg font-bold text-text-primary m-0">Sedang Dibuat ({prepOrders.length})</h3>
            <div className="h-1 rounded-full mt-2 mx-auto w-12 bg-warning" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-3 sm:gap-4 content-start">
              {prepOrders.map(o => <TicketCard key={o.id} order={o} />)}
              {prepOrders.length === 0 && <div className="col-span-full text-center p-8 text-text-muted font-medium border-2 border-dashed border-border rounded-xl">Kosong</div>}
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-[320px] bg-surface/50 border border-border rounded-xl overflow-hidden shadow-sm @container">
          <div className="p-4 bg-surface border-b border-border text-center">
            <h3 className="text-lg font-bold text-text-primary m-0">Siap Diambil ({readyOrders.length})</h3>
            <div className="h-1 rounded-full mt-2 mx-auto w-12 bg-success" />
          </div>
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 custom-scrollbar">
            <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-3 sm:gap-4 content-start">
              {readyOrders.map(o => <TicketCard key={o.id} order={o} />)}
              {readyOrders.length === 0 && <div className="col-span-full text-center p-8 text-text-muted font-medium border-2 border-dashed border-border rounded-xl">Kosong</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
