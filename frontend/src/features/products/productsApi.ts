import { apiClient } from '../../lib/apiClient';
import { Product, ProductDetail, InventoryMovement, PaginationMeta } from '../../types';

export const productsApi = {
  getProducts: async (
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      brandId?: string;
      categoryId?: string;
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
      if (params.brandId && /^[0-9a-fA-F]{24}$/.test(params.brandId.trim())) {
        cleanParams.brandId = params.brandId.trim();
      }
      if (params.categoryId && /^[0-9a-fA-F]{24}$/.test(params.categoryId.trim())) {
        cleanParams.categoryId = params.categoryId.trim();
      }
      if (params.activeOnly !== undefined && params.activeOnly !== null && params.activeOnly !== 'all') {
        cleanParams.activeOnly = params.activeOnly;
      }
      if (params.isActive !== undefined && params.isActive !== null) {
        cleanParams.isActive = params.isActive;
      }
    }
    const res = await apiClient.get<{ data: Product[]; meta: PaginationMeta }>('/products', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getProductOptions: async (
    params?: {
      search?: string;
      brandId?: string;
      categoryId?: string;
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
      if (params.brandId && /^[0-9a-fA-F]{24}$/.test(params.brandId.trim())) {
        cleanParams.brandId = params.brandId.trim();
      }
      if (params.categoryId && /^[0-9a-fA-F]{24}$/.test(params.categoryId.trim())) {
        cleanParams.categoryId = params.categoryId.trim();
      }
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.activeOnly !== undefined && params.activeOnly !== null) cleanParams.activeOnly = params.activeOnly;
      if (params.isActive !== undefined && params.isActive !== null) cleanParams.isActive = params.isActive;
      if (params.selectedId && /^[0-9a-fA-F]{24}$/.test(params.selectedId.trim())) {
        cleanParams.selectedId = params.selectedId.trim();
      }
    }
    const res = await apiClient.get<{ data: Product[]; meta: PaginationMeta }>('/products/options', {
      params: cleanParams,
      signal,
    });
    return res.data;
  },

  getProductById: async (id: string): Promise<ProductDetail> => {
    const res = await apiClient.get<{ data: ProductDetail }>(`/products/${id}`);
    return res.data.data;
  },

  getProductMovements: async (id: string, params?: { page?: number; limit?: number }) => {
    const res = await apiClient.get<{ data: InventoryMovement[]; meta: PaginationMeta }>(
      `/products/${id}/movements`,
      { params }
    );
    return res.data;
  },

  createProduct: async (data: {
    name: string;
    brandId: string;
    categoryId: string;
    code?: string;
    details?: string;
    unit?: string;
    openingStock?: { areaId: string; quantity: number }[];
  }): Promise<Product> => {
    const res = await apiClient.post<{ data: Product }>('/products', data);
    return res.data.data;
  },

  updateProduct: async (
    id: string,
    data: {
      name?: string;
      brandId?: string;
      categoryId?: string;
      details?: string;
      unit?: string;
      isActive?: boolean;
    }
  ): Promise<Product> => {
    const res = await apiClient.put<{ data: Product }>(`/products/${id}`, data);
    return res.data.data;
  },
};
