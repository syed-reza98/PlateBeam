import { getContainer } from '@/server/container';
import {
  apiError,
  apiOk,
  getRequestIp,
  parseQuery,
} from '@/server/api/http';
import {
  buildGuestWifiCard,
  estimateCookCountdown,
  getCategorizedMenu,
  verifySignedQrToken,
  evaluateQrScanSecurity,
} from '@/server/core';
import { NotFoundError, SecurityPolicyError } from '@/server/core/errors';
import { qrBootstrapQuerySchema } from '@/lib/schemas';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ qrToken: string }> },
) {
  try {
    const { qrToken } = await params;
    const query = parseQuery(req, qrBootstrapQuerySchema);
    const { repos } = getContainer();

    const isDemo = qrToken === 'demo';
    if (!isDemo) {
      const payload = verifySignedQrToken(qrToken);
      if (!payload) {
        throw new SecurityPolicyError('Tampered or invalid QR code signature.', 'QR_SIGNATURE_INVALID');
      }
    }
    const table = await repos.floor.findTableByQrToken(qrToken);
    if (!table) {
      throw new NotFoundError('Invalid or rotated QR code. Please scan a valid table QR code or visit /t/demo for demo mode.', { qrToken });
    }

    const tenantId = table.tenantId;
    const [tenant, outlet, zones] = await Promise.all([
      repos.tenantOutlet.findTenantById(tenantId),
      repos.tenantOutlet.findOutletById(tenantId, table.outletId),
      repos.floor.listZones(tenantId, table.outletId),
    ]);

    if (!tenant || !outlet) {
      throw new NotFoundError('Venue not found for QR code');
    }

    // Evaluate QR Geofence, Wi-Fi subnet & Guest blocklist BEFORE mutating DB
    evaluateQrScanSecurity({
      outlet,
      lat: query.lat,
      lng: query.lng,
      clientIp: getRequestIp(req),
    });

    let session = table.activeSessionId
      ? await repos.sessionOrder.findSessionById(tenantId, table.activeSessionId)
      : await repos.sessionOrder.findOpenSessionByTable(tenantId, table.id);

    if (!session || session.status === 'PAID' || session.status === 'CANCELLED') {
      session = await repos.sessionOrder.createSession({
        id: crypto.randomUUID(),
        tenantId,
        outletId: outlet.id,
        tableId: table.id,
        sessionType: 'DINE_IN',
        status: 'OPEN',
        subtotalMinor: 0,
        taxMinor: 0,
        discountMinor: 0,
        serviceChargeMinor: 0,
        tipMinor: 0,
        totalMinor: 0,
      });
      await repos.floor.updateTableStatus(tenantId, table.id, 'ORDERING', session.id);
    }

    const [orders, sessionItems, payments, kdsQueue, menuData, modifiers, upsellRules, leaderboard] =
      await Promise.all([
        repos.sessionOrder.listOrdersBySession(tenantId, session.id),
        repos.sessionOrder.listOrderItemsBySession(tenantId, session.id),
        repos.billing.listPaymentsBySession(tenantId, session.id),
        repos.sessionOrder.listKdsQueue(tenantId, outlet.id),
        getCategorizedMenu(repos.menu, {
          tenantId,
          outletId: outlet.id,
          onlyAvailable: false,
        }),
        repos.menu.listModifiersByOutlet(tenantId, outlet.id),
        repos.menu.listUpsellRules(tenantId, outlet.id),
        repos.engagement.listMiniGameLeaderboard(tenantId, outlet.id, session.id),
      ]);

    const openUnpaidOrderCount = orders.filter((o) => o.status !== 'CANCELLED').length;
    evaluateQrScanSecurity({
      outlet,
      lat: query.lat,
      lng: query.lng,
      clientIp: getRequestIp(req),
      openUnpaidOrderCount,
    });

    const allItems = menuData.categories.flatMap((c) => c.items);
    const menuItemsById = new Map(allItems.map((m) => [m.id, m]));
    const stationsById = new Map(menuData.stations.map((s) => [s.id, s]));

    const countdown = estimateCookCountdown({
      sessionItems,
      stationQueue: kdsQueue,
      menuItemsById,
      stationsById,
    });

    const paidMinor = payments
      .filter((p) => p.status === 'CAPTURED')
      .reduce((acc, p) => acc + p.amountMinor, 0);

    const zoneName = zones.find((z) => z.id === table.zoneId)?.name ?? null;
    const wifiCard = buildGuestWifiCard(outlet);

    const itemsByOrder = new Map<string, typeof sessionItems>();
    for (const item of sessionItems) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderId, list);
    }

    return apiOk({
      outlet: {
        id: outlet.id,
        tenantId: outlet.tenantId,
        name: outlet.name,
        slug: outlet.subdomain,
        currency: tenant.currencyCode,
        timezone: outlet.timezone,
        wifiSsid: wifiCard.ssid,
        wifiPassword: wifiCard.password,
        vatNumber: outlet.taxRegNo,
      },
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        status: table.status,
        zoneName,
      },
      session: {
        id: session.id,
        sessionType: session.sessionType,
        status: session.status,
        subtotalMinor: session.subtotalMinor,
        taxMinor: session.taxMinor,
        discountMinor: session.discountMinor,
        serviceChargeMinor: session.serviceChargeMinor,
        tipMinor: session.tipMinor,
        totalMinor: session.totalMinor,
        paidMinor,
        remainingMinor: Math.max(0, session.totalMinor - paidMinor),
        estimatedWaitMins: Math.ceil(countdown.estimatedRemainingSeconds / 60),
      },
      categories: menuData.categories.map((c) => ({
        id: c.category.id,
        name: c.category.name,
        sortOrder: c.category.sortOrder,
      })),
      menuItems: allItems.map((m) => ({
        id: m.id,
        categoryId: m.categoryId,
        stationId: m.stationId,
        name: m.name,
        description: m.description,
        basePriceMinor: m.basePriceMinor,
        dietaryType: m.dietaryType,
        allergens: m.allergens,
        spiceLevels: m.spiceLevels,
        prepTimeMins: m.prepTimeMins,
        imageUrl: m.imageUrl,
        isAvailable: m.isAvailable,
      })),
      modifiers: modifiers.map((mod) => ({
        id: mod.id,
        menuItemId: mod.menuItemId,
        groupName: mod.groupName,
        optionName: mod.optionName,
        priceDeltaMinor: mod.priceDeltaMinor,
        isRequired: mod.isRequired,
        isMultiSelect: mod.maxSelect > 1,
      })),
      upsellRules: upsellRules.map((u) => ({
        id: u.id,
        triggerCategoryId: u.triggerCategoryId,
        triggerMenuItemId: u.triggerItemId,
        suggestedMenuItemId: u.suggestedItemId,
        promoLabel: u.promoPriceMinor ? 'Chef Pairing Deal' : 'Recommended Pairing',
        discountMinor: u.promoPriceMinor ?? undefined,
      })),
      sharedCart: [],
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        tokenNumber: null,
        createdAt: o.createdAt.toISOString(),
        items: (itemsByOrder.get(o.id) ?? []).map((i) => ({
          id: i.id,
          orderId: i.orderId,
          menuItemId: i.menuItemId,
          itemNameSnapshot: i.itemNameSnapshot,
          quantity: i.quantity,
          unitPriceMinor: i.unitPriceMinor,
          lineTotalMinor: i.unitPriceMinor * i.quantity + i.taxMinor,
          kdsStatus: i.kdsStatus,
          spiceLevel: i.spiceLevel,
          notes: i.notes,
          modifiersSnapshot: i.modifiersSnapshot,
        })),
      })),
      payments: payments.map((p) => ({
        id: p.id,
        provider: p.provider,
        method: p.method,
        amountMinor: p.amountMinor,
        tipMinor: p.tipMinor,
        status: p.status,
        splitGroupId: p.splitGroupId,
        createdAt: (p.paidAt ?? new Date()).toISOString(),
      })),
      leaderboard: leaderboard.map((entry) => ({
        playerNickname: entry.playerNickname,
        score: entry.score,
        createdAt: entry.playedAt.toISOString(),
        rewardCouponCode: entry.rewardCouponCode,
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}
