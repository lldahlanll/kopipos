import { useState, useEffect, useRef } from 'react';
import { getSettings, updateSettings, uploadLogo } from '../api/settings';
import { printTestViaBackend } from '../api/print';
import { useSettings } from '../context/SettingsContext';
import toast from 'react-hot-toast';
import { Save, Wifi, Store, Printer, CheckCircle, XCircle, RefreshCw, ImagePlus, FileText } from 'lucide-react';
import {
  connectQZ,
  getPrinters,
  printTestReceipt,
} from '../utils/qzPrint';

export default function Settings() {
  const { refreshSettings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [formData, setFormData] = useState({
    store_name: '',
    store_address: '',
    store_phone: '',
    theme_color: '#c8a27a',
    wifi_ssid: '',
    wifi_password: '',
    default_printer: '',
    printer_ip: '',
    printer_port: '9100',
    printer_type: 'network',
    paper_width: '58',
    tax_rate: '0',
    receipt_footer: '',
  });

  const [qzStatus, setQzStatus] = useState('idle');
  const [printers, setPrinters] = useState([]);
  const [testPrinting, setTestPrinting] = useState(false);
  const [qzHost, setQzHost] = useState(localStorage.getItem('qz_host') || 'localhost');
  const [networkTestPrinting, setNetworkTestPrinting] = useState(false);

  useEffect(() => {
    getSettings()
      .then(res => {
        setFormData({
          store_name:       res.data.store_name       || '',
          store_address:    res.data.store_address    || '',
          store_phone:      res.data.store_phone      || '',
          theme_color:      res.data.theme_color      || '#c8a27a',
          wifi_ssid:        res.data.wifi_ssid        || '',
          wifi_password:    res.data.wifi_password    || '',
          default_printer:  res.data.default_printer  || '',
          printer_ip:       res.data.printer_ip       || '',
          printer_port:     res.data.printer_port     || '9100',
          printer_type:     res.data.printer_type     || 'network',
          paper_width:      res.data.paper_width      || '58',
          tax_rate:         res.data.tax_rate?.toString() || '0',
          receipt_footer:   res.data.receipt_footer   || '',
        });
        if (res.data.store_logo) setImagePreview(res.data.store_logo);
      })
      .catch(() => toast.error('Gagal memuat pengaturan'))
      .finally(() => setLoading(false));

    handleConnectQZ(true);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (imageFile) {
        await uploadLogo(imageFile);
      }
      const payload = { ...formData, tax_rate: formData.tax_rate?.toString() || '0' };
      await updateSettings(payload);
      await refreshSettings();
      toast.success('Pengaturan berhasil disimpan');
      setImageFile(null);
    } catch (err) {
      let msg = 'Gagal menyimpan pengaturan';
      const detail = err.response?.data?.detail;
      if (detail) {
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        } else if (typeof detail === 'object') {
          msg = JSON.stringify(detail);
        }
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectQZ = async (silent = false) => {
    setQzStatus('connecting');
    try {
      localStorage.setItem('qz_host', qzHost || 'localhost');
      await connectQZ();
      const list = await getPrinters();
      setPrinters(list);
      setQzStatus('connected');
      if (!silent) toast.success('Terhubung ke QZ Tray!');
    } catch (err) {
      setQzStatus('error');
      if (!silent) toast.error(err.message || 'Gagal terhubung ke QZ Tray');
    }
  };

  const handleTestPrint = async () => {
    setTestPrinting(true);
    try {
      await printTestReceipt(formData, formData.default_printer || null);
      toast.success('Struk test berhasil dicetak via QZ Tray!');
    } catch (err) {
      toast.error(err.message || 'Gagal cetak test via QZ Tray');
    } finally {
      setTestPrinting(false);
    }
  };

  const handleTestNetworkPrint = async () => {
    if (!formData.printer_ip) {
      toast.error('Isi IP printer terlebih dahulu');
      return;
    }
    setNetworkTestPrinting(true);
    try {
      await printTestViaBackend(
        formData.printer_ip,
        parseInt(formData.printer_port) || 9100,
        parseInt(formData.paper_width) || 58
      );
      toast.success('Struk test berhasil dicetak via Network!');
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Gagal cetak test via Network');
    } finally {
      setNetworkTestPrinting(false);
    }
  };

  if (loading) return (
    <div className="h-full w-full flex items-center justify-center min-h-[50vh]">
      <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );

  const qzConnected = qzStatus === 'connected';

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Pengaturan Toko</h1>
        <p className="text-sm text-text-secondary mt-1">Atur informasi toko dan printer kasir.</p>
      </div>

      {/* ─── Info Toko ─── */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-6 w-full max-w-full lg:max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Store size={20} />
          <h3 className="text-base font-semibold">Informasi Toko</h3>
        </div>
        <div>
          <p className="text-sm text-text-muted mb-4">
            Informasi ini akan dicetak di bagian atas setiap struk pesanan dan ditampilkan di halaman aplikasi.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Logo Toko (opsional)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-border rounded-lg p-3 cursor-pointer flex items-center gap-3 transition-colors hover:border-primary"
            >
              {imagePreview ? (
                <img
                  src={imagePreview.startsWith('blob:') || imagePreview.startsWith('data:') ? imagePreview : imagePreview}
                  alt="preview"
                  className="w-16 h-16 object-contain rounded-lg shrink-0 bg-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-surface-3 flex items-center justify-center shrink-0">
                  <ImagePlus size={24} className="text-text-muted" />
                </div>
              )}
              <div>
                <div className="font-medium text-[13px]">{imageFile ? imageFile.name : 'Klik untuk ubah logo'}</div>
                <div className="text-sm text-text-muted">Akan tampil di Sidebar dan Halaman Login</div>
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
            <label className="block text-sm font-medium text-text-secondary mb-1">Warna Tema Utama</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                name="theme_color"
                value={formData.theme_color}
                onChange={handleChange}
                className="w-10 h-10 p-0 border-none rounded-lg cursor-pointer outline-none bg-transparent"
              />
              <span className="text-sm font-medium font-mono uppercase">
                {formData.theme_color}
              </span>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Nama Toko</label>
            <input
              type="text"
              name="store_name"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: KopiPOS Coffee Shop"
              value={formData.store_name}
              onChange={handleChange}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Alamat Toko</label>
            <input
              type="text"
              name="store_address"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: Jl. Raya No. 123, Jakarta"
              value={formData.store_address}
              onChange={handleChange}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Nomor Telepon</label>
            <input
              type="text"
              name="store_phone"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: 0812-3456-7890"
              value={formData.store_phone}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* ─── Sistem Printer Kasir ─── */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-6 w-full max-w-full lg:max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Printer size={20} />
          <h3 className="text-base font-semibold">Sistem Printer Kasir</h3>
        </div>
        <div>
          <div className="mb-4">
            <label className="block text-[15px] font-semibold text-text-secondary mb-1">Bagaimana printer Anda terhubung?</label>
            <select 
              name="printer_type" 
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-[15px] transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30"
              value={formData.printer_type} 
              onChange={handleChange}
            >
              <option value="network">Kabel LAN / WiFi (Tanpa colok ke alat ini)</option>
              <option value="usb">Kabel USB / Bluetooth (Tersambung langsung ke alat ini)</option>
            </select>
            <p className="text-sm text-text-muted mt-2">
              {formData.printer_type === 'network' 
                ? 'Cocok jika Anda menggunakan HP/Tablet kasir, karena printer ditembak langsung via jaringan WiFi/LAN.'
                : 'Pilih ini jika kabel printer dicolok langsung ke komputer/laptop ini. Membutuhkan Aplikasi Penghubung (QZ Tray).'}
            </p>
          </div>

          <hr className="my-5 border-dashed border-border" />

          {formData.printer_type === 'network' && (
            <div className="animate-in">
              <div className="px-4 py-3 rounded-lg mb-4 bg-blue-500/10 border border-blue-500/20 text-sm">
                💡 <strong>Cara mengetahui Alamat IP Printer:</strong> Matikan printer, tekan & tahan tombol FEED kertas, lalu nyalakan printer sambil tetap menahan tombol FEED selama 3 detik. Kertas berisi informasi IP (seperti 192.168.1.100) akan tercetak.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="mb-0">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Alamat IP Printer</label>
                  <input
                    type="text"
                    name="printer_ip"
                    className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
                    placeholder="Contoh: 192.168.1.100"
                    value={formData.printer_ip}
                    onChange={handleChange}
                  />
                </div>
                <div className="mb-0">
                  <label className="block text-sm font-medium text-text-secondary mb-1">Ukuran Kertas Struk</label>
                  <select name="paper_width" className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30" value={formData.paper_width} onChange={handleChange}>
                    <option value="58">Kecil (58mm)</option>
                    <option value="80">Besar (80mm)</option>
                  </select>
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-text-muted text-sm font-medium">
                  ⚙️ Pengaturan Lanjutan (Opsional)
                </summary>
                <div className="p-3 bg-light rounded-lg mt-2">
                  <div className="mb-0">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Port TCP Printer</label>
                    <input
                      type="number"
                      name="printer_port"
                      className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
                      placeholder="9100"
                      value={formData.printer_port}
                      onChange={handleChange}
                    />
                    <p className="text-xs text-text-muted mt-1">Biarkan 9100 jika tidak tahu (standar printer kasir).</p>
                  </div>
                </div>
              </details>

              <button
                className="w-full mt-5 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleTestNetworkPrint}
                disabled={networkTestPrinting || !formData.printer_ip}
              >
                <Printer size={18} />
                {networkTestPrinting ? 'Mencetak ke Printer...' : 'Tes Cetak Struk Sekarang'}
              </button>
            </div>
          )}

          {formData.printer_type === 'usb' && (
            <div className="animate-in">
              <label className="block text-sm font-medium text-text-secondary mb-1">Status Aplikasi Penghubung</label>
              <div className={`flex items-center justify-between px-4 py-3 rounded-lg mb-4 border ${qzConnected ? 'bg-success/10 border-success/30' : qzStatus === 'error' ? 'bg-danger/10 border-danger/30' : 'bg-surface-3 border-border'}`}>
                <div className="flex items-center gap-2.5">
                  {qzStatus === 'connecting' ? (
                    <RefreshCw size={18} className="text-primary animate-spin" />
                  ) : qzConnected ? (
                    <CheckCircle size={18} className="text-[#22c55e]" />
                  ) : (
                    <XCircle size={18} className="text-[#ef4444]" />
                  )}
                  <div>
                    <div className="font-semibold text-sm">
                      {qzStatus === 'connecting' ? 'Sedang Mengecek...'
                        : qzConnected ? 'Aplikasi Siap Digunakan'
                        : 'Aplikasi Belum Terdeteksi'}
                    </div>
                    {!qzConnected && qzStatus !== 'connecting' && (
                      <div className="text-sm text-text-muted">
                        Buka aplikasi QZ Tray di komputer ini. Belum punya? <a href="https://qz.io/download/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Download di sini</a>.
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md font-sans text-[13px] font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  onClick={() => handleConnectQZ(false)}
                  disabled={qzStatus === 'connecting'}
                >
                  <RefreshCw size={14} /> Cek Ulang
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">Pilih Printer Anda</label>
                {qzConnected && printers.length > 0 ? (
                  <select
                    name="default_printer"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30"
                    value={formData.default_printer}
                    onChange={handleChange}
                  >
                    <option value="">-- Deteksi Otomatis --</option>
                    {printers.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none placeholder-text-muted opacity-50 cursor-not-allowed"
                    placeholder="Pastikan aplikasi siap untuk melihat daftar printer"
                    disabled
                  />
                )}
                <p className="text-sm text-text-muted mt-1">Pilih nama printer kasir Anda dari daftar (contoh: EPSON TM-T82).</p>
              </div>

              <div className="mb-0 mt-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">Ukuran Kertas Struk</label>
                <select name="paper_width" className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30" value={formData.paper_width} onChange={handleChange}>
                  <option value="58">Kecil (58mm)</option>
                  <option value="80">Besar (80mm)</option>
                </select>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-text-muted text-sm font-medium">
                  ⚙️ Pengaturan Lanjutan (Opsional)
                </summary>
                <div className="p-3 bg-surface-3 rounded-lg mt-2">
                  <div className="mb-0">
                    <label className="block text-sm font-medium text-text-secondary mb-1">Alamat Komputer Server (QZ Host)</label>
                    <input
                      type="text"
                      className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
                      placeholder="localhost"
                      value={qzHost}
                      onChange={(e) => setQzHost(e.target.value)}
                      onBlur={() => localStorage.setItem('qz_host', qzHost || 'localhost')}
                    />
                    <p className="text-xs text-text-muted mt-1">
                      Hanya diubah jika printer berada di komputer lain. Biarkan "localhost" jika printer dicolok di komputer ini.
                    </p>
                  </div>
                </div>
              </details>

              <button
                className="w-full mt-5 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 hover:border-text-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleTestPrint}
                disabled={!qzConnected || testPrinting}
              >
                <Printer size={18} />
                {testPrinting ? 'Mencetak ke Printer...' : 'Tes Cetak Struk Sekarang'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ─── Pajak & Struk ─── */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-6 w-full max-w-full lg:max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <FileText size={20} />
          <h3 className="text-base font-semibold">Pajak & Struk</h3>
        </div>
        <div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Pajak / PB1 (%)</label>
            <input
              type="number"
              name="tax_rate"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: 10 atau 11"
              value={formData.tax_rate}
              onChange={handleChange}
              min="0"
              max="100"
            />
            <p className="text-xs text-text-muted mt-1">Biarkan 0 jika tidak ada pajak tambahan.</p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Pesan Penutup Struk</label>
            <textarea
              name="receipt_footer"
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-border rounded-md text-text-primary font-sans text-sm transition-all outline-none focus:border-primary focus:ring-3 focus:ring-primary/30 placeholder-text-muted min-h-[80px]"
              placeholder="Contoh: Terima kasih atas kunjungan Anda. Follow IG kami @kopipos"
              value={formData.receipt_footer}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* ─── Wifi Pelanggan ─── */}
      <div className="bg-surface border border-white/10 rounded-2xl p-6 mb-6 w-full max-w-full lg:max-w-xl">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Wifi size={20} />
          <h3 className="text-base font-semibold">Akses Wifi Pelanggan</h3>
        </div>
        <div>
          <p className="text-sm text-text-muted mb-4">
            Informasi ini akan tercetak di bagian bawah struk untuk memudahkan pelanggan terhubung ke WiFi.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Nama Wifi (SSID)</label>
            <input
              type="text"
              name="wifi_ssid"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: KopiPOS_Guest"
              value={formData.wifi_ssid}
              onChange={handleChange}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-text-secondary mb-1">Password Wifi</label>
            <input
              type="text"
              name="wifi_password"
              className="w-full px-3 h-10 bg-surface-2 border border-white/10 rounded-[10px] text-sm text-text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder-text-muted/70"
              placeholder="Contoh: kopienak123"
              value={formData.wifi_password}
              onChange={handleChange}
            />
          </div>
        </div>
      </div>

      {/* ─── Simpan ─── */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface border-t border-border md:relative md:bg-transparent md:border-0 md:p-0 mt-5 z-40">
        <button
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto md:max-w-xl shadow-lg md:shadow-none"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={16} /> {saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}
        </button>
      </div>
    </div>
  );
}
