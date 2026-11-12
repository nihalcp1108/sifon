import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, AlertCircle, Ban, Trash2 } from 'lucide-react';
import { purchasesApi } from './purchasesApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Skeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { formatDate, generateIdempotencyKey } from '../../lib/utils';

export const PurchaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { data: purchase, isLoading } = useQuery({
    queryKey: ['purchase-detail', id],
    queryFn: () => purchasesApi.getPurchaseById(id!),
    enabled: !!id,
  });

  const postMutation = useMutation({
    mutationFn: () => purchasesApi.postDraft(id!, generateIdempotencyKey('post-pur')),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Purchase ${p.reference} has been posted. Stock balances increased.`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to post purchase draft');
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: () => purchasesApi.deleteDraft(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast.success('Purchase draft deleted successfully.');
      navigate('/purchases');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete purchase draft');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      purchasesApi.cancelPurchase(id!, { reason }, generateIdempotencyKey('cancel-pur')),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(`Purchase ${p.reference} cancelled and inventory reversed.`);
      setCancelModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel purchase');
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

  if (!purchase) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Purchase record not found.</p>
        <Button className="mt-4" onClick={() => navigate('/purchases')}>
          Back to Purchases
        </Button>
      </div>
    );
  }

  const totalUnits = purchase.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/purchases')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Purchases
        </Button>
      </div>

      <PageHeader
        title={`Purchase: ${purchase.reference}`}
        subtitle={`Recorded on ${formatDate(purchase.purchaseDate)} by ${purchase.createdBy?.name || 'Admin'}`}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={
                purchase.status === 'POSTED'
                  ? 'posted'
                  : purchase.status === 'DRAFT'
                  ? 'draft'
                  : 'cancelled'
              }
              className="text-xs px-3 py-1"
            >
              {purchase.status}
            </Badge>

            {purchase.status === 'DRAFT' && (
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

            {purchase.status === 'POSTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                leftIcon={<Ban className="w-4 h-4 text-rose-600" />}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Cancel / Reverse Purchase
              </Button>
            )}
          </div>
        }
      />

      {/* Cancellation Banner */}
      {purchase.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            This purchase was cancelled and its inventory reversed.
          </div>
          <p>
            <strong>Reason:</strong> {purchase.cancellationReason || 'No reason specified'}
          </p>
          <p className="text-slate-500">
            Cancelled at: {formatDate(purchase.cancelledAt)} by{' '}
            {purchase.cancelledBy?.name || 'Admin'}
          </p>
        </div>
      )}

      {/* Details Box */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-6 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Business Date</span>
            <span className="font-mono font-medium text-slate-800">{formatDate(purchase.purchaseDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Status</span>
            <span className="font-semibold text-slate-800">{purchase.status}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Total Quantity</span>
            <span className="font-mono font-bold text-emerald-700">+{totalUnits.toLocaleString()} units</span>
          </div>
        </div>

        {purchase.notes && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Notes / Delivery Memo
            </h4>
            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {purchase.notes}
            </p>
          </div>
        )}

        {/* Line Items Table */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Inbound Line Items
          </h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                  <th className="py-2.5 px-4">Line #</th>
                  <th className="py-2.5 px-4">Product</th>
                  <th className="py-2.5 px-4">Receiving Area</th>
                  <th className="py-2.5 px-4 text-right">Received Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchase.items.map((item, index) => (
                  <tr key={item._id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>
                        <span>{item.productId?.name || 'Product'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-navy-950">
                        {item.receivingAreaId?.displayName || 'Area'}
                      </span>
                      {item.receivingAreaId?.description && (
                        <span className="block text-[11px] text-slate-400">
                          {item.receivingAreaId.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                      +{item.quantity.toLocaleString()} {item.productId?.unit || 'pcs'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Cancel Purchase Dialog */}
      <ConfirmDialog
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel & Reverse Purchase?"
        message="Are you sure you want to cancel this posted purchase? Reversing this purchase will deduct the received quantities from the receiving areas. This operation will be rejected if deducting the quantity would cause available stock to become negative."
        confirmText="Cancel Purchase & Reverse Stock"
        variant="danger"
        requireReason={true}
        reasonPlaceholder="Specify reason for cancelling this purchase..."
        isLoading={cancelMutation.isPending}
        onConfirm={async (reason) => {
          if (reason) {
            await cancelMutation.mutateAsync(reason);
          }
        }}
      />

      {/* Delete Draft Dialog */}
      <ConfirmDialog
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Purchase Draft?"
        message="Are you sure you want to delete this purchase draft? Unposted drafts have not changed inventory and can be safely deleted."
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
