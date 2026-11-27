import { useRef, useState } from 'react';
import { promoTerms } from '../../utils/selfOrder';

function PromoCard({ banner, applied, onUse, className }) {
  const terms = banner.subtitle || promoTerms(banner.promo);
  return (
    <button
      type="button"
      onClick={() => onUse(banner.promo)}
      aria-pressed={applied}
      className={`group flex text-left h-[168px] md:h-[176px] lg:h-[160px] rounded-2xl overflow-hidden bg-sunny text-ink ${className}`}
    >
      <div className="flex-1 min-w-0 p-4 md:p-[18px] flex flex-col justify-between">
        <div>
          <span className="inline-block text-[11px] font-bold tracking-[0.6px] uppercase px-2 py-[3px] rounded-md bg-ink text-sunny">
            {applied ? 'Promo · terpasang' : 'Promo'}
          </span>
          <div className="mt-2.5 font-display font-extrabold text-[22px] md:text-[23px] lg:text-[26px] leading-[1.05] line-clamp-2">{banner.title}</div>
          {terms && <div className="mt-1.5 text-[12px] leading-[1.4] line-clamp-2">{terms}</div>}
        </div>
        <span className="text-[13px] font-bold underline underline-offset-[3px] group-hover:no-underline">
          {applied ? 'Terpasang di pesananmu' : 'Pakai promo'}
        </span>
      </div>
      {banner.image_url && (
        <img src={banner.image_url} alt="" className="w-[118px] md:w-[130px] lg:w-[220px] h-full object-cover shrink-0" />
      )}
    </button>
  );
}

function PartnerCard({ banner, className }) {
  const label = banner.sponsor_name ? `Disponsori · ${banner.sponsor_name}` : 'Disponsori';
  const body = (
    <>
      <div className="flex-1 min-w-0 p-4 md:p-[18px] flex flex-col justify-between">
        <span className="text-[11px] font-semibold text-ink-soft truncate">{label}</span>
        <div>
          <div className="font-display font-bold text-[20px] md:text-[22px] lg:text-[20px] leading-[1.1] line-clamp-2">{banner.title}</div>
          {banner.subtitle && <div className="mt-1 text-[12.5px] text-ink-soft line-clamp-2">{banner.subtitle}</div>}
        </div>
        {banner.link_url ? <span className="text-[13px] font-semibold underline underline-offset-[3px]">Kunjungi</span> : <span />}
      </div>
      {banner.image_url && <img src={banner.image_url} alt="" className="w-[118px] md:w-[130px] h-full object-cover shrink-0" />}
    </>
  );
  const cls = `flex h-[168px] md:h-[176px] lg:h-[160px] rounded-2xl overflow-hidden bg-paper border border-line text-ink ${className}`;
  if (!banner.link_url) return <div className={cls}>{body}</div>;
  return (
    <a href={banner.link_url} target="_blank" rel="noopener noreferrer sponsored" className={`${cls} hover:border-ink-faint transition-colors`}>
      {body}
    </a>
  );
}

export function BannerCard({ banner, appliedPromoId, onUsePromo, className = '' }) {
  if (banner.kind === 'promo' && banner.promo) {
    return <PromoCard banner={banner} applied={appliedPromoId === banner.promo.id} onUse={onUsePromo} className={className} />;
  }
  return <PartnerCard banner={banner} className={className} />;
}

/** HP: geser ke samping dengan titik penanda. Tablet/laptop: kisi. */
export default function BannerStrip({ banners, appliedPromoId, onUsePromo }) {
  const scroller = useRef(null);
  const [active, setActive] = useState(0);
  if (!banners.length) return null;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const card = el.firstElementChild;
    const w = card ? card.getBoundingClientRect().width + 12 : el.clientWidth;
    setActive(Math.min(banners.length - 1, Math.round(el.scrollLeft / w)));
  };

  const wideFirst = banners.length === 2;

  return (
    <section aria-label="Promo dan info">
      {/* HP */}
      <div className="md:hidden">
        <div
          ref={scroller}
          onScroll={onScroll}
          className="flex gap-3 px-[18px] overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-px-[18px]"
        >
          {banners.map(b => (
            <BannerCard key={b.id} banner={b} appliedPromoId={appliedPromoId} onUsePromo={onUsePromo}
              className={`snap-start shrink-0 ${banners.length > 1 ? 'w-[min(316px,84vw)]' : 'w-full'}`} />
          ))}
        </div>
        {banners.length > 1 && (
          <div aria-hidden="true" className="flex gap-1.5 justify-center mt-2.5">
            {banners.map((b, i) => (
              <span key={b.id} className={`h-1.5 rounded-full transition-all ${i === active ? 'w-[18px] bg-ink' : 'w-1.5 bg-line-strong'}`} />
            ))}
          </div>
        )}
      </div>
      {/* Tablet & laptop */}
      <div className={`hidden md:grid gap-3.5 md:grid-cols-2 ${banners.length > 1 ? 'lg:grid-cols-3' : ''}`}>
        {banners.map((b, i) => (
          <BannerCard key={b.id} banner={b} appliedPromoId={appliedPromoId} onUsePromo={onUsePromo}
            className={`${banners.length === 1 ? 'md:col-span-2 lg:col-span-full' : ''} ${wideFirst && i === 0 ? 'lg:col-span-2' : ''}`} />
        ))}
      </div>
    </section>
  );
}
