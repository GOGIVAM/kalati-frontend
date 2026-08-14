import { create } from 'zustand';

export type Density = 'comfortable' | 'compact';
export type TextSize = 'small' | 'normal' | 'large';

interface Prefs {
  density: Density;
  textSize: TextSize;
  autoOpenSources: boolean;
  enterToSend: boolean;
  showQuality: boolean;
  set: <K extends keyof Omit<Prefs, 'set'>>(key: K, value: Prefs[K]) => void;
}

const KEY = 'kalati.prefs';

const read = (): Partial<Prefs> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
  } catch {
    return {};
  }
};

const apply = (density: Density, textSize: TextSize) => {
  const root = document.documentElement;
  root.dataset.density = density;
  root.dataset.textSize = textSize;
};

const saved = read();

export const usePrefsStore = create<Prefs>((set, get) => ({
  density: saved.density ?? 'comfortable',
  textSize: saved.textSize ?? 'normal',
  autoOpenSources: saved.autoOpenSources ?? true,
  enterToSend: saved.enterToSend ?? true,
  showQuality: saved.showQuality ?? true,

  set(key, value) {
    set({ [key]: value } as never);
    const next = get();
    apply(next.density, next.textSize);
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          density: next.density,
          textSize: next.textSize,
          autoOpenSources: next.autoOpenSources,
          enterToSend: next.enterToSend,
          showQuality: next.showQuality,
        }),
      );
    } catch {
      /* stockage indisponible : les préférences restent en mémoire */
    }
  },
}));

apply(saved.density ?? 'comfortable', saved.textSize ?? 'normal');
