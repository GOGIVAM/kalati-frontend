import { http } from '@/lib/httpClient';
import type { AdminAgent, Category, Department, Grade, Paged } from '@/types';

export interface AgentFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string;
  grade?: number;
}

export const adminService = {
  agents(filters: AgentFilters = {}) {
    return http.get<Paged<AdminAgent>>('/api/admin/agents', {
      query: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 20,
        search: filters.search,
        department: filters.department,
        grade: filters.grade,
      },
    });
  },

  createAgent(payload: Partial<AdminAgent> & { password?: string }) {
    return http.post<AdminAgent>('/api/admin/agents', payload);
  },

  updateAgent(id: string, payload: Partial<AdminAgent>) {
    return http.patch<AdminAgent>(`/api/admin/agents/${encodeURIComponent(id)}`, payload);
  },

  disableAgent(id: string) {
    return http.post<void>(`/api/admin/agents/${encodeURIComponent(id)}/disable`);
  },

  resetPassword(id: string) {
    return http.post<void>(`/api/admin/agents/${encodeURIComponent(id)}/reset-password`);
  },

  grades() {
    return http.get<Grade[]>('/api/admin/grades');
  },

  createGrade(payload: Grade) {
    return http.post<Grade>('/api/admin/grades', payload);
  },

  departments() {
    return http.get<Department[]>('/api/admin/departments');
  },

  createDepartment(payload: Department) {
    return http.post<Department>('/api/admin/departments', payload);
  },

  categories() {
    return http.get<Category[]>('/api/admin/categories');
  },

  createCategory(payload: Category) {
    return http.post<Category>('/api/admin/categories', payload);
  },
};
