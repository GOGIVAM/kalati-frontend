import { useEffect, useState } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

const KEY = 'kalati.theme';

const read = (): ThemeChoice => {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    /* stockage indisponible */
  }
  return 'system';
};

const systemDark = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/** Applique le thème sur <html data-theme> ; les jetons de couleur suivent. */
export const applyTheme = (choice: ThemeChoice) => {
  const dark = choice === 'dark' || (choice === 'system' && systemDark());
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
};

applyTheme(read());

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeChoice>(read);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* stockage indisponible : le thème reste en mémoire */
    }
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
