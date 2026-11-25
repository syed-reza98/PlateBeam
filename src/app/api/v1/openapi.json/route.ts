import { NextResponse } from 'next/server';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'PlateBeam Hospitality & QR Ordering API',
    version: '1.0.0',
    description:
      'Multi-tenant Restaurant Management, QR Ordering, KDS, Split-Bill, and Analytics REST API (PostgreSQL & MySQL portable).',
  },
  servers: [{ url: '/api/v1', description: 'PlateBeam API v1' }],
  paths: {
    '/health': {
      get: { summary: 'System health, DB dialect, and adapter diagnostics' },
    },
    '/openapi.json': {
      get: { summary: 'OpenAPI 3.1 specification' },
    },
    '/public/qr/{qrToken}/bootstrap': {
      get: {
        summary: 'Verify signed QR token, enforce security policy, and bootstrap guest menu + session',
        parameters: [{ name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/sessions/{sessionId}/cart': {
      post: { summary: 'Sync collaborative table cart and broadcast via RealtimePort' },
    },
    '/sessions/{sessionId}/orders': {
      get: { summary: 'List orders and items for a dining session' },
      post: { summary: 'Place a new order round (QR, WAITER, or COUNTER)' },
    },
    '/sessions/{sessionId}/service-requests': {
      post: { summary: 'Create a Call Waiter / Water / Bill service request' },
    },
    '/service-requests/{id}/claim': {
      patch: { summary: 'Claim, resolve, or cancel a service request' },
    },
    '/sessions/{sessionId}/split-bill/calculate': {
      post: { summary: 'Calculate equal, by-item, or custom split-bill shares with Hamilton minor-unit rounding' },
    },
    '/sessions/{sessionId}/payments/initiate': {
      post: { summary: 'Initiate idempotent payment via SSLCommerz, Stripe, Razorpay, Cash/EDC, or Sandbox' },
    },
    '/webhooks/payments/{provider}': {
      post: { summary: 'Verify and reconcile payment gateway IPN/webhook callbacks' },
    },
    '/invoices/{invoiceId}/receipt': {
      get: { summary: 'Render statutory HTML/print receipt for an invoice' },
    },
    '/sessions/{sessionId}/reviews': {
      post: { summary: 'Submit post-meal rating & review (triggers manager alert for <=2 stars)' },
    },
    '/sessions/{sessionId}/games': {
      post: { summary: 'Submit mini-game score and retrieve session leaderboard' },
    },
    '/kds/order-items/{itemId}/status': {
      patch: { summary: 'Transition KDS item status (PENDING -> ACCEPTED -> PREPARING -> READY -> SERVED / CANCELLED)' },
    },
    '/kds/tickets/{orderId}/recall': {
      post: { summary: 'Recall bumped KDS ticket back to READY' },
    },
    '/print-bridge/jobs': {
      get: { summary: 'Fetch pending ESC/POS thermal print jobs for local bridge daemon' },
      post: { summary: 'Acknowledge printed ESC/POS job' },
    },
    '/floor/tables/{tableId}/operations': {
      post: { summary: 'Floor operations: MERGE, TRANSFER, SPLIT, RESET, ROTATE_QR, MOVE, APPROVE_ORDER, COUNTER_TOKEN' },
    },
    '/sync/delta': {
      post: { summary: 'Idempotent offline FOH/KDS queue reconciliation' },
    },
    '/realtime/stream': {
      get: { summary: 'Server-Sent Events (SSE) stream for portable RealtimePort' },
    },
    '/analytics/outlets/{outletId}/live': {
      get: { summary: 'Live KPIs, menu engineering matrix, and outlet dashboard snapshot' },
    },
    '/analytics/outlets/{outletId}/reports': {
      get: { summary: 'JSON or CSV sales/tax/menu export report' },
    },
    '/analytics/outlets/{outletId}/shifts': {
      get: { summary: 'List shift registers' },
      post: { summary: 'Open or close shift register with Z-Report reconciliation' },
    },
    '/auth/pin': {
      post: { summary: 'Verify staff 4/6-digit POS PIN and switch active operator' },
    },
    '/auth/session': {
      get: { summary: 'Get current authenticated staff session claims' },
      post: { summary: 'Email/password staff sign-in' },
      delete: { summary: 'Sign out staff session' },
    },
    '/admin/menu': {
      get: { summary: 'List menu catalog' },
      post: { summary: 'Create or update menu item' },
    },
    '/admin/inventory': {
      get: { summary: 'List inventory items & BOM recipes' },
      post: { summary: 'Restock or adjust inventory item' },
    },
    '/admin/staff': {
      get: { summary: 'List staff, roles, and permission overrides' },
      post: { summary: 'Create staff or update permission override' },
    },
    '/admin/tax-slabs': {
      get: { summary: 'List tax slabs' },
    },
    '/admin/upsells': {
      get: { summary: 'List upsell rules' },
    },
    '/admin/outlets': {
      get: { summary: 'List outlets' },
      patch: { summary: 'Update outlet QR security policy' },
    },
    '/admin/tenants': {
      get: { summary: 'List all tenants (Super Admin)' },
      post: { summary: 'Provision new tenant + flagship outlet' },
    },
    '/admin/audit-logs': {
      get: { summary: 'List immutable audit logs' },
    },
  },
};

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, { status: 200 });
}
