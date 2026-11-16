import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { returnsApi } from './returnsApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useToast } from '../../components/common/Toast';
import { generateIdempotencyKey } from '../../lib/utils';
import { SearchableProductSelect } from '../products/SearchableProductSelect';
import { SearchableLocationSelect } from '../areas/SearchableLocationSelect';
import { ProductStockBreakdown } from '../products/ProductStockBreakdown';

const returnFormSchema = z.object({
  reference: z.string().trim().max(50, 'Reference cannot exceed 50 characters').optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  productId: z.string().min(1, 'Please select a product'),
  receivingAreaId: z.string().min(1, 'Please select destination location'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
  condition: z.enum(['USABLE', 'DAMAGED'], {
    errorMap: () => ({ message: 'Please select condition' }),
  }),
  notes: z.string().trim().min(2, 'Notes or reason is required').max(1000, 'Notes cannot exceed 1000 characters'),
});

type ReturnFormData = z.infer<typeof returnFormSchema>;

export const ReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ReturnFormData>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      returnDate: todayStr,
      productId: '',
      receivingAreaId: '',
      quantity: 1,
      condition: 'USABLE',
      notes: '',
    },
  });

  const selectedProductId = watch('productId');
  const selectedCondition = watch('condition');

  const createMutation = useMutation({
    mutationFn: ({ data, key }: { data: any; key: string }) =>
      returnsApi.createReturn(data, key),
    onSuccess: (returnDoc) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['damaged'] });
      toast.success(`Return ${returnDoc.reference} processed successfully.`);
      navigate(`/returns/${returnDoc._id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process return';
      toast.error(msg);
    },
  });

  const onSubmit = async (data: ReturnFormData) => {
    setSubmitError(null);
    clearErrors();

    const key = generateIdempotencyKey('ret');
    const cleanPayload = {
      returnDate: data.returnDate,
      productId: data.productId.trim(),
      receivingAreaId: data.receivingAreaId.trim(),
      quantity: Math.floor(Number(data.quantity)),
      condition: data.condition,
      notes: data.notes.trim(),
      reason: data.notes.trim(),
      ...(data.reference?.trim() ? { reference: data.reference.trim() } : {}),
    };

    try {
      await createMutation.mutateAsync({ data: cleanPayload, key });
    } catch (err: any) {
      const errorData = err?.response?.data;
      const issues = errorData?.error?.details || errorData?.details;
      let hasMappedIssue = false;

      if (Array.isArray(issues) && issues.length > 0) {
        issues.forEach((issue: { path: string; message: string }) => {
          if (issue.path) {
            setError(issue.path as any, {
              type: 'server',
              message: issue.message,
            });
            hasMappedIssue = true;
          }
        });
      }

      const mainMsg =
        errorData?.message ||
        err?.message ||
        'Failed to process return. Please verify your inputs.';

      if (hasMappedIssue) {
        setSubmitError(`Please correct the highlighted form errors: ${mainMsg}`);
      } else {
        setSubmitError(mainMsg);
      }
    }
  };

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
        title="Record Product Return"
        subtitle="Process product returns. Usable returns restore available stock in the destination location; damaged returns increase damaged inventory without increasing usable stock."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* General Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            General Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Return Date"
              type="date"
              error={errors.returnDate?.message}
              {...register('returnDate')}
            />

            <Input
              label="Return Reference (Optional)"
              placeholder="Leave blank to auto-generate (e.g. RET-20261106-0001)"
              error={errors.reference?.message}
              {...register('reference')}
            />
          </div>
        </div>

        {/* Product & Location Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            Product & Return Destination
          </h3>

          <div className="space-y-4">
            <div>
              <Controller
                control={control}
                name="productId"
                render={({ field }) => (
                  <SearchableProductSelect
                    id="productId"
                    label="Product"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.productId?.message}
                  />
                )}
              />
              {selectedProductId && (
                <div className="mt-3">
                  <ProductStockBreakdown productId={selectedProductId} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Controller
                  control={control}
                  name="receivingAreaId"
                  render={({ field }) => (
                    <SearchableLocationSelect
                      id="receivingAreaId"
                      label="Destination Location"
                      value={field.value}
                      onChange={field.onChange}
                      mode="return"
                      productId={selectedProductId}
                      error={errors.receivingAreaId?.message}
                    />
                  )}
                />
              </div>

              <div>
                <Input
                  label="Return Quantity"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Qty"
                  error={errors.quantity?.message}
                  {...register('quantity')}
                />
              </div>
            </div>

            {/* Condition Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Condition <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    selectedCondition === 'USABLE'
                      ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value="USABLE"
                    {...register('condition')}
                    className="mt-1 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-900">Usable Condition</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Restores usable available stock in the destination location.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    selectedCondition === 'DAMAGED'
                      ? 'border-rose-500 bg-rose-50/50 ring-1 ring-rose-500'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    value="DAMAGED"
                    {...register('condition')}
                    className="mt-1 text-rose-600 focus:ring-rose-500"
                  />
                  <div>
                    <span className="block text-sm font-bold text-slate-900">Damaged Condition</span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Allocates to damaged stock. Will NOT increase usable stock.
                    </span>
                  </div>
                </label>
              </div>
              {errors.condition && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium">{errors.condition.message}</p>
              )}
            </div>

            {/* Notes / Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Notes / Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                placeholder="Reason for return, customer feedback, condition inspection notes..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700 placeholder-slate-400"
                {...register('notes')}
              />
              {errors.notes && (
                <p className="mt-1 text-xs text-rose-600 font-medium">{errors.notes.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/returns')}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="teal"
            isLoading={createMutation.isPending}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Post Return
          </Button>
        </div>
      </form>
    </div>
  );
};
