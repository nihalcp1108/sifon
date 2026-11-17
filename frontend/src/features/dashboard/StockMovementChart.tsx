import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, ArrowDownToLine, ArrowUpFromLine, RefreshCw, AlertCircle } from 'lucide-react';
import { purchasesApi } from '../purchases/purchasesApi';
import { salesApi } from '../sales/salesApi';
import { Purchase, Sale } from '../../types';
import { cn } from '../../lib/utils';

type DateRangeOption = 7 | 14 | 30;

interface DayBucket {
  dateStr: string; // YYYY-MM-DD in business timezone
  displayDate: string; // "Nov 12"
  dayOfWeek: string; // "Wed"
  purchasesQty: number;
  salesQty: number;
}

/**
 * Formats a Date into YYYY-MM-DD string in Asia/Kolkata business timezone
 */
function getBusinessDateStr(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Fetches all pages of posted purchases within the date range, bounded to MAX_PAGES
 */
async function fetchAllPostedPurchases(
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<{ purchases: Purchase[]; truncated: boolean }> {
  const purchases: Purchase[] = [];
  let page = 1;
  const limit = 100; // Maximum allowed by backend purchaseQuerySchema
  const MAX_PAGES = 10;
  let truncated = false;

  while (page <= MAX_PAGES) {
    const res = await purchasesApi.getPurchases(
      {
        status: 'POSTED',
        startDate,
        endDate,
        page,
        limit,
      },
      signal
    );

    if (res?.data && Array.isArray(res.data)) {
      purchases.push(...res.data);
    }

    const totalPages = res?.meta?.totalPages || 1;
    if (page >= totalPages) break;
    if (page === MAX_PAGES && totalPages > MAX_PAGES) {
      truncated = true;
      break;
    }
    page++;
  }

  return { purchases, truncated };
}

/**
 * Fetches all pages of posted sales within the date range, bounded to MAX_PAGES
 */
async function fetchAllPostedSales(
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<{ sales: Sale[]; truncated: boolean }> {
  const sales: Sale[] = [];
  let page = 1;
  const limit = 100; // Maximum allowed by backend saleQuerySchema
  const MAX_PAGES = 10;
  let truncated = false;

  while (page <= MAX_PAGES) {
    const res = await salesApi.getSales(
      {
        status: 'POSTED',
        startDate,
        endDate,
        page,
        limit,
      },
      signal
    );

    if (res?.data && Array.isArray(res.data)) {
      sales.push(...res.data);
    }

    const totalPages = res?.meta?.totalPages || 1;
    if (page >= totalPages) break;
    if (page === MAX_PAGES && totalPages > MAX_PAGES) {
      truncated = true;
      break;
    }
    page++;
  }

  return { sales, truncated };
}

export const StockMovementChart: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<DateRangeOption>(14);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute inclusive date range in business timezone
  const { startDateStr, endDateStr, datesList } = useMemo(() => {
    const today = new Date();
    const dates: string[] = [];

    for (let i = selectedRange - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      dates.push(getBusinessDateStr(d));
    }

    const uniqueDates = Array.from(new Set(dates)).sort();

    return {
      startDateStr: uniqueDates[0],
      endDateStr: uniqueDates[uniqueDates.length - 1],
      datesList: uniqueDates,
    };
  }, [selectedRange]);

  // Combined stock movements query
  const {
    data: movementData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'stock-movements', startDateStr, endDateStr],
    queryFn: async ({ signal }) => {
      const [purResult, saleResult] = await Promise.all([
        fetchAllPostedPurchases(startDateStr, endDateStr, signal),
        fetchAllPostedSales(startDateStr, endDateStr, signal),
      ]);
      return {
        purchases: purResult.purchases,
        sales: saleResult.sales,
        truncated: purResult.truncated || saleResult.truncated,
      };
    },
    staleTime: 30000,
    // Do not automatically retry 4xx validation errors
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (status && status >= 400 && status < 500) {
        return false;
      }
      return failureCount < 1;
    },
  });

  const handleRetry = async () => {
    try {
      await refetch();
    } catch (e) {
      // Rejection handled cleanly
      console.warn('Retry stock movement failed:', e);
    }
  };

  // Aggregate daily buckets
  const { buckets, maxVal, totalPurchasedInPeriod, totalSoldInPeriod } = useMemo(() => {
    let totalPurchased = 0;
    let totalSold = 0;

    const map = new Map<string, { purchases: number; sales: number }>();
    datesList.forEach((d) => map.set(d, { purchases: 0, sales: 0 }));

    if (movementData?.purchases) {
      for (const p of movementData.purchases) {
        if (!p.purchaseDate) continue;
        const key = getBusinessDateStr(new Date(p.purchaseDate));
        const entry = map.get(key);
        if (entry) {
          const qty = p.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
          entry.purchases += qty;
          totalPurchased += qty;
        }
      }
    }

    if (movementData?.sales) {
      for (const s of movementData.sales) {
        if (!s.saleDate) continue;
        const key = getBusinessDateStr(new Date(s.saleDate));
        const entry = map.get(key);
        if (entry) {
          const qty = s.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
          entry.sales += qty;
          totalSold += qty;
        }
      }
    }

    const result: DayBucket[] = datesList.map((dStr) => {
      const parts = dStr.split('-');
      const dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const displayDate = dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayOfWeek = dObj.toLocaleDateString('en-US', { weekday: 'short' });
      const stats = map.get(dStr) || { purchases: 0, sales: 0 };
      return {
        dateStr: dStr,
        displayDate,
        dayOfWeek,
        purchasesQty: stats.purchases,
        salesQty: stats.sales,
      };
    });

    let highest = 0;
    result.forEach((b) => {
      if (b.purchasesQty > highest) highest = b.purchasesQty;
      if (b.salesQty > highest) highest = b.salesQty;
    });

    let ceiling = 10;
    if (highest > 0) {
      if (highest <= 10) ceiling = 10;
      else if (highest <= 25) ceiling = 25;
      else if (highest <= 50) ceiling = 50;
      else if (highest <= 100) ceiling = 100;
      else if (highest <= 250) ceiling = 250;
      else if (highest <= 500) ceiling = 500;
      else ceiling = Math.ceil(highest / 100) * 100;
    }

    return {
      buckets: result,
      maxVal: ceiling,
      totalPurchasedInPeriod: totalPurchased,
      totalSoldInPeriod: totalSold,
    };
  }, [datesList, movementData]);

  // Chart dimensions
  const chartHeight = 170;
  const chartWidth = 620;
  const paddingLeft = 40;
  const paddingRight = 15;
  const paddingTop = 15;
  const paddingBottom = 30;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const slotWidth = innerWidth / buckets.length;
  const barWidth = Math.max(Math.min(slotWidth * 0.36, 14), 4);
  const barGap = 2;

  const yTicks = [0, Math.round(maxVal / 2), maxVal];
  const hasMovements = totalPurchasedInPeriod > 0 || totalSoldInPeriod > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between transition-all hover:border-slate-300">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-navy-950 tracking-tight">Stock Movements</h3>
            <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              Posted Transactions
            </span>
            {movementData?.truncated && (
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Sample bounded to 1,000 records
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Purchases received vs sales dispatched over time
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-lg border border-slate-200/60 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" aria-hidden="true" />
          {([7, 14, 30] as DateRangeOption[]).map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setSelectedRange(days)}
              className={cn(
                'px-2.5 py-1 text-xs font-semibold rounded-md transition-all',
                selectedRange === days
                  ? 'bg-white text-teal-800 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-navy-950 hover:bg-slate-200/50'
              )}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Metric totals for selected period & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 text-xs">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-teal-600 inline-block shadow-2xs" />
            <span className="text-slate-600 font-medium">Purchases (Inbound):</span>
            <span className="font-bold text-slate-900 font-mono">
              +{totalPurchasedInPeriod.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-xs bg-navy-800 inline-block shadow-2xs" />
            <span className="text-slate-600 font-medium">Sales (Outbound):</span>
            <span className="font-bold text-slate-900 font-mono">
              -{totalSoldInPeriod.toLocaleString()}
            </span>
          </div>
        </div>

        <span className="text-[11px] text-slate-400 italic">
          Drafts &amp; cancelled records excluded
        </span>
      </div>

      {/* Main Visual Content */}
      <div className="relative mt-2 min-h-[190px] flex items-center justify-center">
        {/* Loading State */}
        {isLoading && (
          <div className="w-full space-y-2 py-4">
            <div className="flex justify-between items-end h-40 gap-2 px-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full bg-slate-200 rounded-t-md animate-pulse"
                  style={{ height: `${20 + ((i * 17) % 70)}%` }}
                />
              ))}
            </div>
            <div className="h-4 bg-slate-100 rounded w-full" />
          </div>
        )}

        {/* Error State with Accessible Real Icon and Retry */}
        {error && !isLoading && (
          <div className="p-6 text-center text-xs">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" aria-hidden="true" />
            <p className="text-rose-600 font-medium">Failed to load stock movements.</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              {(error as any)?.response?.data?.message || 'An error occurred while loading movement records.'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isFetching}
              aria-label="Retry loading stock movements"
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw
                className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')}
                aria-hidden="true"
              />
              <span>{isFetching ? 'Retrying...' : 'Retry'}</span>
            </button>
          </div>
        )}

        {/* Empty State: No movements in this date range */}
        {!isLoading && !error && !hasMovements && (
          <div className="py-10 text-center text-xs text-slate-500 space-y-2">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-1" aria-hidden="true" />
            <p className="font-semibold text-slate-700">No movements in this date range</p>
            <p className="text-slate-400 text-[11px] max-w-sm mx-auto">
              No posted purchases or sales were recorded between {buckets[0]?.displayDate} and{' '}
              {buckets[buckets.length - 1]?.displayDate}.
            </p>
            {selectedRange < 30 && (
              <button
                type="button"
                onClick={() => setSelectedRange(30)}
                className="mt-2 text-xs font-semibold text-teal-600 hover:text-teal-700 underline"
              >
                Expand to 30 days
              </button>
            )}
          </div>
        )}

        {/* Data Chart State */}
        {!isLoading && !error && hasMovements && (
          <div className="w-full relative">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-auto overflow-visible select-none"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Y-Axis Gridlines & Labels */}
              {yTicks.map((tick) => {
                const y = paddingTop + innerHeight - (tick / maxVal) * innerHeight;
                return (
                  <g key={tick} className="text-slate-400">
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray={tick === 0 ? undefined : '3 3'}
                      strokeWidth={tick === 0 ? 1.5 : 1}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      fontSize="10"
                      fill="#94A3B8"
                      fontFamily="monospace"
                      fontWeight="500"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* Bars per bucket */}
              {buckets.map((b, idx) => {
                const slotCenterX = paddingLeft + idx * slotWidth + slotWidth / 2;
                const pHeight = Math.max(0, (b.purchasesQty / maxVal) * innerHeight);
                const sHeight = Math.max(0, (b.salesQty / maxVal) * innerHeight);

                const pY = paddingTop + innerHeight - pHeight;
                const sY = paddingTop + innerHeight - sHeight;

                const pX = slotCenterX - barWidth - barGap / 2;
                const sX = slotCenterX + barGap / 2;

                const showLabel =
                  selectedRange <= 7 ||
                  (selectedRange === 14 && idx % 2 === 0) ||
                  (selectedRange === 30 && idx % 4 === 0) ||
                  idx === buckets.length - 1;

                const isHovered = hoveredIndex === idx;

                return (
                  <g
                    key={b.dateStr}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className="cursor-pointer"
                  >
                    {/* Hover highlight column */}
                    {isHovered && (
                      <rect
                        x={slotCenterX - slotWidth / 2}
                        y={paddingTop}
                        width={slotWidth}
                        height={innerHeight}
                        fill="#F1F5F9"
                        rx="4"
                        className="opacity-70"
                      />
                    )}

                    {/* Purchases Bar (Teal) */}
                    <rect
                      x={pX}
                      y={pY}
                      width={barWidth}
                      height={pHeight}
                      rx="2"
                      fill={isHovered ? '#0D9488' : '#14B8A6'}
                      className="transition-all duration-300"
                    />

                    {/* Sales Bar (Navy) */}
                    <rect
                      x={sX}
                      y={sY}
                      width={barWidth}
                      height={sHeight}
                      rx="2"
                      fill={isHovered ? '#0B192C' : '#1E3E62'}
                      className="transition-all duration-300"
                    />

                    {/* X-Axis Date Label */}
                    {showLabel && (
                      <text
                        x={slotCenterX}
                        y={chartHeight - 8}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill={isHovered ? '#0F172A' : '#64748B'}
                        fontWeight={isHovered ? '600' : '400'}
                      >
                        {b.displayDate}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Floating Interactive Tooltip */}
            {hoveredIndex !== null && buckets[hoveredIndex] && (
              <div
                className="absolute z-20 pointer-events-none bg-navy-950 text-white text-xs rounded-lg py-2 px-3 shadow-lg border border-navy-800 transition-all duration-150 transform -translate-x-1/2 -translate-y-full"
                style={{
                  left: `${((paddingLeft + hoveredIndex * slotWidth + slotWidth / 2) / chartWidth) * 100}%`,
                  top: '15px',
                }}
              >
                <div className="font-semibold text-slate-200 border-b border-navy-800/80 pb-1 mb-1.5 flex items-center justify-between gap-3">
                  <span>{buckets[hoveredIndex].displayDate}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {buckets[hoveredIndex].dayOfWeek}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-teal-300">
                    <span className="flex items-center gap-1.5">
                      <ArrowDownToLine className="w-3 h-3 text-teal-400" />
                      Inbound:
                    </span>
                    <span className="font-bold font-mono">
                      +{buckets[hoveredIndex].purchasesQty} units
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <ArrowUpFromLine className="w-3 h-3 text-indigo-400" />
                      Outbound:
                    </span>
                    <span className="font-bold font-mono">
                      -{buckets[hoveredIndex].salesQty} units
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
