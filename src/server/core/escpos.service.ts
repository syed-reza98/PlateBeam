import type { TaxBreakdownItem } from '../db/types';
import type { KotPrintItem } from '../ports/print.port';

/**
 * Driverless ESC/POS byte-buffer generator for 58mm (32 cols) and 80mm (48 cols)
 * thermal printers + RJ11 cash drawer kick pulse (FR-016).
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD_INIT = [ESC, 0x40]; // ESC @
const CMD_ALIGN_LEFT = [ESC, 0x61, 0x00];
const CMD_ALIGN_CENTER = [ESC, 0x61, 0x01];
const CMD_BOLD_ON = [ESC, 0x45, 0x01];
const CMD_BOLD_OFF = [ESC, 0x45, 0x00];
const CMD_SIZE_NORMAL = [GS, 0x21, 0x00];
const CMD_SIZE_DOUBLE = [GS, 0x21, 0x11]; // 2x width & height
const CMD_CUT_PARTIAL = [GS, 0x56, 0x42, 0x00]; // GS V 66 0
/** ESC p m t1 t2 — Pin 2 RJ11 cash drawer kick pulse (t1=25*2ms=50ms, t2=250*2ms=500ms) */
const CMD_CASH_DRAWER_KICK = [ESC, 0x70, 0x00, 0x19, 0xfa];

export function getPaperColumns(paperWidthMm: 58 | 80): number {
  return paperWidthMm === 58 ? 32 : 48;
}

function encodeAsciiLine(text: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
  }
  bytes.push(LF);
  return bytes;
}

function formatTwoColumnLine(left: string, right: string, cols: number): string {
  const maxLeft = Math.max(1, cols - right.length - 1);
  const clippedLeft = left.length > maxLeft ? left.slice(0, maxLeft) : left;
  const spaces = Math.max(1, cols - clippedLeft.length - right.length);
  return `${clippedLeft}${' '.repeat(spaces)}${right}`;
}

function divider(cols: number, char = '-'): string {
  return char.repeat(cols);
}

export function formatMinorCurrency(amountMinor: number, currencyCode = 'BDT'): string {
  const major = (amountMinor / 100).toFixed(2);
  return `${currencyCode} ${major}`;
}

export function buildCashDrawerKickBuffer(): Uint8Array {
  return Uint8Array.from([...CMD_INIT, ...CMD_CASH_DRAWER_KICK]);
}

export function buildKotEscPosBuffer(input: {
  paperWidthMm: 58 | 80;
  headerTitle: string;
  stationName?: string;
  orderNumber: string;
  roundNumber?: number;
  tableNumber?: string | null;
  tokenNumber?: number | null;
  items: KotPrintItem[];
  createdAt?: Date;
}): Uint8Array {
  const cols = getPaperColumns(input.paperWidthMm);
  const bytes: number[] = [];

  bytes.push(...CMD_INIT);
  bytes.push(...CMD_ALIGN_CENTER, ...CMD_BOLD_ON, ...CMD_SIZE_DOUBLE);
  bytes.push(...encodeAsciiLine(input.headerTitle));
  bytes.push(...CMD_SIZE_NORMAL, ...CMD_BOLD_OFF);

  if (input.stationName) {
    bytes.push(...CMD_BOLD_ON);
    bytes.push(...encodeAsciiLine(`STATION: ${input.stationName.toUpperCase()}`));
    bytes.push(...CMD_BOLD_OFF);
  }

  bytes.push(...CMD_ALIGN_LEFT);
  bytes.push(...encodeAsciiLine(divider(cols, '=')));

  const targetLabel = input.tableNumber
    ? `TABLE: ${input.tableNumber}`
    : input.tokenNumber != null
      ? `TOKEN: #${input.tokenNumber}`
      : 'TAKEAWAY';

  bytes.push(...CMD_BOLD_ON);
  bytes.push(
    ...encodeAsciiLine(
      formatTwoColumnLine(targetLabel, `ORD ${input.orderNumber}`, cols),
    ),
  );
  bytes.push(...CMD_BOLD_OFF);

  const timeStr = (input.createdAt ?? new Date()).toISOString().slice(11, 16);
  bytes.push(
    ...encodeAsciiLine(
      formatTwoColumnLine(
        `ROUND ${input.roundNumber ?? 1}`,
        `TIME ${timeStr}`,
        cols,
      ),
    ),
  );
  bytes.push(...encodeAsciiLine(divider(cols)));

  for (const item of input.items) {
    bytes.push(...CMD_BOLD_ON);
    bytes.push(...encodeAsciiLine(`${item.quantity}x ${item.name}`));
    bytes.push(...CMD_BOLD_OFF);

    if (item.modifiers && item.modifiers.length > 0) {
      bytes.push(...encodeAsciiLine(`   + ${item.modifiers.join(', ')}`));
    }
    if (item.spiceLevel) {
      bytes.push(...encodeAsciiLine(`   Spice: ${item.spiceLevel}`));
    }
    if (item.notes) {
      bytes.push(...encodeAsciiLine(`   Note: ${item.notes}`));
    }
  }

  bytes.push(...encodeAsciiLine(divider(cols, '=')));
  bytes.push(LF, LF, LF);
  bytes.push(...CMD_CUT_PARTIAL);

  return Uint8Array.from(bytes);
}

