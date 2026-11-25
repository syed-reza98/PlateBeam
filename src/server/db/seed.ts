import { eq } from 'drizzle-orm';
import { hashSecret } from '../adapters/portable/crypto';
import { generateSignedQrToken } from '../core/qr-security.service';
import { closeDb, getDbDialect, getMySqlDb, withTenantTx } from './client';
import { mysqlSchema } from './schema/mysql';
import { pgSchema } from './schema/pg';

const SEED_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const SEED_OUTLET_ID = '22222222-2222-4222-8222-222222222222';

export async function runSeed(): Promise<void> {
  const dialect = getDbDialect();
  console.log(`[seed] Starting PlateBeam seed on dialect=${dialect}...`);

  const tenantId = SEED_TENANT_ID;
  const outletId = SEED_OUTLET_ID;

  // Deterministic IDs so re-runs / demo links are predictable
  const roleIds = {
    OWNER: '33333333-3333-4333-8333-333333333301',
    CAPTAIN: '33333333-3333-4333-8333-333333333302',
    CASHIER: '33333333-3333-4333-8333-333333333303',
    CHEF: '33333333-3333-4333-8333-333333333304',
  };

  const userIds = {
    owner: '44444444-4444-4444-8444-444444444401',
    captain: '44444444-4444-4444-8444-444444444402',
    cashier: '44444444-4444-4444-8444-444444444403',
    chef: '44444444-4444-4444-8444-444444444404',
  };

  const zoneIds = {
    main: '55555555-5555-4555-8555-555555555501',
    patio: '55555555-5555-4555-8555-555555555502',
    vip: '55555555-5555-4555-8555-555555555503',
    bar: '55555555-5555-4555-8555-555555555504',
  };

  const tableIds = [
    '66666666-6666-4666-8666-666666666601',
    '66666666-6666-4666-8666-666666666602',
    '66666666-6666-4666-8666-666666666603',
    '66666666-6666-4666-8666-666666666604',
    '66666666-6666-4666-8666-666666666605',
    '66666666-6666-4666-8666-666666666606',
  ];

  const stationIds = {
    grill: '77777777-7777-4777-8777-777777777701',
    tandoor: '77777777-7777-4777-8777-777777777702',
    cold: '77777777-7777-4777-8777-777777777703',
    bar: '77777777-7777-4777-8777-777777777704',
  };

  const categoryIds = {
    starters: '88888888-8888-4888-8888-888888888801',
    mains: '88888888-8888-4888-8888-888888888802',
    breads: '88888888-8888-4888-8888-888888888803',
    drinks: '88888888-8888-4888-8888-888888888804',
  };

  const taxSlabIds = {
    vat15: '99999999-9999-4999-8999-999999999901',
    zero: '99999999-9999-4999-8999-999999999902',
  };

  const menuItemIds = Array.from({ length: 12 }, (_, idx) => {
    const suffix = String(idx + 1).padStart(2, '0');
    return `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${suffix}`;
  });

  const inventoryIds = {
    chicken: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01',
    paneer: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb02',
    lamb: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb03',
    basmati: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb04',
    flour: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb05',
    mango: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb06',
  };

  const seedData = {
    tenant: {
      id: tenantId,
      name: 'Zaika Bistro',
      slug: 'zaika-bistro',
      subscriptionPlan: 'PRO' as const,
      status: 'ACTIVE' as const,
      currencyCode: 'BDT',
    },
    outlet: {
      id: outletId,
      tenantId,
      name: 'Zaika Bistro — Gulshan Flagship',
      subdomain: 'zaika-bistro',
      address: 'Road 71, Gulshan 2, Dhaka 1212',
      timezone: 'Asia/Dhaka',
      taxRegNo: 'BIN-0048291-0102',
      wifiSsid: 'Zaika_Guest_5G',
      wifiPasswordEnc: 'spice2026',
      qrSecurityPolicy: {
        requireGps: false,
        maxDistanceMeters: 150,
        requireVenueIp: false,
        allowedIpCidrs: [],
        captainApprovalRequired: false,
        payFirstTakeaway: false,
        maxUnpaidOrders: 4,
        serviceRequestCooldownSecs: 60,
      },
      geoLat: 23.7925,
      geoLng: 90.4078,
    },
    roles: [
      { id: roleIds.OWNER, tenantId, name: 'OWNER', defaultPermissions: ['*'] },
      {
        id: roleIds.CAPTAIN,
        tenantId,
        name: 'CAPTAIN',
        defaultPermissions: [
          'pos:*',
          'floor:*',
          'orders:*',
          'kds:read',
          'service_requests:*',
          'menu:read',
        ],
      },
      {
        id: roleIds.CASHIER,
        tenantId,
        name: 'CASHIER',
        defaultPermissions: [
          'pos:*',
          'billing:*',
          'payments:*',
          'shifts:*',
          'orders:read',
        ],
      },
      {
        id: roleIds.CHEF,
        tenantId,
        name: 'CHEF',
        defaultPermissions: ['kds:*', 'menu:86', 'orders:read'],
      },
    ],
    users: [
      {
        id: userIds.owner,
        tenantId,
        outletId,
        fullName: 'Aarav Rahman',
        email: 'owner@zaikabistro.com',
        phone: '+8801711000001',
        passwordHash: hashSecret('ZaikaOwner#2026'),
        posPinHash: hashSecret('1234'),
        roleId: roleIds.OWNER,
        isActive: true,
      },
      {
        id: userIds.captain,
        tenantId,
        outletId,
        fullName: 'Nadia Karim',
        email: 'captain@zaikabistro.com',
        phone: '+8801711000002',
        passwordHash: hashSecret('ZaikaCaptain#2026'),
        posPinHash: hashSecret('2222'),
        roleId: roleIds.CAPTAIN,
        isActive: true,
      },
      {
        id: userIds.cashier,
        tenantId,
        outletId,
        fullName: 'Tariq Hasan',
        email: 'cashier@zaikabistro.com',
        phone: '+8801711000003',
        passwordHash: hashSecret('ZaikaCashier#2026'),
        posPinHash: hashSecret('3333'),
        roleId: roleIds.CASHIER,
        isActive: true,
      },
      {
        id: userIds.chef,
        tenantId,
        outletId,
        fullName: 'Chef Kabir',
        email: 'chef@zaikabistro.com',
        phone: '+8801711000004',
        passwordHash: hashSecret('ZaikaChef#2026'),
        posPinHash: hashSecret('4444'),
        roleId: roleIds.CHEF,
        isActive: true,
      },
    ],
    zones: [
      { id: zoneIds.main, tenantId, outletId, name: 'Main Dining', displayOrder: 1 },
      { id: zoneIds.patio, tenantId, outletId, name: 'Garden Patio', displayOrder: 2 },
      { id: zoneIds.vip, tenantId, outletId, name: 'VIP Lounge', displayOrder: 3 },
      { id: zoneIds.bar, tenantId, outletId, name: 'Bar Counter', displayOrder: 4 },
    ],
    tables: [
      { id: tableIds[0]!, zoneId: zoneIds.main, tableNumber: 'T1', capacity: 4, posX: 80, posY: 80 },
      { id: tableIds[1]!, zoneId: zoneIds.main, tableNumber: 'T2', capacity: 4, posX: 240, posY: 80 },
      { id: tableIds[2]!, zoneId: zoneIds.patio, tableNumber: 'T3', capacity: 2, posX: 80, posY: 220 },
      { id: tableIds[3]!, zoneId: zoneIds.patio, tableNumber: 'T4', capacity: 6, posX: 240, posY: 220 },
      { id: tableIds[4]!, zoneId: zoneIds.vip, tableNumber: 'V1', capacity: 8, posX: 400, posY: 120 },
      { id: tableIds[5]!, zoneId: zoneIds.bar, tableNumber: 'B1', capacity: 2, posX: 400, posY: 260 },
    ].map((t) => ({
      ...t,
      tenantId,
      outletId,
      qrToken: generateSignedQrToken({
        tenantId,
        outletId,
        tableId: t.id,
      }),
      status: 'VACANT' as const,
    })),
    stations: [
      { id: stationIds.grill, tenantId, outletId, name: 'Hot Grill', slaTargetMins: 14 },
      { id: stationIds.tandoor, tenantId, outletId, name: 'Tandoor', slaTargetMins: 12 },
      { id: stationIds.cold, tenantId, outletId, name: 'Cold & Salads', slaTargetMins: 8 },
      { id: stationIds.bar, tenantId, outletId, name: 'Bar & Beverages', slaTargetMins: 6 },
    ],
    categories: [
      { id: categoryIds.starters, tenantId, outletId, name: 'Starters & Tandoor', sortOrder: 1, isActive: true },
      { id: categoryIds.mains, tenantId, outletId, name: 'Main Course', sortOrder: 2, isActive: true },
      { id: categoryIds.breads, tenantId, outletId, name: 'Breads & Rice', sortOrder: 3, isActive: true },
      { id: categoryIds.drinks, tenantId, outletId, name: 'Drinks & Desserts', sortOrder: 4, isActive: true },
    ],
    taxSlabs: [
      {
        id: taxSlabIds.vat15,
        tenantId,
        outletId,
        name: 'VAT 15%',
        rateBps: 1500,
        components: [{ name: 'VAT', rateBps: 1500 }],
        isInclusive: false,
      },
      {
        id: taxSlabIds.zero,
        tenantId,
        outletId,
        name: 'Zero Rated',
        rateBps: 0,
        components: [],
        isInclusive: false,
      },
    ],
    menuItems: [
      {
        id: menuItemIds[0]!,
        categoryId: categoryIds.starters,
        stationId: stationIds.tandoor,
        taxSlabId: taxSlabIds.vat15,
        name: 'Smoked Chicken Tikka',
        description: 'Charcoal-roasted boneless chicken marinated in Kashmiri chili and hung yogurt.',
        basePriceMinor: 52000,
        dietaryType: 'NON_VEG' as const,
        allergens: ['DAIRY'],
        spiceLevels: ['Mild', 'Medium', 'Fiery'],
        prepTimeMins: 14,
      },
      {
        id: menuItemIds[1]!,
        categoryId: categoryIds.starters,
        stationId: stationIds.tandoor,
        taxSlabId: taxSlabIds.vat15,
        name: 'Charred Paneer Shashlik',
        description: 'Cottage cheese cubes skewered with bell peppers and mint glaze.',
        basePriceMinor: 44000,
        dietaryType: 'VEG' as const,
        allergens: ['DAIRY'],
        spiceLevels: ['Mild', 'Medium'],
        prepTimeMins: 12,
      },
      {
        id: menuItemIds[2]!,
        categoryId: categoryIds.starters,
        stationId: stationIds.cold,
        taxSlabId: taxSlabIds.vat15,
        name: 'Crispy Lotus Stem Chaat',
        description: 'Crisp lotus stem tossed in tamarind-date reduction and pomegranate.',
        basePriceMinor: 36000,
        dietaryType: 'VEGAN' as const,
        allergens: [],
        spiceLevels: ['Mild', 'Tangy'],
        prepTimeMins: 9,
      },
      {
        id: menuItemIds[3]!,
        categoryId: categoryIds.mains,
        stationId: stationIds.grill,
        taxSlabId: taxSlabIds.vat15,
        name: 'Old Delhi Butter Chicken',
        description: 'Tandoori chicken simmered in velvety tomato-fenugreek makhani gravy.',
        basePriceMinor: 68000,
        dietaryType: 'NON_VEG' as const,
        allergens: ['DAIRY', 'NUTS'],
        spiceLevels: ['Mild', 'Medium'],
        prepTimeMins: 16,
      },
      {
        id: menuItemIds[4]!,
        categoryId: categoryIds.mains,
        stationId: stationIds.grill,
        taxSlabId: taxSlabIds.vat15,
        name: 'Slow-Braised Lamb Rogan Josh',
        description: 'Aromatic Kashmiri lamb curry infused with saffron and cardamom.',
        basePriceMinor: 82000,
        dietaryType: 'NON_VEG' as const,
        allergens: [],
        spiceLevels: ['Medium', 'Fiery'],
        prepTimeMins: 18,
      },
      {
        id: menuItemIds[5]!,
        categoryId: categoryIds.mains,
        stationId: stationIds.grill,
        taxSlabId: taxSlabIds.vat15,
        name: '24-Hour Dal Zaika',
        description: 'Black lentils slow-cooked overnight with roasted garlic and cultured butter.',
        basePriceMinor: 46000,
        dietaryType: 'VEG' as const,
        allergens: ['DAIRY'],
        spiceLevels: ['Mild'],
        prepTimeMins: 12,
      },
      {
        id: menuItemIds[6]!,
        categoryId: categoryIds.breads,
        stationId: stationIds.tandoor,
        taxSlabId: taxSlabIds.vat15,
        name: 'Roasted Garlic Naan',
        description: 'Blistered tandoori flatbread brushed with confit garlic butter.',
        basePriceMinor: 14000,
        dietaryType: 'VEG' as const,
        allergens: ['GLUTEN', 'DAIRY'],
        spiceLevels: [],
        prepTimeMins: 6,
      },
      {
        id: menuItemIds[7]!,
        categoryId: categoryIds.breads,
        stationId: stationIds.grill,
        taxSlabId: taxSlabIds.vat15,
        name: 'Hyderabadi Chicken Dum Biryani',
        description: 'Aged basmati layered with spiced chicken, fried onions, and saffron.',
        basePriceMinor: 74000,
        dietaryType: 'NON_VEG' as const,
        allergens: ['DAIRY'],
        spiceLevels: ['Medium', 'Fiery'],
        prepTimeMins: 18,
      },
      {
        id: menuItemIds[8]!,
        categoryId: categoryIds.breads,
        stationId: stationIds.grill,
        taxSlabId: taxSlabIds.vat15,
        name: 'Saffron Jeera Pulao',
        description: 'Fragrant basmati rice tempered with toasted cumin and ghee.',
        basePriceMinor: 28000,
        dietaryType: 'GLUTEN_FREE' as const,
        allergens: ['DAIRY'],
        spiceLevels: [],
        prepTimeMins: 8,
      },
      {
        id: menuItemIds[9]!,
        categoryId: categoryIds.drinks,
        stationId: stationIds.bar,
        taxSlabId: taxSlabIds.vat15,
        name: 'Alphonso Mango Lassi',
        description: 'Chilled churned yogurt blended with Alphonso mango pulp and pistachio.',
        basePriceMinor: 24000,
        dietaryType: 'VEG' as const,
        allergens: ['DAIRY', 'NUTS'],
        spiceLevels: [],
        prepTimeMins: 5,
      },
      {
        id: menuItemIds[10]!,
        categoryId: categoryIds.drinks,
        stationId: stationIds.bar,
        taxSlabId: taxSlabIds.vat15,
        name: 'Smoked Tamarind Mojito',
        description: 'Zero-proof botanical cooler with tamarind, mint, and black salt.',
        basePriceMinor: 22000,
        dietaryType: 'VEGAN' as const,
        allergens: [],
        spiceLevels: ['Tangy'],
        prepTimeMins: 5,
      },
      {
        id: menuItemIds[11]!,
        categoryId: categoryIds.drinks,
        stationId: stationIds.cold,
        taxSlabId: taxSlabIds.vat15,
        name: 'Saffron Pistachio Kulfi',
        description: 'Traditional slow-reduced milk popsicle with cardamom and rose.',
        basePriceMinor: 26000,
        dietaryType: 'VEG' as const,
        allergens: ['DAIRY', 'NUTS'],
        spiceLevels: [],
        prepTimeMins: 4,
      },
    ].map((item) => ({
      ...item,
      tenantId,
      outletId,
      isAvailable: true,
    })),
    modifiers: [
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
        tenantId,
        menuItemId: menuItemIds[0]!,
        groupName: 'Portion',
        optionName: 'Half (4 pcs)',
        priceDeltaMinor: 0,
        isRequired: true,
        maxSelect: 1,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
        tenantId,
        menuItemId: menuItemIds[0]!,
        groupName: 'Portion',
        optionName: 'Full (8 pcs)',
        priceDeltaMinor: 32000,
        isRequired: true,
        maxSelect: 1,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc03',
        tenantId,
        menuItemId: menuItemIds[3]!,
        groupName: 'Add-ons',
        optionName: 'Extra Butter Drizzle',
        priceDeltaMinor: 4000,
        isRequired: false,
        maxSelect: 1,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccc04',
        tenantId,
        menuItemId: menuItemIds[7]!,
        groupName: 'Accompaniment',
        optionName: 'Burhani Raita',
        priceDeltaMinor: 6000,
        isRequired: false,
        maxSelect: 1,
      },
    ],
    upsells: [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
        tenantId,
        outletId,
        triggerCategoryId: categoryIds.mains,
        suggestedItemId: menuItemIds[6]!, // Garlic Naan
        promoPriceMinor: 12000,
        priority: 10,
      },
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd02',
        tenantId,
        outletId,
        triggerItemId: menuItemIds[7]!, // Biryani
        suggestedItemId: menuItemIds[9]!, // Mango Lassi
        promoPriceMinor: 20000,
        priority: 8,
      },
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd03',
        tenantId,
        outletId,
        triggerCategoryId: categoryIds.starters,
        suggestedItemId: menuItemIds[10]!, // Smoked Tamarind Mojito
        promoPriceMinor: null,
        priority: 5,
      },
    ],
    inventory: [
      { id: inventoryIds.chicken, tenantId, outletId, sku: 'INV-CHK-01', name: 'Boneless Chicken Thigh', unit: 'kg', currentQty: '25.000', reorderLevel: '6.000', costPerUnitMinor: 38000 },
      { id: inventoryIds.paneer, tenantId, outletId, sku: 'INV-PNR-02', name: 'Fresh Malai Paneer', unit: 'kg', currentQty: '12.000', reorderLevel: '3.000', costPerUnitMinor: 65000 },
      { id: inventoryIds.lamb, tenantId, outletId, sku: 'INV-LMB-03', name: 'Kashmiri Lamb Cut', unit: 'kg', currentQty: '10.000', reorderLevel: '2.500', costPerUnitMinor: 110000 },
      { id: inventoryIds.basmati, tenantId, outletId, sku: 'INV-RCE-04', name: 'Aged Basmati Rice', unit: 'kg', currentQty: '40.000', reorderLevel: '10.000', costPerUnitMinor: 18000 },
      { id: inventoryIds.flour, tenantId, outletId, sku: 'INV-FLR-05', name: 'Tandoori Maida Flour', unit: 'kg', currentQty: '30.000', reorderLevel: '8.000', costPerUnitMinor: 8500 },
      { id: inventoryIds.mango, tenantId, outletId, sku: 'INV-MNG-06', name: 'Alphonso Mango Pulp', unit: 'L', currentQty: '15.000', reorderLevel: '4.000', costPerUnitMinor: 32000 },
    ],
    recipes: [
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01', tenantId, menuItemId: menuItemIds[0]!, inventoryItemId: inventoryIds.chicken, qtyRequired: '0.250' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02', tenantId, menuItemId: menuItemIds[1]!, inventoryItemId: inventoryIds.paneer, qtyRequired: '0.220' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03', tenantId, menuItemId: menuItemIds[3]!, inventoryItemId: inventoryIds.chicken, qtyRequired: '0.280' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee04', tenantId, menuItemId: menuItemIds[4]!, inventoryItemId: inventoryIds.lamb, qtyRequired: '0.300' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee05', tenantId, menuItemId: menuItemIds[6]!, inventoryItemId: inventoryIds.flour, qtyRequired: '0.120' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee06', tenantId, menuItemId: menuItemIds[7]!, inventoryItemId: inventoryIds.basmati, qtyRequired: '0.250' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee07', tenantId, menuItemId: menuItemIds[7]!, inventoryItemId: inventoryIds.chicken, qtyRequired: '0.220' },
      { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee08', tenantId, menuItemId: menuItemIds[9]!, inventoryItemId: inventoryIds.mango, qtyRequired: '0.180' },
    ],
  };

  if (dialect === 'mysql') {
    const db = getMySqlDb();
    const existing = await db
      .select()
      .from(mysqlSchema.tenants)
      .where(eq(mysqlSchema.tenants.slug, 'zaika-bistro'))
      .limit(1);

    if (existing.length > 0) {
      console.log('[seed] Zaika Bistro already seeded (MySQL). Skipping.');
      return;
    }

    await db.transaction(async (tx) => {
      await tx.insert(mysqlSchema.tenants).values(seedData.tenant);
      await tx.insert(mysqlSchema.outlets).values(seedData.outlet);
      await tx.insert(mysqlSchema.roles).values(seedData.roles);
      await tx.insert(mysqlSchema.users).values(seedData.users);
      await tx.insert(mysqlSchema.floorZones).values(seedData.zones);
      await tx.insert(mysqlSchema.diningTables).values(seedData.tables);
      await tx.insert(mysqlSchema.kitchenStations).values(seedData.stations);
      await tx.insert(mysqlSchema.menuCategories).values(seedData.categories);
      await tx.insert(mysqlSchema.taxSlabs).values(seedData.taxSlabs);
      await tx.insert(mysqlSchema.menuItems).values(seedData.menuItems);
      await tx.insert(mysqlSchema.itemVariantsModifiers).values(seedData.modifiers);
      await tx.insert(mysqlSchema.upsellRules).values(seedData.upsells);
      await tx.insert(mysqlSchema.inventoryItems).values(seedData.inventory);
      await tx.insert(mysqlSchema.menuItemRecipes).values(seedData.recipes);
    });
  } else {
    await withTenantTx(tenantId, async (ctx) => {
      if (ctx.dialect !== 'postgres') return;
      const existing = await ctx.tx
        .select()
        .from(pgSchema.tenants)
        .where(eq(pgSchema.tenants.slug, 'zaika-bistro'))
        .limit(1);

      if (existing.length > 0) {
        console.log('[seed] Zaika Bistro already seeded (PostgreSQL). Skipping.');
        return;
      }

      await ctx.tx.insert(pgSchema.tenants).values(seedData.tenant);
      await ctx.tx.insert(pgSchema.outlets).values(seedData.outlet);
      await ctx.tx.insert(pgSchema.roles).values(seedData.roles);
      await ctx.tx.insert(pgSchema.users).values(seedData.users);
      await ctx.tx.insert(pgSchema.floorZones).values(seedData.zones);
      await ctx.tx.insert(pgSchema.diningTables).values(seedData.tables);
      await ctx.tx.insert(pgSchema.kitchenStations).values(seedData.stations);
      await ctx.tx.insert(pgSchema.menuCategories).values(seedData.categories);
      await ctx.tx.insert(pgSchema.taxSlabs).values(seedData.taxSlabs);
      await ctx.tx.insert(pgSchema.menuItems).values(seedData.menuItems);
      await ctx.tx.insert(pgSchema.itemVariantsModifiers).values(seedData.modifiers);
      await ctx.tx.insert(pgSchema.upsellRules).values(seedData.upsells);
      await ctx.tx.insert(pgSchema.inventoryItems).values(seedData.inventory);
      await ctx.tx.insert(pgSchema.menuItemRecipes).values(seedData.recipes);
    });
  }

  console.log('[seed] Zaika Bistro seeded successfully!');
  console.log(`[seed] Tenant ID: ${tenantId} | Outlet ID: ${outletId}`);
  console.log('[seed] Staff PINs -> Owner: 1234 | Captain: 2222 | Cashier: 3333 | Chef: 4444');
  console.log(`[seed] Sample Table T1 QR URL: /t/${seedData.tables[0]!.qrToken}`);
}

if (require.main === module) {
  runSeed()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[seed] Failed:', err);
      await closeDb().catch(() => undefined);
      process.exit(1);
    });
}
