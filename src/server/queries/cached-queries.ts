import { cacheLife, cacheTag } from 'next/cache';
import { resolveTenantAndOutlet } from '@/server/api/http';
import { getContainer } from '@/server/container';
import { computeHourlyRevenueBuckets, computeOwnerKpis } from '@/server/core';
import type {
  OrderItemRecord,
  OrderRecord,
  PaymentRecord,
  TableSessionRecord,
} from '@/server/ports/repositories.port';

/**
 * Cached menu catalog read using the Next.js 16 `menuCatalog` cacheLife profile.
 * Caller must keep cookies/headers outside `'use cache'` and pass primitive args.
 */
export async function getCachedMenuCatalog(outletIdOrSlug?: string) {
  'use cache';
  cacheLife('menuCatalog');
  cacheTag('menu-catalog', outletIdOrSlug ? `menu-catalog:${outletIdOrSlug}` : 'menu-catalog:default');

  const { tenant, outlet } = await resolveTenantAndOutlet(outletIdOrSlug);
  const { repos } = getContainer();

  const [categories, items, modifiers, stations, taxSlabs, upsellRules] = await Promise.all([
    repos.menu.listCategories(tenant.id, outlet.id),
    repos.menu.listMenuItems(tenant.id, outlet.id),
    repos.menu.listModifiersByOutlet(tenant.id, outlet.id),
    repos.menu.listStations(tenant.id, outlet.id),
    repos.menu.listTaxSlabs(tenant.id, outlet.id),
    repos.menu.listUpsellRules(tenant.id, outlet.id),
  ]);

  return {
    tenantId: tenant.id,
    outletId: outlet.id,
    outletName: outlet.name,
    currencyCode: tenant.currencyCode,
    categories,
    items,
    modifiers,
    stations,
    taxSlabs,
    upsellRules,
  };
}

/**
 * Cached inventory snapshot using `analyticsLive` cacheLife profile.
 */
export async function getCachedInventorySnapshot(outletIdOrSlug?: string) {
  'use cache';
  cacheLife('analyticsLive');
  cacheTag('inventory', outletIdOrSlug ? `inventory:${outletIdOrSlug}` : 'inventory:default');

  const { tenant, outlet } = await resolveTenantAndOutlet(outletIdOrSlug);
  const { repos } = getContainer();

  const [items, menuItems] = await Promise.all([
    repos.inventory.listInventoryItems(tenant.id, outlet.id),
    repos.menu.listMenuItems(tenant.id, outlet.id),
  ]);
  const recipes = await repos.inventory.listRecipesForMenuItems(
    tenant.id,
    menuItems.map((m) => m.id),
  );

  return {
    tenantId: tenant.id,
    outletId: outlet.id,
    items,
    recipes,
  };
}

/**
 * Cached live analytics summary using `analyticsLive` cacheLife profile.
 */
export async function getCachedAnalyticsLive(outletIdOrSlug?: string) {
  'use cache';
  cacheLife('analyticsLive');
  cacheTag(
    'analytics-live',
    'menu-catalog',
    'inventory',
    outletIdOrSlug ? `analytics-live:${outletIdOrSlug}` : 'analytics-live:default',
  );

  const { tenant, outlet } = await resolveTenantAndOutlet(outletIdOrSlug);
  const { repos } = getContainer();

  const [tables, openShift] = await Promise.all([
    repos.floor.listTables(tenant.id, outlet.id),
    repos.shift.findOpenShift(tenant.id, outlet.id),
  ]);

  const activeSessions: TableSessionRecord[] = [];
  const activeOrders: OrderRecord[] = [];
  const activeOrderItems: OrderItemRecord[] = [];
  const activePayments: PaymentRecord[] = [];

  for (const table of tables) {
    if (!table.activeSessionId) continue;
    const [session, orders, items, payments] = await Promise.all([
      repos.sessionOrder.findSessionById(tenant.id, table.activeSessionId),
      repos.sessionOrder.listOrdersBySession(tenant.id, table.activeSessionId),
      repos.sessionOrder.listOrderItemsBySession(tenant.id, table.activeSessionId),
      repos.billing.listPaymentsBySession(tenant.id, table.activeSessionId),
    ]);
    if (session) activeSessions.push(session);
    activeOrders.push(...orders);
    activeOrderItems.push(...items);
    activePayments.push(...payments);
  }

  const kpis = computeOwnerKpis({
    tables,
    orders: activeOrders,
    orderItems: activeOrderItems,
    sessions: activeSessions,
    payments: activePayments,
  });

  const hourlyRevenue = computeHourlyRevenueBuckets(activeOrders, activePayments);

  return {
    outletId: outlet.id,
    outletName: outlet.name,
    currencyCode: tenant.currencyCode,
    kpis,
    hourlyRevenue,
    openShift,
  };
}
