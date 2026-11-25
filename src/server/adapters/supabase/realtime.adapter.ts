import type {
  RealtimeEnvelope,
  RealtimeEventType,
  RealtimePort,
} from '../../ports/realtime.port';

/**
 * Supabase Realtime Broadcast adapter using the HTTP Broadcast REST endpoint.
 * Avoids opening a persistent WebSocket per serverless invocation.
 */
export class SupabaseRealtimeAdapter implements RealtimePort {
  private getConfig() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey =
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secretKey) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required for SupabaseRealtimeAdapter',
      );
    }
    return { url: url.replace(/\/+$/, ''), secretKey };
  }

  private async broadcast<TPayload>(
    channel: string,
    envelope: RealtimeEnvelope<TPayload>,
  ): Promise<void> {
    const { url, secretKey } = this.getConfig();
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: channel,
            event: envelope.event,
            payload: envelope,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Supabase realtime broadcast failed (${res.status}): ${body}`,
      );
    }
  }

  async publishToFloor<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void> {
    const channel = `tenant:${tenantId}:outlet:${outletId}:floor`;
    await this.broadcast(channel, {
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
    await this.broadcast(channel, {
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
    await this.broadcast(channel, {
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
    await this.broadcast(channel, {
      event,
      tenantId,
      outletId,
      channel,
      timestamp: new Date().toISOString(),
      payload,
    });
  }
}
