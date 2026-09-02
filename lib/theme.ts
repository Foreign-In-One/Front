export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'paycycle-theme';

export function getStoredTheme(): ThemeMode | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

export function resolveTheme(): ThemeMode {
  const stored = getStoredTheme();
  if (stored) return stored;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // localStorage unavailable — 저장 없이 적용만 진행
  }
}

/** app/layout.tsx의 인라인 스크립트와 반드시 동일한 로직을 유지해야 깜빡임이 없다. */
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_KEY}';var s=localStorage.getItem(k);var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme', d?'dark':'light');}catch(e){}})();`;
