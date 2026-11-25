'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type Scheme = 'light' | 'dark';

function getSystemScheme(): Scheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredScheme(): Scheme | null {
  try {
    const value = localStorage.getItem('color-scheme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function syncMetaTag(scheme: Scheme | null): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = scheme ?? 'light dark';
  }
}

export function ThemeToggle() {
  const [renderedScheme, setRenderedScheme] = useState<Scheme>('light');
  const [isOverridden, setIsOverridden] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const syncFromEnvironment = () => {
      const stored = getStoredScheme();
      const system = media.matches ? 'dark' : 'light';
      setIsOverridden(stored !== null);
      setRenderedScheme(stored ?? system);
      syncMetaTag(stored);
    };

    syncFromEnvironment();

    const handleMediaChange = () => {
      const stored = getStoredScheme();
      if (!stored) {
        setRenderedScheme(media.matches ? 'dark' : 'light');
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'color-scheme' || event.key === null) {
        syncFromEnvironment();
      }
    };

    media.addEventListener('change', handleMediaChange);
    window.addEventListener('storage', handleStorage);
    return () => {
      media.removeEventListener('change', handleMediaChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const handleToggle = () => {
    const system = getSystemScheme();
    const target: Scheme = renderedScheme === 'dark' ? 'light' : 'dark';

    try {
      if (target === system) {
        localStorage.removeItem('color-scheme');
        syncMetaTag(null);
        setIsOverridden(false);
      } else {
        localStorage.setItem('color-scheme', target);
        syncMetaTag(target);
        setIsOverridden(true);
      }
    } catch {
      syncMetaTag(target === system ? null : target);
      setIsOverridden(target !== system);
    }

    setRenderedScheme(target);
  };

  const nextLabel =
    renderedScheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={nextLabel}
      aria-pressed={isOverridden}
      title={isOverridden ? `${nextLabel} (manual override)` : nextLabel}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-xs font-medium text-[var(--pb-ink)] transition-colors hover:border-[var(--pb-accent)] focus-visible:outline-2 focus-visible:outline-[var(--pb-accent)]"
    >
      {renderedScheme === 'dark' ? (
        <Sun className="size-4 text-[var(--pb-turmeric)]" aria-hidden="true" />
      ) : (
        <Moon className="size-4 text-[var(--pb-muted)]" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">
        {renderedScheme === 'dark' ? 'Light' : 'Dark'}
      </span>
    </button>
  );
}