export function buildBillEscPosBuffer(input: {
  paperWidthMm: 58 | 80;
  outletName: string;
  taxRegNo?: string | null;
  invoiceNumber: string;
  tableNumber?: string | null;
  tokenNumber?: number | null;
  items: Array<{ name: string; quantity: number; lineTotalMinor: number }>;
  subtotalMinor: number;
  taxBreakdown: TaxBreakdownItem[];
  serviceChargeMinor?: number;
  discountMinor?: number;
  tipMinor?: number;
  totalMinor: number;
  currencyCode: string;
  openCashDrawer?: boolean;
  footerNote?: string;
}): Uint8Array {
  const cols = getPaperColumns(input.paperWidthMm);
  const bytes: number[] = [];

  bytes.push(...CMD_INIT);
  if (input.openCashDrawer) {
    bytes.push(...CMD_CASH_DRAWER_KICK);
  }

  bytes.push(...CMD_ALIGN_CENTER, ...CMD_BOLD_ON);
  bytes.push(...encodeAsciiLine(input.outletName));
  bytes.push(...CMD_BOLD_OFF);

  if (input.taxRegNo) {
    bytes.push(...encodeAsciiLine(`TAX ID: ${input.taxRegNo}`));
  }
  bytes.push(...encodeAsciiLine(`INV: ${input.invoiceNumber}`));
  bytes.push(...CMD_ALIGN_LEFT);
  bytes.push(...encodeAsciiLine(divider(cols)));

  if (input.tableNumber) {
    bytes.push(...encodeAsciiLine(`Table: ${input.tableNumber}`));
  } else if (input.tokenNumber != null) {
    bytes.push(...encodeAsciiLine(`Token: #${input.tokenNumber}`));
  }

  for (const item of input.items) {
    const left = `${item.quantity}x ${item.name}`;
    const right = formatMinorCurrency(item.lineTotalMinor, input.currencyCode);
    bytes.push(...encodeAsciiLine(formatTwoColumnLine(left, right, cols)));
  }

  bytes.push(...encodeAsciiLine(divider(cols)));
  bytes.push(
    ...encodeAsciiLine(
      formatTwoColumnLine(
        'Subtotal',
        formatMinorCurrency(input.subtotalMinor, input.currencyCode),
        cols,
      ),
    ),
  );

  if (input.discountMinor && input.discountMinor > 0) {
    bytes.push(
      ...encodeAsciiLine(
        formatTwoColumnLine(
          'Discount',
          `-${formatMinorCurrency(input.discountMinor, input.currencyCode)}`,
          cols,
        ),
      ),
    );
  }

  for (const tax of input.taxBreakdown) {
    bytes.push(
      ...encodeAsciiLine(
        formatTwoColumnLine(
          `${tax.name} (${(tax.rateBps / 100).toFixed(2)}%)`,
          formatMinorCurrency(tax.taxMinor, input.currencyCode),
          cols,
        ),
      ),
    );
  }

  if (input.serviceChargeMinor && input.serviceChargeMinor > 0) {
    bytes.push(
      ...encodeAsciiLine(
        formatTwoColumnLine(
          'Service Charge',
          formatMinorCurrency(input.serviceChargeMinor, input.currencyCode),
          cols,
        ),
      ),
    );
  }

  if (input.tipMinor && input.tipMinor > 0) {
    bytes.push(
      ...encodeAsciiLine(
        formatTwoColumnLine(
          'Tip',
          formatMinorCurrency(input.tipMinor, input.currencyCode),
          cols,
        ),
      ),
    );
  }

  bytes.push(...encodeAsciiLine(divider(cols, '=')));
  bytes.push(...CMD_BOLD_ON);
  bytes.push(
    ...encodeAsciiLine(
      formatTwoColumnLine(
        'TOTAL',
        formatMinorCurrency(input.totalMinor, input.currencyCode),
        cols,
      ),
    ),
  );
  bytes.push(...CMD_BOLD_OFF);
  bytes.push(...encodeAsciiLine(divider(cols, '=')));

  bytes.push(...CMD_ALIGN_CENTER);
  bytes.push(...encodeAsciiLine(input.footerNote ?? 'Thank you for dining with us!'));
  bytes.push(LF, LF, LF);
  bytes.push(...CMD_CUT_PARTIAL);

  return Uint8Array.from(bytes);
}

export function escPosBufferToBase64(buffer: Uint8Array): string {
  return Buffer.from(buffer).toString('base64');
}

function centerText(text: string, cols: number): string {
  if (text.length >= cols) return text.slice(0, cols);
  const pad = Math.floor((cols - text.length) / 2);
  return `${' '.repeat(pad)}${text}`;
}

function formatPreviewCurrency(amountMinor: number, currencyCode = 'BDT'): string {
  const major = (amountMinor / 100).toFixed(2);
  return currencyCode === 'BDT' ? `৳${major}` : `${currencyCode} ${major}`;
}

