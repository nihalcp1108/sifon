import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Truck, Plus, Eye, Pencil, Trash2 } from 'lucide-react';
import { purchasesApi } from './purchasesApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../auth/useAuth';
import { formatDate, generateIdempotencyKey } from '../../lib/utils';
import { Purchase } from '../../types';

export const PurchasesListPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', 'list', page, statusFilter, startDate, endDate],
    queryFn: () =>
      purchasesApi.getPurchases({
        page,
        limit: 15,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (purchase: Purchase) =>
      purchasesApi.deletePurchase(purchase._id, generateIdempotencyKey('del-pur')),
    onSuccess: (_, purchase) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success(`Purchase ${purchase.reference} deleted successfully.`);
      setPurchaseToDelete(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete purchase');
    },
  });

  const purchases = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchases"
        subtitle="Manage inbound inventory receipts and purchase orders"
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => navigate('/purchases/new')}
          >
            Record Purchase
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            >
              <option value="">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
          </div>
        </div>

        {(statusFilter || startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : purchases.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No purchases found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Record an incoming inventory purchase to increase available warehouse stock.
            </p>
            <Button size="sm" variant="primary" onClick={() => navigate('/purchases/new')}>
              Record Purchase
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Reference</th>
                  <th className="py-3.5 px-6">Purchase Date</th>
                  <th className="py-3.5 px-6">Items Summary</th>
                  <th className="py-3.5 px-6">Total Units</th>
                  <th className="py-3.5 px-6">Created By</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {purchases.map(p => {
                  const totalUnits = p.items.reduce((sum, item) => sum + item.quantity, 0);

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-navy-950">
                        {p.reference}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 text-xs font-mono">
                        {formatDate(p.purchaseDate)}
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 text-xs">
                        <span className="font-semibold">{p.items.length} product(s)</span>
                        <span className="block text-[11px] text-slate-400 truncate max-w-xs">
                          {p.items
                            .map(
                              i =>
                                `${i.productId?.name || i.productId?.code || 'Product'} (${i.quantity} into ${i.receivingAreaId?.displayName || i.receivingAreaId?.name || 'Location'
                                })`
                            )
                            .join(', ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-emerald-700">
                        +{totalUnits.toLocaleString()} units
                      </td>
                      <td className="py-3.5 px-6 text-slate-500 text-xs">
                        {p.createdBy?.name || 'Admin'}
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge
                          variant={
                            p.status === 'POSTED'
                              ? 'posted'
                              : p.status === 'DRAFT'
                                ? 'draft'
                                : 'cancelled'
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right whitespace-nowrap space-x-1.5">
                        {p.status !== 'CANCELLED' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/purchases/${p._id}/edit`)}
                            leftIcon={<Pencil className="w-3.5 h-3.5 text-slate-500" />}
                            className="text-xs text-slate-600 hover:text-navy-950"
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/purchases/${p._id}`)}
                          leftIcon={<Eye className="w-3.5 h-3.5 text-teal-600" />}
                          className="text-xs"
                        >
                          Details
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPurchaseToDelete(p)}
                            leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                            className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          >
                            Delete
                          </Button>
                        )}
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

      {/* Delete Purchase Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!purchaseToDelete}
        onClose={() => setPurchaseToDelete(null)}
        title={`Delete Purchase: ${purchaseToDelete?.reference || ''}`}
        message={
          purchaseToDelete?.status === 'POSTED'
            ? `Are you sure you want to delete purchase "${purchaseToDelete.reference}"? Deleting this purchase will permanently remove the record and reverse its stock effect by subtracting ${purchaseToDelete.items.reduce(
                (sum, item) => sum + item.quantity,
                0
              )} unit(s) from the receiving location(s). Deletion will be rejected if any location has insufficient remaining stock.`
            : purchaseToDelete?.status === 'DRAFT'
            ? `Are you sure you want to delete draft purchase "${purchaseToDelete.reference}"? Unposted drafts have not changed inventory and will be deleted without affecting stock.`
            : `Are you sure you want to delete cancelled purchase "${purchaseToDelete?.reference}"? This record was already cancelled and its inventory reversed; deleting it will remove it from the list without affecting stock.`
        }
        confirmText="Confirm Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={async () => {
          if (purchaseToDelete) {
            await deleteMutation.mutateAsync(purchaseToDelete);
          }
        }}
      />
    </div>
  );
};
