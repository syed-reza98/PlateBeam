'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import {
  AlertTriangle,
  Check,
  Clock,
  Flame,
  Leaf,
  Plus,
  Search,
  Sparkles,
  Utensils,
} from 'lucide-react';
import type { DietaryType } from '@/server/db/types';
import { formatMoney, type GuestCategory, type GuestMenuItem } from './types';

interface MenuBrowserProps {
  currency: string;
  categories: GuestCategory[];
  menuItems: GuestMenuItem[];
  onSelectItem: (item: GuestMenuItem) => void;
}

const DIETARY_META: Record<
  DietaryType,
  { label: string; badgeClass: string; icon: typeof Leaf }
> = {
  VEG: {
    label: 'Veg',
    badgeClass: 'border-[var(--pb-olive)] text-[var(--pb-olive)]',
    icon: Leaf,
  },
  VEGAN: {
    label: 'Vegan',
    badgeClass: 'border-[var(--pb-olive)] text-[var(--pb-olive)]',
    icon: Sparkles,
  },
  JAIN: {
    label: 'Jain',
    badgeClass: 'border-[var(--pb-olive)] text-[var(--pb-olive)]',
    icon: Leaf,
  },
  GLUTEN_FREE: {
    label: 'GF',
    badgeClass: 'border-[var(--pb-turmeric)] text-[var(--pb-turmeric)]',
    icon: Check,
  },
  EGG: {
    label: 'Egg',
    badgeClass: 'border-[var(--pb-turmeric)] text-[var(--pb-turmeric)]',
    icon: Utensils,
  },
  NON_VEG: {
    label: 'Non-Veg',
    badgeClass: 'border-[var(--pb-chili)] text-[var(--pb-chili)]',
    icon: Flame,
  },
};

const DIETARY_FILTERS: Array<{ value: 'ALL' | DietaryType; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'VEG', label: 'Veg' },
  { value: 'NON_VEG', label: 'Non-Veg' },
  { value: 'VEGAN', label: 'Vegan' },
  { value: 'GLUTEN_FREE', label: 'Gluten-Free' },
  { value: 'JAIN', label: 'Jain' },
  { value: 'EGG', label: 'Egg' },
];

