import { apiClient } from '../../lib/apiClient';
import { Area, PaginationMeta } from '../../types';

export const areasApi = {
  getAreas: async (
    params?: {
      page?: number;
      limit?: number;
      activeOnly?: boolean | string;
      isActive?: boolean | string;
      search?: string;
      sectionId?: string;
    },
    signal?: AbortSignal
  ) => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
      if (params.sectionId && /^[0-9a-fA-F]{24}$/.test(params.sectionId.trim())) {
        cleanParams.sectionId = params.sectionId.trim();
      }
      if (params.activeOnly !== undefined && params.activeOnly !== null && params.activeOnly !== 'all') {
        cleanParams.activeOnly = params.activeOnly;
      }
      if (params.isActive !== undefined && params.isActive !== null) {
        cleanParams.isActive = params.isActive;
      }
    }
    const res = await apiClient.get<{ data: Area[]; meta: PaginationMeta }>('/areas', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getAreaOptions: async (
    params?: {
      limit?: number;
      page?: number;
      activeOnly?: boolean | string;
      isActive?: boolean | string;
      selectedId?: string;
      search?: string;
      sectionId?: string;
    },
    signal?: AbortSignal
  ) => {
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
      if (params.sectionId && /^[0-9a-fA-F]{24}$/.test(params.sectionId.trim())) {
        cleanParams.sectionId = params.sectionId.trim();
      }
      if (params.activeOnly !== undefined && params.activeOnly !== null) cleanParams.activeOnly = params.activeOnly;
      if (params.isActive !== undefined && params.isActive !== null) cleanParams.isActive = params.isActive;
      if (params.selectedId && /^[0-9a-fA-F]{24}$/.test(params.selectedId.trim())) {
        cleanParams.selectedId = params.selectedId.trim();
      }
    }
    const res = await apiClient.get<{ data: Area[]; meta: PaginationMeta }>('/areas/options', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getAreaById: async (id: string): Promise<Area> => {
    const res = await apiClient.get<{ data: Area }>(`/areas/${id}`);
    return res.data.data;
  },

  createArea: async (data: {
    name: string;
    sectionId: string;
    description?: string;
    areaNumber?: number;
  }): Promise<Area> => {
    const res = await apiClient.post<{ data: Area }>('/areas', data);
    return res.data.data;
  },

  updateArea: async (
    id: string,
    data: { name?: string; sectionId?: string; description?: string; isActive?: boolean }
  ): Promise<Area> => {
    const res = await apiClient.put<{ data: Area }>(`/areas/${id}`, data);
    return res.data.data;
  },

  deleteArea: async (id: string): Promise<void> => {
    await apiClient.delete(`/areas/${id}`);
  },
};
