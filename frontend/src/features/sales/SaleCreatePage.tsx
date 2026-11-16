import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, ArrowLeft, ShoppingBag, AlertCircle, RefreshCw } from 'lucide-react';
import { salesApi } from './salesApi';
import { productsApi } from '../products/productsApi';
import { areasApi } from '../areas/areasApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useToast } from '../../components/common/Toast';
import { generateIdempotencyKey } from '../../lib/utils';
import { SearchableProductSelect } from '../products/SearchableProductSelect';
import { SearchableLocationSelect } from '../areas/SearchableLocationSelect';
import { ProductStockBreakdown } from '../products/ProductStockBreakdown';
import { ProductFormModal } from '../products/ProductFormModal';

const saleItemSchema = z.object({
  productId: z.string().min(1, 'Please select a product'),
  sourceAreaId: z.string().min(1, 'Please select source location'),
  quantity: z.coerce
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .int('Quantity must be an integer')
    .positive('Quantity must be at least 1'),
});

const saleFormSchema = z.object({
  reference: z.string().trim().max(50, 'Reference cannot exceed 50 characters').optional(),
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date required (YYYY-MM-DD)'),
  notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  isDraft: z.boolean().default(false),
  items: z.array(saleItemSchema).min(1, 'At least one line item is required'),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

export const SaleCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch active products list for stock calculations and lookup
  const { data: productsData } = useQuery({
    queryKey: ['products', 'options', ''],
    queryFn: ({ signal }) =>
      productsApi.getProductOptions({ activeOnly: true, limit: 200 }, signal),
    staleTime: 30000,
  });

  // Fetch active warehouse areas
  const {
    data: areasData,
    isError: isAreasError,
    error: areasError,
    refetch: refetchAreas,
  } = useQuery({
    queryKey: ['areas', 'options'],
    queryFn: ({ signal }) =>
      areasApi.getAreaOptions({ activeOnly: true, limit: 100 }, signal),
    staleTime: 30000,
  });

  const activeProducts = productsData?.data || [];
  const activeAreas = areasData?.data || [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      saleDate: todayStr,
      isDraft: false,
      items: [{ productId: '', sourceAreaId: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const isDraft = watch('isDraft');
  const watchedItems = watch('items');

  // Helper to get available stock in chosen area for chosen product
  const getAvailableStock = (productId: string, areaId: string): number => {
    if (!productId || !areaId) return 0;
    const prod = activeProducts.find(p => p._id === productId);
    if (!prod || !prod.areaBalances) return 0;
    const balance = prod.areaBalances.find((b: any) => {
      const bAreaId = b.areaId?._id?.toString() || b.areaId?.toString();
      return bAreaId === areaId;
    });
    return balance?.availableQuantity || 0;
  };

  const createMutation = useMutation({
    mutationFn: ({ data, key }: { data: SaleFormData; key: string }) =>
      salesApi.createSale(data, key),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      toast.success(
        `Sale ${sale.reference} ${sale.status === 'POSTED' ? 'posted' : 'saved as draft'}.`
      );
      navigate(`/sales/${sale._id}`);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to process sale';
      toast.error(msg);
    },
  });

  const onSubmit = async (data: SaleFormData) => {
    // Client-side stock check for posted sales
    if (!data.isDraft) {
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const avail = getAvailableStock(item.productId, item.sourceAreaId);
        const prod = activeProducts.find(p => p._id === item.productId);
        if (prod && item.quantity > avail) {
          const area = activeAreas.find(a => a._id === item.sourceAreaId);
          setSubmitError(
            `Line ${i + 1}: Requested quantity (${item.quantity}) exceeds available stock (${avail}) for ${prod.name} in ${area?.displayName || 'selected location'}.`
          );
          return;
        }
      }
    }

    setSubmitError(null);
    clearErrors();

    // Prepare clean payload matching backend contract
    const key = generateIdempotencyKey('sal');
    const cleanPayload: SaleFormData = {
      saleDate: data.saleDate,
      isDraft: Boolean(data.isDraft),
      items: data.items.map(item => ({
        productId: item.productId.trim(),
        sourceAreaId: item.sourceAreaId.trim(),
        quantity: Math.floor(Number(item.quantity)),
      })),
      ...(data.reference?.trim() ? { reference: data.reference.trim() } : {}),
      ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
    };

    try {
      await createMutation.mutateAsync({ data: cleanPayload, key });
    } catch (err: any) {
      // Map server-side validation details to field errors and form feedback
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
        'Failed to process sale. Please verify your inputs.';

      if (hasMappedIssue) {
        setSubmitError(`Please correct the highlighted form errors: ${mainMsg}`);
      } else {
        setSubmitError(mainMsg);
      }
    }
  };

  const handleCreateProduct = async (prodData: any) => {
    try {
      const created = await productsApi.createProduct(prodData);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Product "${created.name}" created successfully.`);
      setIsProductModalOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create product');
    }
  };

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
        title="Record New Sale"
        subtitle="Outbound customer shipment. Posted sales atomically deduct stock from the source locations."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* General Info */}
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
              label="Sale Reference (Optional)"
              placeholder="Leave blank to auto-generate (e.g. SAL-20261106-0001)"
              error={errors.reference?.message}
              {...register('reference')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Customer / Shipping Notes
            </label>
            <textarea
              rows={2}
              placeholder="Customer name, sales order dispatch notes..."
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
                Pick product and source location. Available balance in the location is verified in real-time.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-4 h-4 text-teal-600" />}
                onClick={() =>
                  append({
                    productId: '',
                    sourceAreaId: '',
                    quantity: 1,
                  })
                }
              >
                Add Line Item
              </Button>
            </div>
          </div>

          {errors.items?.message && (
            <p className="text-xs text-rose-600 font-medium">{errors.items.message}</p>
          )}

          {isAreasError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  Failed to load active warehouse locations:{' '}
                  {(areasError as any)?.response?.data?.message ||
                    (areasError as any)?.message ||
                    'Network error'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => refetchAreas()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-100/60 hover:bg-rose-100 rounded-md transition-colors shrink-0 ml-2"
                aria-label="Retry loading locations"
              >
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {fields.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-4 text-center">
              No items added. Click &quot;Add Line Item&quot; to add a product line.
            </p>
          ) : (
            <div className="space-y-4">
              {fields.map((field, idx) => {
                const selectedProdId = watchedItems?.[idx]?.productId;

                return (
                  <div
                    key={field.id}
                    className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-3">
                      <div className="flex-1 w-full space-y-2">
                        <Controller
                          control={control}
                          name={`items.${idx}.productId`}
                          render={({ field: pField }) => (
                            <SearchableProductSelect
                              id={`items.${idx}.productId`}
                              label={`Product #${idx + 1}`}
                              value={pField.value}
                              onChange={(val) => {
                                pField.onChange(val);
                                setValue(`items.${idx}.sourceAreaId`, '');
                              }}
                              error={errors.items?.[idx]?.productId?.message}
                            />
                          )}
                        />
                        {selectedProdId && (
                          <ProductStockBreakdown productId={selectedProdId} />
                        )}
                      </div>

                      <div className="flex-1 w-full">
                        <Controller
                          control={control}
                          name={`items.${idx}.sourceAreaId`}
                          render={({ field: locField }) => (
                            <SearchableLocationSelect
                              id={`items.${idx}.sourceAreaId`}
                              label="Source Location"
                              value={locField.value}
                              onChange={locField.onChange}
                              mode="sale"
                              productId={selectedProdId}
                              error={errors.items?.[idx]?.sourceAreaId?.message}
                            />
                          )}
                        />
                      </div>

                      <div className="w-full sm:w-32">
                        <Input
                          label="Quantity"
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Qty"
                          error={errors.items?.[idx]?.quantity?.message}
                          {...register(`items.${idx}.quantity`)}
                        />
                      </div>

                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(idx)}
                          className="p-2 text-slate-400 hover:text-rose-600 rounded mt-6 transition-colors self-end sm:self-auto"
                          title="Remove Line"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submission Mode and Action */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDraft"
              checked={isDraft}
              onChange={e => setValue('isDraft', e.target.checked)}
              className="w-4 h-4 text-navy-900 border-slate-300 rounded focus:ring-navy-700"
            />
            <label htmlFor="isDraft" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
              Save as Draft only <span className="text-xs text-slate-400">(does not reduce inventory yet)</span>
            </label>
          </div>

          <div className="flex gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/sales')}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
              leftIcon={<ShoppingBag className="w-4 h-4 text-teal-400" />}
            >
              {isDraft ? 'Save Sale Draft' : 'Post Sale & Deduct Stock'}
            </Button>
          </div>
        </div>
      </form>

      {/* Quick Add Product Modal */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSubmit={handleCreateProduct}
        areas={activeAreas}
      />
    </div>
  );
};
