import type { PrintJobPayload, PrintPort } from '../../ports/print.port';

const globalForPrint = globalThis as unknown as {
  __platebeamPrintQueue?: Map<string, PrintJobPayload>;
};

function getPrintStore(): Map<string, PrintJobPayload> {
  if (!globalForPrint.__platebeamPrintQueue) {
    globalForPrint.__platebeamPrintQueue = new Map();
  }
  return globalForPrint.__platebeamPrintQueue;
}

/**
 * In-process PrintPort queue for ESC/POS thermal KOT & Bill jobs.
 * Local print agents poll `listPendingJobs` and call `acknowledgeJob` after printing.
 */
export class InMemoryPrintAdapter implements PrintPort {
  async enqueuePrintJob(
    job: Omit<PrintJobPayload, 'jobId' | 'createdAt'>,
  ): Promise<PrintJobPayload> {
    const fullJob: PrintJobPayload = {
      ...job,
      jobId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    getPrintStore().set(fullJob.jobId, fullJob);
    return fullJob;
  }

  async listPendingJobs(input: {
    tenantId: string;
    outletId: string;
    stationId?: string;
  }): Promise<PrintJobPayload[]> {
    const jobs: PrintJobPayload[] = [];
    for (const job of getPrintStore().values()) {
      if (job.tenantId !== input.tenantId || job.outletId !== input.outletId) {
        continue;
      }
      if (input.stationId && job.stationId && job.stationId !== input.stationId) {
        continue;
      }
      jobs.push(job);
    }
    return jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async acknowledgeJob(input: {
    tenantId: string;
    jobId: string;
  }): Promise<void> {
    const store = getPrintStore();
    const existing = store.get(input.jobId);
    if (existing && existing.tenantId === input.tenantId) {
      store.delete(input.jobId);
    }
  }
}
