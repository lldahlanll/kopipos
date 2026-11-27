import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit2, Trash2, X, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBanners, createBanner, updateBanner, deleteBanner, uploadBannerImage, deleteBannerImage } from '../api/banners';
import { getPromos } from '../api/promos';
import { describePromo } from '../utils/promo';
import { BannerCard } from '../components/selforder/BannerStrip';
import { useSettings } from '../context/SettingsContext';
import { readableBrand } from '../utils/selfOrder';

const EMPTY_FORM = {
  kind: 'promo', promo_id: '', title: '', subtitle: '', sponsor_name: '', link_url: '',
  placement: 'menu', sort_order: '0', starts_at: '', ends_at: '', is_active: true,
};

const PLACEMENT_LABEL = { menu: 'Halaman menu', status: 'Halaman status pesanan', both: 'Menu dan status' };

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatPeriod = (b) => {
  const fmt = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (!b.starts_at && !b.ends_at) return 'Tanpa batas waktu';
  if (b.starts_at && b.ends_at) return `${fmt(b.starts_at)} – ${fmt(b.ends_at)}`;
  return b.starts_at ? `Mulai ${fmt(b.starts_at)}` : `Sampai ${fmt(b.ends_at)}`;
};

const statusBadge = (b) => {
  if (!b.is_active) return { text: 'Nonaktif', cls: 'bg-danger/12 text-danger' };
  if (b.is_running) return { text: 'Tayang', cls: 'bg-success/12 text-success' };
  if (b.kind === 'promo') return { text: 'Promo tidak berlaku', cls: 'bg-warning/12 text-warning' };
  return { text: 'Di luar periode', cls: 'bg-warning/12 text-warning' };
};

const inputCls = 'w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted';
const labelCls = 'block text-sm font-medium text-text-secondary mb-1.5';
const hintCls = 'text-text-muted text-xs font-normal';
const iconBtn = 'inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent hover:bg-surface-2 transition-all';
const btnPrimary = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const btnGhost = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all';

