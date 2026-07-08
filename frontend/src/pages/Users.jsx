import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser } from '../api/users';
import { Plus, Edit2, Trash2, X, Shield, User as UserIcon, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = () => {
    getUsers()
      .then(res => setUsers(res.data))
      .catch(() => toast.error('Gagal memuat pengguna'));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditItem(null);
    setForm({ name: '', email: '', password: '', role: 'cashier', is_active: true });
    setShowModal(true);
  };

  const openEdit = (u) => {
    setEditItem(u);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editItem && !payload.password) delete payload.password;
      
      if (editItem) {
        await updateUser(editItem.id, payload);
        toast.success('Pengguna berhasil diperbarui');
      } else {
        if (!payload.password) {
          toast.error('Password wajib diisi untuk pengguna baru');
          setSaving(false);
          return;
        }
        await createUser(payload);
        toast.success('Pengguna berhasil ditambahkan');
      }
      setShowModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Terjadi kesalahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Yakin ingin menghapus pengguna ini?')) {
      try {
        await deleteUser(id);
        toast.success('Pengguna berhasil dihapus');
        load();
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Gagal menghapus pengguna');
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Manajemen Kasir</h1>
            <p className="text-sm text-text-secondary mt-1">Kelola akun kasir dan admin</p>
          </div>
          <button className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto" onClick={openCreate}>
            <Plus size={18} /> Tambah Akun
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto overflow-y-hidden max-sm:border-none max-sm:bg-transparent max-sm:p-0 max-sm:overflow-visible">
        <table className="w-full border-collapse min-w-[540px] max-sm:min-w-0 max-sm:block text-left text-sm">
          <thead className="max-sm:hidden bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Nama</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Email</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Role</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Status</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap w-[120px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="max-sm:block max-sm:w-full">
            {users.length === 0 ? (
              <tr className="max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:p-3"><td colSpan={5} className="text-center text-text-muted p-8">Belum ada data</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="border-b border-border-subtle hover:bg-white/5 transition-colors max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:mb-2.5 max-sm:p-3 max-sm:relative max-sm:hover:bg-transparent">
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Nama</span>
                  <div className="flex items-center gap-2.5 text-right sm:text-left">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                      backgroundColor: u.role === 'owner' ? 'rgba(232, 168, 73, 0.15)' : u.role === 'kitchen' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-surface-3)',
                      color: u.role === 'owner' ? 'var(--color-accent)' : u.role === 'kitchen' ? 'var(--color-success)' : 'var(--text-secondary)'
                    }}>
                      {u.role === 'owner' ? <Shield size={16} /> : u.role === 'kitchen' ? <Monitor size={16} /> : <UserIcon size={16} />}
                    </div>
                    <span className="font-semibold">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Email</span>
                  {u.email}
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Role</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide capitalize ${u.role === 'owner' ? 'bg-warning/15 text-[#b45309]' : 'bg-surface-3 text-text-secondary border border-border'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${u.is_active ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger'}`}>
                    {u.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-none">
                  <span className="sm:hidden font-semibold text-text-secondary mr-4">Aksi</span>
                  <div className="flex gap-2 justify-end">
                    <button className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Edit" onClick={() => openEdit(u)}><Edit2 size={14} /></button>
                    <button className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border border-transparent bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Hapus" onClick={() => handleDelete(u.id)}><Trash2 size={14} /></button>
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
              <h3 className="text-lg font-bold text-text-primary">{editItem ? 'Edit Akun' : 'Tambah Akun'}</h3>
              <button className="w-8 h-8 rounded-md bg-transparent border-none text-text-muted cursor-pointer flex items-center justify-center transition-all hover:bg-surface-2 hover:text-text-primary" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Nama Lengkap</label>
                  <input
                    required
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Email / Username</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">Password {editItem && <span className="text-text-muted text-xs font-normal">(Kosongkan jika tidak ingin ganti)</span>}</label>
                  <input
                    type="password"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required={!editItem}
                    minLength={6}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">Role</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30"
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                    >
                      <option value="cashier">Kasir</option>
                      <option value="kitchen">Dapur (Kitchen)</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  {editItem && (
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">Status</label>
                      <select
                        className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30"
                        value={form.is_active ? 'true' : 'false'}
                        onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
                    </div>
                  )}
                </div>
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
