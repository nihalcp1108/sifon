import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { productsApi } from './productsApi';
import { Product } from '../../types';
import { cn } from '../../lib/utils';

export interface ProductSelectorProps {
  value: string;
  onChange: (productId: string) => void;
  onBlur?: () => void;
  label?: string;
  error?: string;
  helperText?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  mode?: 'purchase' | 'sale' | 'general';
  selectedAreaId?: string; // For sale mode: to compute area-specific available balance
  onAddNewProduct?: () => void;
}

export const ProductSelector = React.forwardRef<HTMLSelectElement, ProductSelectorProps>(
  (
    {
      value,
      onChange,
      onBlur,
      label,
      error,
      helperText,
      id,
      name,
      disabled,
      mode = 'general',
      selectedAreaId,
      onAddNewProduct,
    },
    ref
  ) => {
    const [searchTerm, setSearchTerm] = useState('');
    const selectId = id || name || `prod-select-${Math.random().toString(36).substring(7)}`;
    const isValidObjectId = Boolean(value && /^[0-9a-fA-F]{24}$/.test(value.trim()));

    // Query active products from backend using dedicated options lookup endpoint
    const {
      data: productsResponse,
      isLoading,
      isError,
      error: queryError,
      refetch,
      isFetching,
    } = useQuery({
      queryKey: ['products', 'options', searchTerm.trim(), value],
      queryFn: ({ signal }) =>
        productsApi.getProductOptions(
          {
            search: searchTerm.trim() || undefined,
            activeOnly: true,
            limit: 100,
            selectedId: isValidObjectId ? value.trim() : undefined,
          },
          signal
        ),
      staleTime: 30000, // 30 seconds fresh
    });

    const products: Product[] = useMemo(() => {
      return productsResponse?.data || [];
    }, [productsResponse]);

    // Fallback query if value is set to a valid ObjectId but was not returned in the main list
    const { data: fallbackProduct } = useQuery({
      queryKey: ['product', 'fallback', value],
      queryFn: () => productsApi.getProductById(value.trim()),
      enabled: Boolean(
        isValidObjectId &&
        products.length > 0 &&
        !products.some(p => p._id === value.trim())
      ),
      staleTime: 60000,
    });

    // Selected product lookup
    const selectedProduct = useMemo(() => {
      return products.find(p => p._id === value) || fallbackProduct || null;
    }, [products, value, fallbackProduct]);

    // Client-side quick filter to make typing feel instantaneous even while querying
    const filteredProducts = useMemo(() => {
      if (!searchTerm.trim()) return products;
      const lower = searchTerm.toLowerCase().trim();
      return products.filter(
        p =>
          p.name.toLowerCase().includes(lower) ||
          p.code.toLowerCase().includes(lower) ||
          (p.details && p.details.toLowerCase().includes(lower))
      );
    }, [products, searchTerm]);

    // Guarantee currently selected option remains in dropdown options during search
    const displayProducts = useMemo(() => {
      if (!selectedProduct) return filteredProducts;
      if (filteredProducts.some(p => p._id === selectedProduct._id)) {
        return filteredProducts;
      }
      return [selectedProduct, ...filteredProducts];
    }, [filteredProducts, selectedProduct]);

    // Helper to calculate available stock in selected area
    const areaAvailableStock = useMemo(() => {
      if (!selectedProduct || !selectedAreaId || !selectedProduct.areaBalances) return null;
      const balance = selectedProduct.areaBalances.find((b: any) => {
        const bAreaId = b.areaId?._id?.toString() || b.areaId?.toString();
        return bAreaId === selectedAreaId;
      });
      return balance?.availableQuantity ?? 0;
    }, [selectedProduct, selectedAreaId]);

    // Compute stock display text for an option in the list
    const getOptionLabel = (p: Product) => {
      const codePart = `(${p.code})`;
      if (mode === 'sale') {
        if (selectedAreaId && p.areaBalances) {
          const bal = p.areaBalances.find((b: any) => {
            const bId = b.areaId?._id?.toString() || b.areaId?.toString();
            return bId === selectedAreaId;
          });
          const qty = bal?.availableQuantity ?? 0;
          return `${p.name} ${codePart} — ${qty > 0 ? `${qty} ${p.unit} in Area` : 'Out of stock in Area'}`;
        }
        const total = p.totalAvailable ?? 0;
        return `${p.name} ${codePart} — Total: ${total} ${p.unit} avail`;
      }

      if (mode === 'purchase') {
        const total = p.totalAvailable ?? 0;
        return `${p.name} ${codePart} — ${p.unit} (Stock: ${total})`;
      }

      return `${p.name} ${codePart}`;
    };

    return (
      <div className="w-full space-y-1.5">
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              {label}
            </label>
          )}
          {onAddNewProduct && (
            <button
              type="button"
              onClick={onAddNewProduct}
              className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
            >
              + Quick Add Product
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
            <span>Loading product catalog...</span>
          </div>
        )}

        {/* Error State with Retry */}
        {isError && !isLoading && (
          <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>
                Failed to load products:{' '}
                {(queryError as any)?.response?.data?.message ||
                  (queryError as any)?.message ||
                  'Network error'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-100/60 hover:bg-rose-100 rounded-md transition-colors shrink-0 ml-2"
              aria-label="Retry loading products"
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Normal Select with Search Field */}
        {!isError && (
          <div className="space-y-1">
            {/* Quick search input if there are more than 5 products */}
            {(products.length > 5 || searchTerm) && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filter product by name or code..."
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-navy-600 placeholder-slate-400 transition-colors"
                  disabled={disabled || isLoading}
                />
                {isFetching && (
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                )}
              </div>
            )}

            <div className="relative">
              <select
                ref={ref}
                id={selectId}
                name={name}
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                disabled={disabled || isLoading || isError}
                className={cn(
                  'w-full px-3 py-2 bg-white border rounded-lg text-sm text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
                  error
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200'
                    : 'border-slate-300 focus:border-navy-700 focus:ring-navy-100'
                )}
              >
                <option value="">
                  {isLoading
                    ? '-- Loading catalog... --'
                    : displayProducts.length === 0
                    ? '-- No matching products --'
                    : '-- Select Product --'}
                </option>

                {displayProducts.map(p => (
                  <option key={p._id} value={p._id}>
                    {getOptionLabel(p)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Empty Catalog State */}
        {!isLoading && !isError && displayProducts.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
            No active products found in the catalog. Please add a product first.
          </p>
        )}

        {/* Sale Mode Stock Callout when a product is selected */}
        {mode === 'sale' && selectedProduct && (
          <div className="text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-1">
            <span className="text-slate-600">
              SKU: <strong className="font-mono text-slate-800">{selectedProduct.code}</strong> ({selectedProduct.unit})
            </span>
            {selectedAreaId ? (
              <span
                className={cn(
                  'font-semibold',
                  (areaAvailableStock ?? 0) > 0 ? 'text-emerald-700' : 'text-rose-600'
                )}
              >
                {(areaAvailableStock ?? 0) > 0
                  ? `${areaAvailableStock} ${selectedProduct.unit} available in selected area`
                  : `0 ${selectedProduct.unit} (Out of stock in selected area)`}
              </span>
            ) : (
              <span className="text-slate-500">
                Total available: <strong className="text-slate-700 font-semibold">{selectedProduct.totalAvailable ?? 0} {selectedProduct.unit}</strong> (pick source area)
              </span>
            )}
          </div>
        )}

        {/* Error message */}
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
      </div>
    );
  }
);

ProductSelector.displayName = 'ProductSelector';
