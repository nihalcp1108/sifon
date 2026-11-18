import { apiClient } from '../../lib/apiClient';
import { Sale, PaginationMeta } from '../../types';

export const salesApi = {
  getSales: async (
    params?: {
      page?: number;
      limit?: number;
      status?: string;
      productId?: string;
      areaId?: string;
      startDate?: string;
      endDate?: string;
    },
    signal?: AbortSignal
  ) => {
    const res = await apiClient.get<{ data: Sale[]; meta: PaginationMeta }>('/sales', {
      params,
      signal,
    });
    return res.data;
  },

  getSaleById: async (id: string): Promise<Sale> => {
    const res = await apiClient.get<{ data: Sale }>(`/sales/${id}`);
    return res.data.data;
  },

  createSale: async (
    data: {
      reference?: string;
      saleDate: string;
      items: { productId: string; sourceAreaId: string; quantity: number }[];
      notes?: string;
      isDraft?: boolean;
    },
    idempotencyKey?: string
  ): Promise<Sale> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Sale }>('/sales', data, { headers });
    return res.data.data;
  },

  postDraft: async (id: string, idempotencyKey?: string): Promise<Sale> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Sale }>(`/sales/${id}/post`, {}, { headers });
    return res.data.data;
  },

  updateSale: async (
    id: string,
    data: {
      reference?: string;
      saleDate?: string;
      items?: { productId: string; sourceAreaId: string; quantity: number }[];
      notes?: string;
      expectedVersion?: number;
      updatedAt?: string;
    },
    idempotencyKey?: string
  ): Promise<Sale> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.put<{ data: Sale }>(`/sales/${id}`, data, { headers });
    return res.data.data;
  },

  updateDraft: async (id: string, data: any): Promise<Sale> => {
    const res = await apiClient.put<{ data: Sale }>(`/sales/${id}`, data);
    return res.data.data;
  },

  deleteSale: async (id: string, idempotencyKey?: string, reason?: string): Promise<void> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    await apiClient.delete(`/sales/${id}`, {
      headers,
      data: reason ? { reason } : undefined,
    });
  },

  deleteDraft: async (id: string): Promise<void> => {
    return salesApi.deleteSale(id);
  },

  cancelSale: async (
    id: string,
    data: { reason: string },
    idempotencyKey?: string
  ): Promise<Sale> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Sale }>(`/sales/${id}/cancel`, data, {
      headers,
    });
    return res.data.data;
  },
};

