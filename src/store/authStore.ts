import { create } from 'zustand';
import { authService } from '@/services/auth.service';
import { getAccessToken, setAccessToken, setUnauthorizedHandler } from '@/lib/httpClient';
import { setLocale } from '@/i18n';
import type { AgentProfile, Locale, Role } from '@/types';

interface AuthState {
  user: AgentProfile | null;
  status: 'idle' | 'restoring' | 'authenticated' | 'anonymous';
  error: string | null;
  restore: () => Promise<void>;
  login: (matricule: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AgentProfile) => void;
  acceptTransparency: () => Promise<void>;
  hasRole: (role: Role) => boolean;
}

/* Marqueur de session : évite d'appeler /api/auth/me (et donc un 401 dans la
   console) quand aucune connexion n'a jamais été ouverte dans ce navigateur.
   Ne contient aucune donnée sensible : uniquement un booléen. */
const SESSION_HINT = 'kalati.session';

const markSession = (open: boolean) => {
  try {
    if (open) localStorage.setItem(SESSION_HINT, '1');
    else localStorage.removeItem(SESSION_HINT);
  } catch {
    /* stockage indisponible : la restauration se fera par appel réseau */
  }
};

const hadSession = () => {
  if (getAccessToken()) return true;
  try {
    return localStorage.getItem(SESSION_HINT) === '1';
  } catch {
    return true;
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  async restore() {
    if (!hadSession()) {
      set({ user: null, status: 'anonymous' });
      return;
    }
    set({ status: 'restoring' });
    const user = await authService.me();
    if (user) {
      if (user.locale) setLocale(user.locale as Locale);
      set({ user, status: 'authenticated', error: null });
    } else {
      markSession(false);
      set({ user: null, status: 'anonymous' });
    }
  },

  async login(matricule, password, remember = false) {
    set({ error: null });
    const user = await authService.login(matricule, password, remember);
    markSession(true);
    if (user.locale) setLocale(user.locale as Locale);
    set({ user, status: 'authenticated' });
  },

  async logout() {
    await authService.logout();
    markSession(false);
    set({ user: null, status: 'anonymous' });
  },

  setUser(user) {
    set({ user });
  },

  async acceptTransparency() {
    const current = get().user;
    if (current) set({ user: { ...current, transparencyAccepted: true } });
    try {
      await authService.acknowledgeTransparency();
    } catch {
      // L'acquittement est confortable, pas critique : on n'annule pas l'UI.
    }
  },

  hasRole(role) {
    return get().user?.roles?.includes(role) ?? false;
  },
}));

// Toute réponse 401 du backend purge la session côté client.
setUnauthorizedHandler(() => {
  setAccessToken(null);
  markSession(false);
  useAuthStore.setState({ user: null, status: 'anonymous' });
});
