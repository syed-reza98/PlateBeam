'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closedby?: 'closerequest' | 'any' | 'none';
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  closedby = 'closerequest',
  className = '',
}: DialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    const handleCancel = (e: Event) => {
      if (closedby === 'none') {
        e.preventDefault();
      }
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

    // Fallback for browsers without native closedby="any"
    let cleanupOutside: (() => void) | undefined;
    if (closedby === 'any' && !('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);
      cleanupOutside = () => {
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
      cleanupOutside?.();
    };
  }, [closedby, onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby } as Record<string, string>)}
      className={`w-full shadow-2xl ${className}`}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--pb-border)] px-5 py-4">
        <h1 id={titleId} className="font-serif text-xl font-normal tracking-tight">
          {title}
        </h1>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => dialogRef.current?.close()}
          className="inline-flex items-center justify-center rounded-lg border border-transparent p-2 text-[var(--pb-muted)] hover:border-[var(--pb-border)] hover:text-[var(--pb-ink)] focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}
