import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, RotateCcw, AlertCircle } from 'lucide-react';
import { returnsApi } from './returnsApi';
import { salesApi } from '../sales/salesApi';
import { areasApi } from '../areas/areasApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { useToast } from '../../components/common/Toast';
import { generateIdempotencyKey } from '../../lib/utils';
import { SaleItem } from '../../types';

const returnFormSchema = z
  .object({
    reference: z.string().trim().max(50).optional(),
    returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
    saleId: z.string().min(1, 'Please select an original sale'),
    saleLineId: z.string().min(1, 'Please select a sale line item'),
    receivingAreaId: z.string().min(1, 'Please select receiving area'),
    nonDamagedQuantity: z.coerce
      .number()
      .int()
      .min(0, 'Cannot be negative')
      .default(0),
    damagedQuantity: z.coerce
      .number()
      .int()
      .min(0, 'Cannot be negative')
      .default(0),
    reason: z.string().trim().min(3, 'Reason is required (minimum 3 characters)').max(500),
  })
  .refine(data => data.nonDamagedQuantity > 0 || data.damagedQuantity > 0, {
    message: 'At least one of non-damaged or damaged quantity must be greater than zero',
    path: ['nonDamagedQuantity'],
  });

type ReturnFormData = z.infer<typeof returnFormSchema>;

