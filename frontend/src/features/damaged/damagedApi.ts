import { apiClient } from '../../lib/apiClient';
import { DamagedBalanceItem, ReturnRecord, PaginationMeta } from '../../types';

export const damagedApi = {
  getDamagedBalances: async (params?: { productId?: string; areaId?: string }) => {
    const res = await apiClient.get<{
      data: { balances: DamagedBalanceItem[]; totalDamagedQuantity: number };
    }>('/damaged/balances', { params });
    return res.data.data;
  },

  getDamagedHistory: async (params?: {
    page?: number;
    limit?: number;
    productId?: string;
    areaId?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const res = await apiClient.get<{ data: ReturnRecord[]; meta: PaginationMeta }>(
      '/damaged/history',
      { params }
    );
    return res.data;
  },
};

