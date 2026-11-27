import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { getOrderStatus, getPublicBanners } from '../api/selfOrder';
import { formatRupiah } from '../utils/format';
import { firstName, queueReorder, statusLabel } from '../utils/selfOrder';
import useSelfOrderStore from '../hooks/useSelfOrderStore';
import { BannerCard } from '../components/selforder/BannerStrip';
import { Spinner } from '../components/selforder/ui';

const STEPS = [
  { key: 'pending', name: 'Diterima' },
  { key: 'confirmed', name: 'Dikonfirmasi' },
  { key: 'preparing', name: 'Dibuat' },
  { key: 'ready', name: 'Siap' },
];

function copyFor(order) {
  const name = firstName(order.customer_name);
  const live = 'Halaman ini berubah sendiri.';
  switch (order.status) {
    case 'pending':
      return order.payment_method === 'qris'
        ? { title: `Tinggal bayar QRIS, ${name}.`, sub: 'Pesanan diproses setelah pembayaran masuk. ' + live }
        : { title: `Pesananmu sudah masuk, ${name}.`, sub: 'Kasir akan mengonfirmasi sebentar lagi. ' + live };
    case 'confirmed':
      return { title: `Kasir sudah menerima pesananmu, ${name}.`, sub: 'Sebentar lagi barista mulai membuat. ' + live };
    case 'preparing':
      return { title: `Barista lagi menyiapkan pesananmu, ${name}.`, sub: `${live} Kami panggil namamu saat siap di bar.` };
    case 'ready':
      return { title: `Pesananmu siap, ${name}. Ambil di bar, ya.`, sub: 'Sebutkan namamu atau nomor pesanan di atas.' };
    case 'paid':
      return { title: `Terima kasih, ${name}. Selamat menikmati.`, sub: 'Pesanan ini sudah selesai.' };
    case 'cancelled':
      return {
        title: 'Pesanan ini dibatalkan.',
        sub: order.payment_method === 'qris'
          ? 'Pembayaran QRIS gagal atau kedaluwarsa. Silakan pesan lagi.'
          : 'Kasir membatalkan pesanan ini. Tanyakan ke kasir bila ada yang keliru.',
      };
    default:
      return { title: statusLabel(order), sub: '' };
  }
}

