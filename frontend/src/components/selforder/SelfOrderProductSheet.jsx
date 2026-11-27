import { useState } from 'react';
import toast from 'react-hot-toast';
import { formatRupiah } from '../../utils/format';
import {
  activeModifiers, findSizeGroup, isSelectionValid, makeCartLine, unitPriceOf,
} from '../../utils/selfOrder';
import { CloseButton, ProductThumb, Sheet, Stepper } from './ui';

const firstAvailable = (group) => activeModifiers(group).find(m => !m.is_out_of_stock) || null;

function initialSelection(product) {
  const sizeGroup = findSizeGroup(product);
  const variant = sizeGroup ? firstAvailable(sizeGroup) : null;
  const modifiers = [];
  (product.modifier_groups || []).forEach(g => {
    if (g.id === sizeGroup?.id || !g.required) return;
    const m = firstAvailable(g);
    if (m) modifiers.push(m);
  });
  return { variant, modifiers };
}

function groupHint(group) {
  if (group.selection_type === 'checkbox') {
    if (group.required) return group.min_select > 1 ? `wajib, pilih ${group.min_select}` : 'wajib';
    return group.max_select > 1 ? `opsional, maks ${group.max_select}` : 'opsional';
  }
  return group.required ? 'wajib' : 'opsional';
}

const extraLabel = (m) => m.is_out_of_stock ? 'Habis' : m.price_adjustment > 0 ? `+${formatRupiah(m.price_adjustment)}` : '';

export default function SelfOrderProductSheet({ product, onClose, onAdd }) {
  const sizeGroup = findSizeGroup(product);
  const [{ variant, modifiers }, setSel] = useState(() => initialSelection(product));
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState('');

  const groups = (product.modifier_groups || []).filter(g => activeModifiers(g).length > 0);
  const valid = isSelectionValid(product, variant, modifiers);
  const total = unitPriceOf(product, variant, modifiers) * qty;

  const pick = (group, mod) => {
    if (mod.is_out_of_stock) return;
    if (group.id === sizeGroup?.id) {
      setSel(s => ({ ...s, variant: mod }));
      return;
    }
    setSel(s => {
      const inGroup = s.modifiers.filter(m => m.modifier_group_id === group.id);
      const selected = inGroup.some(m => m.id === mod.id);
      const others = s.modifiers.filter(m => m.modifier_group_id !== group.id);
      if (group.selection_type === 'radio') {
        if (selected) return group.required ? s : { ...s, modifiers: others };
        return { ...s, modifiers: [...others, mod] };
      }
      if (selected) {
        if (group.required && inGroup.length <= group.min_select) {
          toast.error(`Pilih minimal ${group.min_select} untuk ${group.name}`);
          return s;
        }
        return { ...s, modifiers: s.modifiers.filter(m => m.id !== mod.id) };
      }
      if (inGroup.length >= group.max_select) {
        if (group.max_select === 1) return { ...s, modifiers: [...others, mod] };
        toast.error(`Maksimal ${group.max_select} pilihan untuk ${group.name}`);
        return s;
      }
      return { ...s, modifiers: [...s.modifiers, mod] };
    });
  };

  const isPicked = (group, mod) =>
    group.id === sizeGroup?.id ? variant?.id === mod.id : modifiers.some(m => m.id === mod.id);

  const submit = () => {
    if (!valid) return;
    onAdd(makeCartLine({ product, variant, modifiers, qty, notes: notes.trim() }));
    onClose();
  };

  return (
    <Sheet onClose={onClose} label={product.name}>
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="relative">
          <ProductThumb src={product.image_url} alt={product.name} className="block w-full h-[220px]" />
          <CloseButton onClick={onClose} className="absolute top-3 right-3 border-0" />
        </div>

        <div className="px-[18px] pt-[18px]">
          <h2 className="m-0 font-extrabold text-[26px] leading-[1.1]">{product.name}</h2>
          {product.description && <p className="mt-1.5 text-[14px] text-ink-soft leading-normal">{product.description}</p>}
          <div className="mt-2 font-bold text-[17px]">{formatRupiah(product.base_price)}</div>
        </div>

        <div className="px-[18px] pb-[18px] flex flex-col">
          {groups.map(group => {
            const mods = activeModifiers(group);
            const asChips = group.id === sizeGroup?.id || group.selection_type === 'radio';
            return (
              <fieldset key={group.id} className="border-0 mx-0 mb-0 mt-[18px] p-0 min-w-0">
                <legend className="p-0 flex gap-2 items-baseline font-bold text-[15px]">
                  {group.name} <span className="font-medium text-[12px] text-ink-soft">{groupHint(group)}</span>
                </legend>
                {asChips ? (
                  <div role="radiogroup" aria-label={group.name} className="flex gap-2 mt-2.5 flex-wrap">
                    {mods.map(m => {
                      const on = isPicked(group, m);
                      const extra = extraLabel(m);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          disabled={m.is_out_of_stock}
                          onClick={() => pick(group, m)}
                          className={`inline-flex flex-col justify-center min-h-12 px-4 py-1.5 rounded-xl text-[14px] font-semibold text-left border transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${on ? 'bg-brand text-white border-brand' : 'bg-paper text-ink border-line-strong hover:border-ink-faint'}`}
                        >
                          {m.name}
                          {extra && <span className="text-[12px] font-medium">{extra}</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-1">
                    {mods.map(m => (
                      <label key={m.id} className={`flex items-center gap-3 min-h-12 border-b border-line-soft text-[14px] ${m.is_out_of_stock ? 'opacity-45' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={isPicked(group, m)}
                          disabled={m.is_out_of_stock}
                          onChange={() => pick(group, m)}
                          className="w-5 h-5 m-0 accent-brand"
                        />
                        <span className="flex-1">{m.name}</span>
                        <span className="text-ink-soft">{extraLabel(m)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            );
          })}

          <label htmlFor="so-catatan" className="mt-[18px] font-bold text-[15px]">Catatan untuk barista</label>
          <textarea
            id="so-catatan"
            rows={2}
            maxLength={80}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Mis. es dipisah"
            className="mt-2 p-3 border border-line rounded-xl text-[14px] resize-none bg-paper-2 outline-none focus:border-brand"
          />
        </div>
      </div>

      <div className="shrink-0 px-[18px] pt-3 pb-[max(18px,env(safe-area-inset-bottom))] border-t border-line flex gap-3 items-center bg-paper">
        <Stepper size="lg" value={qty} onDec={() => setQty(q => Math.max(1, q - 1))} onInc={() => setQty(q => Math.min(99, q + 1))} />
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="flex-1 flex items-center justify-between min-h-[52px] px-4 rounded-[14px] bg-brand text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 transition"
        >
          <span>{valid ? 'Tambah' : 'Lengkapi pilihan'}</span>
          <span className="tabular-nums">{formatRupiah(total)}</span>
        </button>
      </div>
    </Sheet>
  );
}
