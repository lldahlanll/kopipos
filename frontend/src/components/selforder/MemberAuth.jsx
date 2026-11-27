import { useState } from 'react';
import toast from 'react-hot-toast';
import { loginMember, registerMember } from '../../api/selfOrder';
import { StoreMark } from './ui';

const inputCls = 'box-border w-full h-12 mt-1.5 px-3 border border-line-strong rounded-[10px] text-[15px] bg-paper-2 outline-none focus:border-brand';
const labelCls = 'block text-[13px] font-semibold text-ink-soft';

export default function MemberAuth({ storeInfo = {}, onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone || !pin) { toast.error('Nomor HP dan PIN wajib diisi'); return; }
    if (pin.length !== 6 || !/^\d+$/.test(pin)) { toast.error('PIN harus 6 digit angka'); return; }
    if (!isLogin && !name.trim()) { toast.error('Nama wajib diisi'); return; }

    setLoading(true);
    try {
      const res = isLogin
        ? await loginMember({ phone, pin })
        : await registerMember({ name: name.trim(), phone, pin });
      localStorage.setItem('member_token', res.data.access_token);
      localStorage.setItem('member_profile', JSON.stringify(res.data.member));
      onAuthSuccess(res.data.member);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const tab = (on) => `flex-1 min-h-11 rounded-[10px] text-[14px] font-semibold transition-colors ${on ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink'}`;

  return (
    <div className="so-root min-h-[100dvh] flex flex-col">
      <header className="flex items-center gap-2.5 px-[18px] md:px-7 py-3.5 border-b border-line">
        <StoreMark storeInfo={storeInfo} size={36} />
        <span className="font-display font-bold text-[17px]">{storeInfo.store_name || 'KopiPOS'}</span>
      </header>

      <main className="flex-1 w-full max-w-[440px] mx-auto px-[18px] pt-8 pb-10">
        <h1 className="m-0 font-extrabold text-[30px] leading-[1.1] tracking-[-0.5px]">
          {isLogin ? 'Masuk dulu, lalu pesan dari meja.' : 'Daftar member, kumpulkan poin.'}
        </h1>
        <p className="mt-2 text-[14px] text-ink-soft leading-normal">
          Setiap Rp 10.000 dapat 1 poin. Satu poin bernilai Rp 500 untuk potongan pesanan berikutnya.
        </p>

        <div role="tablist" aria-label="Masuk atau daftar" className="flex gap-1 p-1 mt-6 rounded-xl bg-sand">
          <button type="button" role="tab" aria-selected={isLogin} onClick={() => setIsLogin(true)} className={tab(isLogin)}>Masuk</button>
          <button type="button" role="tab" aria-selected={!isLogin} onClick={() => setIsLogin(false)} className={tab(!isLogin)}>Daftar baru</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 p-4 bg-paper border border-line rounded-2xl flex flex-col gap-4">
          {!isLogin && (
            <div>
              <label htmlFor="so-nama" className={labelCls}>Nama panggilan</label>
              <input id="so-nama" autoComplete="given-name" maxLength={60} className={inputCls} placeholder="Nama yang dipanggil barista" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div>
            <label htmlFor="so-hp" className={labelCls}>Nomor WhatsApp</label>
            <input id="so-hp" type="tel" autoComplete="tel" inputMode="tel" className={inputCls} placeholder="08123456789" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="so-pin" className={labelCls}>PIN 6 angka</label>
            <input
              id="so-pin"
              type="password"
              inputMode="numeric"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              pattern="[0-9]*"
              maxLength={6}
              className={`${inputCls} tracking-[0.3em]`}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            />
            {!isLogin && <p className="mt-1.5 text-[12px] text-ink-soft">Ingat PIN ini untuk masuk lagi di kunjungan berikutnya.</p>}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] mt-1 rounded-[14px] bg-brand text-white font-bold text-[16px] disabled:opacity-50 hover:brightness-110 transition"
          >
            {loading ? 'Memproses…' : isLogin ? 'Masuk' : 'Daftar dan masuk'}
          </button>
        </form>
      </main>
    </div>
  );
}
