'use client';

import { useState } from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { showToast } from '@/components/ui/ToastRegion';
import type { ServiceRequestType } from '@/server/db/types';
import { SERVICE_REQUEST_TAGS } from './types';

interface HelpPanelProps {
  sessionId: string;
  tableId: string | null;
}

export function HelpPanel({ sessionId, tableId }: HelpPanelProps) {
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
    <section aria-label="Call waiter and help requests" className="space-y-5">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-center shadow-sm sm:p-6">
        <button
          type="button"
          onClick={() => {
            const form = document.getElementById('guest-help-form') as HTMLFormElement | null;
            form?.requestSubmit();
          }}
          disabled={submitting}
          className="animate-halo mx-auto flex size-28 flex-col items-center justify-center rounded-full bg-[#FF5412] text-white shadow-beam transition-transform active:scale-95 disabled:opacity-60"
          aria-label="Call waiter"
        >
          <BellRing className="size-8" aria-hidden="true" />
          <span className="mt-1 text-[11px] font-extrabold uppercase tracking-wide">
            Call
          </span>
        </button>
        <h2 className="mt-4 font-sans text-lg font-extrabold tracking-tight text-zinc-900">
          Need anything?
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tap Call or pick a quick request — your floor captain is alerted live.
        </p>
      </div>

      <form
        id="guest-help-form"
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5"
      >
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
                    <CheckCircle2 className="size-4 text-[#FF5412]" aria-hidden="true" />
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
            htmlFor="help-waiter-note"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-500"
          >
            Short Note (Optional)
          </label>
          <input
            id="help-waiter-note"
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
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
        >
          <BellRing className="size-4" aria-hidden="true" />
          {submitting ? 'Alerting Server...' : 'Send Request'}
        </button>
      </form>
    </section>
  );
}
