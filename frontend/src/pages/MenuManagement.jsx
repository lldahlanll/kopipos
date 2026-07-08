import { useState, useEffect, useRef } from 'react';
import { getProducts, createProduct, updateProduct, deleteProduct, createVariant, updateVariant, deleteVariant, uploadProductImage } from '../api/products';
import { getCategories } from '../api/categories';
import { Plus, Edit2, Trash2, X, Save, ImagePlus, Coffee, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatRupiah } from '../utils/format';
import { useAutoAnimate } from '@formkit/auto-animate/react';

export default function MenuManagement() {
  const [tableRef] = useAutoAnimate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', category_id: '', base_price: '', description: '', is_recommended: false, is_bestseller: false, is_favorite: false });
  const [variants, setVariants] = useState([]);
  const [filterCat, setFilterCat] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const load = () => {
    const params = {};
    if (filterCat) params.category_id = filterCat;
    getProducts(params).then(r => setProducts(r.data)).catch(() => toast.error('Gagal memuat produk'));
  };

  useEffect(() => {
    getCategories().then(r => setCategories(r.data)).catch(() => toast.error('Gagal memuat kategori'));
  }, []);

  useEffect(() => { load(); }, [filterCat]);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', category_id: categories[0]?.id || '', base_price: '', description: '', is_recommended: false, is_bestseller: false, is_favorite: false });
    setVariants([]);
    setImageFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditItem(p);
    setForm({ name: p.name, category_id: p.category_id, base_price: p.base_price, description: p.description || '', is_recommended: p.is_recommended || false, is_bestseller: p.is_bestseller || false, is_favorite: p.is_favorite || false });
    setImageFile(null);
    setImagePreview(p.image_url || null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        name: form.name,
        category_id: Number(form.category_id),
        base_price: Number(form.base_price),
        description: form.description || null,
        is_recommended: form.is_recommended,
        is_bestseller: form.is_bestseller,
        is_favorite: form.is_favorite,
      };

      if (editItem) {
        await updateProduct(editItem.id, data);
        if (imageFile) {
          await uploadProductImage(editItem.id, imageFile);
        }
        toast.success('Menu berhasil diperbarui!');
      } else {
        const created = await createProduct(data);
        if (imageFile && created.data?.id) {
          await uploadProductImage(created.data.id, imageFile);
        }
        toast.success('Menu berhasil ditambahkan!');
      }

      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan menu');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p) => {
    const action = p.is_active ? 'Nonaktifkan' : 'Aktifkan';
    if (window.confirm(`${action} produk ini?`)) {
      try {
        await updateProduct(p.id, { is_active: !p.is_active });
        toast.success(`Produk ${action.toLowerCase()}`);
        load();
      } catch {
        toast.error(`Gagal ${action.toLowerCase()} produk`);
      }
    }
  };

  const addVariantRow = () => {
    setVariants([...variants, { name: '', price_adjustment: 0, is_active: true, _edited: false, _deleted: false }]);
  };

  const updateVariantField = (i, field, value) => {
    const copy = [...variants];
    copy[i] = { ...copy[i], [field]: value, _edited: true };
    setVariants(copy);
  };

  const markVariantDeleted = (i) => {
    if (!variants[i].id) {
      setVariants(variants.filter((_, j) => j !== i));
    } else {
      const copy = [...variants];
      copy[i] = { ...copy[i], _deleted: !copy[i]._deleted };
      setVariants(copy);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Menu</h1>
            <p className="text-sm text-text-secondary mt-1">Kelola produk dan varian</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto" onClick={openCreate}>
            <Plus size={18} /> Tambah Menu
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          className="w-full sm:w-auto px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 min-w-[160px]"
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
        >
          <option value="">Semua Kategori</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto overflow-y-hidden max-sm:border-none max-sm:bg-transparent max-sm:p-0 max-sm:overflow-visible">
        <table className="w-full border-collapse min-w-[540px] max-sm:min-w-0 max-sm:block text-left text-sm">
          <thead className="max-sm:hidden bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Nama</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Kategori</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Harga</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Varian</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap w-[120px]">Aksi</th>
            </tr>
          </thead>
          <tbody ref={tableRef} className="max-sm:block max-sm:w-full">
            {products.length === 0 ? (
              <tr className="max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:p-3">
                <td colSpan={6} className="text-center text-text-muted p-8">Belum ada menu</td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b border-border-subtle hover:bg-white/5 transition-colors max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:mb-2.5 max-sm:p-3 max-sm:relative max-sm:hover:bg-transparent">
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Nama</span>
                  <div className="flex items-center gap-2.5 text-right sm:text-left">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        className="w-10 h-10 object-cover rounded-lg shrink-0 bg-white"
                        onError={e => { e.target.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                        <Coffee size={16} className="text-text-muted" />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      {p.description && <div className="text-sm text-text-muted max-sm:hidden">{p.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Kategori</span>
                  {categories.find(c => c.id === p.category_id)?.name || '-'}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle font-semibold">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Harga</span>
                  {formatRupiah(p.base_price)}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Varian</span>
                  {p.variants?.filter(v => v.is_active).length > 0 ? (
                    <div className="flex gap-1.5 flex-wrap justify-end sm:justify-start">
                      {p.variants.filter(v => v.is_active).map(v => (
                        <span key={v.id} className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-surface-3 text-text-secondary border border-border">
                          {v.name} {v.price_adjustment > 0 ? `+${formatRupiah(v.price_adjustment)}` : ''}
                        </span>
                      ))}
                    </div>
                  ) : <span className="text-text-muted">-</span>}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${p.is_active ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'}`}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-none">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Aksi</span>
                  <div className="flex gap-2 justify-end">
                    <button className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Edit" onClick={() => openEdit(p)}>
                      <Edit2 size={14} />
                    </button>
                    <button 
                      className={`inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent hover:bg-surface-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${p.is_active ? 'text-danger' : 'text-success'}`}
                      title={p.is_active ? "Nonaktifkan" : "Aktifkan ulang"} 
                      onClick={() => handleToggleActive(p)}
                    >
                      {p.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
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
          <div className="bg-surface border border-border rounded-xl w-[95%] max-w-[580px] max-h-[90vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">{editItem ? 'Edit Menu' : 'Tambah Menu'}</h3>
              <button className="w-8 h-8 rounded-md bg-transparent border-none text-text-muted cursor-pointer flex items-center justify-center transition-all hover:bg-surface-2 hover:text-text-primary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Foto Produk (opsional)</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-3 cursor-pointer flex items-center gap-3 transition-colors hover:border-primary"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : imagePreview}
                        alt="preview"
                        className="w-16 h-16 object-cover rounded-lg shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                        <ImagePlus size={24} className="text-text-muted" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-[13px] text-text-primary">{imageFile ? imageFile.name : 'Klik untuk pilih gambar'}</div>
                      <div className="text-sm text-text-muted">JPG, PNG, WebP. Max 5MB.</div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setImageFile(file);
                        setImagePreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Nama Produk</label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Es Kopi Susu"
                    required
                    autoFocus
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Kategori</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                      value={form.category_id}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                      required
                    >
                      <option value="">Pilih...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Harga (Rp)</label>
                    <input
                      type="number"
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                      value={form.base_price}
                      onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                      placeholder="22000"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Deskripsi (opsional)</label>
                  <input
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Signature blend coffee"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-2.5">Atribut Khusus (Self Order)</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                      <input 
                        type="checkbox" 
                        checked={form.is_recommended}
                        onChange={(e) => setForm({ ...form, is_recommended: e.target.checked })}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" 
                      />
                      ⭐ Rekomendasi
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                      <input 
                        type="checkbox" 
                        checked={form.is_bestseller}
                        onChange={(e) => setForm({ ...form, is_bestseller: e.target.checked })}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" 
                      />
                      🔥 Terlaris
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-text-primary">
                      <input 
                        type="checkbox" 
                        checked={form.is_favorite}
                        onChange={(e) => setForm({ ...form, is_favorite: e.target.checked })}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50" 
                      />
                      ❤️ Favorit
                    </label>
                  </div>
                </div>

                {/* Variants section removed */}
              </div>

              <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-surface-2/50">
                <button type="button" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed" disabled={saving}>
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
