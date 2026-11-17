import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { reportsApi } from '../reports/reportsApi';
import { Skeleton } from '../../components/common/Skeleton';
import { cn } from '../../lib/utils';

interface LocationStockItem {
  id: string;
  name: string;
  available: number;
  damaged: number;
  percentage: number;
}

export const StockByLocation: React.FC = () => {
  const {
    data: matrix,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'stock-matrix-locations'],
    queryFn: () => reportsApi.getCurrentStockMatrix(),
    staleTime: 30000,
  });

  const locationStats = useMemo<LocationStockItem[]>(() => {
    if (!matrix || !Array.isArray(matrix.areas) || matrix.areas.length === 0) {
      return [];
    }

    const items: LocationStockItem[] = matrix.areas.map((area) => {
      const aId = area._id.toString();
      let available = 0;
      let damaged = 0;

      if (Array.isArray(matrix.rows)) {
        for (const row of matrix.rows) {
          const bal = row.areaQuantities?.[aId];
          if (bal) {
            available += bal.available || 0;
            damaged += bal.damaged || 0;
          }
        }
      }

      return {
        id: area._id,
        name: area.displayName || area.name || 'Unnamed Location',
        available,
        damaged,
        percentage: 0,
      };
    });

    // Find maximum available stock across locations for relative bar scaling
    const maxAvailable = Math.max(...items.map((i) => i.available), 1);

    items.forEach((item) => {
      item.percentage = Math.round((item.available / maxAvailable) * 100);
    });

    // Sort locations: highest available stock first, then alphabetically by name
    return items.sort((a, b) => b.available - a.available || a.name.localeCompare(b.name));
  }, [matrix]);

  const totalWarehouseStock = useMemo(() => {
    return locationStats.reduce((acc, curr) => acc + curr.available, 0);
  }, [locationStats]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-navy-950 tracking-tight">Stock by Location</h3>
              <span className="text-[11px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60">
                {locationStats.length} {locationStats.length === 1 ? 'Location' : 'Locations'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Available inventory balances across designated warehouse spots
            </p>
          </div>

          <Link
            to="/locations"
            className="text-xs font-semibold text-teal-600 hover:text-teal-700 inline-flex items-center gap-1 group"
          >
            Manage <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 py-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="py-8 text-center text-xs">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
            <p className="text-rose-600 font-medium">Failed to calculate stock by location.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && locationStats.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500">
            <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">No active locations found</p>
            <p className="text-slate-400 mt-1">Create a warehouse location to start tracking stock.</p>
            <Link
              to="/locations"
              className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors"
            >
              Add Location
            </Link>
          </div>
        )}

        {/* Location Bars List */}
        {!isLoading && !error && locationStats.length > 0 && (
          <div className="mt-4 space-y-4 max-h-[260px] overflow-y-auto pr-1">
            {locationStats.map((loc) => {
              return (
                <div key={loc.id} className="group space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500 shrink-0" />
                      <span className="font-semibold text-slate-800 group-hover:text-navy-950 transition-colors">
                        {loc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 font-mono">
                        {loc.available.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-500">available</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500 ease-out',
                        loc.available > 0
                          ? 'bg-gradient-to-r from-teal-500 to-teal-600'
                          : 'bg-transparent'
                      )}
                      style={{ width: `${Math.max(loc.percentage, loc.available > 0 ? 5 : 0)}%` }}
                    />
                  </div>

                  {/* Damaged stock indicator if any */}
                  {loc.damaged > 0 && (
                    <div className="flex justify-end text-[10px] text-rose-600">
                      <span>+{loc.damaged.toLocaleString()} quarantined</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {!isLoading && !error && locationStats.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Total allocated balance:</span>
          <span className="font-bold text-slate-900 font-mono">
            {totalWarehouseStock.toLocaleString()} units
          </span>
        </div>
      )}
    </div>
  );
};

