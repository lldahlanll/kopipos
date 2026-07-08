import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRangeSummary, getPaymentSummary, getBestSellers, getDailyBreakdown } from '../api/reports';
import { getOrders } from '../api/orders';
import {
  DollarSign, ShoppingCart, Package, TrendingUp, Calendar,
  RefreshCw, Download, BarChart2, CreditCard, Star, ClipboardList,
  ArrowRight, Flame, Trophy, ChevronRight
} from 'lucide-react';
import { formatRupiah } from '../utils/format';
import { exportToCSV } from '../utils/export';
import { useAutoAnimate } from '@formkit/auto-animate/react';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Area, AreaChart, ComposedChart, Line
} from 'recharts';

/* ─────────────── Custom Tooltip ─────────────── */
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const dateLabel = new Date(data.date + 'T00:00:00').toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    return (
      <div style={{
        background: 'rgba(26,29,39,0.97)',
        border: '1px solid rgba(200,162,122,0.25)',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(200,162,122,0.1)',
      }}>
        <p style={{ color: '#9ca3af', fontSize: '11px', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dateLabel}</p>
        <p style={{ color: '#f0ece4', fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {formatRupiah(data.revenue)}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#c8a27a'
          }} />
          <p style={{ color: '#c8a27a', fontSize: '12px', fontWeight: 600, margin: 0 }}>
            {data.transactions} Transaksi
          </p>
        </div>
      </div>
    );
  }
  return null;
};

/* ─────────────── Animated Number ─────────────── */
function AnimatedNumber({ value, prefix = '', suffix = '', duration = 800 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    if (value === undefined || value === null) return;
    const startVal = prevValue.current;
    const endVal = typeof value === 'number' ? value : 0;
    const startTime = performance.now();

    if (animRef.current) cancelAnimationFrame(animRef.current);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * eased);
      setDisplayValue(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = endVal;
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value, duration]);

  return <>{prefix}{displayValue.toLocaleString('id-ID')}{suffix}</>;
}

/* ─────────────── Helpers ─────────────── */
const toISO = (d) => d.toISOString().split('T')[0];
const today = toISO(new Date());
const d7 = toISO(new Date(Date.now() - 6 * 86400000));
const d30 = toISO(new Date(Date.now() - 29 * 86400000));

const firstOfMonth = () => {
  const d = new Date();
  return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
};

const PRESETS = [
  { label: 'Hari Ini', from: today, to: today },
  { label: '7 Hari', from: d7, to: today },
  { label: '30 Hari', from: d30, to: today },
  { label: 'Bulan Ini', from: firstOfMonth(), to: today },
];

const formatLocalDate = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getPreviousPeriod = (fromStr, toStr) => {
  const fromDate = new Date(fromStr + 'T00:00:00');
  const toDate = new Date(toStr + 'T00:00:00');
  const diffTime = toDate.getTime() - fromDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const prevFromDate = new Date(fromDate);
  prevFromDate.setDate(fromDate.getDate() - diffDays);
  const prevToDate = new Date(toDate);
  prevToDate.setDate(toDate.getDate() - diffDays);
  return { from: formatLocalDate(prevFromDate), to: formatLocalDate(prevToDate) };
};

/* ─────────────── Skeleton ─────────────── */
function SkeletonCard() {
  return (
    <div className="bg-surface border border-white/8 rounded-2xl p-5 overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-white/5 rounded-l-2xl" />
      <div className="w-10 h-10 rounded-xl bg-white/5 mb-4 animate-pulse" />
      <div className="w-20 h-3 rounded-full bg-white/5 mb-3 animate-pulse" />
      <div className="w-32 h-7 rounded-full bg-white/5 animate-pulse" />
    </div>
  );
}

/* ─────────────── Rank Badge ─────────────── */
const RANK_STYLES = [
  { bg: 'from-yellow-500/30 to-amber-400/20', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: '0 0 12px rgba(234,179,8,0.3)' },
  { bg: 'from-slate-400/30 to-slate-300/20', text: 'text-slate-300', border: 'border-slate-400/30', glow: 'none' },
  { bg: 'from-orange-700/30 to-orange-600/20', text: 'text-orange-400', border: 'border-orange-700/30', glow: 'none' },
];

