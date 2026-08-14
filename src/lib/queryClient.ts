import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './httpClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Inutile de réessayer une erreur d'authentification ou de droits.
        if (error instanceof ApiError && [400, 401, 403, 404, 422].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});

/** Clés de cache centralisées : évite les invalidations approximatives. */
export const qk = {
  me: ['auth', 'me'] as const,
  health: ['health'] as const,
  scopes: ['scopes'] as const,
  conversations: (search?: string) => ['conversations', { search: search ?? '' }] as const,
  conversation: (id: string) => ['conversations', id] as const,
  documents: (filters: Record<string, unknown>) => ['documents', filters] as const,
  document: (id: string) => ['documents', id] as const,
  documentPage: (id: string, page: number) => ['documents', id, 'pages', page] as const,
  audit: (filters: Record<string, unknown>) => ['audit', filters] as const,
  agents: (filters: Record<string, unknown>) => ['admin', 'agents', filters] as const,
  grades: ['admin', 'grades'] as const,
  departments: ['admin', 'departments'] as const,
  categories: ['admin', 'categories'] as const,
  metricsOverview: (range: string) => ['metrics', 'overview', range] as const,
  metricsSeries: (metric: string, range: string) => ['metrics', 'series', metric, range] as const,
  metricsScopes: (range: string) => ['metrics', 'scopes', range] as const,
  qualityRuns: ['metrics', 'quality-runs'] as const,
};
