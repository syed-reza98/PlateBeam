'use client';

import { useState } from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import type { ServiceRequestType } from '@/server/db/types';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
import { SERVICE_REQUEST_TAGS } from './types';

interface CallWaiterDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  tableId: string | null;
}

export function CallWaiterDialog({
  open,
  onClose,
  sessionId,
  tableId,
}: CallWaiterDialogProps) {
  const [selectedType, setSelectedType] = useState<ServiceRequestType>('WATER');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId) {
      showToast({
        title: 'Counter / Takeaway session',
        description: 'Table service requests are available for dine-in tables.',
        variant: 'info',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableId,
          requestType: selectedType,
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        showToast({
          title: 'Request could not be sent',
          description: data.error ?? 'Please wait a moment before requesting again.',
          variant: 'warning',
        });
        return;
      }

      const label =
        SERVICE_REQUEST_TAGS.find((t) => t.type === selectedType)?.label ?? selectedType;
      showToast({
        title: `${label} requested`,
        description: 'Your server has been alerted.',
        variant: 'success',
      });
      setNote('');
      onClose();
    } catch {
      showToast({
        title: 'Network error',
        description: 'Unable to reach your server right now.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Call Waiter"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-zinc-500">
          Tap a quick request below to alert your table&apos;s server immediately.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {SERVICE_REQUEST_TAGS.map((tag) => {
            const active = selectedType === tag.type;
            return (
              <button
                key={tag.type}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedType(tag.type)}
                className={`flex min-h-[56px] flex-col items-start justify-center rounded-2xl border px-3.5 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-[#FF5412] bg-[#FF5412]/10 text-zinc-900'
                    : 'border-zinc-200 bg-[#FAF7F2] text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <span className="flex w-full items-center justify-between text-xs font-bold">
                  {tag.label}
                  {active && (
                    <CheckCircle2
                      className="size-4 text-[#FF5412]"
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
                  {tag.description}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="waiter-note"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-500"
          >
            Short Note (Optional)
          </label>
          <input
            id="waiter-note"
            type="text"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., 2 extra glasses, baby high-chair..."
            className="min-h-[44px] w-full rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-[#FF5412]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="animate-halo inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-4 py-3 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033] disabled:opacity-60"
        >
          <BellRing className="size-4" aria-hidden="true" />
          {submitting ? 'Alerting Server...' : 'Send Request'}
        </button>
      </form>
    </Dialog>
  );
}
