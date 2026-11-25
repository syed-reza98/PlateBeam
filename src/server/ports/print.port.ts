/**
 * Hexagonal PrintPort contract for ESC/POS thermal KOT & Bill printing.
 */

export type PrintJobType = 'KOT' | 'BILL' | 'TEST' | 'CASH_DRAWER_KICK';

export interface KotPrintItem {
  name: string;
  quantity: number;
  modifiers?: string[];
  spiceLevel?: string | null;
  notes?: string | null;
}

export interface PrintJobPayload {
  jobId: string;
  tenantId: string;
  outletId: string;
  stationId?: string;
  jobType: PrintJobType;
  paperWidthMm: 58 | 80;
  openCashDrawer?: boolean;
  headerTitle: string;
  tableNumber?: string | null;
  tokenNumber?: number | null;
  orderNumber?: string;
  roundNumber?: number;
  items?: KotPrintItem[];
  totalFormatted?: string;
  footerNote?: string;
  escPosBase64: string;
  createdAt: string;
}

export interface PrintPort {
  enqueuePrintJob(job: Omit<PrintJobPayload, 'jobId' | 'createdAt'>): Promise<PrintJobPayload>;

  listPendingJobs(input: {
    tenantId: string;
    outletId: string;
    stationId?: string;
  }): Promise<PrintJobPayload[]>;

  acknowledgeJob(input: {
    tenantId: string;
    jobId: string;
  }): Promise<void>;
}
