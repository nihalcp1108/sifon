import { apiClient } from '../../lib/apiClient';
import { DashboardSummary } from '../../types';

export const dashboardApi = {
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await apiClient.get<{ data: DashboardSummary }>('/dashboard/summary');
    return res.data.data;
  },
};

