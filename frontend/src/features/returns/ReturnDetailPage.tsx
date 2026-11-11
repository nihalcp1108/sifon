import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, AlertCircle, Ban, CheckCircle2 } from 'lucide-react';
import { returnsApi } from './returnsApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Skeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { formatDate, generateIdempotencyKey } from '../../lib/utils';

export const ReturnDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const { data: returnDoc, isLoading } = useQuery({
    queryKey: ['return-detail', id],
    queryFn: () => returnsApi.getReturnById(id!),
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: (reason: string) =>
      returnsApi.cancelReturn(id!, { reason }, generateIdempotencyKey('cancel-ret')),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['return-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['damaged'] });
      toast.success(`Return ${r.reference} cancelled and stock balances reversed.`);
      setCancelModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel return');
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

  if (!returnDoc) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Return record not found.</p>
        <Button className="mt-4" onClick={() => navigate('/returns')}>
          Back to Returns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/returns')}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Back to Returns
        </Button>
      </div>

      <PageHeader
        title={`Customer Return: ${returnDoc.reference}`}
        subtitle={`Recorded on ${formatDate(returnDoc.returnDate)} by ${returnDoc.createdBy?.name || 'Admin'}`}
        action={
          <div className="flex items-center gap-2">
            <Badge
              variant={returnDoc.status === 'POSTED' ? 'posted' : 'cancelled'}
              className="text-xs px-3 py-1"
            >
              {returnDoc.status}
            </Badge>

            {returnDoc.status === 'POSTED' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelModalOpen(true)}
                leftIcon={<Ban className="w-4 h-4 text-rose-600" />}
                className="text-rose-600 border-rose-200 hover:bg-rose-50"
              >
                Cancel / Reverse Return
              </Button>
            )}
          </div>
        }
      />

      {/* Cancellation Banner */}
      {returnDoc.status === 'CANCELLED' && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            This customer return was cancelled and its inventory movements reversed.
          </div>
          <p>
            <strong>Reason:</strong> {returnDoc.cancellationReason || 'No reason specified'}
          </p>
          <p className="text-slate-500">
            Cancelled at: {formatDate(returnDoc.cancelledAt)} by{' '}
            {returnDoc.cancelledBy?.name || 'Admin'}
          </p>
        </div>
      )}

      {/* Main Details Grid */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-6 border-b border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Return Date</span>
            <span className="font-mono font-medium text-slate-800">{formatDate(returnDoc.returnDate)}</span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Original Sale</span>
            <span className="font-mono font-bold text-navy-950">
              {returnDoc.saleId?.reference || '-'}
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Product</span>
            <span className="font-semibold text-slate-800">
              {returnDoc.productId?.name} ({returnDoc.productId?.code})
            </span>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold block mb-1">Receiving Area</span>
            <span className="font-semibold text-navy-950">
              {returnDoc.receivingAreaId?.displayName || 'Area'}
            </span>
          </div>
        </div>

        {/* Quantities Box */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                Non-Damaged Returned Quantity
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-700">
              +{returnDoc.nonDamagedQuantity.toLocaleString()} {returnDoc.productId?.unit || 'pcs'}
            </div>
            <p className="text-[11px] text-emerald-600 mt-1">
              Restored into available inventory in {returnDoc.receivingAreaId?.displayName}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/80">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
                Damaged Returned Quantity
              </span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-600">
              +{returnDoc.damagedQuantity.toLocaleString()} {returnDoc.productId?.unit || 'pcs'}
            </div>
            <p className="text-[11px] text-rose-600 mt-1">
              Placed in separate damaged inventory. Never counted as available stock.
            </p>
          </div>
        </div>

        {/* Reason Box */}
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Return Reason / Justification
          </h4>
          <p className="text-xs text-slate-800 bg-slate-50 p-3.5 rounded-lg border border-slate-100 leading-relaxed">
            {returnDoc.reason}
          </p>
        </div>
      </div>

      {/* Cancel Return Dialog */}
      <ConfirmDialog
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel & Reverse Return?"
        message="Are you sure you want to cancel this return? Reversing will atomically deduct the restored available units and damaged units from the receiving area. This operation will be rejected if the required balances are no longer sufficient."
        confirmText="Cancel Return & Reverse Stock"
        variant="danger"
        requireReason={true}
        reasonPlaceholder="Specify reason for cancelling this customer return..."
        isLoading={cancelMutation.isPending}
        onConfirm={async (reason) => {
          if (reason) {
            await cancelMutation.mutateAsync(reason);
          }
        }}
      />
    </div>
  );
};
