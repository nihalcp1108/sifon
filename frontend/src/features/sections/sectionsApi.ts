import { apiClient } from '../../lib/apiClient';
import { Section, PaginationMeta } from '../../types';

export const sectionsApi = {
  getSections: async (
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      activeOnly?: boolean | string;
      isActive?: boolean | string;
    },
    signal?: AbortSignal
  ) => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
      if (params.activeOnly !== undefined && params.activeOnly !== null && params.activeOnly !== 'all') {
        cleanParams.activeOnly = params.activeOnly;
      }
      if (params.isActive !== undefined && params.isActive !== null) {
        cleanParams.isActive = params.isActive;
      }
    }
    const res = await apiClient.get<{ data: Section[]; meta: PaginationMeta }>('/sections', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getSectionOptions: async (
    params?: {
      search?: string;
      limit?: number;
      page?: number;
      activeOnly?: boolean | string;
      isActive?: boolean | string;
      selectedId?: string;
    },
    signal?: AbortSignal
  ) => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.activeOnly !== undefined && params.activeOnly !== null) cleanParams.activeOnly = params.activeOnly;
      if (params.isActive !== undefined && params.isActive !== null) cleanParams.isActive = params.isActive;
      if (params.selectedId && /^[0-9a-fA-F]{24}$/.test(params.selectedId.trim())) {
        cleanParams.selectedId = params.selectedId.trim();
      }
    }
    const res = await apiClient.get<{ data: Section[]; meta: PaginationMeta }>('/sections/options', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getSectionById: async (id: string): Promise<Section> => {
    const res = await apiClient.get<{ data: Section }>(`/sections/${id}`);
    return res.data.data;
  },

  createSection: async (data: { name: string; description?: string }): Promise<Section> => {
    const res = await apiClient.post<{ data: Section }>('/sections', data);
    return res.data.data;
  },

  updateSection: async (
    id: string,
    data: { name?: string; description?: string; isActive?: boolean }
  ): Promise<Section> => {
    const res = await apiClient.put<{ data: Section }>(`/sections/${id}`, data);
    return res.data.data;
  },

  deleteSection: async (id: string): Promise<void> => {
    await apiClient.delete(`/sections/${id}`);
  },
};

