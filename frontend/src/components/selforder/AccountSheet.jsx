import { formatRupiah } from '../../utils/format';
import { ACTIVE_STATUSES, POINT_VALUE, statusLabel } from '../../utils/selfOrder';
import { CloseButton, Sheet } from './ui';

export default function AccountSheet({ member, orders, loading, onOpenOrder, onLogout, onClose }) {
  return (
    <Sheet onClose={onClose} label="Akun member">
      <div className="flex items-start justify-between gap-3 px-[18px] pt-[18px]">
        <div className="min-w-0">
          <h2 className="m-0 font-extrabold text-[24px] leading-tight truncate">{member.name}</h2>
          <p className="mt-0.5 text-[13px] text-ink-soft">{member.phone}</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="mx-[18px] mt-4 p-4 rounded-2xl bg-sunny-soft flex items-baseline justify-between">
        <span className="text-[14px] font-semibold">Poin kamu</span>
        <span className="text-right">
          <span className="font-display font-extrabold text-[26px] tabular-nums">{member.points}</span>
          <span className="block text-[12px] text-ink-soft">senilai {formatRupiah(member.points * POINT_VALUE)}</span>
        </span>
      </div>

      <div className="px-[18px] pt-5 pb-2 flex items-baseline justify-between">
        <h3 className="m-0 font-bold text-[17px]">Pesanan hari ini</h3>
      </div>
      <div className="px-[18px] flex-1 overflow-y-auto min-h-0">
        {loading && orders.length === 0 ? (
          <p className="py-6 text-[14px] text-ink-soft">Memuat pesanan…</p>
        ) : orders.length === 0 ? (
          <p className="py-6 text-[14px] text-ink-soft">Belum ada pesanan hari ini.</p>
        ) : orders.map(o => (
          <button
            key={o.id}
            type="button"
            onClick={() => onOpenOrder(o)}
            className="w-full text-left flex items-center gap-3 py-3 border-b border-line-soft hover:bg-paper-2"
          >
            <span className="flex-1 min-w-0">
              <span className="block font-semibold text-[14px]">{o.order_number}</span>
              <span className="block text-[12px] text-ink-soft">
                {new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {formatRupiah(o.total)}
              </span>
            </span>
            <span className={`text-[12px] font-bold px-2.5 py-1 rounded-full ${ACTIVE_STATUSES.includes(o.status) ? 'bg-brand text-white' : 'bg-sand text-ink-soft'}`}>
              {statusLabel(o)}
            </span>
          </button>
        ))}
      </div>

      <div className="px-[18px] pt-3 pb-[max(18px,env(safe-area-inset-bottom))] border-t border-line mt-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-full min-h-12 rounded-[14px] border border-ink font-bold text-[15px] hover:bg-sand transition-colors"
        >
          Keluar dari akun
        </button>
      </div>
    </Sheet>
  );
}
