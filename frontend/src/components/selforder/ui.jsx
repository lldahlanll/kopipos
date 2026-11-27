import { useEffect, useRef, useState } from 'react';
import { Coffee, X } from 'lucide-react';

/**
 * Lapisan bawah (HP) / dialog tengah (tablet & laptop).
 * Escape dan ketuk latar menutup; fokus dipindah ke dalam saat dibuka.
 */
export function Sheet({ onClose, label, children, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="so-root fixed inset-0 z-[100] flex items-end md:items-center justify-center !bg-transparent">
      <div className="so-fade-in absolute inset-0 bg-ink/50" onClick={onClose} aria-hidden="true" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`so-sheet-in relative w-full md:max-w-[480px] max-h-[92dvh] md:max-h-[86dvh] bg-paper rounded-t-[22px] md:rounded-[22px] flex flex-col overflow-hidden outline-none ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CloseButton({ onClick, label = 'Tutup', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`w-11 h-11 rounded-full bg-paper text-ink flex items-center justify-center border border-line hover:bg-sand transition-colors ${className}`}
    >
      <X size={18} strokeWidth={2.2} />
    </button>
  );
}

/** Foto produk, atau blok krem dengan ikon bila belum ada foto. */
export function ProductThumb({ src, alt = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`object-cover bg-sand ${className}`} />;
  }
  return (
    <div className={`bg-sand text-ink-faint flex items-center justify-center ${className}`} aria-hidden={!alt} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      <Coffee size={22} strokeWidth={1.6} />
    </div>
  );
}

export function Stepper({ value, onDec, onInc, size = 'md', decLabel = 'Kurangi', incLabel = 'Tambah jumlah' }) {
  const btn = size === 'lg' ? 'w-11 h-12 text-xl' : 'w-9 h-11 text-lg';
  return (
    <div className="flex items-center border border-line-strong rounded-[10px] bg-paper shrink-0">
      <button type="button" onClick={onDec} aria-label={decLabel} className={`${btn} flex items-center justify-center text-ink hover:bg-sand rounded-l-[10px] transition-colors`}>−</button>
      <span className="min-w-6 text-center font-bold text-[14px] tabular-nums" aria-live="polite">{value}</span>
      <button type="button" onClick={onInc} aria-label={incLabel} className={`${btn} flex items-center justify-center text-ink hover:bg-sand rounded-r-[10px] transition-colors`}>+</button>
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="so-root min-h-[100dvh] flex flex-col items-center justify-center gap-3">
      <div className="w-9 h-9 rounded-full border-[3px] border-line border-t-brand animate-spin" />
      {label && <span className="text-[14px] text-ink-soft">{label}</span>}
    </div>
  );
}

/** Logo toko atau huruf pertama nama toko di kotak warna tema. */
export function StoreMark({ storeInfo, size = 36 }) {
  if (storeInfo.store_logo) {
    return <img src={storeInfo.store_logo} alt="" style={{ height: size }} className="rounded-[10px] w-auto max-w-[120px] object-contain" />;
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2 }}
      className="rounded-[10px] bg-brand text-white flex items-center justify-center font-display font-extrabold shrink-0"
      aria-hidden="true"
    >
      {(storeInfo.store_name || 'K').trim().charAt(0).toUpperCase()}
    </div>
  );
}
