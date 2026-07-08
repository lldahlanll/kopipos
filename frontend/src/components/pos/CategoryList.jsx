import { usePOS } from '../../context/POSContext';
import { ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

export default function CategoryList() {
  const { categories, selectedCat, setSelectedCat } = usePOS();

  const scrollContainer = (dir) => {
    const el = document.getElementById('cat-scroll-container');
    if (el) {
      el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    }
  };

  const baseBtn = `
    flex-shrink-0 flex items-center justify-center gap-2
    whitespace-nowrap font-medium transition-colors duration-200
    h-9 px-4
    min-w-[70px]
    rounded-lg text-[13px] md:text-[14px]
  `;

  const activeBtn = `
    bg-primary text-text-inverse font-semibold
    shadow-sm
  `;

  const inactiveBtn = `
    bg-transparent border border-white/10 text-text-secondary
    hover:bg-white/5 hover:text-white
  `;

  return (
    <div className="flex-shrink-0 bg-surface border-b border-white/5 w-full z-10 relative flex items-center group shadow-sm">
      <button
        onClick={() => scrollContainer('left')}
        className="hidden md:flex items-center justify-center w-8 h-full absolute left-0 top-0 bottom-0 bg-gradient-to-r from-surface via-surface/80 to-transparent z-10 text-text-muted hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Scroll kiri"
      >
        <ChevronLeft size={20} />
      </button>

      <div
        id="cat-scroll-container"
        className="flex flex-row overflow-x-auto no-scrollbar items-center px-4 md:px-6 lg:px-8 gap-2 md:gap-3 h-[56px] md:h-[62px] w-full"
        style={{ scrollbarWidth: 'none' }}
      >
        <button
          className={`${baseBtn} ${!selectedCat ? activeBtn : inactiveBtn}`}
          onClick={() => setSelectedCat(null)}
        >
          <LayoutGrid size={15} className="shrink-0" />
          <span>Semua</span>
        </button>

        {categories.map(cat => (
          <button
            key={cat.id}
            className={`${baseBtn} ${selectedCat === cat.id ? activeBtn : inactiveBtn}`}
            onClick={() => setSelectedCat(cat.id)}
          >
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => scrollContainer('right')}
        className="hidden md:flex items-center justify-center w-8 h-full absolute right-0 top-0 bottom-0 bg-gradient-to-l from-surface via-surface/80 to-transparent z-10 text-text-muted hover:text-white transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
        aria-label="Scroll kanan"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}