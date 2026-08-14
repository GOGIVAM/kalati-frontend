import { http } from '@/lib/httpClient';
import type { Conversation, ConversationDetail, Paged } from '@/types';

export const conversationsService = {
  list(params: { page?: number; pageSize?: number; search?: string } = {}) {
    return http.get<Paged<Conversation>>('/api/conversations', {
      query: { page: params.page ?? 1, pageSize: params.pageSize ?? 50, search: params.search },
    });
  },

  create(payload: { title?: string | null; scopes?: string[] } = {}) {
    return http.post<Conversation>('/api/conversations', {
      title: payload.title ?? null,
      scopes: payload.scopes ?? [],
    });
  },

  get(id: string) {
    return http.get<ConversationDetail>(`/api/conversations/${encodeURIComponent(id)}`);
  },

  rename(id: string, title: string) {
    return http.patch<Conversation>(`/api/conversations/${encodeURIComponent(id)}`, { title });
  },

  remove(id: string) {
    return http.delete<void>(`/api/conversations/${encodeURIComponent(id)}`);
  },
};