export type KotPreviewInput = {
  paperWidthMm?: 58 | 80;
  headerTitle: string;
  stationName?: string;
  orderNumber: string;
  roundNumber?: number;
  tableNumber?: string | null;
  tokenNumber?: number | null;
  items: KotPrintItem[];
  createdAt?: Date;
};

/**
 * Formats an 80mm/58mm thermal KOT preview as plain-text lines for KDS modals.
 */
export function formatKotPreviewLines(input: KotPreviewInput): string[] {
  const cols = getPaperColumns(input.paperWidthMm ?? 80);
  const lines: string[] = [];

  lines.push(centerText(input.headerTitle, cols));
  if (input.stationName) {
    lines.push(centerText(`STATION: ${input.stationName.toUpperCase()}`, cols));
  }
  lines.push(divider(cols, '='));

  const targetLabel = input.tableNumber
    ? `TABLE: ${input.tableNumber}`
    : input.tokenNumber != null
      ? `TOKEN: #${input.tokenNumber}`
      : 'TAKEAWAY';

  lines.push(formatTwoColumnLine(targetLabel, `ORD ${input.orderNumber}`, cols));
  const timeStr = (input.createdAt ?? new Date()).toISOString().slice(11, 16);
  lines.push(
    formatTwoColumnLine(`ROUND ${input.roundNumber ?? 1}`, `TIME ${timeStr}`, cols),
  );
  lines.push(divider(cols));

  for (const item of input.items) {
    lines.push(`${item.quantity}x ${item.name}`);
    if (item.modifiers && item.modifiers.length > 0) {
      lines.push(`   + ${item.modifiers.join(', ')}`);
    }
    if (item.spiceLevel) {
      lines.push(`   Spice: ${item.spiceLevel}`);
    }
    if (item.notes) {
      lines.push(`   Note: ${item.notes}`);
    }
  }

  lines.push(divider(cols, '='));
  return lines;
}

export type BillPreviewInput = {
  paperWidthMm?: 58 | 80;
  outletName: string;
  taxRegNo?: string | null;
  invoiceNumber: string;
  tableNumber?: string | null;
  tokenNumber?: number | null;
  items: Array<{ name: string; quantity: number; lineTotalMinor: number }>;
  subtotalMinor: number;
  taxBreakdown: TaxBreakdownItem[];
  serviceChargeMinor?: number;
  discountMinor?: number;
  tipMinor?: number;
  totalMinor: number;
  currencyCode?: string;
  footerNote?: string;
};

/**
 * Formats an 80mm/58mm thermal bill receipt preview as plain-text lines for POS/Guest modals.
 */
export function formatBillPreviewLines(input: BillPreviewInput): string[] {
  const cols = getPaperColumns(input.paperWidthMm ?? 80);
  const currency = input.currencyCode ?? 'BDT';
  const lines: string[] = [];

  lines.push(centerText(input.outletName, cols));
  if (input.taxRegNo) {
    lines.push(centerText(`TAX ID: ${input.taxRegNo}`, cols));
  }
  lines.push(centerText(`INV: ${input.invoiceNumber}`, cols));
  lines.push(divider(cols));

  if (input.tableNumber) {
    lines.push(`Table: ${input.tableNumber}`);
  } else if (input.tokenNumber != null) {
    lines.push(`Token: #${input.tokenNumber}`);
  }

  for (const item of input.items) {
    lines.push(
      formatTwoColumnLine(
        `${item.quantity}x ${item.name}`,
        formatPreviewCurrency(item.lineTotalMinor, currency),
        cols,
      ),
    );
  }

  lines.push(divider(cols));
  lines.push(
    formatTwoColumnLine(
      'Subtotal',
      formatPreviewCurrency(input.subtotalMinor, currency),
      cols,
    ),
  );

  if (input.discountMinor && input.discountMinor > 0) {
    lines.push(
      formatTwoColumnLine(
        'Discount',
        `-${formatPreviewCurrency(input.discountMinor, currency)}`,
        cols,
      ),
    );
  }

  for (const tax of input.taxBreakdown) {
    lines.push(
      formatTwoColumnLine(
        `${tax.name} (${(tax.rateBps / 100).toFixed(2)}%)`,
        formatPreviewCurrency(tax.taxMinor, currency),
        cols,
      ),
    );
  }

  if (input.serviceChargeMinor && input.serviceChargeMinor > 0) {
    lines.push(
      formatTwoColumnLine(
        'Service Charge',
        formatPreviewCurrency(input.serviceChargeMinor, currency),
        cols,
      ),
    );
  }

  if (input.tipMinor && input.tipMinor > 0) {
    lines.push(
      formatTwoColumnLine(
        'Tip',
        formatPreviewCurrency(input.tipMinor, currency),
        cols,
      ),
    );
  }

  lines.push(divider(cols, '='));
  lines.push(
    formatTwoColumnLine('TOTAL', formatPreviewCurrency(input.totalMinor, currency), cols),
  );
  lines.push(divider(cols, '='));
  lines.push(centerText(input.footerNote ?? 'Thank you for dining with us!', cols));

  return lines;
}
