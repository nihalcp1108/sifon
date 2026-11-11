import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, AlertCircle, Ban, Trash2, RotateCcw } from 'lucide-react';
import { salesApi } from './salesApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Skeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { formatDate, generateIdempotencyKey } from '../../lib/utils';

export const SaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sale-detail', id],
    queryFn: () => salesApi.getSaleById(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => salesApi.postDraft(id!, generateIdempotencyKey('post-sal')),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['sale-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Sale ${s.reference} posted. Inventory stock deducted.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to post sale draft');
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: () => salesApi.deleteDraft(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      toast.success('Sale draft deleted successfully.');
      navigate('/sales');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete sale draft');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      salesApi.cancelSale(id!, { reason }, generateIdempotencyKey('cancel-sal')),
    onSuccess: (s) => {
      queryClient.invalidateQueries({ queryKey: ['sale-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Sale ${s.reference} cancelled and stock restored to original areas.`);
      setCancelModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel sale');
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Sale record not found.</p>
        <Button className="mt-4" onClick={() => navigate('/sales')}>
          Back to Sales
        </Button>
      </div>
    );
  }

  const totalSold = sale.items.reduce((sum, item) => sum + item.quantity, 0);
  const totalReturned = sale.items.reduce((sum, item) => sum + (item.returnedQuantity || 0), 0);
  const hasActiveReturns = totalReturned > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/sales')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Sales
        </Button>
      </div>

      <PageHeader
        title={`Sale: ${sale.reference}`}
        subtitle={`Recorded on ${formatDate(sale.saleDate)} by ${sale.createdBy?.name || 'Admin'}`}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                sale.status === 'POSTED'
                  ? 'posted'
                  : sale.status === 'DRAFT'
                  ? 'draft'
                  : 'cancelled'
              }
              className="text-xs px-3 py-1"
            >
              {sale.status}
            </Badge>

            {sale.status === 'POSTED' && (
              <Button
                size="sm"
                variant="teal"
                onClick={() => navigate(`/returns/new?saleId=${sale._id}`)}
                leftIcon={<RotateCcw className="w-4 h-4" />}
              >
                Record Return Against Sale
              </Button>
            )}

            {sale.status === 'DRAFT' && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => postMutation.mutate()}
                  isLoading={postMutation.isPending}
                  leftIcon={<Check className="w-4 h-4 text-teal-400" />}
                >
                  Post Draft
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteModalOpen(true)}
                  leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
                  className="text-rose-600 hover:text-rose-700"
                >
                  Delete
                </Button>
              </>
            )}

            {sale.status === 'POSTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                leftIcon={<Ban className="w-4 h-4 text-rose-600" />}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Cancel / Reverse Sale
              </Button>
            )}
          </div>
        }
      />

      {/* Cancellation Banner */}
      {sale.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            This sale was cancelled and its stock deduction was restored.
          </div>
          <p>
            <strong>Reason:</strong> {sale.cancellationReason || 'No reason specified'}
          </p>
          <p className="text-slate-500">
            Cancelled at: {formatDate(sale.cancelledAt)} by {sale.cancelledBy?.name || 'Admin'}
          </p>
        </div>
      )}

      {/* Details Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Business Date</span>
            <span className="font-mono font-medium text-slate-800">{formatDate(sale.saleDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Status</span>
            <span className="font-semibold text-slate-800">{sale.status}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Total Quantity Sold</span>
            <span className="font-mono font-bold text-slate-900">{totalSold.toLocaleString()} units</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Active Returns</span>
            <span className={`font-mono font-bold ${hasActiveReturns ? 'text-amber-700' : 'text-slate-400'}`}>
              {totalReturned} units
            </span>
          </div>
        </div>

        {sale.notes && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Customer / Dispatch Memo
            </h4>
            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {sale.notes}
            </p>
          </div>
        )}

        {/* Line Items Table */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Outbound Line Items
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="py-2.5 px-4">Line #</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Source Area</th>
                  <th className="py-2.5 px-4 text-right">Quantity Sold</th>
                  <th className="py-2.5 px-4 text-right">Active Returned</th>
                  <th className="py-2.5 px-4 text-right">Remaining Returnable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, index) => {
                  const retQty = item.returnedQuantity || 0;
                  const returnable = item.quantity - retQty;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div>
                          <span>{item.productId?.name || 'Product'}</span>
                          <span className="block font-mono text-slate-400 text-[11px]">
                            {item.productId?.code}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-navy-950">
                          {item.sourceAreaId?.displayName || 'Area'}
                        </span>
                        {item.sourceAreaId?.description && (
                          <span className="block text-[11px] text-slate-400">
                            {item.sourceAreaId.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        {item.quantity.toLocaleString()} {item.productId?.unit || 'pcs'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700">
                        {retQty > 0 ? `${retQty.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        {returnable.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cancel Sale Dialog */}
      <ConfirmDialog
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel & Reverse Sale?"
        message={
          hasActiveReturns
            ? 'CANNOT CANCEL: Active customer returns currently exist against this sale. In accordance with inventory integrity rules, all associated customer returns must be reversed before this sale can be cancelled.'
            : 'Are you sure you want to cancel this sale? Reversing this sale will restore the deducted stock back to the original source areas.'
        }
        confirmText={hasActiveReturns ? 'Cancellation Blocked' : 'Cancel Sale & Restore Stock'}
        variant="danger"
        requireReason={!hasActiveReturns}
        reasonPlaceholder="Specify reason for cancelling this sale..."
        isLoading={cancelMutation.isPending}
        onConfirm={async (reason) => {
          if (hasActiveReturns) {
            toast.error('Sale cancellation blocked: Reverse active returns first.');
            setCancelModalOpen(false);
            return;
          }
          if (reason) {
            await cancelMutation.mutateAsync(reason);
          }
        }}
      />

      {/* Delete Draft Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Sale Draft?"
        message="Are you sure you want to delete this sale draft? Unposted drafts have not changed inventory and can be safely deleted."
        confirmText="Delete Draft"
        variant="danger"
        isLoading={deleteDraftMutation.isPending}
        onConfirm={async () => {
          await deleteDraftMutation.mutateAsync();
        }}
      />
    </div>
  );
};
