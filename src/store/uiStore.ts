import { create } from 'zustand';
import type { Citation } from '@/types';

const COLLAPSE_KEY = 'kalati.rail.collapsed';

interface UiState {
  railOpen: boolean;
  railCollapsed: boolean;
  navOpen: boolean;
  transparencyOpen: boolean;
  guideOpen: boolean;
  activeCitation: Citation | null;
  scopes: string[];
  toggleRail: () => void;
  toggleRailCollapsed: () => void;
  setRail: (open: boolean) => void;
  toggleNav: () => void;
  closeOverlays: () => void;
  openTransparency: () => void;
  closeTransparency: () => void;
  openGuide: () => void;
  closeGuide: () => void;
  openCitation: (citation: Citation) => void;
  closeCitation: () => void;
  setScopes: (scopes: string[]) => void;
  toggleScope: (code: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  railOpen: false,
  railCollapsed:
    typeof localStorage !== 'undefined' && localStorage.getItem(COLLAPSE_KEY) === '1',
  navOpen: false,
  transparencyOpen: false,
  guideOpen: false,
  activeCitation: null,
  scopes: [],

  toggleRail: () => set((s) => ({ railOpen: !s.railOpen, navOpen: false })),
  toggleRailCollapsed: () =>
    set((s) => {
      const next = !s.railCollapsed;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* stockage indisponible : l'état reste en mémoire */
      }
      return { railCollapsed: next };
    }),
  setRail: (open) => set({ railOpen: open }),
  toggleNav: () => set((s) => ({ navOpen: !s.navOpen, railOpen: false })),
  closeOverlays: () => set({ railOpen: false, navOpen: false }),

  openTransparency: () => set({ transparencyOpen: true }),
  closeTransparency: () => set({ transparencyOpen: false }),

  openGuide: () => set({ guideOpen: true, navOpen: false }),
  closeGuide: () => set({ guideOpen: false }),

  openCitation: (citation) => set({ activeCitation: citation }),
  closeCitation: () => set({ activeCitation: null }),

  setScopes: (scopes) => set({ scopes }),
  toggleScope: (code) => {
    const current = get().scopes;
    set({
      scopes: current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code],
    });
  },
}));
