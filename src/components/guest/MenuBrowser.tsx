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
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Leaf,
  },
  VEGAN: {
    label: 'Vegan',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Sparkles,
  },
  JAIN: {
    label: 'Jain',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: Leaf,
  },
  GLUTEN_FREE: {
    label: 'GF',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Check,
  },
  EGG: {
    label: 'Egg',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    icon: Utensils,
  },
  NON_VEG: {
    label: 'Non-Veg',
    badgeClass: 'border-red-200 bg-red-50 text-red-700',
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
        <article className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 sm:aspect-[21/9]">
            <Image
              src={heroItem.imageUrl}
              alt={heroItem.name}
              fill
              unoptimized
              priority
              fetchPriority="high"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5412] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Chef&apos;s Spotlight
                </span>
                <h2 className="mt-1.5 font-sans text-[clamp(1.25rem,1rem+1.5vw,1.75rem)] font-extrabold leading-tight tracking-tight">
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
                className="min-h-[44px] min-w-[44px] shrink-0 rounded-full bg-white px-4 py-2 font-mono text-xs font-bold text-zinc-900 shadow-md transition-transform active:scale-95 disabled:opacity-50"
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
      <div className="sticky top-0 z-20 -mx-4 border-b border-zinc-200/80 bg-[#FAF7F2]/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dishes, ingredients, or allergens..."
            aria-label="Search menu dishes"
            className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-[#FF5412]"
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
            className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${
              activeCategoryId === 'ALL'
                ? 'border-[#FF5412] bg-[#FF5412] text-white'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#FF5412]'
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
              className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-bold transition-colors ${
                activeCategoryId === cat.id
                  ? 'border-[#FF5412] bg-[#FF5412] text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#FF5412]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Dietary Filters */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {DIETARY_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={dietaryFilter === filter.value}
              onClick={() => setDietaryFilter(filter.value)}
              className={`min-h-[44px] shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                dietaryFilter === filter.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Menu List */}
      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
          <p className="font-sans text-lg font-bold text-zinc-900">No dishes match your filters</p>
          <p className="mt-1 text-sm text-zinc-500">
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
                  <h2 className="font-sans text-[clamp(1.125rem,1rem+0.9vw,1.375rem)] font-extrabold tracking-tight text-zinc-900">
                    {cat.name}
                  </h2>
                  <span className="font-mono text-xs font-medium text-zinc-500">
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
                        className={`group relative flex gap-3.5 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#FF5412]/40 hover:shadow-md ${
                          item.isAvailable ? '' : 'opacity-65'
                        }`}
                      >
                        <div className="min-w-0 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${diet.badgeClass}`}
                              >
                                <DietIcon className="size-3" aria-hidden="true" />
                                {diet.label}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                                <Clock className="size-3" aria-hidden="true" />
                                {item.prepTimeMins}m
                              </span>
                              {!item.isAvailable && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold uppercase text-red-600">
                                  Sold Out (86)
                                </span>
                              )}
                            </div>

                            <h3 className="mt-1.5 font-sans text-base font-bold leading-snug tracking-tight text-zinc-900 transition-colors group-hover:text-[#FF5412]">
                              {item.name}
                            </h3>
                            {item.description && (
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                                {item.description}
                              </p>
                            )}

                            {item.allergens.length > 0 && (
                              <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
                                <span>Contains: {item.allergens.join(', ')}</span>
                              </p>
                            )}
                          </div>

                          <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-zinc-100 pt-2.5">
                            <span className="font-mono text-base font-bold tabular-nums text-zinc-900">
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
                              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#FF5412] px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#FF7033] active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 disabled:active:scale-100"
                            >
                              <Plus className="size-4" aria-hidden="true" />
                              <span>{item.isAvailable ? 'Add' : 'Unavailable'}</span>
                            </button>
                          </div>
                        </div>

                        {item.imageUrl && (
                          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-[#FAF7F2]">
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