export default function Banners() {
  const [banners, setBanners] = useState([]);
  const [promos, setPromos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const { themeColor } = useSettings();
  const brandStyle = { '--so-brand': readableBrand(themeColor) };

  const load = () => getBanners().then(r => setBanners(r.data)).catch(() => toast.error('Gagal memuat banner'));
  useEffect(() => {
    load();
    getPromos().then(r => setPromos(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!file) { setFilePreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, promo_id: promos.find(p => p.is_active)?.id?.toString() || '' });
    setFile(null); setRemoveImage(false); setShowModal(true);
  };
  const openEdit = (b) => {
    setEditItem(b);
    setForm({
      kind: b.kind, promo_id: b.promo_id ? String(b.promo_id) : '', title: b.title, subtitle: b.subtitle || '',
      sponsor_name: b.sponsor_name || '', link_url: b.link_url || '', placement: b.placement,
      sort_order: String(b.sort_order ?? 0), starts_at: toLocalInput(b.starts_at), ends_at: toLocalInput(b.ends_at),
      is_active: b.is_active,
    });
    setFile(null); setRemoveImage(false); setShowModal(true);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast.error('Gambar maksimal 5 MB'); e.target.value = ''; return; }
    setFile(f); setRemoveImage(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const isPromo = form.kind === 'promo';
    const payload = {
      kind: form.kind,
      promo_id: isPromo ? Number(form.promo_id) || null : null,
      title: form.title.trim(),
      subtitle: form.subtitle.trim() || null,
      sponsor_name: isPromo ? null : form.sponsor_name.trim() || null,
      link_url: isPromo ? null : form.link_url.trim() || null,
      placement: form.placement,
      sort_order: parseInt(form.sort_order, 10) || 0,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active,
    };
    try {
      const res = editItem ? await updateBanner(editItem.id, payload) : await createBanner(payload);
      const id = res.data.id;
      if (file) await uploadBannerImage(id, file);
      else if (removeImage && editItem?.image_url) await deleteBannerImage(id);
      toast.success(editItem ? 'Banner diperbarui' : 'Banner ditambahkan');
      setShowModal(false);
      load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(Array.isArray(detail) ? detail[0]?.msg?.replace(/^Value error, /, '') : detail || 'Gagal menyimpan banner');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b) => {
    try {
      await updateBanner(b.id, { is_active: !b.is_active });
      toast.success(b.is_active ? 'Banner disembunyikan' : 'Banner ditayangkan');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah status banner');
    }
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Hapus banner "${b.title}"?`)) return;
    try {
      await deleteBanner(b.id);
      toast.success('Banner dihapus');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus banner');
    }
  };

  const selectedPromo = promos.find(p => String(p.id) === String(form.promo_id));
  const previewImage = removeImage ? null : filePreview || editItem?.image_url || null;
  const preview = {
    id: 0, kind: form.kind, title: form.title || 'Judul banner', subtitle: form.subtitle || null,
    sponsor_name: form.sponsor_name || null, link_url: form.link_url || null, image_url: previewImage,
    promo: form.kind === 'promo' ? (selectedPromo || { id: -1, name: '', discount_type: 'percent', value: 0, min_purchase: 0 }) : null,
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Banner Self-Order</h1>
          <p className="text-sm text-text-secondary mt-1 max-w-[640px]">
            Tampil di HP pelanggan saat memesan dari meja. Banner promo memasang promonya di keranjang;
            promo hanya bisa dipakai pelanggan kalau banner promonya sedang tayang.
          </p>
        </div>
        <button className={`${btnPrimary} w-full sm:w-auto`} onClick={openCreate}>
          <Plus size={18} /> Tambah Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-text-muted">
          <ImageIcon size={32} className="mx-auto mb-3 opacity-60" />
          <p className="font-medium">Belum ada banner.</p>
          <p className="text-xs mt-1">Tambahkan banner promo atau iklan partner untuk halaman self-order.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {banners.map(b => {
            const badge = statusBadge(b);
            return (
              <div key={b.id} className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
                <div className="so-root p-3 pointer-events-none" style={brandStyle} aria-hidden="true">
                  <BannerCard banner={b} className="w-full" />
                </div>
                <div className="p-4 flex-1 flex flex-col gap-1.5 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
                    <span className="text-xs text-text-muted">{b.kind === 'promo' ? 'Promo toko' : 'Iklan partner'} · {PLACEMENT_LABEL[b.placement]}</span>
                  </div>
                  <div className="text-text-secondary">
                    {b.kind === 'promo' ? (b.promo ? `${b.promo.name} — ${describePromo(b.promo)}` : 'Promo terhapus') : (b.sponsor_name || 'Tanpa nama sponsor')}
                  </div>
                  <div className="text-text-muted text-xs">{formatPeriod(b)} · urutan {b.sort_order}</div>
                  <div className="flex gap-2 mt-auto pt-2">
                    <button className={`${iconBtn} text-text-secondary hover:text-text-primary`} aria-label={`Edit ${b.title}`} onClick={() => openEdit(b)}>
                      <Edit2 size={14} /> Edit
                    </button>
                    <button className={`${iconBtn} ${b.is_active ? 'text-danger' : 'text-success'}`} aria-label={`${b.is_active ? 'Sembunyikan' : 'Tayangkan'} ${b.title}`} onClick={() => toggleActive(b)}>
                      {b.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />} {b.is_active ? 'Sembunyikan' : 'Tayangkan'}
                    </button>
                    <button className={`${iconBtn} text-text-muted hover:text-danger ml-auto`} aria-label={`Hapus ${b.title}`} onClick={() => handleDelete(b)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Portal: wrapper halaman ber-animasi (transform) membuat `fixed` relatif ke wrapper */}
      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowModal(false)}>
          <div role="dialog" aria-modal="true" aria-label={editItem ? 'Edit banner' : 'Tambah banner'} className="bg-surface border border-border rounded-xl w-[95%] max-w-[920px] max-h-[92vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">{editItem ? 'Edit Banner' : 'Tambah Banner'}</h3>
              <button aria-label="Tutup" className="w-8 h-8 rounded-md text-text-muted flex items-center justify-center hover:bg-surface-2 hover:text-text-primary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 grid gap-6 md:grid-cols-[1fr_360px]">
                <div className="space-y-4">
                  <div role="radiogroup" aria-label="Jenis banner" className="grid grid-cols-2 gap-2">
                    {[['promo', 'Promo toko', 'Pelanggan bisa memasang promonya'], ['partner', 'Iklan partner', 'Ditandai “Disponsori”']].map(([id, label, sub]) => (
                      <button key={id} type="button" role="radio" aria-checked={form.kind === id} onClick={() => set({ kind: id })}
                        className={`text-left p-3 rounded-lg border transition-all ${form.kind === id ? 'border-primary bg-primary/10' : 'border-border bg-surface-2 hover:border-text-muted'}`}>
                        <span className="block text-sm font-semibold text-text-primary">{label}</span>
                        <span className="block text-xs text-text-muted mt-0.5">{sub}</span>
                      </button>
                    ))}
                  </div>

                  {form.kind === 'promo' ? (
                    <div>
                      <label htmlFor="bn-promo" className={labelCls}>Promo</label>
                      <select id="bn-promo" className={inputCls} value={form.promo_id} onChange={e => set({ promo_id: e.target.value })} required>
                        <option value="" disabled>Pilih promo…</option>
                        {promos.map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {describePromo(p)}{p.is_running ? '' : ' (tidak berlaku)'}</option>
                        ))}
                      </select>
                      {promos.length === 0 && <p className="text-xs text-warning mt-1.5">Belum ada promo. Buat dulu di menu Promo &amp; Diskon.</p>}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="bn-sponsor" className={labelCls}>Nama partner <span className={hintCls}>opsional</span></label>
                        <input id="bn-sponsor" className={inputCls} maxLength={80} value={form.sponsor_name} onChange={e => set({ sponsor_name: e.target.value })} placeholder="Mis. Toko Buku Sinar" />
                      </div>
                      <div>
                        <label htmlFor="bn-link" className={labelCls}>Tautan <span className={hintCls}>opsional</span></label>
                        <input id="bn-link" type="url" className={inputCls} maxLength={500} value={form.link_url} onChange={e => set({ link_url: e.target.value })} placeholder="https://…" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="bn-title" className={labelCls}>Judul</label>
                    <input id="bn-title" className={inputCls} required minLength={2} maxLength={80} value={form.title} onChange={e => set({ title: e.target.value })}
                      placeholder={form.kind === 'promo' ? 'Mis. Diskon 20% jam nugas' : 'Mis. Diskon buku 10% untuk pelanggan'} />
                  </div>
                  <div>
                    <label htmlFor="bn-sub" className={labelCls}>Keterangan <span className={hintCls}>{form.kind === 'promo' ? 'kosongkan agar otomatis dari syarat promo' : 'opsional'}</span></label>
                    <input id="bn-sub" className={inputCls} maxLength={160} value={form.subtitle} onChange={e => set({ subtitle: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="bn-place" className={labelCls}>Tampil di</label>
                      <select id="bn-place" className={inputCls} value={form.placement} onChange={e => set({ placement: e.target.value })}>
                        {Object.entries(PLACEMENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="bn-order" className={labelCls}>Urutan <span className={hintCls}>kecil tampil dulu</span></label>
                      <input id="bn-order" type="number" className={inputCls} value={form.sort_order} onChange={e => set({ sort_order: e.target.value })} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="bn-start" className={labelCls}>Mulai <span className={hintCls}>opsional</span></label>
                      <input id="bn-start" type="datetime-local" className={inputCls} value={form.starts_at} onChange={e => set({ starts_at: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="bn-end" className={labelCls}>Selesai <span className={hintCls}>opsional</span></label>
                      <input id="bn-end" type="datetime-local" className={inputCls} value={form.ends_at} min={form.starts_at || undefined} onChange={e => set({ ends_at: e.target.value })} />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                    <input type="checkbox" checked={form.is_active} onChange={e => set({ is_active: e.target.checked })} />
                    Tayangkan banner ini
                  </label>
                </div>

                <div className="space-y-3">
                  <div>
                    <span className={labelCls}>Gambar <span className={hintCls}>opsional · jpg/png/webp, maks 5 MB</span></span>
                    <div className="flex gap-2 flex-wrap">
                      <label className={`${btnGhost} cursor-pointer`}>
                        <ImageIcon size={16} /> {previewImage ? 'Ganti gambar' : 'Pilih gambar'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onFile} />
                      </label>
                      {previewImage && (
                        <button type="button" className={btnGhost} onClick={() => { setFile(null); setRemoveImage(true); }}>Hapus gambar</button>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={labelCls}>Pratinjau di HP pelanggan</span>
                    <div className="so-root rounded-xl p-3 pointer-events-none" style={brandStyle} aria-hidden="true">
                      <BannerCard banner={preview} className="w-full" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface-2/50">
                <button type="button" className={btnGhost} onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
