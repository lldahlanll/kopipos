import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  createSelfOrder, getLastOrderItems, getMemberOrders, getMemberProfile, getPublicBanners, getPublicMenu,
} from '../api/selfOrder';
import { formatRupiah } from '../utils/format';
import {
  ACTIVE_STATUSES, NO_DISCOUNT, addLine, changeQty, discountFor, firstName, greeting, loadCart,
  loadDiscount, makeCartLine, needsOptions, productTag, promosFromBanners, rebuildOrderItem,
  saveCart, saveDiscount, takeReorder,
} from '../utils/selfOrder';
import useSelfOrderStore from '../hooks/useSelfOrderStore';

import SelfOrderProductSheet from '../components/selforder/SelfOrderProductSheet';
import SelfOrderCart from '../components/selforder/SelfOrderCart';
import SelfOrderCheckout from '../components/selforder/SelfOrderCheckout';
import MemberAuth from '../components/selforder/MemberAuth';
import AccountSheet from '../components/selforder/AccountSheet';
import BannerStrip from '../components/selforder/BannerStrip';
import { ProductThumb, Spinner, StoreMark } from '../components/selforder/ui';

const VIRTUAL = [
  { id: 'v_recommended', name: 'Rekomendasi', test: p => p.is_recommended },
  { id: 'v_bestseller', name: 'Terlaris', test: p => p.is_bestseller },
  { id: 'v_favorite', name: 'Favorit', test: p => p.is_favorite },
];

const toastStyle = { borderRadius: '12px', background: '#1E1B16', color: '#FFFFFF', fontSize: '14px' };
const say = (msg) => toast(msg, { style: toastStyle, duration: 2500 });

function visitLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (days <= 0) return 'dari pesanan tadi';
  if (days === 1) return 'dari kunjungan kemarin';
  return `dari kunjungan ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`;
}

function SearchBox({ id, value, onChange, className = '' }) {
  return (
    <label htmlFor={id} className={`flex items-center gap-2.5 h-12 md:h-[46px] px-3.5 bg-paper border border-line rounded-xl text-ink-soft focus-within:border-brand ${className}`}>
      <Search size={18} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">Cari menu</span>
      <input
        id={id}
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Cari menu, mis. latte"
        className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[15px] text-ink placeholder:text-ink-faint"
      />
    </label>
  );
}

