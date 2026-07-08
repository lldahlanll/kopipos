import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { login } from '../api/auth';
import { Coffee } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const { storeName, storeLogo, refreshSettings } = useSettings();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      loginUser(res.data.access_token, res.data.user);
      await refreshSettings();
      navigate(res.data.user.role === 'owner' ? '/dashboard' : '/pos');
    } catch (err) {
      setError(err.response?.data?.detail || 'Login gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative bg-body text-text-primary overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(200,162,122,0.15)_0%,transparent_50%)]" />
      <div className="w-full max-w-[400px] bg-surface border border-white/10 rounded-[24px] p-10 shadow-2xl relative z-10 animate-in">
        <div className="flex flex-col items-center gap-4 mb-8">
          {storeLogo ? (
            <img src={storeLogo} alt="Logo" className="w-14 h-14 rounded-2xl object-cover bg-white" />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white shadow-lg">
              <Coffee size={28} />
            </div>
          )}
          <span className="text-2xl font-black tracking-tight text-text-primary">{storeName}</span>
        </div>
        {error && <div className="p-3 sm:p-4 mb-6 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm font-medium text-center">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <label className="block text-sm font-medium text-text-secondary mb-2">Email</label>
            <input
              id="email-input"
              type="email"
              className="w-full px-4 h-12 bg-surface-2 border border-white/10 rounded-xl text-text-primary text-sm transition-all outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 placeholder-text-muted/70"
              placeholder="email@kopipos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-text-secondary mb-2">Password</label>
            <input
              id="password-input"
              type="password"
              className="w-full px-4 h-12 bg-surface-2 border border-white/10 rounded-xl text-text-primary text-sm transition-all outline-none focus:border-primary focus:ring-2 focus:ring-primary/50 placeholder-text-muted/70"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="mt-8">
            <button
              id="login-button"
              type="submit"
              className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-base font-semibold bg-primary text-text-inverse hover:bg-primary-hover active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
              disabled={loading}
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </div>
        </form>
        <p className="text-center text-text-muted text-sm mt-8">
          {storeName} POS v1.0
        </p>
      </div>
    </div>
  );
}
