import { useState } from 'react';
import { User, Phone, Key, ArrowRight, Coffee, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginMember, registerMember } from '../../api/selfOrder';

export default function MemberAuth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !pin) {
      toast.error('Nomor HP dan PIN wajib diisi');
      return;
    }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      toast.error('PIN harus terdiri dari 6 digit angka');
      return;
    }
    if (!isLogin && !name) {
      toast.error('Nama lengkap wajib diisi');
      return;
    }

    setLoading(false);
    setLoading(true);
    try {
      if (isLogin) {
        const res = await loginMember({ phone, pin });
        localStorage.setItem('member_token', res.data.access_token);
        localStorage.setItem('member_profile', JSON.stringify(res.data.member));
        toast.success(`Selamat datang kembali, ${res.data.member.name}!`);
        onAuthSuccess(res.data.member);
      } else {
        const res = await registerMember({ name, phone, pin });
        localStorage.setItem('member_token', res.data.access_token);
        localStorage.setItem('member_profile', JSON.stringify(res.data.member));
        toast.success(`Pendaftaran berhasil! Halo, ${res.data.member.name}!`);
        onAuthSuccess(res.data.member);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 max-w-[500px] mx-auto bg-body z-[150] overflow-y-auto custom-scrollbar border-x border-white/5 shadow-2xl flex flex-col">
      <div className="flex-1 flex flex-col justify-between min-h-full px-6 py-8 relative">
        {/* Header */}
        <div className="flex flex-col items-center mb-6 mt-4 shrink-0">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 mb-3 animate-bounce duration-1000">
            <Coffee size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-text-primary tracking-tight">KopiPOS <span className="text-primary font-bold">Loyalty</span></h1>
          <p className="text-text-muted text-[11px] font-medium tracking-widest uppercase mt-1">Self Order & Member Portal</p>
        </div>

        {/* Card Form */}
        <div className="bg-surface/85 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-xl space-y-6 my-auto shrink-0">
          {/* Toggle Tab */}
          <div className="flex p-1 rounded-2xl bg-surface-2 border border-white/5">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${isLogin ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
            >
              MASUK MEMBER
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${!isLogin ? 'bg-primary text-white shadow-md' : 'text-text-secondary hover:text-text-primary'}`}
            >
              DAFTAR BARU
            </button>
          </div>

          <div>
            <h2 className="text-lg font-bold text-text-primary mb-1">
              {isLogin ? 'Selamat Datang' : 'Bergabunglah Bersama Kami'}
            </h2>
            <p className="text-xs text-text-muted leading-relaxed">
              {isLogin 
                ? 'Silakan masuk ke akun member Anda untuk memesan dan menggunakan loyalty poin.' 
                : 'Dapatkan saldo poin belanja untuk ditukarkan potongan harga kopi favorit Anda.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Nama Lengkap</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    className="w-full bg-surface-2 border border-white/5 rounded-xl pl-10 pr-4 py-3.5 text-sm font-medium text-text-primary placeholder-text-muted/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                    placeholder="Masukkan nama lengkap Anda..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Nomor WhatsApp</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Phone size={16} />
                </div>
                <input
                  type="tel"
                  className="w-full bg-surface-2 border border-white/5 rounded-xl pl-10 pr-4 py-3.5 text-sm font-medium text-text-primary placeholder-text-muted/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                  placeholder="Contoh: 08123456789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">PIN Transaksi (6 Digit Angka)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted">
                  <Key size={16} />
                </div>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="w-full bg-surface-2 border border-white/5 rounded-xl pl-10 pr-4 py-3.5 text-sm font-medium text-text-primary placeholder-text-muted/60 focus:border-primary/50 focus:ring-1 focus:ring-primary/50 outline-none transition-all tracking-[0.25em]"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-primary to-accent hover:shadow-[0_8px_24px_rgba(200,162,122,0.3)] text-white py-4 rounded-xl font-bold text-[14px] transition-all active:scale-[0.98] flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <span>{loading ? 'Memproses...' : isLogin ? 'Masuk Sekarang' : 'Daftar & Masuk'}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-start gap-2.5 bg-surface-2/50 border border-white/5 p-3.5 rounded-2xl shrink-0">
          <Sparkles className="text-primary shrink-0 mt-0.5" size={16} />
          <p className="text-[11px] text-text-muted leading-normal">
            <strong>Keuntungan Member:</strong> Dapatkan 1 poin setiap kelipatan Rp 10.000. Poin yang dikumpulkan bernilai Rp 500/poin untuk potongan belanja langsung!
          </p>
        </div>
      </div>
    </div>
  );
}
