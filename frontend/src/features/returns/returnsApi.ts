import { apiClient } from '../../lib/apiClient';
import { ReturnRecord, PaginationMeta } from '../../types';

export const returnsApi = {
  getReturns: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    productId?: string;
    areaId?: string;
    saleId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient.get<{ data: ReturnRecord[]; meta: PaginationMeta }>('/returns', {
      params,
    });
    return res.data;
  },

  getReturnById: async (id: string): Promise<ReturnRecord> => {
    const res = await apiClient.get<{ data: ReturnRecord }>(`/returns/${id}`);
    return res.data.data;
  },

  createReturn: async (
    data: {
      reference?: string;
      returnDate: string;
      saleId: string;
      saleLineId: string;
      receivingAreaId?: string;
      nonDamagedQuantity: number;
      damagedQuantity: number;
      reason: string;
    },
    idempotencyKey?: string
  ): Promise<ReturnRecord> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: ReturnRecord }>('/returns', data, { headers });
    return res.data.data;
  },

  cancelReturn: async (
    id: string,
    data: { reason: string },
    idempotencyKey?: string
  ): Promise<ReturnRecord> => {
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey;
    }
    const res = await apiClient.post<{ data: ReturnRecord }>(`/returns/${id}/cancel`, data, {
      headers,
    });
    return res.data.data;
  },
};

