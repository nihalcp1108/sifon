import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, Search, Edit2, Eye } from 'lucide-react';
import { productsApi } from './productsApi';
import { areasApi } from '../areas/areasApi';
import { brandsApi } from '../brands/brandsApi';
import { categoriesApi } from '../categories/categoriesApi';
import { ProductFormModal } from './ProductFormModal';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { Product } from '../../types';

export const ProductsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(searchParams.get('action') === 'new');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data: areasData } = useQuery({
    queryKey: ['areas-lookup'],
    queryFn: () => areasApi.getAreas({ activeOnly: 'true', limit: 100 }),
  });

  const { data: brandsData } = useQuery({
    queryKey: ['brands-filter-options'],
    queryFn: () => brandsApi.getBrandOptions({ limit: 200 }),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories-filter-options'],
    queryFn: () => categoriesApi.getCategoryOptions({ limit: 200 }),
  });

  const brands = brandsData?.data || [];
  const categories = categoriesData?.data || [];

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'list', page, searchTerm, activeFilter, selectedBrand, selectedCategory],
    queryFn: () =>
      productsApi.getProducts({
        page,
        limit: 15,
        search: searchTerm || undefined,
        brandId: selectedBrand || undefined,
        categoryId: selectedCategory || undefined,
        activeOnly: activeFilter === 'all' ? undefined : activeFilter,
      }),
  });

  const createMutation = useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Product "${prod.name}" created successfully.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create product';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.updateProduct(id, data),
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Product "${prod.name}" updated.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to update product';
      toast.error(msg);
    },
  });

  const toggleArchiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      productsApi.updateProduct(id, { isActive }),
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.info(`Product status set to ${prod.isActive ? 'Active' : 'Archived'}.`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to change archive status';
      toast.error(msg);
    },
  });

  const products = productsData?.data || [];
  const meta = productsData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Inventory"
        subtitle="Manage product catalog, view brand/category classifications, and track stock across areas"
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => {
              setEditingProduct(null);
              setModalOpen(true);
            }}
          >
            Add Product
          </Button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by product name..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Brand Filter */}
          <select
            value={selectedBrand}
            onChange={(e) => {
              setSelectedBrand(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-700"
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
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-700"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-700"
          >
            <option value="all">All Status</option>
            <option value="true">Active Only</option>
            <option value="false">Archived Only</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No products found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {searchTerm || selectedBrand || selectedCategory
                ? 'No products match your search or filter criteria.'
                : 'Add your first product to begin tracking inventory.'}
            </p>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setEditingProduct(null);
                setModalOpen(true);
              }}
            >
              Add Product
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Product Name</th>
                  <th className="py-3.5 px-6">Brand</th>
                  <th className="py-3.5 px-6">Category</th>
                  <th className="py-3.5 px-6">Unit</th>
                  <th className="py-3.5 px-6 text-right">Available Stock</th>
                  <th className="py-3.5 px-6 text-right">Damaged Stock</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map((prod) => {
                  const brandName =
                    typeof prod.brandId === 'object' && (prod.brandId as any)?.name
                      ? (prod.brandId as any).name
                      : prod.brand?.name || '—';

                  const categoryName =
                    typeof prod.categoryId === 'object' && (prod.categoryId as any)?.name
                      ? (prod.categoryId as any).name
                      : prod.category?.name || '—';

                  return (
                    <tr key={prod._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-900 max-w-xs truncate">
                        <div>
                          <span className="block font-semibold">{prod.name}</span>
                          {prod.details && (
                            <span className="block text-xs text-slate-400 truncate">{prod.details}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-6 text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          {brandName}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-700">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200/50">
                          {categoryName}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 font-mono text-xs">{prod.unit}</td>
                      <td className="py-3.5 px-6 text-right font-bold text-emerald-700 font-mono">
                        {(prod.totalAvailable ?? 0).toLocaleString()} {prod.unit}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-rose-600 font-mono">
                        {(prod.totalDamaged ?? 0).toLocaleString()} {prod.unit}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <Badge variant={prod.isActive ? 'active' : 'archived'}>
                          {prod.isActive ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/products/${prod._id}`)}
                          leftIcon={<Eye className="w-3.5 h-3.5 text-teal-600" />}
                          title="View Balances & Movements"
                          className="text-xs"
                        >
                          Detail
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingProduct(prod);
                            setModalOpen(true);
                          }}
                          leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                          className="text-slate-600 hover:text-slate-900 text-xs"
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            toggleArchiveMutation.mutate({
                              id: prod._id,
                              isActive: !prod.isActive,
                            })
                          }
                          title={prod.isActive ? 'Archive Product' : 'Restore Product'}
                          className="text-xs"
                        >
                          {prod.isActive ? (
                            <span className="text-slate-400 hover:text-slate-700">Archive</span>
                          ) : (
                            <span className="text-teal-600 hover:text-teal-700">Restore</span>
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Product Create/Edit Modal */}
      <ProductFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingProduct(null);
        }}
        editingProduct={editingProduct}
        areas={areasData?.data || []}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={async (data) => {
          if (editingProduct) {
            await updateMutation.mutateAsync({ id: editingProduct._id, data });
          } else {
            await createMutation.mutateAsync(data);
          }
        }}
      />
    </div>
  );
};