export function MenuBrowser({
  currency,
  categories,
  menuItems,
  onSelectItem,
}: MenuBrowserProps) {
  const [search, setSearch] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string>('ALL');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | DietaryType>('ALL');

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (activeCategoryId !== 'ALL' && item.categoryId !== activeCategoryId) {
        return false;
      }
      if (dietaryFilter !== 'ALL' && item.dietaryType !== dietaryFilter) {
        return false;
      }
      if (query) {
        const hay = `${item.name} ${item.description ?? ''} ${item.allergens.join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }, [menuItems, activeCategoryId, dietaryFilter, search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, GuestMenuItem[]>();
    for (const item of filteredItems) {
      const list = map.get(item.categoryId) ?? [];
      list.push(item);
      map.set(item.categoryId, list);
    }
    return map;
  }, [filteredItems]);

  const heroItem = useMemo(
    () => menuItems.find((m) => m.isFeatured && m.imageUrl) ?? menuItems.find((m) => m.imageUrl),
    [menuItems],
  );

  return (
    <section aria-label="Digital menu" className="space-y-4">
      {heroItem?.imageUrl && (
        <article className="relative overflow-hidden rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)]">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--pb-canvas)] sm:aspect-[21/9]">
            <Image
              src={heroItem.imageUrl}
              alt={heroItem.name}
              fill
              unoptimized
              priority
              fetchPriority="high"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pb-accent)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--pb-accent-ink)]">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Chef&apos;s Spotlight
                </span>
                <h2 className="mt-1.5 font-serif text-2xl leading-tight tracking-tight">
                  {heroItem.name}
                </h2>
                {heroItem.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-white/85">
                    {heroItem.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!heroItem.isAvailable}
                onClick={() => onSelectItem(heroItem)}
                className="min-h-[44px] shrink-0 rounded-full bg-[var(--pb-surface)] px-4 py-2 text-xs font-semibold text-[var(--pb-ink)] shadow-md transition-transform active:scale-95 disabled:opacity-50"
              >
                {heroItem.isAvailable
                  ? `Add · ${formatMoney(heroItem.basePriceMinor, currency)}`
                  : 'Sold Out'}
              </button>
            </div>
          </div>
        </article>
      )}

      {/* Search & Sticky Category Tabs */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--pb-border)] bg-[var(--pb-canvas)]/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--pb-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes, ingredients, or allergens..."
            aria-label="Search menu dishes"
            className="min-h-[44px] w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] pl-10 pr-4 text-sm text-[var(--pb-ink)] placeholder:text-[var(--pb-muted)] focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
          />
        </div>

        {/* Category Pills */}
        <div
          role="tablist"
          aria-label="Menu categories"
          className="mt-2.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeCategoryId === 'ALL'}
            onClick={() => setActiveCategoryId('ALL')}
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${
              activeCategoryId === 'ALL'
                ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-ink)] hover:border-[var(--pb-accent)]'
            }`}
          >
            All Dishes
          </button>
          {sortedCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={activeCategoryId === cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors ${
                activeCategoryId === cat.id
                  ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                  : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-ink)] hover:border-[var(--pb-accent)]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Dietary Filters */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {DIETARY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={dietaryFilter === filter.value}
              onClick={() => setDietaryFilter(filter.value)}
              className={`min-h-[44px] shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors ${
                dietaryFilter === filter.value
                  ? 'border-[var(--pb-ink)] bg-[var(--pb-ink)] text-[var(--pb-canvas)]'
                  : 'border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-muted)] hover:text-[var(--pb-ink)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--pb-border)] bg-[var(--pb-surface)] p-8 text-center">
          <p className="font-serif text-xl">No dishes match your filters</p>
          <p className="mt-1 text-sm text-[var(--pb-muted)]">
            Try clearing your search query or switching dietary preferences.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedCategories.map((cat) => {
            const items = groupedByCategory.get(cat.id);
            if (!items || items.length === 0) return null;
            return (
              <div key={cat.id} className="space-y-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-2xl tracking-tight">{cat.name}</h2>
                  <span className="font-mono text-xs font-medium text-[var(--pb-muted)]">
                    {items.length} {items.length === 1 ? 'dish' : 'dishes'}
                  </span>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  {items.map((item) => {
                    const diet = DIETARY_META[item.dietaryType];
                    const DietIcon = diet.icon;
                    return (
                      <article
                        key={item.id}
                        className={`group relative flex gap-3.5 rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--pb-accent)]/40 hover:shadow-md ${
                          item.isAvailable ? '' : 'opacity-65'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${diet.badgeClass}`}
                              >
                                <DietIcon className="size-3" aria-hidden="true" />
                                {diet.label}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-[var(--pb-muted)]">
                                <Clock className="size-3" aria-hidden="true" />
                                {item.prepTimeMins}m
                              </span>
                              {!item.isAvailable && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--pb-chili)]/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--pb-chili)]">
                                  Sold Out (86)
                                </span>
                              )}
                            </div>

                            <h3 className="mt-1.5 font-serif text-lg leading-snug tracking-tight text-[var(--pb-ink)] transition-colors group-hover:text-[var(--pb-accent)]">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--pb-muted)]">
                                {item.description}
                              </p>
                            )}

                            {item.allergens.length > 0 && (
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--pb-turmeric)]">
                                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                                <span>Contains: {item.allergens.join(', ')}</span>
                              </p>
                            )}
                          </div>

                          <div className="mt-3.5 flex items-center justify-between gap-2 pt-1 border-t border-[var(--pb-border)]/40">
                            <span className="font-mono text-base font-bold tabular-nums text-[var(--pb-ink)]">
                              {formatMoney(item.basePriceMinor, currency)}
                            </span>
                            <button
                              type="button"
                              disabled={!item.isAvailable}
                              onClick={() => onSelectItem(item)}
                              aria-label={
                                item.isAvailable
                                  ? `Customize and add ${item.name}`
                                  : `${item.name} is sold out`
                              }
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-[var(--pb-accent)] px-3.5 text-xs font-semibold text-[var(--pb-accent-ink)] shadow-sm transition-all hover:opacity-95 active:scale-95 disabled:cursor-not-allowed disabled:bg-[var(--pb-border)] disabled:text-[var(--pb-muted)] disabled:active:scale-100"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                              <span>{item.isAvailable ? 'Add' : 'Unavailable'}</span>
                            </button>
                          </div>
                        </div>

                        {item.imageUrl && (
                          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)]">
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              unoptimized
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
