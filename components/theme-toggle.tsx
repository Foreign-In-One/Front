'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { applyTheme, resolveTheme, type ThemeMode } from '@/lib/theme';

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode | null>(null);

  useEffect(() => {
    setMode(resolveTheme());
  }, []);

  if (!mode) return null;

  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      aria-label={mode === 'dark' ? '낮 모드로 전환' : '밤 모드로 전환'}
      onClick={() => {
        applyTheme(next);
        setMode(next);
      }}
      className="fixed bottom-24 left-4 z-40 flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-accent"
    >
      {mode === 'dark' ? (
        <Moon className="size-4" />
      ) : (
        <Sun className="size-4" />
      )}
    </button>
  );
}
