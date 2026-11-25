'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertTriangle, Flame, Minus, Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { formatMoney, type GuestCartItem, type GuestMenuItem, type GuestModifier } from './types';

interface ItemModifierDialogProps {
  open: boolean;
  item: GuestMenuItem | null;
  modifiers: GuestModifier[];
  currency: string;
  guestNickname: string;
  onClose: () => void;
  onAddToCart: (cartItem: GuestCartItem) => void;
}

const DEFAULT_SPICE_LEVELS = ['Mild', 'Medium', 'Spicy', 'Extra Spicy'];

export function ItemModifierDialog({
  open,
  item,
  modifiers,
  currency,
  guestNickname,
  onClose,
  onAddToCart,
}: ItemModifierDialogProps) {
  const itemModifiers = useMemo(
    () => (item ? modifiers.filter((m) => m.menuItemId === item.id) : []),
    [item, modifiers],
  );

  const groupedModifiers = useMemo(() => {
    const groups = new Map<string, GuestModifier[]>();
    for (const mod of itemModifiers) {
      const list = groups.get(mod.groupName) ?? [];
      list.push(mod);
      groups.set(mod.groupName, list);
    }
    return Array.from(groups.entries());
  }, [itemModifiers]);

  const spiceOptions = useMemo(() => {
    if (!item) return [];
    return item.spiceLevels.length > 0 ? item.spiceLevels : DEFAULT_SPICE_LEVELS;
  }, [item]);

  const [quantity, setQuantity] = useState(1);
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>(() => {
    const defaults: string[] = [];
    for (const [, mods] of groupedModifiers) {
      const req = mods.find((m) => m.isRequired);
      if (req) defaults.push(req.id);
    }
    return defaults;
  });
  const [spiceLevel, setSpiceLevel] = useState<string>(() => spiceOptions[0] ?? 'Medium');
  const [notes, setNotes] = useState('');

  if (!item) {
    return (
      <Dialog open={open} onClose={onClose} title="Customize Dish" closedby="any">
        <p className="text-sm text-[var(--pb-muted)]">Select a dish to customize.</p>
      </Dialog>
    );
  }

  const toggleModifier = (mod: GuestModifier, groupMods: GuestModifier[]) => {
    if (mod.isMultiSelect) {
      setSelectedModifierIds((prev) =>
        prev.includes(mod.id) ? prev.filter((id) => id !== mod.id) : [...prev, mod.id],
      );
    } else {
      const groupIds = new Set(groupMods.map((g) => g.id));
      setSelectedModifierIds((prev) => [
        ...prev.filter((id) => !groupIds.has(id)),
        mod.id,
      ]);
    }
  };

  const modifierDeltaMinor = itemModifiers
    .filter((m) => selectedModifierIds.includes(m.id))
    .reduce((acc, m) => acc + m.priceDeltaMinor, 0);

  const unitPriceMinor = item.basePriceMinor + modifierDeltaMinor;
  const lineTotalMinor = unitPriceMinor * quantity;

  const handleConfirm = () => {
    const chosenMods = itemModifiers.filter((m) => selectedModifierIds.includes(m.id));
    onAddToCart({
      cartItemId: crypto.randomUUID(),
      menuItemId: item.id,
      name: item.name,
      unitPriceMinor,
      quantity,
      modifierIds: chosenMods.map((m) => m.id),
      modifierLabels: chosenMods.map((m) => `${m.groupName}: ${m.optionName}`),
      spiceLevel: spiceLevel || undefined,
      notes: notes.trim() || undefined,
      addedByNickname: guestNickname,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={item.name} closedby="any">
      <div className="space-y-5">
        {item.imageUrl && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-sm border border-[var(--pb-border)]">
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              unoptimized
              className="object-cover"
            />
          </div>
        )}

        {item.description && (
          <p className="text-sm text-[var(--pb-muted)]">{item.description}</p>
        )}

        {item.allergens.length > 0 && (
          <div className="flex items-center gap-2 rounded-sm border border-[var(--pb-turmeric)]/40 bg-[var(--pb-turmeric)]/10 px-3 py-2 text-xs">
            <AlertTriangle className="size-4 shrink-0 text-[var(--pb-turmeric)]" aria-hidden="true" />
            <span>Allergens: {item.allergens.join(', ')}</span>
          </div>
        )}

        {/* Spice Level */}
        <fieldset className="space-y-2">
          <legend className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            <Flame className="size-3.5 text-[var(--pb-accent)]" aria-hidden="true" />
            Spice Preference
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {spiceOptions.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={spiceLevel === level}
                onClick={() => setSpiceLevel(level)}
                className={`min-h-[44px] rounded-sm border px-3 text-xs font-semibold transition-colors ${
                  spiceLevel === level
                    ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                    : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-ink)]'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </fieldset>

        {/* Modifier Groups */}
        {groupedModifiers.map(([groupName, mods]) => {
          const isRequired = mods.some((m) => m.isRequired);
          const isMulti = mods.some((m) => m.isMultiSelect);
          return (
            <fieldset key={groupName} className="space-y-2">
              <legend className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
                <span>{groupName}</span>
                <span className="rounded-full border border-[var(--pb-border)] px-2 py-0.5 text-[10px] font-medium">
                  {isRequired ? 'Required' : isMulti ? 'Multi-select' : 'Optional'}
                </span>
              </legend>
              <div className="space-y-1.5">
                {mods.map((mod) => {
                  const checked = selectedModifierIds.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-3 rounded-sm border px-3.5 py-2 text-sm transition-colors ${
                        checked
                          ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)]/8'
                          : 'border-[var(--pb-border)] bg-[var(--pb-canvas)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type={mod.isMultiSelect ? 'checkbox' : 'radio'}
                          name={`mod-${groupName}`}
                          checked={checked}
                          onChange={() => toggleModifier(mod, mods)}
                          className="size-4 accent-[var(--pb-accent)]"
                        />
                        <span className="font-medium">{mod.optionName}</span>
                      </span>
                      <span className="font-mono text-xs text-[var(--pb-muted)] tabular-nums">
                        {mod.priceDeltaMinor > 0
                          ? `+${formatMoney(mod.priceDeltaMinor, currency)}`
                          : 'Included'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {/* Kitchen Notes */}
        <div className="space-y-1.5">
          <label htmlFor="kitchen-notes" className="block text-xs font-semibold uppercase tracking-wider text-[var(--pb-muted)]">
            Kitchen Notes (Optional)
          </label>
          <textarea
            id="kitchen-notes"
            rows={2}
            maxLength={400}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., No cilantro, extra crispy, dressing on the side..."
            className="w-full rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 py-2.5 text-sm text-[var(--pb-ink)] placeholder:text-[var(--pb-muted)] focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
          />
        </div>

        {/* Quantity + Add CTA */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--pb-border)] pt-4">
          <div className="inline-flex items-center rounded-sm border border-[var(--pb-border)] bg-[var(--pb-canvas)]">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--pb-ink)]"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-[2.5rem] text-center font-mono text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-[var(--pb-ink)]"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            className="min-h-[44px] flex-1 rounded-sm bg-[var(--pb-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--pb-accent-ink)] transition-opacity hover:opacity-95"
          >
            Add to Table Cart · {formatMoney(lineTotalMinor, currency)}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
