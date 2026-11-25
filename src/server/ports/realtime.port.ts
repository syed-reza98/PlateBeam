/**
 * Hexagonal RealtimePort contract.
 * Implemented by SupabaseRealtimeAdapter (Broadcast) or SseRealtimeAdapter (portable EventBus + SSE).
 */

export type RealtimeEventType =
  | 'order.created'
  | 'order.approved'
  | 'kds.updated'
  | 'table.updated'
  | 'waiter.called'
  | 'waiter.claimed'
  | 'cart.synced'
  | 'game.tick'
  | 'menu.updated'
  | 'payment.settled';

export interface RealtimeEnvelope<TPayload = Record<string, unknown>> {
  event: RealtimeEventType;
  tenantId: string;
  outletId?: string;
  channel: string;
  timestamp: string;
  payload: TPayload;
}

export interface RealtimePort {
  publishToFloor<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void>;

  publishToStation<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    stationId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void>;

  publishToTableSession<TPayload = Record<string, unknown>>(
    tenantId: string,
    sessionId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void>;

  publishToMenu<TPayload = Record<string, unknown>>(
    tenantId: string,
    outletId: string,
    event: RealtimeEventType,
    payload: TPayload,
  ): Promise<void>;
}
