import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, CheckCircle, XCircle, BadgePercent } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { getPromos, createPromo, updatePromo, deletePromo } from '../api/promos';
import { describePromo } from '../utils/promo';

const EMPTY_FORM = {
  name: '', discount_type: 'percent', value: '', max_discount: '', min_purchase: '',
  starts_at: '', ends_at: '', is_active: true,
};

// ISO dari server → nilai <input type="datetime-local"> (waktu lokal)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatPeriod = (p) => {
  const fmt = (iso) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (!p.starts_at && !p.ends_at) return 'Tanpa batas waktu';
  if (p.starts_at && p.ends_at) return `${fmt(p.starts_at)} – ${fmt(p.ends_at)}`;
  return p.starts_at ? `Mulai ${fmt(p.starts_at)}` : `Sampai ${fmt(p.ends_at)}`;
};

const statusBadge = (p) => {
  if (!p.is_active) return { text: 'Nonaktif', cls: 'bg-danger/12 text-danger' };
  if (p.is_running) return { text: 'Berlaku', cls: 'bg-success/12 text-success' };
  return { text: 'Di luar periode', cls: 'bg-warning/12 text-warning' };
};

const inputCls = 'w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted';
const labelCls = 'block text-sm font-medium text-text-secondary mb-1.5';
const iconBtn = 'inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent hover:bg-surface-2 transition-all';

