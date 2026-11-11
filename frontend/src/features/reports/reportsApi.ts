import { apiClient } from '../../lib/apiClient';
import { MatrixStatementData, PeriodStatementData } from '../../types';

export const reportsApi = {
  getCurrentStockMatrix: async (params?: { search?: string; productId?: string; areaId?: string }) => {
    const res = await apiClient.get<{ data: MatrixStatementData }>('/reports/matrix', { params });
    return res.data.data;
  },

  exportMatrixCsv: async (params?: { search?: string; productId?: string; areaId?: string }) => {
    const res = await apiClient.get('/reports/matrix/csv', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },

  getPeriodStatement: async (params: {
    startDate: string;
    endDate: string;
    productId?: string;
    areaId?: string;
    search?: string;
  }) => {
    const res = await apiClient.get<{ data: PeriodStatementData }>('/reports/period', { params });
    return res.data.data;
  },

  exportPeriodCsv: async (params: {
    startDate: string;
    endDate: string;
    productId?: string;
    areaId?: string;
    search?: string;
  }) => {
    const res = await apiClient.get('/reports/period/csv', {
      params,
      responseType: 'blob',
    });
    return res.data;
  },
};

