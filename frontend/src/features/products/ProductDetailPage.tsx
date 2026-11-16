import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, Boxes, AlertTriangle, CheckCircle, Clock, Tag, Layers } from 'lucide-react';
import { productsApi } from './productsApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { Skeleton, TableSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';
import { useAuth } from '../auth/useAuth';

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [movementPage, setMovementPage] = useState(1);

  const { data: product, isLoading: isProductLoading } = useQuery({
    queryKey: ['product-detail', id],
    queryFn: () => productsApi.getProductById(id!),
    enabled: !!id,
  });

  const { data: movementsData, isLoading: isMovementsLoading } = useQuery({
    queryKey: ['product-movements', id, movementPage],
    queryFn: () => productsApi.getProductMovements(id!, { page: movementPage, limit: 15 }),
    enabled: !!id && user?.role !== 'PRODUCT_VIEWER',
  });

  if (isProductLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Product not found.</p>
        <Button className="mt-4" onClick={() => navigate('/products')}>
          Back to Products
        </Button>
      </div>
    );
  }

  const movements = movementsData?.data || [];
  const meta = movementsData?.meta;

  const brandName =
    typeof product.brandId === 'object' && (product.brandId as any)?.name
      ? (product.brandId as any).name
      : product.brand?.name || '—';

  const categoryName =
    typeof product.categoryId === 'object' && (product.categoryId as any)?.name
      ? (product.categoryId as any).name
      : product.category?.name || '—';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/products')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Products
        </Button>
      </div>

      <PageHeader
        title={product.name}
        subtitle={product.details || 'Product balance details and ledger movement audit trail'}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              Brand: {brandName}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
              <Layers className="w-3.5 h-3.5 text-teal-600" />
              Category: {categoryName}
            </span>
            <Badge variant={product.isActive ? 'active' : 'archived'}>
              {product.isActive ? 'Active Catalog' : 'Archived Catalog'}
            </Badge>
          </div>
        }
      />

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Available Stock
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-navy-950">
              {product.totalAvailable.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">{product.unit}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Available for sales & transfer</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Damaged Stock
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-rose-600">
              {product.totalDamaged.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500 font-medium">{product.unit}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Excluded from available inventory</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Unit of Measure
            </span>
            <div className="p-2 rounded-lg bg-navy-50 text-navy-700 border border-navy-200">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-navy-950">{product.unit}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Base accounting unit</p>
        </div>
      </div>

      {/* Location-Wise Balances */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
            <Boxes className="w-4 h-4 text-teal-600" />
            Location Stock Breakdown
          </h3>
          <span className="text-xs text-slate-400">Available and damaged stock per location</span>
        </div>

        {product.balances.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 italic">
            No stock recorded in any location for this product yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Location</th>
                  <th className="py-3.5 px-6 text-right">Available Stock</th>
                  <th className="py-3.5 px-6 text-right">Damaged Stock</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {product.balances.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      {b.areaId?.displayName || b.areaId?.name || (b.areaId?.areaNumber ? `Area ${b.areaId.areaNumber}` : 'Location')}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-emerald-700 font-mono">
                      {b.availableQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-rose-600 font-mono">
                      {b.damagedQuantity.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <Badge variant={b.areaId?.isActive ? 'active' : 'archived'} className="text-xs">
                        {b.areaId?.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Movement Ledger Audit History - Hidden for PRODUCT_VIEWER */}
      {user?.role !== 'PRODUCT_VIEWER' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-navy-950 flex items-center gap-2">
              <Clock className="w-4 h-4 text-navy-700" />
              Immutable Movement Ledger History
            </h3>
            <span className="text-xs text-slate-400">Chronological stock audit</span>
          </div>

          {isMovementsLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : movements.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No ledger movements found for this product.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3 px-6">Business Date</th>
                    <th className="py-3 px-6">Movement Type</th>
                    <th className="py-3 px-6">Location</th>
                    <th className="py-3 px-6 text-right">Available Delta</th>
                    <th className="py-3 px-6 text-right">Damaged Delta</th>
                    <th className="py-3 px-6">Performed By</th>
                    <th className="py-3 px-6">Notes / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {movements.map((m) => (
                    <tr key={m._id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-6 font-mono text-slate-600">
                        {formatDate(m.businessDate)}
                      </td>
                      <td className="py-3 px-6">
                        <span className="font-semibold text-slate-800 uppercase tracking-wider">
                          {m.movementType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-6 font-medium text-slate-800">
                        {m.areaId?.displayName || 'Location'}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold">
                        {m.availableDelta > 0 ? (
                          <span className="text-emerald-600">+{m.availableDelta}</span>
                        ) : m.availableDelta < 0 ? (
                          <span className="text-rose-600">{m.availableDelta}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold">
                        {m.damagedDelta > 0 ? (
                          <span className="text-amber-600">+{m.damagedDelta}</span>
                        ) : m.damagedDelta < 0 ? (
                          <span className="text-rose-600">{m.damagedDelta}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-6 text-slate-600">
                        {m.createdBy?.name || 'Admin'}
                      </td>
                      <td className="py-3 px-6 text-slate-500 max-w-xs truncate">
                        {m.reason || m.notes || '-'}
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
              onPageChange={setMovementPage}
              isLoading={isMovementsLoading}
            />
          )}
        </div>
      )}
    </div>
  );
};
