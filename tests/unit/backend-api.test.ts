import { describe, expect, it } from 'vitest';
import { computeHourlyRevenueBuckets } from '../../src/server/core/analytics.service';
import {
  formatBillPreviewLines,
  formatKotPreviewLines,
} from '../../src/server/core/escpos.service';
import type { OrderRecord, PaymentRecord } from '../../src/server/ports/repositories.port';

describe('Hourly Revenue Buckets', () => {
  it('aggregates non-cancelled orders and captured payments into 24 hourly buckets', () => {
    const now = new Date('2026-11-28T14:30:00');
    const orders = [
      {
        id: 'o1',
        status: 'CONFIRMED',
        createdAt: new Date('2026-11-28T14:10:00'),
      },
      {
        id: 'o2',
        status: 'CANCELLED',
        createdAt: new Date('2026-11-28T14:15:00'),
      },
      {
        id: 'o3',
        status: 'SERVED',
        createdAt: new Date('2026-11-28T12:05:00'),
      },
    ] as unknown as OrderRecord[];

    const payments = [
      {
        id: 'p1',
        status: 'CAPTURED',
        amountMinor: 50000,
        paidAt: new Date('2026-11-28T14:20:00'),
      },
      {
        id: 'p2',
        status: 'PENDING',
        amountMinor: 25000,
        paidAt: new Date('2026-11-28T14:25:00'),
      },
    ] as unknown as PaymentRecord[];

    const buckets = computeHourlyRevenueBuckets(orders, payments, now);
    expect(buckets).toHaveLength(24);
    expect(buckets[14]).toEqual({
      hour: 14,
      hourLabel: '14:00',
      amountMinor: 50000,
      orderCount: 1,
      isCurrentHour: true,
    });
    expect(buckets[12]).toEqual({
      hour: 12,
      hourLabel: '12:00',
      amountMinor: 0,
      orderCount: 1,
      isCurrentHour: false,
    });
  });
});

describe('Thermal 80mm Preview Formatters', () => {
  it('formats KOT preview lines with station, table, order number, and items', () => {
    const lines = formatKotPreviewLines({
      paperWidthMm: 80,
      headerTitle: 'Zaika Bistro',
      stationName: 'Tandoor',
      orderNumber: 'ORD-1042',
      tableNumber: 'T-04',
      items: [
        {
          name: 'Butter Chicken',
          quantity: 2,
          modifiers: ['Extra Garlic'],
          spiceLevel: 'MEDIUM',
          notes: 'Less oil',
        },
      ],
      createdAt: new Date('2026-11-28T14:00:00Z'),
    });

    const text = lines.join('\n');
    expect(text).toContain('Zaika Bistro');
    expect(text).toContain('STATION: TANDOOR');
    expect(text).toContain('TABLE: T-04');
    expect(text).toContain('ORD ORD-1042');
    expect(text).toContain('2x Butter Chicken');
    expect(text).toContain('+ Extra Garlic');
    expect(text).toContain('Spice: MEDIUM');
    expect(text).toContain('Note: Less oil');
  });

  it('formats Bill preview lines in BDT ৳ currency', () => {
    const lines = formatBillPreviewLines({
      paperWidthMm: 80,
      outletName: 'Zaika Bistro',
      invoiceNumber: 'INV-001',
      tableNumber: 'T-04',
      items: [{ name: 'Kacchi Biryani', quantity: 1, lineTotalMinor: 45000 }],
      subtotalMinor: 45000,
      discountMinor: 10000,
      taxBreakdown: [{ name: 'VAT', rateBps: 500, taxableMinor: 35000, taxMinor: 1750 }],
      totalMinor: 36750,
      currencyCode: 'BDT',
    });

    const text = lines.join('\n');
    expect(text).toContain('INV: INV-001');
    expect(text).toContain('1x Kacchi Biryani');
    expect(text).toContain('৳450.00');
    expect(text).toContain('-৳100.00');
    expect(text).toContain('TOTAL');
    expect(text).toContain('৳367.50');
  });
});
