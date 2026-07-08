import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[100dvh] w-full flex items-center justify-center bg-[#0b0d12] px-6 text-center text-text-primary">
          <div className="max-w-md w-full bg-surface border border-white/5 p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="w-16 h-16 bg-danger/10 text-danger rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white mb-2">Terjadi Kesalahan Aplikasi</h2>
              <p className="text-text-muted text-xs leading-relaxed">
                Ada kendala teknis saat memuat modul aplikasi ini. Silakan muat ulang halaman atau hubungi pengembang jika masalah berlanjut.
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-primary hover:bg-primary/90 text-white py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} />
              <span>Muat Ulang Halaman</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
