import { useState, useEffect } from 'react';
import { getShiftHistory } from '../api/shifts';
import { Calendar, RefreshCw, Download, Clock } from 'lucide-react';
import { formatRupiah } from '../utils/format';
import toast from 'react-hot-toast';
import { useAutoAnimate } from '@formkit/auto-animate/react';

const toISO = (d) => d.toISOString().split('T')[0];
const today = toISO(new Date());
const d7 = toISO(new Date(Date.now() - 6 * 86400000));

export default function ShiftHistory() {
  const [tableRef] = useAutoAnimate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(d7);
  const [dateTo, setDateTo] = useState(today);

  const load = () => {
    setLoading(true);
    getShiftHistory({ date_from: dateFrom, date_to: dateTo })
      .then(res => setShifts(res.data))
      .catch(() => toast.error('Gagal memuat riwayat shift'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    if (shifts.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }
    const headers = ['ID Shift', 'Mulai', 'Selesai', 'Modal Awal', 'Kas Aktual', 'Selisih'];
    const rows = shifts.map(s => [
      s.id,
      new Date(s.started_at).toLocaleString('id-ID'),
      s.ended_at ? new Date(s.ended_at).toLocaleString('id-ID') : '-',
      s.opening_balance,
      s.closing_actual || 0,
      (s.closing_actual || 0) - (s.closing_expected || 0)
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Riwayat_Shift_${dateFrom}_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 pt-[calc(1rem+10px)] w-full max-w-[1400px] mx-auto animate-in">
      <div className="mb-4 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-transparent tracking-tight bg-gradient-to-br from-white to-primary bg-clip-text">Riwayat Shift</h1>
            <p className="text-sm text-text-secondary mt-1">Rekap modal dan selisih kas per shift</p>
          </div>

          <div className="flex flex-col sm:flex-row w-full sm:w-auto items-stretch sm:items-center gap-2 mt-2 sm:mt-0">
            <div className="flex items-center gap-1.5 w-full sm:w-auto bg-surface-2 p-1 rounded-md border border-border">
              <Calendar size={14} className="ml-1 text-text-secondary shrink-0" />
              <input
                type="date"
                className="p-1 text-xs min-w-0 flex-1 border-0 bg-transparent text-text-primary outline-none"
                value={dateFrom}
                max={dateTo}
                onChange={e => setDateFrom(e.target.value)}
              />
              <span className="text-text-secondary text-xs">s/d</span>
              <input
                type="date"
                className="p-1 text-xs min-w-0 flex-1 border-0 bg-transparent text-text-primary outline-none"
                value={dateTo}
                min={dateFrom}
                max={today}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <button className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-surface-2 text-text-primary border-border hover:bg-surface-3 transition-all flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed" onClick={load} disabled={loading}>
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="sm:hidden ml-2">Muat Ulang</span>
              </button>
              <button className="inline-flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-md font-sans text-sm font-semibold cursor-pointer border bg-gradient-to-br from-primary to-primary-dark text-white border-primary hover:from-primary-hover hover:to-primary hover:shadow-[0_0_24px_rgba(200,162,122,0.3)] hover:-translate-y-px transition-all flex-1 sm:flex-none" onClick={exportCSV}>
                <Download size={14} /> 
                <span className="sm:hidden ml-1">CSV</span>
                <span className="hidden sm:inline ml-1">Export CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto overflow-y-hidden max-sm:border-none max-sm:bg-transparent max-sm:p-0 max-sm:overflow-visible">
        <table className="w-full border-collapse min-w-[540px] max-sm:min-w-0 max-sm:block text-left text-sm">
          <thead className="max-sm:hidden bg-surface-2 border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Waktu Shift</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Modal Awal</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Kas Diharapkan</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Kas Aktual</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Selisih</th>
              <th className="px-4 py-3 font-semibold text-text-secondary whitespace-nowrap">Status</th>
            </tr>
          </thead>
          <tbody ref={tableRef} className="max-sm:block max-sm:w-full">
            {loading && shifts.length === 0 ? (
              <tr className="max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:p-3"><td colSpan={6} className="text-center text-text-muted p-8">Memuat data...</td></tr>
            ) : shifts.length === 0 ? (
              <tr className="max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:p-3"><td colSpan={6} className="text-center text-text-muted p-8">Belum ada data shift</td></tr>
            ) : shifts.map(s => {
              const expected = s.closing_expected || 0;
              const actual = s.closing_actual || 0;
              const diff = actual - expected;
              return (
                <tr key={s.id} className="border-b border-border-subtle hover:bg-white/5 transition-colors max-sm:block max-sm:w-full max-sm:bg-surface-2 max-sm:border max-sm:border-border max-sm:rounded-xl max-sm:mb-2.5 max-sm:p-3 max-sm:relative max-sm:hover:bg-transparent">
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Waktu Shift</span>
                    <div className="text-right sm:text-left space-y-1">
                      <div className="flex items-center justify-end sm:justify-start gap-1.5 font-bold text-text-primary">
                        <Calendar size={13} className="text-primary shrink-0" />
                        <span>{new Date(s.started_at).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center justify-end sm:justify-start gap-2 text-xs text-text-secondary">
                        <span className="inline-flex items-center gap-1 bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                          <span className="w-1 h-1 rounded-full bg-success animate-pulse" />
                          {new Date(s.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-text-muted text-[10px]">➔</span>
                        {s.ended_at ? (
                          <span className="inline-flex items-center gap-1 bg-surface-3 text-text-secondary border border-border px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">
                            <span className="w-1 h-1 rounded-full bg-text-muted" />
                            {new Date(s.ended_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-warning/10 text-warning border border-warning/20 px-1.5 py-0.5 rounded font-bold text-[9px] uppercase tracking-wider animate-pulse">
                            <span className="w-1 h-1 rounded-full bg-warning animate-ping" />
                            Aktif
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Modal Awal</span>
                    {formatRupiah(s.opening_balance)}
                  </td>
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Kas Diharapkan</span>
                    {formatRupiah(expected)}
                  </td>
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle font-semibold">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Kas Aktual</span>
                    {formatRupiah(actual)}
                  </td>
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-b max-sm:border-border-subtle">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Selisih</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${diff > 0 ? 'bg-success/12 text-success' : diff < 0 ? 'bg-danger/12 text-danger' : 'bg-surface-3 text-text-secondary border border-border'}`}>
                      {diff > 0 ? '+' : ''}{formatRupiah(diff)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-middle max-sm:flex max-sm:justify-between max-sm:items-center max-sm:px-0 max-sm:py-1 max-sm:border-none">
                    <span className="sm:hidden font-semibold text-text-secondary mr-4">Status</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-surface-3 text-text-secondary border border-border capitalize">{s.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
