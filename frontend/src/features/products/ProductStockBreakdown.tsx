import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Boxes, AlertCircle } from 'lucide-react';
import { productsApi } from './productsApi';

export interface ProductStockBreakdownProps {
  productId?: string;
  className?: string;
}

export const ProductStockBreakdown: React.FC<ProductStockBreakdownProps> = ({
  productId,
  className = '',
}) => {
  const isValidId = Boolean(productId && /^[0-9a-fA-F]{24}$/.test(productId.trim()));

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['product-stock-breakdown', productId],
    queryFn: () => productsApi.getProductById(productId!.trim()),
    enabled: isValidId,
    staleTime: 10000,
  });

  if (!productId || !isValidId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={`p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
        <span>Loading real-time location stock...</span>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className={`p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2 ${className}`}>
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Unable to load location stock for selected product.</span>
      </div>
    );
  }

  // Guard against stale product data when switching between products
  if (product._id && product._id !== productId.trim()) {
    return (
      <div className={`p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-2 ${className}`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
        <span>Loading real-time location stock...</span>
      </div>
    );
  }

  const balances = product.balances || (product as any).areaBalances || [];
  const stockedBalances = balances.filter((b: any) => (b.availableQuantity || 0) > 0);
  const totalAvail = product.totalAvailable ?? stockedBalances.reduce((sum: number, b: any) => sum + (b.availableQuantity || 0), 0);

  return (
    <div className={`p-3 bg-slate-50/90 border border-slate-200 rounded-lg text-xs space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between font-semibold text-slate-800">
        <span className="flex items-center gap-1.5">
          <Boxes className="w-3.5 h-3.5 text-teal-600" />
          <span>Selected product: <strong className="text-navy-950 font-bold">{product.name}</strong></span>
        </span>
        <span className="text-emerald-700 font-bold font-mono">
          Total available — {totalAvail}
        </span>
      </div>

      <div className="pt-1 border-t border-slate-200/80">
        {stockedBalances.length === 0 ? (
          <p className="text-slate-500 italic">No usable stock currently in any location</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
            {stockedBalances.map((b: any) => {
              const locName =
                b.locationName ||
                b.areaId?.name ||
                b.areaId?.displayName ||
                (b.areaId?.areaNumber ? `Location ${b.areaId.areaNumber}` : (b.areaId ? 'Unnamed Location' : 'Location unavailable'));
              return (
                <div key={b._id || b.locationId || b.areaId?._id} className="flex justify-between py-0.5">
                  <span className="font-medium text-slate-700">{locName}</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    — {b.availableQuantity} available
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

