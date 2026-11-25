/**
 * Shared client formatting, CSV export, and Web Audio chime utilities
 * for PlateBeam operational surfaces (POS, KDS, Owner Dashboard, Super-Admin).
 */

export function formatMinorCurrency(
  amountMinor: number,
  currencyCode = 'USD',
  locale = 'en-US',
): string {
  const major = amountMinor / 100;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${currencyCode} ${major.toFixed(2)}`;
  }
}

export function formatElapsedMmSs(createdAtIso: string, nowMs = Date.now()): string {
  const startMs = new Date(createdAtIso).getTime();
  const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const mins = Math.floor(diffSecs / 60);
  const secs = diffSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function playAlertChime(kind: 'kot' | 'waiter' = 'kot'): void {
  if (typeof window === 'undefined') return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = kind === 'kot' ? [660, 880] : [523.25, 659.25, 783.99];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = kind === 'kot' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.24);
    });

    setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 900);
  } catch {
    // Ignore autoplay restrictions before first user gesture
  }
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | boolean | null | undefined>>,
): void {
  if (typeof window === 'undefined') return;
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