function ProductCard({ product, onOpen, onQuickAdd }) {
  const tag = productTag(product);
  return (
    <article className="flex gap-3.5 py-3.5 border-b border-line md:flex-col md:gap-0 md:p-0 md:border md:rounded-[14px] md:bg-paper md:overflow-hidden">
      <button type="button" onClick={() => onOpen(product)} className="shrink-0 rounded-xl md:rounded-none overflow-hidden" tabIndex={-1} aria-hidden="true">
        <ProductThumb src={product.image_url} className="w-[84px] h-[84px] rounded-xl md:rounded-none md:w-full md:h-[150px] lg:h-[140px]" />
      </button>
      <div className="flex-1 min-w-0 flex flex-col md:p-3">
        {tag && <span className="self-start text-[11px] font-bold text-brand mb-0.5">{tag}</span>}
        <button type="button" onClick={() => onOpen(product)} className="text-left font-semibold text-[15px] md:text-[14.5px] leading-[1.3] hover:underline underline-offset-2">
          {product.name}
        </button>
        {product.description && (
          <p className="md:hidden text-[12.5px] text-ink-soft leading-[1.4] mt-[3px] line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-1.5 gap-2">
          <span className="font-bold text-[15px] md:text-[14px] tabular-nums">{formatRupiah(product.base_price)}</span>
          <button
            type="button"
            onClick={() => onQuickAdd(product)}
            aria-label={`Tambah ${product.name}`}
            className="w-11 h-11 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 hover:brightness-110 active:scale-95 transition"
          >
            <Plus size={18} strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </article>
  );
}

function ProductSection({ title, products, onOpen, onQuickAdd }) {
  if (!products.length) return null;
  return (
    <section className="px-[18px] md:px-7 pt-[18px] md:pt-5 pb-1">
      <h2 className="m-0 mb-1 md:mb-3 font-bold text-[19px] md:text-[20px]">{title}</h2>
      <div className="md:grid md:grid-cols-3 md:gap-4">
        {products.map(p => <ProductCard key={p.id} product={p} onOpen={onOpen} onQuickAdd={onQuickAdd} />)}
      </div>
    </section>
  );
}

export default function SelfOrder() {
  const navigate = useNavigate();
  const { storeInfo } = useSelfOrderStore();

  const [member, setMember] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [menu, setMenu] = useState({ categories: [], products: [] });
  const [menuLoading, setMenuLoading] = useState(true);
  const [banners, setBanners] = useState([]);
  const [bannersLoaded, setBannersLoaded] = useState(false);
  const [lastOrder, setLastOrder] = useState({ items: [] });
  const [myOrders, setMyOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [tableNum, setTableNum] = useState(null);
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');

  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [discount, setDiscount] = useState(loadDiscount);
  const [selected, setSelected] = useState(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const promos = useMemo(() => promosFromBanners(banners), [banners]);

  // ── Muat data ─────────────────────────────────────────────────────────────
  const refreshMember = useCallback(() => {
    if (!localStorage.getItem('member_token')) return;
    getMemberProfile().then(r => setMember(r.data)).catch(() => {});
    getMemberOrders().then(r => setMyOrders(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    // Meja dari QR berlaku selama tab ini terbuka (kembali dari halaman status tetap ingat)
    const table = new URLSearchParams(window.location.search).get('table') || sessionStorage.getItem('selfOrder_qrTable');
    if (table) {
      setTableNum(table);
      sessionStorage.setItem('selfOrder_qrTable', table);
      localStorage.setItem('selfOrder_tableNumber', table);
    }
    (async () => {
      if (localStorage.getItem('member_token')) {
        try {
          const res = await getMemberProfile();
          setMember(res.data);
        } catch {
          localStorage.removeItem('member_token');
          localStorage.removeItem('member_profile');
        }
      }
      setAuthChecking(false);
    })();
    getPublicMenu().then(r => setMenu(r.data)).catch(() => toast.error('Menu gagal dimuat. Coba muat ulang halaman.')).finally(() => setMenuLoading(false));
    getPublicBanners('menu').then(r => setBanners(r.data)).catch(() => {}).finally(() => setBannersLoaded(true));
  }, []);

  useEffect(() => {
    if (!member?.id) return;
    getMemberOrders().then(r => setMyOrders(r.data)).catch(() => {});
    getLastOrderItems().then(r => setLastOrder(r.data)).catch(() => {});
  }, [member?.id]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return;
      getPublicMenu().then(r => setMenu(r.data)).catch(() => {});
      getPublicBanners('menu').then(r => setBanners(r.data)).catch(() => {});
      refreshMember();
    }, 30000);
    return () => clearInterval(id);
  }, [refreshMember]);

  // Pulihkan keranjang + proses "Pesan lagi" dari halaman status, setelah menu tersedia
  useEffect(() => {
    if (menuLoading || cartReady) return;
    let next = loadCart(menu.products);
    const queued = takeReorder();
    const needChoice = [];
    queued.forEach(item => {
      const r = rebuildOrderItem(menu.products, item);
      if (r?.line) next = addLine(next, r.line);
      else if (r?.product) needChoice.push(r.product);
    });
    setCart(next);
    setCartReady(true);
    if (needChoice.length) {
      setSelected(needChoice[0]);
      say(needChoice.length === 1 ? 'Pilihan menu ini berubah, pilih ulang ya.' : `${needChoice.length} menu perlu dipilih ulang.`);
    } else if (queued.length) {
      say('Pesanan sebelumnya sudah masuk keranjang.');
    }
  }, [menuLoading, cartReady, menu.products]);

  useEffect(() => { if (cartReady) saveCart(cart); }, [cart, cartReady]);
  useEffect(() => { saveDiscount(discount); }, [discount]);

  // Promo yang sudah tidak tayang dilepas
  useEffect(() => {
    if (bannersLoaded && discount.kind === 'promo' && !promos.some(p => p.id === discount.promoId)) {
      setDiscount(NO_DISCOUNT);
    }
  }, [promos, discount, bannersLoaded]);

  // ── Aksi ──────────────────────────────────────────────────────────────────
  const addToCart = (line) => setCart(c => addLine(c, line));
  const onQty = (key, delta) => setCart(c => changeQty(c, key, delta));

  const quickAdd = (product) => {
    if (needsOptions(product)) { setSelected(product); return; }
    addToCart(makeCartLine({ product, variant: null, modifiers: [], qty: 1, notes: '' }));
  };

  const reorderItem = (item) => {
    const r = rebuildOrderItem(menu.products, item);
    if (r?.line) { addToCart(r.line); say(`${r.line.product.name} ditambahkan.`); }
    else if (r?.product) setSelected(r.product);
  };

  const usePromo = (promo) => {
    setDiscount({ kind: 'promo', promoId: promo.id });
    say(`Promo terpasang: ${promo.name}`);
  };

  const logout = () => {
    localStorage.removeItem('member_token');
    localStorage.removeItem('member_profile');
    setMember(null);
    setMyOrders([]);
    setLastOrder({ items: [] });
    setShowAccount(false);
    if (discount.kind === 'points') setDiscount(NO_DISCOUNT);
  };

  const submitOrder = async (data) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const itemNotes = cart.filter(c => c.notes).map(c => `${c.product.name}: ${c.notes}`);
      const notes = [data.tableNumber ? `Meja: ${data.tableNumber}` : null, ...itemNotes].filter(Boolean).join(' | ');
      const payload = {
        customer_name: member.name,
        order_type: data.orderType,
        payment_method: data.paymentMethod,
        notes: notes || null,
        redeem_points: data.redeemPoints || 0,
        promo_id: data.promoId,
        items: cart.map(c => ({
          product_id: c.product.id,
          quantity: c.qty,
          variant_id: c.variant?.id || null,
          modifier_ids: c.modifiers.length ? c.modifiers.map(m => m.id) : null,
        })),
      };
      const res = await createSelfOrder(payload, data.idempotencyKey);
      // Simpan langsung: halaman berpindah sebelum efek penyimpanan sempat jalan
      saveCart([]);
      saveDiscount(NO_DISCOUNT);
      setCart([]);
      setDiscount(NO_DISCOUNT);
      refreshMember();
      const goStatus = () => navigate(`/order/status/${res.data.id}`);
      if (res.data.payment_token && window.snap) {
        window.snap.pay(res.data.payment_token, {
          onSuccess: goStatus, onPending: goStatus, onError: goStatus, onClose: goStatus,
        });
      } else {
        goStatus();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Pesanan gagal dikirim. Coba lagi.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  // ── Tampilan ──────────────────────────────────────────────────────────────
  if (authChecking) return <Spinner />;
  if (!member) return <MemberAuth storeInfo={storeInfo} onAuthSuccess={setMember} />;
  if (menuLoading) return <Spinner label="Memuat menu…" />;

  const products = menu.products;
  const usedCats = new Set(products.map(p => p.category_id));
  const categories = menu.categories.filter(c => usedCats.has(c.id));
  const tabs = [
    { id: 'all', name: 'Semua' },
    ...VIRTUAL.filter(v => products.some(v.test)),
    ...categories.map(c => ({ id: c.id, name: c.name })),
  ];

  let sections;
  const q = query.trim().toLowerCase();
  if (q) {
    const hits = products.filter(p => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
    sections = [{ key: 'search', title: hits.length ? `Hasil untuk “${query.trim()}”` : null, items: hits }];
  } else if (category === 'all') {
    sections = categories.map(c => ({ key: c.id, title: c.name, items: products.filter(p => p.category_id === c.id) }));
    const loose = products.filter(p => !p.category_id || !categories.some(c => c.id === p.category_id));
    if (loose.length) sections.push({ key: 'other', title: 'Lainnya', items: loose });
  } else {
    const v = VIRTUAL.find(x => x.id === category);
    const tab = tabs.find(t => t.id === category);
    sections = [{ key: category, title: tab?.name, items: v ? products.filter(v.test) : products.filter(p => p.category_id === category) }];
  }
  const nothing = sections.every(s => s.items.length === 0);

  const subtotal = cart.reduce((s, c) => s + c.subtotal, 0);
  const itemCount = cart.reduce((s, c) => s + c.qty, 0);
  const cut = discountFor(discount, subtotal, promos, member.points);
  const total = Math.max(subtotal - cut.amount, 0);
  const appliedPromoId = discount.kind === 'promo' ? discount.promoId : null;
  const hasActiveOrder = myOrders.some(o => ACTIVE_STATUSES.includes(o.status));
  const reorderable = (lastOrder.items || []).filter(i => products.some(p => p.id === i.product_id));
  const context = tableNum ? `Meja ${tableNum} · Makan di sini` : 'Pesan dari HP';
  const name = firstName(member.name);

  const pickTab = (id) => {
    setCategory(id);
    setQuery('');
    document.getElementById('so-menu-top')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const tabClass = (on) => `inline-flex items-center min-h-11 text-[14px] whitespace-nowrap ${on ? 'font-bold text-ink shadow-[inset_0_-3px_0_var(--color-brand)]' : 'font-medium text-ink-soft hover:text-ink'}`;

  return (
    <div className="so-root min-h-[100dvh]">
      <header className="lg:sticky lg:top-0 z-30 bg-cream border-b border-line">
        <div className="max-w-[1440px] mx-auto flex items-center gap-2.5 md:gap-4 px-[18px] md:px-7 lg:px-8 py-3.5">
          <StoreMark storeInfo={storeInfo} size={36} />
          <div className="flex flex-col min-w-0 lg:max-w-[240px] lg:shrink-0">
            <span className="font-display font-bold text-[17px] md:text-[18px] leading-[1.1] truncate">{storeInfo.store_name || 'KopiPOS'}</span>
            <span className="text-[12px] text-ink-soft truncate">{context}</span>
          </div>
          <SearchBox id="so-cari-wide" value={query} onChange={setQuery} className="hidden md:flex flex-1 lg:max-w-[520px] md:ml-3 lg:ml-0" />
          <span className="flex-1 md:hidden lg:block" />
          <button
            type="button"
            onClick={() => { setShowAccount(true); setOrdersLoading(true); getMemberOrders().then(r => setMyOrders(r.data)).catch(() => {}).finally(() => setOrdersLoading(false)); }}
            aria-label={`Akun ${member.name}, ${member.points} poin${hasActiveOrder ? ', ada pesanan berjalan' : ''}`}
            className="relative flex items-center gap-2 min-h-11 md:min-h-[46px] pl-1.5 pr-3 md:pr-3.5 py-1.5 border border-line rounded-full bg-paper shrink-0 hover:border-ink-faint"
          >
            <span className="w-[30px] h-[30px] md:w-8 md:h-8 rounded-full bg-sand flex items-center justify-center font-bold text-[13px]">{name.charAt(0).toUpperCase()}</span>
            <span className="text-[13px] font-semibold tabular-nums"><span className="hidden md:inline">{name} · </span>{member.points} poin</span>
            {hasActiveOrder && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand border-2 border-cream" aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="max-w-[1440px] mx-auto lg:flex">
        <nav aria-label="Kategori" className="hidden lg:flex flex-col gap-0.5 w-[200px] shrink-0 pt-[22px] pl-8 sticky top-[75px] self-start max-h-[calc(100dvh-75px)] overflow-y-auto">
          {tabs.map(t => {
            const on = !q && category === t.id;
            return (
              <button key={t.id} type="button" onClick={() => pickTab(t.id)} aria-current={on ? 'true' : undefined}
                className={`text-left min-h-11 px-3 rounded-[10px] text-[14px] ${on ? 'bg-paper font-bold text-ink border border-line' : 'font-medium text-ink-soft hover:text-ink'}`}>
                {t.name}
              </button>
            );
          })}
        </nav>

        <main className="flex-1 min-w-0 pb-32 lg:pb-12">
          <section className="px-[18px] md:px-7 pt-[22px] pb-1.5 lg:flex lg:items-baseline lg:justify-between lg:gap-4">
            <h1 className="m-0 font-extrabold text-[30px] md:text-[32px] lg:text-[30px] leading-[1.1] tracking-[-0.5px]">{greeting()}, {name}.</h1>
            <p className="mt-1.5 lg:mt-0 text-ink-soft text-[14px] lg:text-[13px] leading-[1.45]">Pesan dari meja, ambil di bar saat namamu dipanggil.</p>
          </section>
          <div className="px-[18px] md:hidden mt-3.5">
            <SearchBox id="so-cari" value={query} onChange={setQuery} />
          </div>

          {!q && banners.length > 0 && (
            <div className="pt-4 pb-1 md:px-7">
              <BannerStrip banners={banners} appliedPromoId={appliedPromoId} onUsePromo={usePromo} />
            </div>
          )}

          {!q && reorderable.length > 0 && (
            <section className="px-[18px] md:px-7 pt-[18px] pb-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="m-0 font-bold text-[19px]">Pesan lagi</h2>
                <span className="text-[12px] text-ink-soft">{visitLabel(lastOrder.ordered_at)}</span>
              </div>
              <div className="flex flex-col md:grid md:grid-cols-2 2xl:grid-cols-3 gap-2 mt-2.5">
                {reorderable.map((item, i) => {
                  const product = products.find(p => p.id === item.product_id);
                  const opts = (item.modifiers || []).map(m => m.modifier_name).join(' · ');
                  return (
                    <div key={`${item.product_id}-${i}`} className="flex items-center gap-3 p-2.5 bg-paper border border-line rounded-xl">
                      <ProductThumb src={product.image_url} className="w-12 h-12 rounded-[10px] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[14px] truncate">{item.product_name}</div>
                        <div className="text-[12px] text-ink-soft truncate">{[opts, formatRupiah(item.unit_price)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <button type="button" onClick={() => reorderItem({ ...item, quantity: 1 })}
                        className="min-h-11 px-3.5 rounded-[10px] border border-ink text-[13px] font-bold hover:bg-sand transition-colors shrink-0">
                        Tambah
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <span id="so-menu-top" className="block scroll-mt-0 lg:scroll-mt-[80px]" />
          <nav aria-label="Kategori" className="lg:hidden sticky top-0 z-20 mt-3.5 bg-cream border-b border-line">
            <div className="flex gap-5 md:gap-6 px-[18px] md:px-7 overflow-x-auto no-scrollbar">
              {tabs.map(t => (
                <button key={t.id} type="button" onClick={() => pickTab(t.id)} aria-current={!q && category === t.id ? 'true' : undefined}
                  className={tabClass(!q && category === t.id)}>
                  {t.name}
                </button>
              ))}
            </div>
          </nav>

          {sections.map(s => (
            <ProductSection key={s.key} title={s.title} products={s.items} onOpen={setSelected} onQuickAdd={quickAdd} />
          ))}
          {nothing && (
            <div className="px-[18px] md:px-7 py-12 text-center">
              <p className="font-display font-bold text-[19px]">{q ? 'Menu tidak ketemu' : 'Belum ada menu di sini'}</p>
              <p className="mt-1 text-[14px] text-ink-soft">{q ? 'Coba kata lain, mis. “kopi” atau “teh”.' : 'Lihat kategori lain, ya.'}</p>
            </div>
          )}
        </main>

        <div className="hidden lg:flex">
          <SelfOrderCart
            cart={cart}
            promos={promos}
            discount={discount}
            member={member}
            onQty={onQty}
            onDiscountChange={setDiscount}
            onCheckout={() => setShowCheckout(true)}
          />
        </div>
      </div>

      {cart.length > 0 && !showCheckout && (
        <div className="lg:hidden fixed left-3 right-3 md:left-7 md:right-7 bottom-[max(16px,env(safe-area-inset-bottom))] z-40 max-w-[780px] md:mx-auto">
          <button
            type="button"
            onClick={() => setShowCheckout(true)}
            className="w-full flex items-center justify-between min-h-[60px] md:min-h-16 pl-[18px] md:pl-5 pr-3 py-2.5 rounded-2xl bg-ink text-white text-left shadow-[0_10px_30px_rgba(30,27,22,0.25)]"
          >
            <span className="flex flex-col md:flex-row md:items-center md:gap-4 min-w-0">
              <span className="text-[12px] md:text-[14px] text-[#D9D3C7]">
                {itemCount} item{cut.amount > 0 ? (discount.kind === 'promo' ? ' · promo terpasang' : ' · poin dipakai') : ''}
              </span>
              <span className="font-bold text-[16px] md:hidden tabular-nums">
                {formatRupiah(total)}
                {cut.amount > 0 && <span className="ml-1.5 font-medium text-[12px] text-[#B7AFA2] line-through">{formatRupiah(subtotal)}</span>}
              </span>
            </span>
            <span className="flex items-center gap-4">
              <span className="hidden md:inline font-bold text-[17px] tabular-nums">{formatRupiah(total)}</span>
              <span className="px-3.5 md:px-4 py-2.5 md:py-[11px] rounded-xl bg-sunny text-ink font-bold text-[14px] whitespace-nowrap">Lihat pesanan</span>
            </span>
          </button>
        </div>
      )}

      {selected && (
        <SelfOrderProductSheet
          key={selected.id}
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={(line) => { addToCart(line); say(`${line.product.name} ditambahkan.`); }}
        />
      )}

      {showCheckout && (
        <SelfOrderCheckout
          cart={cart}
          member={member}
          storeInfo={storeInfo}
          tableNum={tableNum}
          tableLocked={!!tableNum}
          promos={promos}
          discount={discount}
          onDiscountChange={setDiscount}
          onQty={onQty}
          onBack={() => setShowCheckout(false)}
          onSubmit={submitOrder}
          loading={submitting}
        />
      )}

      {showAccount && (
        <AccountSheet
          member={member}
          orders={myOrders}
          loading={ordersLoading}
          onOpenOrder={(o) => navigate(`/order/status/${o.id}`)}
          onLogout={logout}
          onClose={() => setShowAccount(false)}
        />
      )}
    </div>
  );
}
