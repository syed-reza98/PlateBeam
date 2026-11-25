import { EventEmitter } from 'node:events';
import type {
  RealtimeEnvelope,
  RealtimeEventType,
  RealtimePort,
} from '../../ports/realtime.port';

const globalForSse = globalThis as unknown as {
  __platebeamSseBus?: EventEmitter;
};

function getSseBus(): EventEmitter {
  if (!globalForSse.__platebeamSseBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(500);
    globalForSse.__platebeamSseBus = emitter;
  }
  return globalForSse.__platebeamSseBus;
}

export type RealtimeListener = (envelope: RealtimeEnvelope) => void;

/**
 * Subscribes to a specific realtime channel for `/api/v1/realtime/stream` SSE endpoints.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeRealtimeChannel(
  channel: string,
  listener: RealtimeListener,
): () => void {
  const bus = getSseBus();
  bus.on(channel, listener);
  return () => {
    bus.off(channel, listener);
  };
}

/**
 * Portable in-memory EventEmitter pub-sub adapter for Server-Sent Events (SSE).
 * Works identically across PostgreSQL and MySQL deployments without Supabase Realtime.
 */
export class SseRealtimeAdapter implements RealtimePort {
  private emit(channel: string, envelope: RealtimeEnvelope<unknown>): void {
    getSseBus().emit(channel, envelope);
  }

  async publishToFloor<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void> {
    const channel = `tenant:${tenantId}:outlet:${outletId}:floor`;
    this.emit(channel, {
      event,
      tenantId,
      outletId,
      channel,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  async publishToStation<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    stationId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void> {
    const channel = `tenant:${tenantId}:outlet:${outletId}:station:${stationId}`;
    this.emit(channel, {
      event,
      tenantId,
      outletId,
      channel,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  async publishToTableSession<TPayload = Record<string, unknown>>(
    tenantId: string,
    sessionId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void> {
    const channel = `tenant:${tenantId}:session:${sessionId}`;
    this.emit(channel, {
      event,
      tenantId,
      channel,
      timestamp: new Date().toISOString(),
      payload,
    });
  }

  async publishToMenu<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void> {
    const channel = `tenant:${tenantId}:outlet:${outletId}:menu`;
    this.emit(channel, {
      event,
      tenantId,
      outletId,
      channel,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
