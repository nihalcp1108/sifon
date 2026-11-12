import React, { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, Info, AlertCircle } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { Product, Area } from '../../types';
import { brandsApi } from '../brands/brandsApi';
import { categoriesApi } from '../categories/categoriesApi';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  brandId: z.string({ required_error: 'Brand is required' }).trim().min(1, 'Please select a brand'),
  categoryId: z.string({ required_error: 'Category is required' }).trim().min(1, 'Please select a category'),
  details: z.string().trim().max(1000).optional(),
  unit: z.string().trim().min(1).default('pcs'),
  openingStock: z
    .array(
      z.object({
        areaId: z.string().min(1, 'Please select an area'),
        quantity: z.coerce.number().int().positive('Quantity must be > 0'),
      })
    )
    .optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

export interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  editingProduct?: Product | null;
  areas: Area[];
  isLoading?: boolean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingProduct,
  areas,
  isLoading,
}) => {
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit: 'pcs',
      openingStock: [],
    },
  });

  const selectedBrandId = watch('brandId');
  const selectedCategoryId = watch('categoryId');

  // Load Brand and Category options
  const { data: brandsData, isLoading: loadingBrands } = useQuery({
    queryKey: ['brands', 'options'],
    queryFn: () => brandsApi.getBrandOptions({ limit: 200, activeOnly: 'true' }),
    enabled: isOpen,
  });

  const { data: categoriesData, isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', 'options'],
    queryFn: () => categoriesApi.getCategoryOptions({ limit: 200, activeOnly: 'true' }),
    enabled: isOpen,
  });

  const brands = brandsData?.data || [];
  const categories = categoriesData?.data || [];

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'openingStock',
  });

  useEffect(() => {
    if (editingProduct) {
      const bId =
        typeof editingProduct.brandId === 'object' && editingProduct.brandId
          ? (editingProduct.brandId as any)._id
          : (editingProduct.brandId as string) || '';

      const cId =
        typeof editingProduct.categoryId === 'object' && editingProduct.categoryId
          ? (editingProduct.categoryId as any)._id
          : (editingProduct.categoryId as string) || '';

      reset({
        name: editingProduct.name,
        brandId: bId,
        categoryId: cId,
        details: editingProduct.details || '',
        unit: editingProduct.unit || 'pcs',
        openingStock: [],
      });
    } else {
      reset({
        name: '',
        brandId: '',
        categoryId: '',
        details: '',
        unit: 'pcs',
        openingStock: [],
      });
    }
  }, [editingProduct, reset, isOpen]);

  const handleFormSubmit = async (data: ProductFormData) => {
    const payload = editingProduct
      ? {
          name: data.name,
          brandId: data.brandId,
          categoryId: data.categoryId,
          details: data.details,
          unit: data.unit,
        }
      : {
          name: data.name,
          brandId: data.brandId,
          categoryId: data.categoryId,
          details: data.details,
          unit: data.unit,
          openingStock: data.openingStock?.filter((o) => o.areaId && o.quantity > 0),
        };

    await onSubmit(payload);
    onClose();
  };

  const activeAreas = areas.filter((a) => a.isActive);
  const noBrandsOrCategories = !loadingBrands && !loadingCategories && (brands.length === 0 || categories.length === 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingProduct ? `Edit Product: ${editingProduct.name}` : 'Add New Product'}
      description={
        editingProduct
          ? 'Update product specifications, brand, or category. Stock balances cannot be edited directly.'
          : 'Define product master record with brand, category, and optional initial opening stock'
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Warning if no brands or categories exist */}
        {!editingProduct && noBrandsOrCategories && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Brands and Categories required</p>
              <p className="mt-0.5">
                {brands.length === 0 && categories.length === 0
                  ? 'Please create at least one Brand and one Category from the sidebar before adding products.'
                  : brands.length === 0
                  ? 'Please create at least one Brand from the Brands page before adding products.'
                  : 'Please create at least one Category from the Categories page before adding products.'}
              </p>
            </div>
          </div>
        )}

        <Input
          label="Product Name"
          placeholder="e.g. Stainless Steel Ball Valve 2 inch"
          error={errors.name?.message}
          required
          autoFocus
          {...register('name')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="product-brand-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Brand <span className="text-rose-500">*</span>
            </label>
            <select
              id="product-brand-select"
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 ${
                errors.brandId ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300'
              }`}
              value={selectedBrandId || ''}
              onChange={(e) => setValue('brandId', e.target.value, { shouldValidate: true })}
            >
              <option value="">-- Select Brand --</option>
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
            {errors.brandId && <p className="mt-1 text-xs text-rose-500">{errors.brandId.message}</p>}
          </div>

          <div>
            <label htmlFor="product-category-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              id="product-category-select"
              className={`w-full px-3 py-2 bg-white border rounded-lg text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-navy-700 ${
                errors.categoryId ? 'border-rose-400 focus:ring-rose-200' : 'border-slate-300'
              }`}
              value={selectedCategoryId || ''}
              onChange={(e) => setValue('categoryId', e.target.value, { shouldValidate: true })}
            >
              <option value="">-- Select Category --</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.categoryId && <p className="mt-1 text-xs text-rose-500">{errors.categoryId.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Unit of Measure"
            placeholder="pcs, units, box, kg, pairs"
            error={errors.unit?.message}
            {...register('unit')}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Technical Details / Specifications
          </label>
          <textarea
            rows={2}
            placeholder="Optional specifications, dimensions, material grade, etc."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-700"
            {...register('details')}
          />
        </div>

        {/* Opening Stock Section (ONLY available on creation) */}
        {!editingProduct && (
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  Initial Opening Stock (Optional)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Initial balances will be posted directly to the inventory movement ledger.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5 text-teal-600" />}
                onClick={() => append({ areaId: activeAreas[0]?._id || '', quantity: 10 })}
                disabled={activeAreas.length === 0}
              >
                Add Area
              </Button>
            </div>

            {activeAreas.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                No active storage areas found. Please create an area first to assign opening stock.
              </p>
            ) : fields.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No opening stock added. You can receive stock later via purchases.
              </p>
            ) : (
              <div className="space-y-2 mt-2 max-h-48 overflow-y-auto pr-1">
                {fields.map((field, idx) => (
                  <div key={field.id} className="flex items-start gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <Select
                        {...register(`openingStock.${idx}.areaId`)}
                        error={errors.openingStock?.[idx]?.areaId?.message}
                      >
                        {activeAreas.map((a) => (
                          <option key={a._id} value={a._id}>
                            {a.displayName} {a.description ? `(${a.description})` : ''}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        placeholder="Quantity"
                        min="1"
                        step="1"
                        {...register(`openingStock.${idx}.quantity`)}
                        error={errors.openingStock?.[idx]?.quantity?.message}
                      >
                        {errors.openingStock?.[idx]?.quantity?.message && (
                          <p className="mt-1 text-xs text-rose-500 font-medium">
                            {errors.openingStock?.[idx]?.quantity?.message}
                          </p>
                        )}
                      </Input>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded transition-colors mt-0.5"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {editingProduct && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-start gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <span>
              Stock balances cannot be modified here. Stock adjustments occur exclusively through
              posted purchases, sales, and returns.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            isLoading={isLoading}
            disabled={!editingProduct && noBrandsOrCategories}
          >
            {editingProduct ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
