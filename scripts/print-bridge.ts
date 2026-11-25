/**
 * Standalone PlateBeam ESC/POS Print Bridge Daemon.
 * Polls `/api/v1/print-bridge/jobs` for pending KOT, Bill, Test, and Cash Drawer Kick jobs,
 * dispatches raw ESC/POS bytes to a LAN thermal printer (TCP port 9100) or dry-run stdout,
 * and acknowledges printed jobs.
 *
 * Usage:
 *   API_BASE_URL=http://localhost:3000 TENANT_ID=... OUTLET_ID=... npx tsx scripts/print-bridge.ts
 */

import net from 'node:net';
import type { PrintJobPayload } from '../src/server/ports/print.port';

const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const TENANT_ID = process.env.TENANT_ID ?? '';
const OUTLET_ID = process.env.OUTLET_ID ?? '';
const STATION_ID = process.env.STATION_ID ?? '';
const PRINT_BRIDGE_TOKEN = process.env.PRINT_BRIDGE_TOKEN ?? '';
const PRINTER_HOST = process.env.PRINTER_HOST ?? '';
const PRINTER_PORT = Number(process.env.PRINTER_PORT ?? '9100');
const POLL_INTERVAL_MS = Math.max(1000, Number(process.env.POLL_INTERVAL_MS ?? '2500'));
const DRY_RUN = process.env.DRY_RUN === '1' || !PRINTER_HOST;

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (PRINT_BRIDGE_TOKEN) {
    headers.Authorization = `Bearer ${PRINT_BRIDGE_TOKEN}`;
  }
  return headers;
}

function sendToLanPrinter(host: string, port: number, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(5000);

    socket.on('timeout', () => {
      socket.destroy(new Error(`Printer connection timeout (${host}:${port})`));
    });

    socket.on('error', (err) => {
      reject(err);
    });

    socket.connect(port, host, () => {
      socket.write(buffer, (writeErr) => {
        if (writeErr) {
          socket.destroy(writeErr);
          reject(writeErr);
          return;
        }
        socket.end();
        resolve();
      });
    });
  });
}

async function fetchPendingJobs(): Promise<PrintJobPayload[]> {
  const params = new URLSearchParams();
  if (TENANT_ID) params.set('tenantId', TENANT_ID);
  if (OUTLET_ID) params.set('outletId', OUTLET_ID);
  if (STATION_ID) params.set('stationId', STATION_ID);

  const url = `${API_BASE_URL}/api/v1/print-bridge/jobs?${params.toString()}`;
  const res = await fetch(url, { headers: buildHeaders() });
  if (!res.ok) {
    throw new Error(`Poll failed with HTTP ${res.status}`);
  }
  const body = (await res.json()) as { jobs?: PrintJobPayload[] } | PrintJobPayload[];
  return Array.isArray(body) ? body : (body.jobs ?? []);
}

async function acknowledgeJob(jobId: string): Promise<void> {
  const url = `${API_BASE_URL}/api/v1/print-bridge/jobs`;
  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      tenantId: TENANT_ID,
      jobId,
      action: 'ACK',
    }),
  });
  if (!res.ok) {
    throw new Error(`Ack failed for ${jobId} with HTTP ${res.status}`);
  }
}

async function processJob(job: PrintJobPayload): Promise<void> {
  const rawBuffer = Buffer.from(job.escPosBase64, 'base64');

  if (DRY_RUN) {
    console.info(
      `[print-bridge:dry-run] job=${job.jobId} type=${job.jobType} width=${job.paperWidthMm}mm bytes=${rawBuffer.byteLength} title="${job.headerTitle}"`,
    );
  } else {
    await sendToLanPrinter(PRINTER_HOST, PRINTER_PORT, rawBuffer);
    console.info(
      `[print-bridge:printed] job=${job.jobId} -> ${PRINTER_HOST}:${PRINTER_PORT} (${rawBuffer.byteLength} bytes)`,
    );
  }

  await acknowledgeJob(job.jobId);
}

async function runLoop(): Promise<void> {
  console.info(
    `[print-bridge] Started polling ${API_BASE_URL}/api/v1/print-bridge/jobs every ${POLL_INTERVAL_MS}ms (${DRY_RUN ? 'DRY_RUN' : `${PRINTER_HOST}:${PRINTER_PORT}`})`,
  );

  let stopping = false;
  const handleStop = () => {
    stopping = true;
    console.info('[print-bridge] Shutting down...');
  };
  process.on('SIGINT', handleStop);
  process.on('SIGTERM', handleStop);

  while (!stopping) {
    try {
      const jobs = await fetchPendingJobs();
      for (const job of jobs) {
        if (stopping) break;
        await processJob(job);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[print-bridge:error] ${message}`);
    }

    if (!stopping) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

void runLoop();
