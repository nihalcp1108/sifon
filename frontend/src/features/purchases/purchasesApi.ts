import { apiClient } from '../../lib/apiClient';
import { Purchase, PaginationMeta } from '../../types';

export const purchasesApi = {
  getPurchases: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: string;
    areaId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient.get<{ data: Purchase[]; meta: PaginationMeta }>('/purchases', {
      params,
    });
    return res.data;
  },

  getPurchaseById: async (id: string): Promise<Purchase> => {
    const res = await apiClient.get<{ data: Purchase }>(`/purchases/${id}`);
    return res.data.data;
  },

  createPurchase: async (
    data: {
      reference?: string;
      purchaseDate: string;
      items: { productId: string; receivingAreaId: string; quantity: number }[];
      notes?: string;
      isDraft?: boolean;
    },
    idempotencyKey?: string
  ): Promise<Purchase> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Purchase }>('/purchases', data, { headers });
    return res.data.data;
  },

  postDraft: async (id: string, idempotencyKey?: string): Promise<Purchase> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Purchase }>(`/purchases/${id}/post`, {}, { headers });
    return res.data.data;
  },

  updateDraft: async (id: string, data: any): Promise<Purchase> => {
    const res = await apiClient.put<{ data: Purchase }>(`/purchases/${id}`, data);
    return res.data.data;
  },

  deleteDraft: async (id: string): Promise<void> => {
    await apiClient.delete(`/purchases/${id}`);
  },

  cancelPurchase: async (
    id: string,
    data: { reason: string },
    idempotencyKey?: string
  ): Promise<Purchase> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: Purchase }>(`/purchases/${id}/cancel`, data, {
      headers,
    });
    return res.data.data;
  },
};