function RankBadge({ rank }) {
  const style = RANK_STYLES[rank] || { bg: 'from-white/5 to-white/3', text: 'text-text-secondary', border: 'border-white/10', glow: 'none' };
  return (
    <span
      className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold border bg-gradient-to-br ${style.bg} ${style.text} ${style.border}`}
      style={{ boxShadow: style.glow }}
    >
      {rank + 1}
    </span>
  );
}

/* ─────────────── Section Header ─────────────── */
function SectionHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary shrink-0">
          <Icon size={16} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-text-primary leading-tight">{title}</h3>
          {subtitle && <p className="text-xs text-text-muted leading-tight mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/* ─────────────── Main Dashboard ─────────────── */
export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [prevRevenue, setPrevRevenue] = useState(null);
  const [payments, setPayments] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [loading, setLoading] = useState(false);

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [activePreset, setActivePreset] = useState('Hari Ini');

  const [paymentsRef] = useAutoAnimate();
  const [bestSellersRef] = useAutoAnimate();
  const [recentOrdersRef] = useAutoAnimate();

  const navigate = useNavigate();

  const load = useCallback((from, to) => {
    setLoading(true);
    const prevPeriod = getPreviousPeriod(from, to);
    Promise.all([
      getRangeSummary(from, to).then(r => setSummary(r.data)).catch(() => {}),
      getRangeSummary(prevPeriod.from, prevPeriod.to).then(r => setPrevRevenue(r.data?.total_revenue ?? 0)).catch(() => setPrevRevenue(0)),
      getPaymentSummary(from, to).then(r => setPayments(r.data)).catch(() => {}),
      getBestSellers(from, to).then(r => setBestSellers(r.data)).catch(() => {}),
      getDailyBreakdown(from, to).then(r => setBreakdown(r.data)).catch(() => {}),
      getOrders({ limit: 10 }).then(r => setRecentOrders(r.data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(dateFrom, dateTo); }, []);

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    setDateFrom(preset.from);
    setDateTo(preset.to);
    load(preset.from, preset.to);
  };

  const applyCustomRange = () => {
    setActivePreset('');
    load(dateFrom, dateTo);
  };

  const formattedPeriod = dateFrom === dateTo
    ? new Date(dateFrom + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : `${new Date(dateFrom + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(dateTo + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const handleExport = () => {
    if (!breakdown || breakdown.length === 0) return;
    const headers = ['Tanggal', 'Omzet', 'Transaksi'];
    const rows = breakdown.map(d => [
      new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID'),
      d.revenue,
      d.transactions
    ]);
    exportToCSV(`Laporan_Harian_${dateFrom}_${dateTo}`, headers, rows);
  };

  /* ── Trend calculation ── */
  const currentRevenue = summary?.total_revenue ?? 0;
  const prevRevenueVal = prevRevenue ?? 0;

  let trendText = '';
  let trendType = 'neutral';
  let arrow = '—';
  let trendClass = 'text-text-muted bg-white/5 border-white/10';
  let animationClass = '';

  if (summary !== null && prevRevenue !== null) {
    if (currentRevenue === 0 && prevRevenueVal === 0) {
      trendText = '0%'; trendType = 'neutral'; arrow = '—';
      trendClass = 'text-gray-400 bg-gray-500/10 border-gray-500/25';
    } else if (prevRevenueVal === 0) {
      trendText = 'New'; trendType = 'increase'; arrow = '▲';
      trendClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]';
      animationClass = 'animate-trend-increase';
    } else {
      const trendVal = ((currentRevenue - prevRevenueVal) / prevRevenueVal) * 100;
      const formattedVal = trendVal.toFixed(1);
      const parsedVal = parseFloat(formattedVal);
      if (parsedVal > 0) {
        trendText = `+${formattedVal}%`; trendType = 'increase'; arrow = '▲';
        trendClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25 shadow-[0_0_12px_rgba(52,211,153,0.15)]';
        animationClass = 'animate-trend-increase';
      } else if (parsedVal < 0) {
        trendText = `${formattedVal}%`; trendType = 'decrease'; arrow = '▼';
        trendClass = 'text-red-400 bg-red-500/10 border-red-500/25';
        animationClass = 'animate-trend-decrease';
      } else {
        trendText = '0%'; trendType = 'neutral'; arrow = '—';
        trendClass = 'text-gray-400 bg-gray-500/10 border-gray-500/25';
      }
    }
  }

  /* ── Chart metrics ── */
  const maxRevenue = breakdown.length > 0 ? Math.max(...breakdown.map(d => d.revenue)) : 0;
  const avgRevenue = breakdown.length > 0 ? Math.round(breakdown.reduce((s, d) => s + d.revenue, 0) / breakdown.length) : 0;
  const peakDay = breakdown.find(d => d.revenue === maxRevenue);

  /* ── Payment totals ── */
  const totalPaymentRevenue = payments.reduce((s, p) => s + p.total, 0);

  /* ── Best seller max qty ── */
  const maxQty = bestSellers.length > 0 ? Math.max(...bestSellers.map(i => i.total_qty)) : 1;

  /* ── Avg per transaction ── */
  const avgPerTrx = summary?.total_transactions
    ? Math.round(summary.total_revenue / summary.total_transactions)
    : 0;

  const STAT_CARDS = [
    {
      key: 'revenue',
      icon: DollarSign,
      label: 'Omzet',
      accent: '#c8a27a',
      accentBg: 'rgba(200,162,122,0.12)',
      value: (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 min-w-0">
          <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-text-primary whitespace-nowrap">
            {loading ? '—' : formatRupiah(summary?.total_revenue)}
          </div>
          {!loading && summary !== null && prevRevenue !== null && (
            <span
              key={`${currentRevenue}_${prevRevenueVal}`}
              aria-label={`Tren omzet: ${trendType} sebesar ${trendText}`}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${trendClass} ${animationClass} shrink-0`}
            >
              <span aria-hidden="true">{arrow}</span>
              <span>{trendText}</span>
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'transactions',
      icon: ShoppingCart,
      label: 'Total Transaksi',
      accent: '#60a5fa',
      accentBg: 'rgba(96,165,250,0.12)',
      value: (
        <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-text-primary mt-1">
          {loading ? '—' : <AnimatedNumber value={summary?.total_transactions || 0} />}
        </div>
      ),
    },
    {
      key: 'items',
      icon: Package,
      label: 'Item Terjual',
      accent: '#4ade80',
      accentBg: 'rgba(74,222,128,0.12)',
      value: (
        <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-text-primary mt-1">
          {loading ? '—' : <AnimatedNumber value={summary?.total_items_sold || 0} />}
        </div>
      ),
    },
    {
      key: 'avg',
      icon: TrendingUp,
      label: 'Rata-rata / Trx',
      accent: '#fbbf24',
      accentBg: 'rgba(251,191,36,0.12)',
      value: (
        <div className="text-2xl lg:text-3xl font-extrabold tracking-tight text-text-primary mt-1">
          {loading ? '—' : formatRupiah(avgPerTrx)}
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">

      {/* ── Page Header ── */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="shrink-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">
              Dashboard
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Memuat data...
                </span>
              ) : `Ringkasan — ${formattedPeriod}`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-surface-2 rounded-xl border border-border">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg font-sans text-xs font-semibold cursor-pointer transition-all whitespace-nowrap leading-none ${
                    activePreset === p.label
                      ? 'bg-gradient-to-br from-primary to-primary-dark text-white shadow-[0_0_15px_rgba(200,162,122,0.25)]'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                  }`}
                  onClick={() => applyPreset(p)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Date Range */}
            <div className="flex items-center gap-1.5 bg-surface-2 p-1.5 rounded-xl border border-border">
              <Calendar size={13} className="ml-0.5 text-text-muted shrink-0" />
              <input
                type="date"
                className="w-full bg-transparent border-0 text-text-primary font-sans text-xs outline-none min-w-0 flex-1 px-1"
                value={dateFrom}
                max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span className="text-text-muted text-xs shrink-0 px-1">–</span>
              <input
                type="date"
                className="w-full bg-transparent border-0 text-text-primary font-sans text-xs outline-none min-w-0 flex-1 px-1"
                value={dateTo}
                min={dateFrom}
                max={today}
                onChange={e => setDateTo(e.target.value)}
              />
              <button
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-primary bg-gradient-to-br from-primary to-primary-dark text-white hover:from-primary-hover hover:to-primary hover:shadow-[0_0_12px_rgba(200,162,122,0.3)] shrink-0 transition-all"
                onClick={applyCustomRange}
                title="Terapkan rentang tanggal"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6 lg:mb-8">
        {loading && !summary ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          STAT_CARDS.map(card => {
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className="bg-surface border border-white/8 rounded-2xl p-5 hover:border-white/15 transition-all duration-300 group relative overflow-hidden"
                style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}
              >
                {/* Left accent bar */}
                <div
                  className="absolute top-0 left-0 w-[3px] h-full rounded-l-2xl transition-all duration-300 group-hover:opacity-100 opacity-70"
                  style={{ background: card.accent }}
                />
                {/* Subtle glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
                  style={{ background: `radial-gradient(circle at top left, ${card.accentBg}, transparent 70%)` }}
                />

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 shrink-0 relative z-10"
                  style={{ background: card.accentBg, color: card.accent }}
                >
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="text-xs font-semibold text-text-secondary mb-1 uppercase tracking-wider relative z-10">
                  {card.label}
                </div>
                <div className="relative z-10">{card.value}</div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Grafik Omzet Harian ── */}
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 mb-6 hover:border-white/10 transition-all duration-300"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>

        <SectionHeader
          icon={BarChart2}
          title="Grafik Omzet Harian"
          subtitle={formattedPeriod}
          action={
            <button
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-sans text-xs font-semibold cursor-pointer border transition-all bg-surface-2 text-text-secondary border-border hover:bg-surface-3 hover:text-text-primary hover:border-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={handleExport}
              disabled={!breakdown || breakdown.length === 0}
            >
              <Download size={13} />
              Export CSV
            </button>
          }
        />

        {/* Mini Stats Row */}
        {breakdown.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-5 pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-8 rounded-full bg-primary" />
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Tertinggi</p>
                <p className="text-sm font-bold text-text-primary">{formatRupiah(maxRevenue)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-8 rounded-full bg-info/60" />
              <div>
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Rata-rata</p>
                <p className="text-sm font-bold text-text-primary">{formatRupiah(avgRevenue)}</p>
              </div>
            </div>
            {peakDay && (
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-8 rounded-full bg-warning/60" />
                <div>
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Hari Terbaik</p>
                  <p className="text-sm font-bold text-text-primary">
                    {new Date(peakDay.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-[220px] sm:h-[260px] lg:h-[300px] w-full">
          {!breakdown || breakdown.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <BarChart2 size={36} className="text-white/10" />
              <p className="text-text-muted text-sm">Belum ada data untuk periode ini</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={breakdown} margin={{ top: 5, right: 8, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8a27a" stopOpacity={1} />
                    <stop offset="100%" stopColor="#a07850" stopOpacity={0.8} />
                  </linearGradient>
                  <linearGradient id="barGradientDim" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8a27a" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#a07850" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8a27a" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#c8a27a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(val) => new Date(val + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }} dy={6}
                />
                <YAxis
                  tickFormatter={(val) => val === 0 ? 'Rp0' : `Rp${(val / 1000).toLocaleString('id-ID')}k`}
                  axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }} dx={0} width={72}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }}
                  content={<CustomTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  fill="url(#areaGradient)"
                  stroke="none"
                />
                <Bar dataKey="revenue" radius={[6, 6, 2, 2]} maxBarSize={52}>
                  {breakdown.map((entry, index) => {
                    const isMax = entry.revenue === maxRevenue;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isMax ? 'url(#barGradient)' : 'url(#barGradientDim)'}
                      />
                    );
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Payment & Best Sellers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">

        {/* Metode Pembayaran */}
        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 hover:border-white/10 transition-all duration-300"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
          <SectionHeader icon={CreditCard} title="Metode Pembayaran" subtitle={`${payments.length} metode aktif`} />
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <CreditCard size={28} className="text-white/10" />
              <p className="text-text-muted text-sm">Belum ada transaksi</p>
            </div>
          ) : (
            <div ref={paymentsRef} className="flex flex-col gap-3">
              {payments.map((p) => {
                const pct = totalPaymentRevenue > 0 ? Math.round((p.total / totalPaymentRevenue) * 100) : 0;
                const methodColors = {
                  cash: { bar: '#4ade80', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
                  qris: { bar: '#60a5fa', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
                  transfer: { bar: '#a78bfa', badge: 'bg-violet-500/15 text-violet-400 border-violet-500/25' },
                };
                const style = methodColors[p.payment_method?.toLowerCase()] || { bar: '#c8a27a', badge: 'bg-primary/15 text-primary border-primary/25' };

                return (
                  <div key={p.payment_method} className="p-3 rounded-xl bg-surface-2/60 border border-white/5 hover:border-white/10 transition-all duration-200">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border uppercase ${style.badge}`}>
                          {p.payment_method}
                        </span>
                        <span className="text-text-muted text-xs">{p.count} trx</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm text-text-primary">{formatRupiah(p.total)}</span>
                        <span className="text-xs text-text-muted ml-2">{pct}%</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, background: style.bar, opacity: 0.8 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Menu Terlaris */}
        <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 hover:border-white/10 transition-all duration-300"
          style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
          <SectionHeader icon={Flame} title="Menu Terlaris" subtitle={`Top ${Math.min(bestSellers.length, 5)} menu`} />
          {bestSellers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Flame size={28} className="text-white/10" />
              <p className="text-text-muted text-sm">Belum ada data</p>
            </div>
          ) : (
            <div ref={bestSellersRef} className="flex flex-col gap-2">
              {bestSellers.slice(0, 5).map((item, i) => {
                const pct = maxQty > 0 ? Math.round((item.total_qty / maxQty) * 100) : 0;
                return (
                  <div key={item.product_name} className="p-3 rounded-xl bg-surface-2/60 border border-white/5 hover:border-white/10 transition-all duration-200">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <RankBadge rank={i} />
                        <span className="truncate text-sm font-semibold text-text-primary">{item.product_name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-bold text-text-primary">{item.total_qty}<span className="text-text-muted font-normal">x</span></div>
                        <div className="text-xs text-text-muted">{formatRupiah(item.total_revenue)}</div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${pct}%`,
                          background: i === 0
                            ? 'linear-gradient(90deg, #eab308, #f59e0b)'
                            : i === 1 ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)'
                            : i === 2 ? 'linear-gradient(90deg, #c2410c, #f97316)'
                            : 'rgba(200,162,122,0.5)'
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Transaksi Terbaru ── */}
      <div className="bg-surface border border-border rounded-2xl p-5 sm:p-6 hover:border-white/10 transition-all duration-300"
        style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
        <SectionHeader
          icon={ClipboardList}
          title="Transaksi Terbaru"
          subtitle="10 transaksi terakhir"
          action={
            <button
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover transition-colors"
              onClick={() => navigate('/transactions')}
            >
              Lihat semua
              <ArrowRight size={13} />
            </button>
          }
        />

        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <ClipboardList size={32} className="text-white/10" />
            <p className="text-text-muted text-sm">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse min-w-[560px] text-left text-sm">
              <thead>
                <tr className="bg-surface-2 border-b border-border">
                  {['No. Order', 'Tipe', 'Pembayaran', 'Total', 'Status', 'Waktu'].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={recentOrdersRef}>
                {recentOrders.map((o, idx) => (
                  <tr
                    key={o.id}
                    className="border-b border-border-subtle last:border-0 hover:bg-white/3 transition-colors duration-150 cursor-pointer group"
                    onClick={() => navigate(`/transactions/${o.id}`)}
                  >
                    <td className="px-4 py-3 align-middle">
                      <span className="font-bold text-text-primary group-hover:text-primary transition-colors">
                        {o.order_number}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                        o.order_type === 'dine_in'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                      }`}>
                        {o.order_type === 'dine_in' ? 'Dine In' : 'Takeaway'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-info/10 text-info border border-info/20">
                        {o.payment_method}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="font-semibold text-text-primary">{formatRupiah(o.total)}</span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                        o.status === 'paid'
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-danger/10 text-danger border-danger/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${o.status === 'paid' ? 'bg-success' : 'bg-danger'}`} />
                        {o.status === 'paid' ? 'Paid' : 'Cancelled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-text-muted text-xs">
                      {o.created_at ? new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
