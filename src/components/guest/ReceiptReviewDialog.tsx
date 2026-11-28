'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Printer, Star } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { showToast } from '@/components/ui/ToastRegion';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
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
    <Dialog
      open={open}
      onClose={onClose}
      title="Digital Receipt & Review"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <div className="space-y-6">
        {/* Statutory Receipt (FR-030) */}
        <section aria-label="Tax invoice receipt" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-base font-bold text-zinc-900">Tax Receipt</h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3.5 text-xs font-bold text-zinc-900 transition-colors hover:border-[#FF5412]"
            >
              <Printer className="size-4" aria-hidden="true" />
              Print / Save PDF
            </button>
          </div>

          {loadingReceipt ? (
            <div className="h-28 animate-pulse rounded-2xl bg-[#FAF7F2]" />
          ) : receipt ? (
            <div className="thermal-receipt mx-auto rounded-xl border border-zinc-200 bg-white p-4 font-mono text-xs text-zinc-900 shadow-sm">
              <div className="flex justify-between border-b border-dashed border-zinc-300 pb-2.5">
                <div>
                  <p className="font-bold uppercase tracking-wide">{receipt.outletName}</p>
                  {receipt.gstin && <p className="text-zinc-500">GSTIN: {receipt.gstin}</p>}
                  {receipt.vatNumber && (
                    <p className="text-zinc-500">VAT: {receipt.vatNumber}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold">#{receipt.invoiceNumber}</p>
                  <p className="text-zinc-500">
                    {new Date(receipt.issuedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-dashed divide-zinc-200 py-2">
                {receipt.items.map((item, idx) => (
                  <li key={idx} className="flex justify-between py-1">
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(item.lineTotalMinor, outlet.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="space-y-1 border-t border-dashed border-zinc-300 pt-2">
                <div className="flex justify-between">
                  <dt className="text-zinc-500">Subtotal</dt>
                  <dd className="tabular-nums">
                    {formatMoney(receipt.subtotalMinor, outlet.currency)}
                  </dd>
                </div>
                {receipt.taxBreakdown.map((tax) => (
                  <div key={tax.name} className="flex justify-between">
                    <dt className="text-zinc-500">
                      {tax.name} ({(tax.rateBps / 100).toFixed(2)}%)
                    </dt>
                    <dd className="tabular-nums">
                      {formatMoney(tax.taxMinor, outlet.currency)}
                    </dd>
                  </div>
                ))}
                {receipt.discountMinor > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <dt>Discount / Voucher</dt>
                    <dd className="tabular-nums">
                      -{formatMoney(receipt.discountMinor, outlet.currency)}
                    </dd>
                  </div>
                )}
                {receipt.tipMinor > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-zinc-500">Staff Tip</dt>
                    <dd className="tabular-nums">
                      {formatMoney(receipt.tipMinor, outlet.currency)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-zinc-300 pt-1.5 text-sm font-bold">
                  <dt>Total Paid</dt>
                  <dd className="tabular-nums">
                    {formatMoney(receipt.totalMinor, outlet.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-300 bg-[#FAF7F2] p-4 text-xs text-zinc-500">
              Your statutory receipt will appear here as soon as payment settles.
            </p>
          )}
        </section>

        {/* Post-Payment 5-Star Review Routing (FR-031) */}
        <section
          aria-label="Rate your dining experience"
          className="border-t border-zinc-200 pt-5"
        >
          {submittedReview ? (
            <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="font-sans text-lg font-bold text-zinc-900">
                Thank you for dining with us!
              </p>
              {rating >= 4 ? (
                <a
                  href={
                    outlet.googleReviewUrl ||
                    `https://www.google.com/search?q=${encodeURIComponent(`${outlet.name} review`)}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#FF5412] px-5 py-2.5 text-xs font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033]"
                >
                  Post 5-Star on Google Reviews
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : (
                <p className="text-xs text-zinc-600">
                  Your feedback has been routed directly to our on-duty manager.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-4">
              <div>
                <h2 className="font-sans text-base font-bold text-zinc-900">How was your meal?</h2>
                <p className="text-xs text-zinc-500">
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
                        ? 'border-amber-300 bg-amber-50 text-amber-500'
                        : 'border-zinc-200 bg-[#FAF7F2] text-zinc-400'
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
                      className={`min-h-[44px] rounded-full border px-3.5 text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#FF5412] bg-[#FF5412] text-white'
                          : 'border-zinc-200 bg-[#FAF7F2] text-zinc-700'
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
                className="w-full rounded-xl border border-zinc-200 bg-[#FAF7F2] px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-2 focus-visible:outline-[#FF5412]"
              />

              <button
                type="submit"
                disabled={submitting || rating === 0}
                className="min-h-[44px] w-full rounded-xl bg-[#FF5412] px-4 py-2.5 text-sm font-bold text-white shadow-beam transition-colors hover:bg-[#FF7033] disabled:opacity-50"
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
