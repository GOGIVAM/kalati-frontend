import { buildUrl, http } from '@/lib/httpClient';
import type { DocumentDetail, DocumentItem, DocumentPage, Paged } from '@/types';

export interface DocumentFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  status?: string;
}

export const documentsService = {
  list(filters: DocumentFilters = {}) {
    return http.get<Paged<DocumentItem>>('/api/documents', {
      query: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        search: filters.search,
        category: filters.category,
        status: filters.status,
      },
    });
  },

  get(id: string) {
    return http.get<DocumentDetail>(`/api/documents/${encodeURIComponent(id)}`);
  },

  page(id: string, page: number) {
    return http.get<DocumentPage>(
      `/api/documents/${encodeURIComponent(id)}/pages/${page}`,
    );
  },

  /** URL absolue d'une image de page, utilisable dans un `src`. */
  pageImageUrl(id: string, page: number) {
    return buildUrl(`/api/documents/${encodeURIComponent(id)}/pages/${page}/image`);
  },

  upload(form: FormData) {
    return http.post<DocumentItem>('/api/documents', form);
  },

  remove(id: string) {
    return http.delete<void>(`/api/documents/${encodeURIComponent(id)}`);
  },
};
