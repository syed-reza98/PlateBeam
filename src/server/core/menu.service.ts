import type { DietaryType } from '../db/types';
import type { RealtimePort } from '../ports/realtime.port';
import type {
  AuditRepository,
  ItemModifierRecord,
  KitchenStationRecord,
  MenuCategoryRecord,
  MenuItemRecord,
  MenuRepository,
  TaxSlabRecord,
  UpsellRuleRecord,
} from '../ports/repositories.port';
import { NotFoundError } from './errors';
import { writeAuditLog } from './rbac.service';

export interface MenuCatalogFilter {
  tenantId: string;
  outletId: string;
  timezone?: string;
  now?: Date;
  onlyAvailable?: boolean;
  includeInactiveSchedules?: boolean;
  dietaryTypes?: DietaryType[];
  excludeAllergens?: string[];
  spiceLevel?: string;
  search?: string;
}

export interface EnrichedMenuItem extends MenuItemRecord {
  modifiers: ItemModifierRecord[];
  taxSlab: TaxSlabRecord | null;
  station: KitchenStationRecord | null;
}

export interface CategorizedMenuGroup {
  category: MenuCategoryRecord;
  items: EnrichedMenuItem[];
}

function getLocalDayAndMinutes(date: Date, timezone = 'UTC'): { day: number; minutes: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const hour = Number(hourStr) % 24;
    const minute = Number(minStr);
    return {
      day: dayMap[weekdayStr] ?? date.getDay(),
      minutes: hour * 60 + minute,
    };
  } catch {
    return {
      day: date.getDay(),
      minutes: date.getHours() * 60 + date.getMinutes(),
    };
  }
}

function parseHhMmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Evaluates time-based menu scheduling windows (FR-011: Breakfast, Lunch, Happy Hour).
 */
export function isCategoryActiveAtTime(
  category: Pick<MenuCategoryRecord, 'isActive' | 'scheduleRules'>,
  now: Date = new Date(),
  timezone = 'UTC',
): boolean {
  if (!category.isActive) return false;
  const windows = category.scheduleRules?.windows;
  if (!windows || windows.length === 0) return true;

  const { day, minutes } = getLocalDayAndMinutes(now, timezone);

  return windows.some((win) => {
    if (win.daysOfWeek && win.daysOfWeek.length > 0 && !win.daysOfWeek.includes(day)) {
      return false;
    }
    if (!win.startTime || !win.endTime) return true;
    const start = parseHhMmToMinutes(win.startTime);
    const end = parseHhMmToMinutes(win.endTime);
    if (start === null || end === null) return true;

    // Handle standard daytime window vs overnight window (e.g. 22:00 - 02:00)
    if (start <= end) {
      return minutes >= start && minutes <= end;
    }
    return minutes >= start || minutes <= end;
  });
}

/**
 * Returns categorized menu with dietary, allergen, spice, search, and schedule filters (FR-006, FR-007, FR-011).
 */
