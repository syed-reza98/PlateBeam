import { subscribeRealtimeChannel } from '@/server/adapters/portable/sse-realtime.adapter';
import { resolveTenantAndOutlet } from '@/server/api/http';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const outletIdParam = url.searchParams.get('outletId') ?? undefined;
  const sessionId = url.searchParams.get('sessionId') ?? undefined;
  const stationId = url.searchParams.get('stationId') ?? undefined;
  let tenantId = url.searchParams.get('tenantId') ?? undefined;
  let outletId = outletIdParam;

  if (!tenantId || !outletId || outletId === 'default') {
    try {
      const resolved = await resolveTenantAndOutlet(outletIdParam, tenantId);
      tenantId = resolved.tenant.id;
      outletId = resolved.outlet.id;
    } catch {
      return new Response('Tenant/outlet not found', { status: 404 });
    }
  }

  const channels: string[] = [
    `tenant:${tenantId}:outlet:${outletId}:floor`,
    `tenant:${tenantId}:outlet:${outletId}:menu`,
  ];
  if (sessionId) {
    channels.push(`tenant:${tenantId}:session:${sessionId}`);
  }
  if (stationId) {
    channels.push(`tenant:${tenantId}:outlet:${outletId}:station:${stationId}`);
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendEvent = (eventName: string, data: unknown) => {
        if (closed) return;
        try {
          const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      sendEvent('connected', { tenantId, outletId, channels, timestamp: new Date().toISOString() });

      const unsubs = channels.map((ch) =>
        subscribeRealtimeChannel(ch, (envelope) => {
          sendEvent(envelope.event, envelope.payload);
        }),
      );

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
        } catch {
          closed = true;
        }
      }, 20000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        for (const unsub of unsubs) unsub();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener('abort', cleanup, { once: true });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
