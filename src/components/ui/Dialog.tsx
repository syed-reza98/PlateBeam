'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closedby?: 'closerequest' | 'any' | 'none';
  variant?: 'dark' | 'light';
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  closedby = 'closerequest',
  variant = 'dark',
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

  const surfaceStyles =
    variant === 'light'
      ? 'border-zinc-200 bg-[#FFFFFF] text-[#18181B]'
      : 'border-white/15 bg-[#111115] text-[#F4F4F5]';

  const headerBorder = variant === 'light' ? 'border-zinc-200/80' : 'border-white/10';
  const closeButtonStyles =
    variant === 'light'
      ? 'text-zinc-500 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900'
      : 'text-[#A1A1AA] hover:border-white/15 hover:bg-[#18181F] hover:text-white';

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby } as Record<string, string>)}
      className={`w-full max-w-lg rounded-3xl border shadow-2xl ${surfaceStyles} ${className}`}
    >
      <div className={`flex items-center justify-between gap-4 border-b px-6 py-4 ${headerBorder}`}>
        <h1 id={titleId} className="text-lg font-bold tracking-tight">
          {title}
        </h1>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => dialogRef.current?.close()}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-[#FF5412] ${closeButtonStyles}`}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
