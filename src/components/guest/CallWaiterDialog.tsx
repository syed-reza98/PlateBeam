'use client';

import { Dialog } from '@/components/ui/Dialog';
import { GUEST_DIALOG_CLASS } from './GuestPortalClient';
import { HelpPanel } from './HelpPanel';

interface CallWaiterDialogProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  tableId: string | null;
}

/** Modal wrapper kept for POS/demo embeds; guest portal uses inline HelpPanel. */
export function CallWaiterDialog({
  open,
  onClose,
  sessionId,
  tableId,
}: CallWaiterDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Call Waiter"
      closedby="any"
      className={GUEST_DIALOG_CLASS}
    >
      <HelpPanel sessionId={sessionId} tableId={tableId} />
    </Dialog>
  );
}
