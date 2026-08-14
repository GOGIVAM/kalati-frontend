import { authHeaders, buildUrl, credentialsMode, http } from '@/lib/httpClient';
import type { AuditEntry, ChainVerification, Paged } from '@/types';

export interface AuditFilters {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  agentHash?: string;
  model?: string;
  outcome?: string;
}

export const auditService = {
  list(filters: AuditFilters = {}) {
    return http.get<Paged<AuditEntry>>('/api/audit/entries', {
      query: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 25,
        from: filters.from,
        to: filters.to,
        agentHash: filters.agentHash,
        model: filters.model,
        outcome: filters.outcome,
      },
    });
  },

  get(id: number) {
    return http.get<AuditEntry>(`/api/audit/entries/${id}`);
  },

  verify(range: { fromId?: number; toId?: number } = {}) {
    return http.post<ChainVerification>('/api/audit/verify', range);
  },

  /** Téléchargement CSV : on passe par un Blob pour conserver l'en-tête d'auth. */
  async exportCsv(filters: { from?: string; to?: string } = {}) {
    const response = await fetch(
      buildUrl('/api/audit/export', { ...filters, format: 'csv' }),
      { headers: authHeaders(), credentials: credentialsMode },
    );
    if (!response.ok) throw new Error(`Export impossible (${response.status})`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kalati-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
