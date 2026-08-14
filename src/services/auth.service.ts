import { http, setAccessToken } from '@/lib/httpClient';
import { usesCookieAuth } from '@/lib/env';
import type { AgentProfile, HealthStatus, LoginResponse, Locale, Scope } from '@/types';

export const authService = {
  async login(
    matricule: string,
    password: string,
    remember = false,
  ): Promise<AgentProfile> {
    const response = await http.post<LoginResponse>('/api/auth/login', { matricule, password });
    if (!usesCookieAuth && response.accessToken) setAccessToken(response.accessToken, remember);
    return response.user;
  },

  /** Restauration de session au démarrage. Renvoie null si non authentifié. */
  async me(): Promise<AgentProfile | null> {
    try {
      return await http.get<AgentProfile>('/api/auth/me', { silent401: true });
    } catch {
      return null;
    }
  },

  async logout(): Promise<void> {
    try {
      await http.post<void>('/api/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },

  acknowledgeTransparency(): Promise<void> {
    return http.post<void>('/api/auth/transparency-ack');
  },

  updatePreferences(payload: { locale?: Locale; defaultScopes?: string[] }): Promise<AgentProfile> {
    return http.patch<AgentProfile>('/api/auth/me/preferences', payload);
  },

  scopes(): Promise<Scope[]> {
    return http.get<Scope[]>('/api/admin/scopes');
  },

  health(): Promise<HealthStatus> {
    return http.get<HealthStatus>('/api/health');
  },
};
