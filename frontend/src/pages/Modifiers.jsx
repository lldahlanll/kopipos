import { useState, useEffect } from 'react';
import { getModifiers, createModifier, updateModifier, deleteModifier } from '../api/modifiers';
import { Plus, Edit2, Trash2, X, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import { formatRupiah } from '../utils/format';

export default function Modifiers() {
  const [tableRef] = useAutoAnimate();
  const [modifiers, setModifiers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', price_adjustment: 0 });

  const load = () => getModifiers().then(r => setModifiers(r.data));
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name: form.name, price_adjustment: Number(form.price_adjustment) };
    if (editItem) {
      await updateModifier(editItem.id, data);
    } else {
      await createModifier(data);
    }
    setShowModal(false);
    setEditItem(null);
    load();
  };

  const handleEdit = (m) => {
    setEditItem(m);
    setForm({ name: m.name, price_adjustment: m.price_adjustment });
    setShowModal(true);
  };

  const handleToggleActive = async (m) => {
    const action = m.is_active ? 'Nonaktifkan' : 'Aktifkan';
    if (window.confirm(`${action} modifier ini?`)) {
      try {
        await updateModifier(m.id, { is_active: !m.is_active });
        toast.success(`Modifier ${action.toLowerCase()}`);
        load();
      } catch (err) {
        toast.error(`Gagal ${action.toLowerCase()} modifier`);
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Topping & Ekstra</h1>
            <p className="text-sm text-text-secondary mt-1">Extra shot, less sugar, dll</p>
          </div>
          <button 
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto" 
            onClick={() => { setEditItem(null); setForm({ name: '', price_adjustment: 0 }); setShowModal(true); }}
          >
            <Plus size={18} /> Tambah Topping/Ekstra
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto overflow-y-hidden max-sm:border-none max-sm:bg-transparent max-sm:p-0 max-sm:overflow-visible">
        <table className="w-full border-collapse min-w-[540px] max-sm:min-w-0 max-sm:block text-left text-sm">
          <thead className="max-sm:hidden bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Nama</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Tambahan Harga</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap w-[120px]">Aksi</th>
            </tr>
          </thead>
          <tbody ref={tableRef} className="max-sm:block max-sm:w-full">
            {modifiers.map((m) => (
              <tr key={m.id} className="border-b border-border-subtle hover:bg-white/5 transition-colors max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:mb-2.5 max-sm:p-3 max-sm:relative max-sm:hover:bg-transparent">
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle font-semibold">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Nama</span>
                  {m.name}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Tambahan Harga</span>
                  {m.price_adjustment > 0 ? `+${formatRupiah(m.price_adjustment)}` : 'Gratis'}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${m.is_active ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'}`}>{m.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-none">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Aksi</span>
                  <div className="flex gap-2 justify-end">
                    <button 
                      className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed" 
                      title="Edit" 
                      onClick={() => handleEdit(m)}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      className={`inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent hover:bg-surface-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${m.is_active ? 'text-danger' : 'text-success'}`}
                      title={m.is_active ? "Nonaktifkan" : "Aktifkan ulang"} 
                      onClick={() => handleToggleActive(m)}
                    >
                      {m.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={() => setShowModal(false)}>
          <div className="bg-surface border border-border rounded-xl w-[95%] max-w-[480px] max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">{editItem ? 'Edit Topping/Ekstra' : 'Tambah Topping/Ekstra'}</h3>
              <button className="w-8 h-8 rounded-md bg-transparent border-none text-text-muted cursor-pointer flex items-center justify-center transition-all hover:bg-surface-2 hover:text-text-primary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Nama</label>
                  <input className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Extra Shot" required autoFocus />
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Tambahan Harga (Rp)</label>
                  <input type="number" className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted" value={form.price_adjustment} onChange={(e) => setForm({ ...form, price_adjustment: e.target.value })} placeholder="5000" />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface-2/50">
                <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
