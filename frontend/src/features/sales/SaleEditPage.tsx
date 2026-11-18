import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, AlertCircle, Save, X } from 'lucide-react';
import { salesApi } from './salesApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';
import { generateIdempotencyKey } from '../../lib/utils';
import { SearchableProductSelect } from '../products/SearchableProductSelect';
import { SearchableLocationSelect } from '../areas/SearchableLocationSelect';
import { ProductStockBreakdown } from '../products/ProductStockBreakdown';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Please select a product'),
  sourceAreaId: z.string().min(1, 'Please select source location'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
});

const saleEditFormSchema = z.object({
  reference: z.string().trim().max(50, 'Reference cannot exceed 50 characters').optional(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  items: z.array(saleItemSchema).min(1, 'At least one line item is required'),
});

type SaleEditFormData = z.infer<typeof saleEditFormSchema>;

export const SaleEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch sale to edit
  const {
    data: sale,
    isLoading: isSaleLoading,
    error: saleLoadError,
  } = useQuery({
    queryKey: ['sale-detail', id],
    queryFn: () => salesApi.getSaleById(id!),
    enabled: !!id,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setError,
    clearErrors,
    reset,
    formState: { errors },
  } = useForm<SaleEditFormData>({
    resolver: zodResolver(saleEditFormSchema),
    defaultValues: {
      saleDate: '',
      reference: '',
      notes: '',
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Prefill form once sale data is loaded
  useEffect(() => {
    if (sale) {
      if (sale.status === 'CANCELLED') {
        toast.error('Cancelled sales cannot be edited.');
        navigate(`/sales/${id}`);
        return;
      }

      const dateStr = sale.saleDate
        ? new Date(sale.saleDate).toISOString().split('T')[0]
        : '';

      reset({
        reference: sale.reference,
        saleDate: dateStr,
        notes: sale.notes || '',
        items: sale.items.map((i: any) => ({
          productId: i.productId?._id ? i.productId._id.toString() : i.productId.toString(),
          sourceAreaId: i.sourceAreaId?._id
            ? i.sourceAreaId._id.toString()
            : i.sourceAreaId.toString(),
          quantity: i.quantity,
        })),
      });
    }
  }, [sale, reset, navigate, id, toast]);

  const updateMutation = useMutation({
    mutationFn: ({
      data,
      key,
    }: {
      data: SaleEditFormData & { expectedVersion?: number; updatedAt?: string };
      key: string;
    }) => salesApi.updateSale(id!, data, key),
    onSuccess: (updated) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['areas'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });

      toast.success(`Sale ${updated.reference} updated successfully.`);
      navigate(`/sales/${id}`);
    },
  });

  const onSubmit = async (data: SaleEditFormData) => {
    setSubmitError(null);
    clearErrors();

    const key = generateIdempotencyKey('edit-sal');
    const cleanPayload = {
      saleDate: data.saleDate,
      items: data.items.map((item) => ({
        productId: item.productId.trim(),
        sourceAreaId: item.sourceAreaId.trim(),
        quantity: Math.floor(Number(item.quantity)),
      })),
      ...(data.reference?.trim() ? { reference: data.reference.trim() } : {}),
      notes: data.notes?.trim() || '',
      expectedVersion: sale?.__v,
      updatedAt: sale?.updatedAt,
    };

    try {
      await updateMutation.mutateAsync({ data: cleanPayload, key });
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
        'Failed to save sale changes. Please verify your inputs.';

      if (hasMappedIssue) {
        setSubmitError(`Please correct the highlighted form errors: ${mainMsg}`);
      } else {
        setSubmitError(mainMsg);
      }
    }
  };

  if (isSaleLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto p-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (saleLoadError || !sale) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-4xl mx-auto">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
        <p className="text-slate-800 font-semibold">Sale record not found.</p>
        <Button className="mt-4" onClick={() => navigate('/sales')}>
          Back to Sales
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/sales/${id}`)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
        >
          Cancel &amp; Back to Details
        </Button>

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
      </div>

      <PageHeader
        title={`Edit Sale: ${sale.reference}`}
        subtitle={
          sale.status === 'POSTED'
            ? 'Editing a posted sale automatically restores or deducts stock differences in the designated warehouse locations.'
            : 'Update draft sale details before posting.'
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">
              <span className="font-semibold block">Update Blocked:</span>
              <span>{submitError}</span>
            </div>
          </div>
        )}

        {/* General Information */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
            General Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Sale Date"
              type="date"
              error={errors.saleDate?.message}
              {...register('saleDate')}
            />

            <Input
              label="Sale Reference"
              error={errors.reference?.message}
              {...register('reference')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Notes / Delivery Instructions
            </label>
            <textarea
              rows={2}
              placeholder="Customer reference, delivery address, dispatch notes..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-700 placeholder-slate-400"
              {...register('notes')}
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
                Sale Line Items
              </h3>
              <p className="text-xs text-slate-500">
                Correct products, source dispatch locations, and sold quantities.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-4 h-4 text-teal-600" />}
              onClick={() => append({ productId: '', sourceAreaId: '', quantity: 1 })}
            >
              Add Item
            </Button>
          </div>

          {errors.items?.root && (
            <p className="text-xs text-rose-600 font-medium">{errors.items.root.message}</p>
          )}

          <div className="space-y-4">
            {fields.map((field, index) => {
              const itemError = errors.items?.[index];

              return (
                <div
                  key={field.id}
                  className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3 relative group"
                >
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Item #{index + 1}
                    </span>
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                        title="Remove line item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    {/* Searchable Product Dropdown */}
                    <div className="md:col-span-6">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Product <span className="text-rose-500">*</span>
                      </label>
                      <Controller
                        control={control}
                        name={`items.${index}.productId`}
                        render={({ field: { value, onChange } }) => (
                          <SearchableProductSelect
                            value={value}
                            onChange={onChange}
                            error={itemError?.productId?.message}
                          />
                        )}
                      />
                    </div>

                    {/* Searchable Location Dropdown */}
                    <div className="md:col-span-4">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Source Location <span className="text-rose-500">*</span>
                      </label>
                      <Controller
                        control={control}
                        name={`items.${index}.sourceAreaId`}
                        render={({ field: { value, onChange } }) => (
                          <SearchableLocationSelect
                            value={value}
                            onChange={onChange}
                            productId={watch(`items.${index}.productId`)}
                            mode="sale"
                            error={itemError?.sourceAreaId?.message}
                            placeholder="Select Location..."
                          />
                        )}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="md:col-span-2">
                      <Input
                        label="Quantity"
                        type="number"
                        min="1"
                        step="1"
                        error={itemError?.quantity?.message}
                        {...register(`items.${index}.quantity` as const)}
                      />
                    </div>
                  </div>

                  {/* Stock Breakdown Context */}
                  <Controller
                    control={control}
                    name={`items.${index}.productId`}
                    render={({ field: { value } }) => (
                      <ProductStockBreakdown productId={value} />
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/sales/${id}`)}
            disabled={updateMutation.isPending}
            leftIcon={<X className="w-4 h-4" />}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="teal"
            isLoading={updateMutation.isPending}
            disabled={updateMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