export default function SelfOrderStatus() {
  const { id } = useParams();
  const navigate = useNavigate();
  useSelfOrderStore();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [banners, setBanners] = useState([]);

  useEffect(() => {
    getPublicBanners('status').then(r => setBanners(r.data.filter(b => b.kind === 'partner').slice(0, 1))).catch(() => {});
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await getOrderStatus(id);
        setOrder(res.data);
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          toast.error('Pesanan tidak ditemukan');
          navigate('/order');
        } else if (status === 401) {
          localStorage.removeItem('member_token');
          localStorage.removeItem('member_profile');
          toast.error('Sesi berakhir. Masuk lagi untuk melihat pesanan.', { id: 'member-session' });
          navigate('/order');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
    const interval = setInterval(() => { if (!document.hidden) fetchStatus(); }, 5000);
    return () => clearInterval(interval);
  }, [id, navigate]);

  if (loading) return <Spinner />;
  if (!order) return null;

  const { title, sub } = copyFor(order);
  const cancelled = order.status === 'cancelled';
  const done = order.status === 'paid';
  const current = done ? STEPS.length : STEPS.findIndex(s => s.key === order.status);
  const payLabel = order.payment_method === 'qris' ? 'QRIS' : 'bayar di kasir';
  const cutLabel = order.promo_name || (order.points_redeemed ? `Tukar ${order.points_redeemed} poin` : 'Potongan');

  const reorder = () => {
    queueReorder(order.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, modifiers: i.modifiers })));
    navigate('/order');
  };

  const payNow = () => {
    if (!window.snap) { toast.error('Pembayaran belum siap. Muat ulang halaman.'); return; }
    window.snap.pay(order.payment_token, {
      onSuccess: () => window.location.reload(),
      onPending: () => window.location.reload(),
      onError: () => toast.error('Pembayaran gagal. Coba lagi.'),
    });
  };

  return (
    <div className="so-root min-h-[100dvh]">
      <div className="max-w-[560px] mx-auto pb-10 md:border-x md:border-line min-h-[100dvh]">
        <header className="flex items-center gap-2 px-2.5 py-2 border-b border-line">
          <Link to="/order" aria-label="Kembali ke menu" className="w-11 h-11 flex items-center justify-center text-ink rounded-full hover:bg-sand">
            <ChevronLeft size={22} strokeWidth={2.2} />
          </Link>
          <span className="flex-1 text-[13px] text-ink-soft">{order.order_number}</span>
        </header>

        <section className="px-[18px] pt-[26px]" aria-live="polite">
          <p className={`m-0 text-[13px] font-bold uppercase tracking-[0.6px] ${cancelled ? 'text-[#8A2C2C]' : 'text-brand'}`}>{statusLabel(order)}</p>
          <h1 className="mt-2 mb-0 font-extrabold text-[32px] leading-[1.08] tracking-[-0.5px]">{title}</h1>
          {sub && <p className="mt-2.5 text-[14px] text-ink-soft leading-normal">{sub}</p>}
        </section>

        {!cancelled && (
          <ol aria-label="Tahap pesanan" className="list-none mx-[18px] mt-6 p-0 grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-col gap-2" aria-current={i === current ? 'step' : undefined}>
                <span className={`block h-1.5 rounded-[3px] ${i <= current ? 'bg-brand' : 'bg-line-strong'}`} />
                <span className={`text-[12px] ${i === current ? 'font-bold text-ink' : 'font-medium text-ink-soft'}`}>{s.name}</span>
              </li>
            ))}
          </ol>
        )}

        {order.status === 'pending' && order.payment_method === 'qris' && order.payment_token && (
          <section className="mx-[18px] mt-6 p-4 bg-sunny-soft rounded-2xl">
            <h2 className="m-0 font-bold text-[17px]">Selesaikan pembayaran</h2>
            <p className="mt-1 text-[13px] text-ink-soft">Kalau jendela pembayaran tidak muncul, buka tautannya di tab baru.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              <button type="button" onClick={payNow} className="min-h-12 rounded-[12px] bg-brand text-white font-bold">Bayar dengan QRIS</button>
              {order.payment_url && (
                <a href={order.payment_url} target="_blank" rel="noopener noreferrer" className="min-h-12 rounded-[12px] border border-ink font-bold flex items-center justify-center">
                  Buka tautan bayar
                </a>
              )}
            </div>
          </section>
        )}

        <section className="mx-[18px] mt-[26px] p-4 bg-paper border border-line rounded-2xl text-[14px]" aria-label="Rincian pesanan">
          {order.items.map((it, i) => (
            <div key={i} className="py-1">
              <div className="flex justify-between gap-3"><span>{it.quantity}× {it.product_name}</span><span className="tabular-nums shrink-0">{formatRupiah(it.subtotal)}</span></div>
              {it.modifiers.length > 0 && <div className="text-[12px] text-ink-soft">{it.modifiers.map(m => m.modifier_name).join(' · ')}</div>}
            </div>
          ))}
          {order.discount > 0 && (
            <div className="flex justify-between py-1 text-ink-soft"><span>{cutLabel}</span><span className="tabular-nums">−{formatRupiah(order.discount)}</span></div>
          )}
          <div className="flex justify-between pt-2.5 mt-1.5 border-t border-dashed border-line-strong font-bold text-[16px]">
            <span>Total · {payLabel}</span><span className="tabular-nums">{formatRupiah(order.total)}</span>
          </div>
          {order.points_earned > 0 && !cancelled && (
            <p className="mt-1.5 text-[12.5px] font-semibold text-brand">
              {done ? `+${order.points_earned} poin sudah masuk` : `+${order.points_earned} poin setelah pesanan dibayar`}
            </p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2.5 mx-[18px] mt-4">
          <button type="button" onClick={reorder} className="min-h-[52px] rounded-[14px] bg-brand text-white font-bold hover:brightness-110 transition">Pesan lagi</button>
          <Link to="/order" className="min-h-[52px] rounded-[14px] border border-ink font-bold flex items-center justify-center hover:bg-sand transition-colors">Lihat menu</Link>
        </div>

        {banners.map(b => (
          <div key={b.id} className="mx-[18px] mt-[22px]">
            <BannerCard banner={b} className="!h-auto min-h-[120px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
