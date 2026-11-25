import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  LayoutDashboard, ShoppingCart, Coffee, Tag,
  Receipt, Settings, LogOut, Sliders, Users, Calendar, Monitor, Menu, X, BadgePercent
} from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuth();
  const { storeName, storeLogo } = useSettings();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Apakah Anda yakin ingin keluar dari sistem POS?')) {
      logout();
      navigate('/login');
    }
  };

  const ownerLinks = [
    { to: '/dashboard',    icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    { to: '/pos',          icon: <ShoppingCart size={20} />,    label: 'Kasir (POS)' },
    { to: '/kitchen',      icon: <Monitor size={20} />,         label: 'Pesanan Dapur' },
    { to: '/menu',         icon: <Coffee size={20} />,          label: 'Daftar Menu' },
    { to: '/categories',   icon: <Tag size={20} />,             label: 'Kategori Menu' },
    { to: '/modifiers',    icon: <Sliders size={20} />,         label: 'Topping & Ekstra' },
    { to: '/promos',       icon: <BadgePercent size={20} />,    label: 'Promo & Diskon' },
    { to: '/transactions', icon: <Receipt size={20} />,         label: 'Riwayat Transaksi' },
    { to: '/shifts',       icon: <Calendar size={20} />,        label: 'Riwayat Shift' },
    { to: '/users',        icon: <Users size={20} />,           label: 'Pegawai' },
    { to: '/settings',     icon: <Settings size={20} />,        label: 'Pengaturan' },
  ];

  const cashierLinks = [
    { to: '/pos',          icon: <ShoppingCart size={20} />, label: 'POS' },
    { to: '/transactions', icon: <Receipt size={20} />,      label: 'Transaksi' },
  ];

  // Tim Promo hanya mengelola promo — tidak punya akses POS, laporan, atau data lain
  const promoLinks = [
    { to: '/promos',       icon: <BadgePercent size={20} />, label: 'Promo & Diskon' },
  ];

  const links = user?.role === 'owner' ? ownerLinks : user?.role === 'promo' ? promoLinks : cashierLinks;
  const location = useLocation();
  const currentLink = links.find(l => location.pathname.startsWith(l.to)) || { label: storeName };

  return (
    <div className="flex h-screen overflow-hidden bg-body font-sans">
      {/* MOBILE HEADER */}
      <header className="flex md:hidden fixed top-0 left-0 right-0 z-50 items-center justify-between px-4 h-[60px] bg-surface/80 backdrop-blur-md border-b border-white/5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-2 rounded-full text-text-secondary hover:text-primary hover:bg-primary/10 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <Menu size={22} strokeWidth={2.5} />
          </button>
          
          <div className="h-5 w-px bg-white/10" />
          
          <div className="flex items-center gap-2.5">
            {storeLogo ? (
              <img src={storeLogo} alt="Logo" className="w-7 h-7 rounded-full shadow-sm object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent text-text-inverse flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(200,162,122,0.3)] ring-2 ring-primary/20">
                {storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-bold text-[15px] tracking-tight text-text-primary">
              {currentLink.label === storeName ? storeName : currentLink.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center font-bold text-xs text-text-primary border border-white/10 shadow-sm" title={user?.name}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
        </div>
      </header>

      {/* SIDEBAR */}
      <aside
        className={`
          flex flex-col bg-surface border-r border-white/5
          fixed inset-y-0 left-0 z-50 w-72 shadow-2xl
          transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:relative md:inset-auto md:z-auto md:translate-x-0 md:w-20 md:shadow-none md:shrink-0
          lg:w-60
        `}
      >
        <div className="flex items-center justify-between h-[60px] px-4 border-b border-white/5 shrink-0">
          <div className="flex items-center">
            {storeLogo ? (
              <img src={storeLogo} alt="Logo" className="w-8 h-8 rounded-lg shadow-md object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-text-inverse flex items-center justify-center font-bold text-sm shadow-[0_0_20px_rgba(200,162,122,0.3)] shrink-0">
                {storeName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="ml-3 font-bold text-base tracking-tight text-text-primary whitespace-nowrap overflow-hidden md:hidden lg:block">
              {storeName}
            </span>
          </div>
          <button 
            className="md:hidden p-1 -mr-1 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
          <div className="px-2 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted whitespace-nowrap overflow-hidden md:hidden lg:block">
            Menu Utama
          </div>
          <div className="hidden md:block lg:hidden h-px bg-white/5 mb-2" />

          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsMobileMenuOpen(false)}
              title={link.label}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-[9px] rounded-[10px] text-[0.8125rem] font-medium transition-colors cursor-pointer whitespace-nowrap overflow-hidden md:justify-center md:p-2.5 md:overflow-visible ${
                  isActive 
                    ? 'bg-primary/12 text-primary' 
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex items-center justify-center shrink-0 w-5 h-5 transition-colors ${isActive ? 'text-primary' : 'text-text-muted group-hover:text-white/80'}`}>
                    {link.icon}
                  </span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis transition-opacity md:absolute md:left-[calc(100%+12px)] md:top-1/2 md:-translate-y-1/2 md:opacity-0 md:pointer-events-none md:bg-surface-3 md:text-text-primary md:text-[0.75rem] md:font-semibold md:px-3 md:py-1.5 md:rounded-lg md:border md:border-white/10 md:shadow-md md:whitespace-nowrap md:z-[200] group-hover:md:opacity-100 group-hover:md:pointer-events-auto lg:static lg:opacity-100 lg:pointer-events-auto lg:bg-transparent lg:border-none lg:shadow-none lg:translate-y-0 lg:p-0 lg:text-[0.8125rem]">
                    {link.label}
                  </span>
                  {isActive && (
                    <span className="hidden md:block lg:hidden absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-l bg-primary" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-white/5 shrink-0 relative">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 group md:hidden lg:flex">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-xs text-[#1a1d27] shadow-sm shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-text-primary truncate">{user?.name}</div>
              <div className="text-xs text-text-muted capitalize">{user?.role}</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
          
          <div className="hidden md:flex lg:hidden flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-sm text-[#1a1d27] shadow-sm shrink-0 cursor-pointer hover:opacity-80 transition-opacity" title={user?.name}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex items-center justify-center w-10 h-10 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-body pt-[60px] md:pt-0">
        <div key={location.pathname} className="flex-1 overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden flex animate-in fade-in duration-300 ease-out"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