export default function Promos() {
  const [tableRef] = useAutoAnimate();
  const [promos, setPromos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = () => getPromos().then(r => setPromos(r.data)).catch(() => toast.error('Gagal memuat promo'));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (p) => {
    setEditItem(p);
    setForm({
      name: p.name, discount_type: p.discount_type, value: String(p.value),
      max_discount: p.max_discount ? String(p.max_discount) : '',
      min_purchase: p.min_purchase ? String(p.min_purchase) : '',
      starts_at: toLocalInput(p.starts_at), ends_at: toLocalInput(p.ends_at), is_active: p.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      discount_type: form.discount_type,
      value: parseFloat(form.value) || 0,
      max_discount: form.discount_type === 'percent' && form.max_discount ? parseFloat(form.max_discount) : null,
      min_purchase: parseFloat(form.min_purchase) || 0,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      is_active: form.is_active,
    };
    try {
      if (editItem) await updatePromo(editItem.id, payload);
      else await createPromo(payload);
      toast.success(editItem ? 'Promo diperbarui' : 'Promo ditambahkan');
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan promo');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p) => {
    try {
      await updatePromo(p.id, { is_active: !p.is_active });
      toast.success(p.is_active ? 'Promo dinonaktifkan' : 'Promo diaktifkan');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal mengubah status promo');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Hapus promo "${p.name}"?`)) return;
    try {
      await deletePromo(p.id);
      toast.success('Promo dihapus');
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus promo');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Promo & Diskon</h1>
            <p className="text-sm text-text-secondary mt-1">Kasir hanya bisa memakai promo yang berlaku di sini.</p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all w-full sm:w-auto"
            onClick={openCreate}
          >
            <Plus size={18} /> Tambah Promo
          </button>
        </div>
      </div>

      {promos.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-10 text-center text-text-muted">
          <BadgePercent size={32} className="mx-auto mb-3 opacity-60" />
          <p className="font-medium">Belum ada promo.</p>
          <p className="text-xs mt-1">Tambahkan promo agar kasir bisa memberi diskon.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto overflow-y-hidden max-sm:border-none max-sm:bg-transparent max-sm:p-0 max-sm:overflow-visible">
          <table className="w-full border-collapse min-w-[720px] max-sm:min-w-0 max-sm:block text-left text-sm">
            <thead className="max-sm:hidden bg-surface-2 border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-text-secondary">Nama</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">Diskon</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">Periode</th>
                <th className="px-4 py-3 font-semibold text-text-secondary">Status</th>
                <th className="px-4 py-3 font-semibold text-text-secondary w-[140px]">Aksi</th>
              </tr>
            </thead>
            <tbody ref={tableRef} className="max-sm:block max-sm:w-full">
              {promos.map((p) => {
                const badge = statusBadge(p);
                return (
                  <tr key={p.id} className="border-b border-border-subtle hover:bg-white/5 transition-colors max-sm:block max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:mb-2.5 max-sm:p-3">
                    <td className="px-4 py-3 font-semibold max-sm:block max-sm:px-0 max-sm:py-1">{p.name}</td>
                    <td className="px-4 py-3 text-text-secondary max-sm:block max-sm:px-0 max-sm:py-1">{describePromo(p)}</td>
                    <td className="px-4 py-3 text-text-secondary max-sm:block max-sm:px-0 max-sm:py-1">{formatPeriod(p)}</td>
                    <td className="px-4 py-3 max-sm:block max-sm:px-0 max-sm:py-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${badge.cls}`}>{badge.text}</span>
                    </td>
                    <td className="px-4 py-3 max-sm:block max-sm:px-0 max-sm:pt-2">
                      <div className="flex gap-2 justify-end max-sm:justify-start">
                        <button className={`${iconBtn} text-text-secondary hover:text-text-primary`} title="Edit" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}>
                          <Edit2 size={14} />
                        </button>
                        <button
                          className={`${iconBtn} ${p.is_active ? 'text-danger' : 'text-success'}`}
                          title={p.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          aria-label={`${p.is_active ? 'Nonaktifkan' : 'Aktifkan'} ${p.name}`}
                          onClick={() => toggleActive(p)}
                        >
                          {p.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                        </button>
                        <button className={`${iconBtn} text-text-muted hover:text-danger`} title="Hapus" aria-label={`Hapus ${p.name}`} onClick={() => handleDelete(p)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowModal(false)}>
          <div role="dialog" aria-modal="true" className="bg-surface border border-border rounded-xl w-[95%] max-w-[520px] max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">{editItem ? 'Edit Promo' : 'Tambah Promo'}</h3>
              <button aria-label="Tutup" className="w-8 h-8 rounded-md bg-transparent border-none text-text-muted cursor-pointer flex items-center justify-center transition-all hover:bg-surface-2 hover:text-text-primary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label htmlFor="promo-name" className={labelCls}>Nama Promo</label>
                  <input id="promo-name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Happy Hour 15%" required minLength={2} maxLength={100} autoFocus />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="promo-type" className={labelCls}>Jenis</label>
                    <select id="promo-type" className={inputCls} value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}>
                      <option value="percent">Persen (%)</option>
                      <option value="nominal">Nominal (Rp)</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="promo-value" className={labelCls}>{form.discount_type === 'percent' ? 'Besar diskon (%)' : 'Besar diskon (Rp)'}</label>
                    <input id="promo-value" type="number" className={inputCls} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                      min={1} max={form.discount_type === 'percent' ? 100 : undefined} step="any" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {form.discount_type === 'percent' && (
                    <div>
                      <label htmlFor="promo-max" className={labelCls}>Maks. diskon (Rp) <span className="text-text-muted text-xs font-normal">opsional</span></label>
                      <input id="promo-max" type="number" className={inputCls} value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} min={1} placeholder="Tanpa batas" />
                    </div>
                  )}
                  <div>
                    <label htmlFor="promo-min" className={labelCls}>Min. belanja (Rp) <span className="text-text-muted text-xs font-normal">opsional</span></label>
                    <input id="promo-min" type="number" className={inputCls} value={form.min_purchase} onChange={(e) => setForm({ ...form, min_purchase: e.target.value })} min={0} placeholder="0" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="promo-start" className={labelCls}>Mulai <span className="text-text-muted text-xs font-normal">opsional</span></label>
                    <input id="promo-start" type="datetime-local" className={inputCls} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                  </div>
                  <div>
                    <label htmlFor="promo-end" className={labelCls}>Selesai <span className="text-text-muted text-xs font-normal">opsional</span></label>
                    <input id="promo-end" type="datetime-local" className={inputCls} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} min={form.starts_at || undefined} />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                  Aktif (bisa dipilih kasir selama dalam periode)
                </label>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface-2/50">
                <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
