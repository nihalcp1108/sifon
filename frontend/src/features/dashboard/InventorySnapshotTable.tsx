import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowRight,
  Eye,
  AlertCircle,
  RefreshCw,
  Package,
} from 'lucide-react';
import { productsApi } from '../products/productsApi';
import { brandsApi } from '../brands/brandsApi';
import { categoriesApi } from '../categories/categoriesApi';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { Button } from '../../components/common/Button';

export const InventorySnapshotTable: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const limit = 8;

  // Fetch filter options: Brands & Categories
  const { data: brandsData } = useQuery({
    queryKey: ['brands-list-filter'],
    queryFn: () => brandsApi.getBrands({ limit: 100 }),
    staleTime: 60000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-list-filter'],
    queryFn: () => categoriesApi.getCategories({ limit: 100 }),
    staleTime: 60000,
  });

  const brands = brandsData?.data || [];
  const categories = categoriesData?.data || [];

  // Fetch products with balances
  const {
    data: productsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'inventory-snapshot', page, limit, searchTerm, selectedBrand, selectedCategory],
    queryFn: () =>
      productsApi.getProducts({
        page,
        limit,
        search: searchTerm,
        brandId: selectedBrand || undefined,
        categoryId: selectedCategory || undefined,
      }),
    staleTime: 15000,
  });

  const products = productsResponse?.data || [];
  const meta = productsResponse?.meta;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedBrand(e.target.value);
    setPage(1);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedBrand('');
    setSelectedCategory('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchTerm || selectedBrand || selectedCategory);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden transition-all hover:border-slate-300">
      {/* Top Header & Search/Filter Controls */}
      <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-navy-950 tracking-tight">Inventory Snapshot</h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {meta ? `${meta.total} Total Products` : 'Catalog'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time balance breakdown per product and storage location
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search product name..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-800 transition-colors"
            />
          </div>

          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={handleBrandChange}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-800 transition-colors"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-800 transition-colors"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
            >
              Reset
            </button>
          )}

          <Link
            to="/products"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 ml-1"
          >
            Full Catalog <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Table Container with Contained Horizontal Scroll */}
      <div className="overflow-x-auto min-h-[220px]">
        {isLoading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="flex gap-4">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="py-12 text-center text-xs">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-rose-600 font-semibold text-sm">Failed to load inventory snapshot.</p>
            <p className="text-slate-400 mt-1">Check network connection or server status.</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        )}

        {!isLoading && !error && products.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-500">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No products match the filter criteria</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && products.length > 0 && (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-5">Product Name</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4 text-right">Available Stock</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((prod) => {
                const brandName =
                  typeof prod.brandId === 'object' && (prod.brandId as any)?.name
                    ? (prod.brandId as any).name
                    : prod.brand?.name || '—';

                const categoryName =
                  typeof prod.categoryId === 'object' && (prod.categoryId as any)?.name
                    ? (prod.categoryId as any).name
                    : prod.category?.name || '—';

                // Extract location badges with stock counts
                const stockedLocations: { name: string; qty: number }[] = (prod.areaBalances || [])
                  .filter((b: any) => (b.availableQuantity || 0) > 0)
                  .map((b: any) => ({
                    name: b.areaId?.displayName || b.areaId?.name || 'Location',
                    qty: b.availableQuantity || 0,
                  }));

                return (
                  <tr
                    key={prod._id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-default"
                  >
                    {/* Product Name (Strictly NO Product Code) */}
                    <td className="py-3 px-5 font-medium text-slate-900 max-w-xs">
                      <div className="font-semibold group-hover:text-teal-700 transition-colors">
                        {prod.name}
                      </div>
                      {prod.details && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {prod.details}
                        </div>
                      )}
                    </td>

                    {/* Brand */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/50">
                        {brandName}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-800 border border-teal-200/50">
                        {categoryName}
                      </span>
                    </td>

                    {/* Actual Location Names (No guessing, preserves 'Location') */}
                    <td className="py-3 px-4">
                      {stockedLocations.length === 0 ? (
                        <span className="text-slate-400 italic text-[11px]">Not stocked</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {stockedLocations.map((loc, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                            >
                              <span>{loc.name}</span>
                              <span className="font-mono font-bold text-teal-700">({loc.qty})</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Available Stock (Strictly NO Units column) */}
                    <td className="py-3 px-4 text-right font-bold text-emerald-700 font-mono text-xs">
                      {(prod.totalAvailable ?? 0).toLocaleString()}
                    </td>

                    {/* Stock Status (Supported by existing rule: isActive) */}
                    <td className="py-3 px-4 text-center">
                      <Badge variant={prod.isActive ? 'active' : 'archived'}>
                        {prod.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </td>

                    {/* Details Action Button */}
                    <td className="py-3 px-4 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/products/${prod._id}`)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-slate-500" />}
                        className="text-xs text-slate-600 hover:text-navy-900 py-1 px-2"
                        title="View Product Details"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination & Footer */}
      {!isLoading && !error && meta && meta.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.total} products)
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="px-2 font-medium text-slate-800">{page}</span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="px-2.5 py-1 border border-slate-200 rounded-md bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