export const ReturnCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();

  const initialSaleId = searchParams.get('saleId') || '';
  const todayStr = new Date().toISOString().split('T')[0];

  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch posted sales for dropdown
  const { data: salesData } = useQuery({
    queryKey: ['sales-posted-dropdown'],
    queryFn: () => salesApi.getSales({ status: 'POSTED', limit: 100 }),
  });

  // Fetch active warehouse areas
  const { data: areasData } = useQuery({
    queryKey: ['areas', 'options'],
    queryFn: ({ signal }) => areasApi.getAreaOptions({ activeOnly: true, limit: 100 }, signal),
  });

  const postedSales = salesData?.data || [];
  const activeAreas = areasData?.data || [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ReturnFormData>({
    resolver: zodResolver(returnFormSchema),
    defaultValues: {
      returnDate: todayStr,
      saleId: initialSaleId,
      saleLineId: '',
      receivingAreaId: '',
      nonDamagedQuantity: 0,
      damagedQuantity: 0,
      reason: '',
    },
  });

  const selectedSaleId = watch('saleId');
  const selectedSaleLineId = watch('saleLineId');
  const nonDamagedQty = watch('nonDamagedQuantity') || 0;
  const damagedQty = watch('damagedQuantity') || 0;

  // Selected sale object
  const selectedSale = postedSales.find(s => s._id === selectedSaleId);

  // Selected sale line item
  const selectedLine: SaleItem | undefined = selectedSale?.items.find(
    i => i._id === selectedSaleLineId
  );

  // Update receiving area when sale line changes
  useEffect(() => {
    if (selectedLine) {
      const defaultAreaId =
        (selectedLine.sourceAreaId as any)?._id || (selectedLine.sourceAreaId as any);
      if (defaultAreaId) {
        setValue('receivingAreaId', defaultAreaId.toString());
      }
    }
  }, [selectedLine, setValue]);

  // Limits calculation
  const soldQty = selectedLine ? selectedLine.quantity : 0;
  const alreadyReturned = selectedLine ? selectedLine.returnedQuantity || 0 : 0;
  const remainingReturnable = Math.max(0, soldQty - alreadyReturned);
  const totalReturning = nonDamagedQty + damagedQty;
  const isOverLimit = totalReturning > remainingReturnable;

  const createMutation = useMutation({
    mutationFn: ({ data, key }: { data: ReturnFormData; key: string }) =>
      returnsApi.createReturn(data, key),
    onSuccess: (returnDoc) => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      queryClient.invalidateQueries({ queryKey: ['damaged'] });
      toast.success(`Customer return ${returnDoc.reference} processed successfully.`);
      navigate(`/returns/${returnDoc._id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process return';
      toast.error(msg);
    },
  });

  const onSubmit = async (data: ReturnFormData) => {
    if (isOverLimit) {
      setSubmitError(
        `Total return quantity (${totalReturning}) cannot exceed remaining returnable quantity (${remainingReturnable}).`
      );
      return;
    }

    setSubmitError(null);
    clearErrors();

    const key = generateIdempotencyKey('ret');
    const cleanPayload: ReturnFormData = {
      returnDate: data.returnDate,
      saleId: data.saleId.trim(),
      saleLineId: data.saleLineId.trim(),
      receivingAreaId: data.receivingAreaId?.trim() || '',
      nonDamagedQuantity: Math.floor(Number(data.nonDamagedQuantity) || 0),
      damagedQuantity: Math.floor(Number(data.damagedQuantity) || 0),
      reason: data.reason.trim(),
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
        title="Record Customer Sales Return"
        subtitle="Link return directly to original sale line. Non-damaged restores available stock; damaged goes to separate damaged inventory."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Return Header */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            1. Sale Selection
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Original Sale Order"
              error={errors.saleId?.message}
              {...register('saleId')}
            >
              <option value="">-- Choose Sale Order --</option>
              {postedSales.map(s => (
                <option key={s._id} value={s._id}>
                  {s.reference} &bull; {s.items.length} items &bull; ({s.saleDate?.substring(0, 10)})
                </option>
              ))}
            </Select>

            <Input
              label="Return Date"
              type="date"
              error={errors.returnDate?.message}
              {...register('returnDate')}
            />
          </div>

          {selectedSale && (
            <div>
              <Select
                label="Select Sold Product Line"
                error={errors.saleLineId?.message}
                {...register('saleLineId')}
              >
                <option value="">-- Select line item to return --</option>
                {selectedSale.items.map((line, idx) => {
                  const ret = line.returnedQuantity || 0;
                  const retRemaining = line.quantity - ret;
                  return (
                    <option key={line._id} value={line._id} disabled={retRemaining <= 0}>
                      Line #{idx + 1}: {line.productId?.name} - Sold:{' '}
                      {line.quantity}, Returned: {ret}, Remaining Returnable: {retRemaining}
                    </option>
                  );
                })}
              </Select>
            </div>
          )}
        </div>

        {/* Selected Line Item Verification Card */}
        {selectedLine && (
          <div className="bg-navy-900 text-white p-5 rounded-xl border border-navy-800 shadow-md">
            <div className="flex items-center justify-between mb-3 border-b border-navy-800 pb-3">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-400 block">
                  Original Line Item Verification
                </span>
                <h4 className="text-base font-bold text-white">
                  {selectedLine.productId?.name}
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-300">
                Original Area: {selectedLine.sourceAreaId?.displayName}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-2 rounded-lg bg-navy-950/60 border border-navy-800">
                <span className="block text-[11px] text-slate-400 uppercase">Sold Quantity</span>
                <span className="text-xl font-bold font-mono text-white">{soldQty}</span>
              </div>
              <div className="p-2 rounded-lg bg-navy-950/60 border border-navy-800">
                <span className="block text-[11px] text-slate-400 uppercase">Already Returned</span>
                <span className="text-xl font-bold font-mono text-amber-400">{alreadyReturned}</span>
              </div>
              <div className="p-2 rounded-lg bg-teal-950/60 border border-teal-800">
                <span className="block text-[11px] text-teal-300 uppercase">Max Returnable</span>
                <span className="text-xl font-bold font-mono text-teal-400">{remainingReturnable}</span>
              </div>
            </div>
          </div>
        )}

        {/* Return Details */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            2. Return Quantities & Receiving Area
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Input
                label="Non-Damaged Quantity"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                error={errors.nonDamagedQuantity?.message}
                helperText="Restores available stock"
                {...register('nonDamagedQuantity')}
              />
            </div>

            <div>
              <Input
                label="Damaged Quantity"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                error={errors.damagedQuantity?.message}
                helperText="Moves to separate damaged stock"
                {...register('damagedQuantity')}
              />
            </div>

            <div>
              <Select
                label="Receiving Storage Area"
                error={errors.receivingAreaId?.message}
                helperText="Defaults to original sale area"
                {...register('receivingAreaId')}
              >
                <option value="">-- Select Area --</option>
                {activeAreas.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.displayName} {a.description ? `(${a.description})` : ''}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Validation Feedback Banner */}
          {selectedLine && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                isOverLimit
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : totalReturning > 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <span>
                Total Returning: <strong>{totalReturning}</strong> unit(s) &bull; Maximum Allowed:{' '}
                <strong>{remainingReturnable}</strong> unit(s)
              </span>
              {isOverLimit && (
                <span className="font-bold text-rose-600">Exceeds Returnable Limit!</span>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason / Return Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Detailed reason for customer return (required, e.g. Customer ordered incorrect size; damaged during transport)..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700 placeholder-slate-400"
              {...register('reason')}
            />
            {errors.reason && (
              <p className="mt-1 text-xs text-rose-600 font-medium">{errors.reason.message}</p>
            )}
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
            disabled={!selectedLine || isOverLimit || totalReturning <= 0}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Post Customer Return
          </Button>
        </div>
      </form>
    </div>
  );
};
