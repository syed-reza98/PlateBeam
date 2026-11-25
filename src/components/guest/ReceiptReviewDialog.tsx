'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Printer, Star } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import { formatMoney, type GuestOutletInfo, type ReceiptPayload } from './types';

interface ReceiptReviewDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  invoiceId?: string | null;
  guestId?: string;
  outlet: GuestOutletInfo;
}

const REVIEW_TAGS = [
  'Great Food',
  'Fast Service',
  'Warm Ambience',
  'Accurate Order',
  'Value for Money',
];

export function ReceiptReviewDialog({
  open,
  onClose,
  sessionId,
  invoiceId,
  guestId,
  outlet,
}: ReceiptReviewDialogProps) {
  const [receipt, setReceipt] = useState<ReceiptPayload | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submittedReview, setSubmittedReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) return;
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      if (!cancelled) setLoadingReceipt(true);
    });
    fetch(`/api/v1/invoices/${invoiceId}/receipt`)
      .then((res) => (res.ok ? (res.json() as Promise<ReceiptPayload>) : null))
      .then((data) => {
        if (!cancelled && data) setReceipt(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingReceipt(false);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [open, invoiceId]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      showToast({ title: 'Please select a star rating', variant: 'warning' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/sessions/${sessionId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId,
          rating,
          comment: comment.trim() || undefined,
          tags: selectedTags,
        }),
      });
      if (res.ok) {
        setSubmittedReview(true);
        showToast({
          title:
            rating >= 4
              ? 'Thank you for your 5-star feedback!'
              : 'Feedback sent to the duty manager',
          variant: 'success',
        });
      }
    } catch {
      showToast({ title: 'Unable to submit review', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Digital Receipt & Review" closedby="any">
      <div className="space-y-6">
        {/* Statutory Receipt (FR-030) */}
        <section aria-label="Tax invoice receipt" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg">Tax Receipt</h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--pb-border)] px-3 text-xs font-semibold hover:border-[var(--pb-accent)]"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print / Save PDF
            </button>
          </div>

          {loadingReceipt ? (
            <div className="h-28 animate-pulse rounded-xl bg-[var(--pb-canvas)]" />
          ) : receipt ? (
            <div className="rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] p-4 text-xs">
              <div className="flex justify-between border-b border-[var(--pb-border)] pb-2">
                <div>
                  <p className="font-semibold">{receipt.outletName}</p>
                  {receipt.gstin && <p className="text-[var(--pb-muted)]">GSTIN: {receipt.gstin}</p>}
                  {receipt.vatNumber && (
                    <p className="text-[var(--pb-muted)]">VAT: {receipt.vatNumber}</p>
                  )}
                </div>
                <div className="text-right font-mono">
                  <p>#{receipt.invoiceNumber}</p>
                  <p className="text-[var(--pb-muted)]">
                    {new Date(receipt.issuedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-[var(--pb-border)] py-2">
                {receipt.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between py-1">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatMoney(item.lineTotalMinor, outlet.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1 border-t border-[var(--pb-border)] pt-2">
                <div className="flex justify-between">
                  <dt className="text-[var(--pb-muted)]">Subtotal</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoney(receipt.subtotalMinor, outlet.currency)}
                  </dd>
                </div>
                {receipt.taxBreakdown.map((tax) => (
                  <div key={tax.name} className="flex justify-between">
                    <dt className="text-[var(--pb-muted)]">
                      {tax.name} ({(tax.rateBps / 100).toFixed(2)}%)
                    </dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoney(tax.taxMinor, outlet.currency)}
                    </dd>
                  </div>
                ))}
                {receipt.tipMinor > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--pb-muted)]">Staff Tip</dt>
                    <dd className="font-mono tabular-nums">
                      {formatMoney(receipt.tipMinor, outlet.currency)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-sm font-bold">
                  <dt>Total Paid</dt>
                  <dd className="font-mono tabular-nums">
                    {formatMoney(receipt.totalMinor, outlet.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--pb-border)] p-4 text-xs text-[var(--pb-muted)]">
              Your statutory receipt will appear here as soon as payment settles.
            </p>
          )}
        </section>

        {/* Post-Payment 5-Star Review Routing (FR-031) */}
        <section
          aria-label="Rate your dining experience"
          className="border-t border-[var(--pb-border)] pt-5"
        >
          {submittedReview ? (
            <div className="space-y-3 rounded-xl border border-[var(--pb-olive)]/40 bg-[var(--pb-olive)]/10 p-4 text-center">
              <p className="font-serif text-xl">Thank you for dining with us!</p>
              {rating >= 4 ? (
                <a
                  href={
                    outlet.googleReviewUrl ||
                    `https://www.google.com/search?q=${encodeURIComponent(`${outlet.name} review`)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[var(--pb-accent)] px-5 py-2.5 text-xs font-bold text-[var(--pb-accent-ink)] shadow-md glow-accent active:scale-98 transition-all"
                >
                  Post 5-Star on Google Reviews
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-xs text-[var(--pb-muted)]">
                  Your feedback has been routed directly to our on-duty manager.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <h2 className="font-serif text-lg">How was your meal?</h2>
                <p className="text-xs text-[var(--pb-muted)]">
                  Tap a star rating to help our kitchen and service team.
                </p>
              </div>

              <div className="flex justify-between gap-2" role="radiogroup" aria-label="Star rating">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={rating === star}
                    aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
                    onClick={() => setRating(star)}
                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-xl border transition-colors ${
                      rating >= star
                        ? 'border-[var(--pb-turmeric)] bg-[var(--pb-turmeric)]/15 text-[var(--pb-turmeric)]'
                        : 'border-[var(--pb-border)] bg-[var(--pb-canvas)] text-[var(--pb-muted)]'
                    }`}
                  >
                    <Star
                      className={`size-5 ${rating >= star ? 'fill-current' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {REVIEW_TAGS.map((tag) => {
                  const active = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleTag(tag)}
                      className={`min-h-[44px] rounded-full border px-3 text-xs font-medium ${
                        active
                          ? 'border-[var(--pb-accent)] bg-[var(--pb-accent)] text-[var(--pb-accent-ink)]'
                          : 'border-[var(--pb-border)] bg-[var(--pb-canvas)]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                rows={2}
                maxLength={1500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  rating > 0 && rating <= 3
                    ? 'Tell our manager what we can make right immediately...'
                    : 'Optional note for the chef or team...'
                }
                aria-label="Review comment"
                className="w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-canvas)] px-3.5 py-2.5 text-sm"
              />

              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="min-h-[44px] w-full rounded-xl bg-[var(--pb-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--pb-accent-ink)] disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </section>
      </div>
    </Dialog>
  );
}
