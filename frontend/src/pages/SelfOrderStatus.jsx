import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOrderStatus, getStoreInfo } from '../api/selfOrder';
import { CheckCircle, Clock, Coffee, Package, RefreshCw, ArrowLeft } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import toast from 'react-hot-toast';
import { loadMidtransSnap } from '../utils/midtrans';

export default function SelfOrderStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storeInfo, setStoreInfo] = useState({});

  useEffect(() => {
    getStoreInfo().then(r => setStoreInfo(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (storeInfo.midtrans_client_key) {
      loadMidtransSnap(storeInfo.midtrans_client_key, storeInfo.midtrans_is_production);
    }
  }, [storeInfo.midtrans_client_key, storeInfo.midtrans_is_production]);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getOrderStatus(id);
        setOrder(res.data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          toast.error("Pesanan tidak ditemukan");
          navigate('/order');
        } else if (status === 401) {
          // Status pesanan hanya bisa dilihat pemiliknya; sesi member habis / belum login
          localStorage.removeItem('member_token');
          localStorage.removeItem('member_profile');
          toast.error("Sesi Anda berakhir. Silakan masuk lagi untuk melihat pesanan.", { id: 'member-session' });
          navigate('/order');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(() => {
      if (!document.hidden) fetchStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="h-screen bg-body flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) return null;

  const STATUS_STEPS = [
    { 
      key: 'pending', 
      label: order.payment_method === 'qris' 
        ? (order.status === 'pending' ? 'Proses Pembayaran (QRIS)' : 'Pembayaran Berhasil') 
        : (order.status === 'pending' ? 'Menunggu Konfirmasi Kasir' : 'Dikonfirmasi Kasir'), 
      icon: Clock 
    },
    { key: 'confirmed', label: 'Konfirmasi Kasir', icon: CheckCircle },
    { key: 'preparing', label: 'Pembuatan Pesanan', icon: Coffee },
    { key: 'ready', label: 'Siap Diambil', icon: Package },
  ];

  const currentStepIdx = STATUS_STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const isPaid = order.status === 'paid';

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-body overflow-hidden text-text-primary max-w-[500px] mx-auto relative shadow-2xl border-x border-white/5">
      <div className="flex-shrink-0 px-4 py-3 bg-surface/90 backdrop-blur-md border-b border-white/5 sticky top-0 z-20 shadow-[0_4px_24px_rgba(0,0,0,0.2)] flex items-center justify-between">
        <button 
          onClick={() => navigate('/order')}
          className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-secondary hover:text-white transition-colors border border-white/5"
          title="Kembali ke Menu"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          {storeInfo.store_logo ? (
            <img src={storeInfo.store_logo} alt="Logo" className="h-8 rounded" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">KP</div>
          )}
          <span className="font-bold text-[18px]">{storeInfo.store_name || "KopiPOS"}</span>
        </div>
        <div className="w-9 h-9" />
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar px-4 py-6 pb-[100px]">
        <div className="text-center mb-8">
          {order.status === 'pending' ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/15 text-yellow-500 mb-4 animate-pulse">
                <Clock size={32} />
              </div>
              <h1 className="text-2xl font-extrabold mb-2 text-text-primary">
                {order.payment_method === 'qris' ? 'Menunggu Pembayaran' : 'Menunggu Konfirmasi'}
              </h1>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/15 text-success mb-4">
                <CheckCircle size={32} />
              </div>
              <h1 className="text-2xl font-extrabold mb-2 text-text-primary">Pesanan Diterima</h1>
            </>
          )}
          <p className="text-text-muted mb-1 text-sm">Nomor Order: <strong className="text-text-primary">{order.order_number}</strong></p>
          <p className="text-text-muted text-sm">Atas Nama: <strong className="text-text-primary">{order.customer_name || '-'}</strong></p>
        </div>

        {isCancelled ? (
          <div className="bg-danger/10 border border-danger/30 rounded-xl p-5 text-center text-danger mb-6">
            <h3 className="text-lg font-bold mb-2">Pesanan Gagal / Batal</h3>
            <p className="text-sm">
              {order.payment_method === 'qris'
                ? "Pembayaran QRIS gagal, dibatalkan, atau kadaluarsa. Silakan lakukan pemesanan ulang."
                : "Mohon maaf, pesanan Anda dibatalkan oleh kasir atau tidak disetujui."}
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl p-6 mb-6 shadow-sm">
            <h3 className="text-base font-bold mb-6 flex items-center gap-2 text-text-primary">
              Status Pesanan
              <RefreshCw size={14} className="text-text-muted animate-spin" />
            </h3>

            <div className="relative pl-2 pb-2">
              {STATUS_STEPS.map((step, idx) => {
                const isPassed = isPaid || currentStepIdx >= idx;
                const isActive = currentStepIdx === idx && !isPaid;
                const Icon = step.icon;

                return (
                  <div key={step.key} className="flex gap-4 relative mb-6 last:mb-0">
                    <div className="relative flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10 relative transition-colors ${isPassed ? 'bg-success/20 border-success text-success' : isActive ? 'bg-primary/20 border-primary text-primary shadow-[0_0_12px_rgba(200,162,122,0.4)]' : 'bg-surface-2 border-border text-text-muted'}`}>
                        <Icon size={16} />
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 absolute top-8 bottom-[-24px] left-1/2 -translate-x-1/2 ${isPassed ? 'bg-success' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className="flex flex-col pt-1.5">
                      <div className={`font-bold text-[15px] ${isPassed || isActive ? 'text-text-primary' : 'text-text-secondary'}`}>{step.label}</div>
                      {isActive && <div className="text-text-muted text-xs mt-1">Sedang diproses...</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {(order.status === 'ready' || order.status === 'paid') && (
              <div className="mt-6 p-4 bg-primary/10 rounded-xl border border-primary/30 text-center">
                <h4 className="text-primary font-bold text-base mb-1">Pesanan Siap Diambil! 🎉</h4>
                <p className="text-[13px] text-text-secondary">Silakan menuju meja kasir / pickup area.</p>
              </div>
            )}
          </div>
        )}

        {order.status === 'pending' && order.payment_method === 'qris' && order.payment_token && (
          <div className="bg-surface border border-border rounded-2xl p-5 mb-6 shadow-sm text-center">
            <h4 className="text-text-primary font-bold text-base mb-2">Selesaikan Pembayaran</h4>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Silakan selesaikan pembayaran online Anda. Jika pop-up tidak muncul, Anda dapat membuka tautan pembayaran secara langsung.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => {
                  if (window.snap) {
                    window.snap.pay(order.payment_token, {
                      onSuccess: () => {
                        toast.success("Pembayaran berhasil!");
                        window.location.reload();
                      },
                      onPending: () => {
                        toast.success("Pembayaran sedang diproses.");
                        window.location.reload();
                      },
                      onError: () => {
                        toast.error("Pembayaran gagal!");
                      },
                      onClose: () => {
                        toast.error("Popup pembayaran ditutup.");
                      }
                    });
                  } else {
                    toast.error("Midtrans Snap belum siap. Silakan refresh halaman.");
                  }
                }}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-primary hover:shadow-[0_8px_24px_rgba(200,162,122,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                Bayar Sekarang via QRIS (Popup)
              </button>
              {order.payment_url && (
                <a
                  href={order.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 rounded-xl font-bold text-text-primary bg-surface-2 border border-border hover:bg-surface-3 transition-all flex items-center justify-center gap-2"
                >
                  Buka Link Pembayaran (Tab Baru)
                </a>
              )}
            </div>
          </div>
        )}

        <div className="bg-surface-2 rounded-xl p-4 flex justify-between items-center shadow-sm border border-border">
          <div>
            <div className="text-xs text-text-muted">Total Pembayaran</div>
            <div className="text-lg font-bold text-primary">{formatRupiah(order.total)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-text-muted">Metode</div>
            <div className="text-sm font-semibold uppercase">{order.payment_method === 'cashier' ? 'Bayar di Kasir' : order.payment_method}</div>
          </div>
        </div>

        <button 
          className="w-full mt-8 py-4 inline-flex items-center justify-center gap-2 rounded-xl font-sans text-sm font-bold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 transition-all" 
          onClick={() => navigate('/order')}
        >
          <ArrowLeft size={16} /> Kembali ke Menu Utama
        </button>
      </div>
    </div>
  );
}