export async function getCategorizedMenu(
  menuRepo: MenuRepository,
  filter: MenuCatalogFilter,
): Promise<{
  categories: CategorizedMenuGroup[];
  stations: KitchenStationRecord[];
  taxSlabs: TaxSlabRecord[];
}> {
  const [categories, items, modifiers, stations, taxSlabs] = await Promise.all([
    menuRepo.listCategories(filter.tenantId, filter.outletId),
    menuRepo.listMenuItems(filter.tenantId, filter.outletId, filter.onlyAvailable),
    menuRepo.listModifiersByOutlet(filter.tenantId, filter.outletId),
    menuRepo.listStations(filter.tenantId, filter.outletId),
    menuRepo.listTaxSlabs(filter.tenantId, filter.outletId),
  ]);

  const modifiersByItem = new Map<string, ItemModifierRecord[]>();
  for (const mod of modifiers) {
    const arr = modifiersByItem.get(mod.menuItemId) ?? [];
    arr.push(mod);
    modifiersByItem.set(mod.menuItemId, arr);
  }

  const stationById = new Map(stations.map((s) => [s.id, s]));
  const taxSlabById = new Map(taxSlabs.map((t) => [t.id, t]));

  const searchNeedle = filter.search?.trim().toLowerCase();
  const excludedAllergens = new Set(
    (filter.excludeAllergens ?? []).map((a) => a.trim().toLowerCase()),
  );
  const dietarySet = filter.dietaryTypes?.length
    ? new Set(filter.dietaryTypes)
    : null;
  const spiceNeedle = filter.spiceLevel?.trim().toLowerCase();
  const now = filter.now ?? new Date();

  const activeCategories = categories
    .filter((cat) =>
      filter.includeInactiveSchedules
        ? cat.isActive
        : isCategoryActiveAtTime(cat, now, filter.timezone),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const itemsByCategory = new Map<string, EnrichedMenuItem[]>();
  for (const item of items) {
    if (dietarySet && !dietarySet.has(item.dietaryType)) continue;

    if (excludedAllergens.size > 0) {
      const hasExcluded = item.allergens.some((a) =>
        excludedAllergens.has(a.toLowerCase()),
      );
      if (hasExcluded) continue;
    }

    if (spiceNeedle) {
      const hasSpice = item.spiceLevels.some(
        (s) => s.toLowerCase() === spiceNeedle,
      );
      if (!hasSpice) continue;
    }

    if (searchNeedle) {
      const haystack = `${item.name} ${item.description ?? ''}`.toLowerCase();
      if (!haystack.includes(searchNeedle)) continue;
    }

    const enriched: EnrichedMenuItem = {
      ...item,
      modifiers: modifiersByItem.get(item.id) ?? [],
      taxSlab: taxSlabById.get(item.taxSlabId) ?? null,
      station: stationById.get(item.stationId) ?? null,
    };

    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push(enriched);
    itemsByCategory.set(item.categoryId, list);
  }

  const grouped: CategorizedMenuGroup[] = activeCategories
    .map((category) => ({
      category,
      items: itemsByCategory.get(category.id) ?? [],
    }))
    .filter((g) => g.items.length > 0 || filter.includeInactiveSchedules);

  return {
    categories: grouped,
    stations,
    taxSlabs,
  };
}

export interface UpsellSuggestion {
  rule: UpsellRuleRecord;
  item: MenuItemRecord;
  effectivePriceMinor: number;
}

/**
 * Intelligent upsell & pairing engine (FR-008).
 */
export async function getUpsellSuggestions(
  menuRepo: MenuRepository,
  input: {
    tenantId: string;
    outletId: string;
    cartMenuItemIds: string[];
    limit?: number;
  },
): Promise<UpsellSuggestion[]> {
  if (input.cartMenuItemIds.length === 0) return [];

  const [rules, items] = await Promise.all([
    menuRepo.listUpsellRules(input.tenantId, input.outletId),
    menuRepo.listMenuItems(input.tenantId, input.outletId, true),
  ]);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const cartItemSet = new Set(input.cartMenuItemIds);
  const cartCategorySet = new Set<string>();
  for (const id of input.cartMenuItemIds) {
    const item = itemById.get(id);
    if (item) cartCategorySet.add(item.categoryId);
  }

  const matched = rules
    .filter((rule) => {
      if (cartItemSet.has(rule.suggestedItemId)) return false;
      const suggested = itemById.get(rule.suggestedItemId);
      if (!suggested || !suggested.isAvailable) return false;

      const itemMatch =
        rule.triggerItemId != null && cartItemSet.has(rule.triggerItemId);
      const catMatch =
        rule.triggerCategoryId != null &&
        cartCategorySet.has(rule.triggerCategoryId);
      return itemMatch || catMatch;
    })
    .sort((a, b) => b.priority - a.priority);

  const seenSuggested = new Set<string>();
  const suggestions: UpsellSuggestion[] = [];
  const limit = input.limit ?? 4;

  for (const rule of matched) {
    if (seenSuggested.has(rule.suggestedItemId)) continue;
    const item = itemById.get(rule.suggestedItemId);
    if (!item) continue;
    seenSuggested.add(item.id);
    suggestions.push({
      rule,
      item,
      effectivePriceMinor: rule.promoPriceMinor ?? item.basePriceMinor,
    });
    if (suggestions.length >= limit) break;
  }

  return suggestions;
}

/**
 * Real-time 86 / availability toggle (FR-009).
 */
export async function toggleItem86(
  deps: {
    menu: MenuRepository;
    realtime: RealtimePort;
    audit: AuditRepository;
  },
  input: {
    tenantId: string;
    outletId: string;
    menuItemId: string;
    isAvailable: boolean;
    actorUserId?: string | null;
    reason?: string;
  },
): Promise<MenuItemRecord> {
  const existing = await deps.menu.findMenuItemById(
    input.tenantId,
    input.menuItemId,
  );
  if (!existing) {
    throw new NotFoundError('Menu item not found', { menuItemId: input.menuItemId });
  }

  const updated = await deps.menu.setItemAvailability(
    input.tenantId,
    input.menuItemId,
    input.isAvailable,
  );

  await writeAuditLog(deps.audit, {
    tenantId: input.tenantId,
    outletId: input.outletId,
    actorUserId: input.actorUserId ?? null,
    action: input.isAvailable ? 'MENU_ITEM_RESTOCKED' : 'MENU_ITEM_86ED',
    entityType: 'menu_items',
    entityId: input.menuItemId,
    beforeState: { isAvailable: existing.isAvailable },
    afterState: { isAvailable: updated.isAvailable, reason: input.reason ?? null },
  });

  await deps.realtime.publishToMenu(
    input.tenantId,
    input.outletId,
    'menu.updated',
    {
      menuItemId: updated.id,
      isAvailable: updated.isAvailable,
      name: updated.name,
    },
  );

  return updated;
}
