import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, Plus, Search, Edit2, Eye } from 'lucide-react';
import { productsApi } from './productsApi';
import { areasApi } from '../areas/areasApi';
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

  const { data: areasData } = useQuery({
    queryKey: ['areas-lookup'],
    queryFn: () => areasApi.getAreas({ activeOnly: 'true', limit: 100 }),
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', 'list', page, searchTerm, activeFilter],
    queryFn: () =>
      productsApi.getProducts({
        page,
        limit: 15,
        search: searchTerm || undefined,
        activeOnly: activeFilter === 'all' ? undefined : activeFilter,
      }),
  });

  const createMutation = useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Product ${prod.name} (${prod.code}) created successfully.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.updateProduct(id, data),
    onSuccess: (prod) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Product ${prod.name} updated.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update product');
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
      toast.error(err.message || 'Failed to change archive status');
    },
  });

  const products = productsData?.data || [];
  const meta = productsData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Inventory"
        subtitle="Manage SKU catalog, view total available & damaged balances across areas"
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by code or product name..."
            value={searchTerm}
            onChange={e => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
          <select
            value={activeFilter}
            onChange={e => {
              setActiveFilter(e.target.value as any);
              setPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-navy-700"
          >
            <option value="all">All Products</option>
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
              {searchTerm ? 'No products match your search query.' : 'Add your first product to begin tracking inventory.'}
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
                  <th className="py-3.5 px-6">SKU / Code</th>
                  <th className="py-3.5 px-6">Product Name</th>
                  <th className="py-3.5 px-6">Unit</th>
                  <th className="py-3.5 px-6 text-right">Available Stock</th>
                  <th className="py-3.5 px-6 text-right">Damaged Stock</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map(prod => (
                  <tr key={prod._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-navy-900">
                      {prod.code}
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-900 max-w-xs truncate">
                      <div>
                        <span className="block">{prod.name}</span>
                        {prod.details && (
                          <span className="block text-xs text-slate-400 truncate">{prod.details}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 font-mono text-xs">
                      {prod.unit}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-emerald-700 font-mono">
                      {(prod.totalAvailable ?? 0).toLocaleString()} {prod.unit}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-rose-600 font-mono">
                      {(prod.totalDamaged ?? 0).toLocaleString()} {prod.unit}
                    </td>
                    <td className="py-3.5 px-6">
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
                ))}
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
        onSubmit={async data => {
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
