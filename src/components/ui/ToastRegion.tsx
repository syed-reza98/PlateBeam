'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
}

const TOAST_EVENT = 'platebeam:toast';

export function showToast(toast: Omit<ToastMessage, 'id'>): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<ToastMessage>(TOAST_EVENT, {
      detail: {
        ...toast,
        id: crypto.randomUUID(),
      },
    }),
  );
}

function announceMessage(text: string, liveEl: HTMLDivElement | null): void {
  const doc = document as Document & {
    ariaNotify?: (message: string, options?: { priority?: 'normal' | 'high' }) => void;
  };
  if (typeof doc.ariaNotify === 'function') {
    doc.ariaNotify(text, { priority: 'normal' });
    return;
  }
  if (liveEl) {
    liveEl.textContent = '';
    requestAnimationFrame(() => {
      liveEl.textContent = text;
    });
  }
}

export function ToastRegion() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const liveRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pausedRef = useRef<Set<string>>(new Set());
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!Object.hasOwn(HTMLElement.prototype, 'popover')) {
      void import('@oddbird/popover-polyfill').catch(() => undefined);
    }
  }, []);

  const dismissToast = useCallback((id: string, restoreFocus = false) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    pausedRef.current.delete(id);

    const el = itemRefs.current.get(id) as
      | (HTMLDivElement & { hidePopover?: () => void })
      | undefined;
    try {
      el?.hidePopover?.();
    } catch {
      // Ignore if already hidden
    }

    setToasts((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (restoreFocus) {
        if (next.length > 0) {
          const targetToast = next[Math.min(idx, next.length - 1)];
          requestAnimationFrame(() => {
            const btn = itemRefs.current
              .get(targetToast.id)
              ?.querySelector<HTMLButtonElement>('button[data-toast-close]');
            btn?.focus();
          });
        } else if (previousFocusRef.current?.isConnected) {
          previousFocusRef.current.focus();
        }
      }
      return next;
    });
  }, []);

  const scheduleDismiss = useCallback(
    (toast: ToastMessage) => {
      const duration = toast.durationMs ?? 5000;
      if (duration <= 0) return;
      const existing = timersRef.current.get(toast.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        if (!pausedRef.current.has(toast.id)) {
          dismissToast(toast.id, false);
        }
      }, duration);
      timersRef.current.set(toast.id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    const handleToastEvent = (event: Event) => {
      const custom = event as CustomEvent<ToastMessage>;
      const detail = custom.detail;
      if (!detail) return;

      // Do not surface background toasts while a modal dialog is open
      if (document.querySelector('dialog[open]:modal')) {
        return;
      }

      if (document.activeElement instanceof HTMLElement) {
        previousFocusRef.current = document.activeElement;
      }

      setToasts((prev) => [...prev.slice(-3), detail]);
      const message = detail.description
        ? `${detail.title}. ${detail.description}`
        : detail.title;
      setAnnouncement(message);
      announceMessage(message, liveRef.current);
      scheduleDismiss(detail);
    };

    window.addEventListener(TOAST_EVENT, handleToastEvent);
    return () => {
      window.removeEventListener(TOAST_EVENT, handleToastEvent);
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, [scheduleDismiss]);

  useEffect(() => {
    for (const toast of toasts) {
      const el = itemRefs.current.get(toast.id) as
        | (HTMLDivElement & { showPopover?: () => void })
        | undefined;
      if (el && !el.matches(':popover-open')) {
        try {
          el.showPopover?.();
        } catch {
          // Fallback if polyfill is still loading
        }
      }
    }
  }, [toasts]);

  return (
    <>
      <p className="sr-only">Screen reader notifications</p>
      <div
        ref={liveRef}
        id="pb-toast-live"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>

      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-20 right-4 z-50 flex flex-col gap-2 sm:bottom-4"
      >
        {toasts.map((toast, idx) => {
          const variant = toast.variant ?? 'info';
          const Icon =
            variant === 'success'
              ? CheckCircle2
              : variant === 'error' || variant === 'warning'
                ? AlertCircle
                : Info;
          const accentClass =
            variant === 'success'
              ? 'text-[#10B981]'
              : variant === 'error'
                ? 'text-[#EF4444]'
                : variant === 'warning'
                  ? 'text-[#F59E0B]'
                  : 'text-[#FF5412]';

          const offsetBottom = toasts.length - 1 - idx;

          return (
            <div
              key={toast.id}
              ref={(node) => {
                if (node) {
                  itemRefs.current.set(toast.id, node);
                } else {
                  itemRefs.current.delete(toast.id);
                }
              }}
              {...({ popover: 'manual' } as Record<string, string>)}
              style={{
                transform: offsetBottom > 0 ? `translateY(-${offsetBottom * 4.75}rem)` : undefined,
              }}
              className="pb-toast-item pointer-events-auto bottom-20 right-4 flex items-start gap-3 rounded-2xl border border-white/15 bg-[#111115] p-3.5 text-[#F4F4F5] shadow-2xl sm:bottom-4"
              onFocus={() => {
                pausedRef.current.add(toast.id);
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  pausedRef.current.delete(toast.id);
                  scheduleDismiss(toast);
                }
              }}
            >
              <Icon className={`mt-0.5 size-5 shrink-0 ${accentClass}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-[#F4F4F5]">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                data-toast-close
                aria-label="Close notification"
                onClick={() => dismissToast(toast.id, true)}
                className="inline-flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-[#A1A1AA] transition-colors hover:bg-[#18181F] hover:text-white focus-visible:outline-2 focus-visible:outline-[#FF5412]"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
