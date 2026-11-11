import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Download, Printer, Search, Calendar } from 'lucide-react';
import { reportsApi } from './reportsApi';
import { productsApi } from '../products/productsApi';
import { areasApi } from '../areas/areasApi';
import { AreaMatrixView } from './AreaMatrixView';
import { PeriodMovementView } from './PeriodMovementView';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { TableSkeleton } from '../../components/common/Skeleton';
import { useToast } from '../../components/common/Toast';

export const StockStatementPage: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'matrix' | 'period'>('matrix');

  // Matrix filters
  const [matrixSearch, setMatrixSearch] = useState('');
  const [matrixProductId, setMatrixProductId] = useState('');
  const [matrixAreaId, setMatrixAreaId] = useState('');

  // Period statement filters (default to current month)
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(todayStr);
  const [periodProductId, setPeriodProductId] = useState('');
  const [periodAreaId, setPeriodAreaId] = useState('');
  const [periodSearch, setPeriodSearch] = useState('');

  const [isExporting, setIsExporting] = useState(false);

  // Lookups
  const { data: productsData } = useQuery({
    queryKey: ['products', 'filter-reports'],
    queryFn: () => productsApi.getProducts({ limit: 500 }),
  });

  const { data: areasData } = useQuery({
    queryKey: ['areas', 'filter-reports'],
    queryFn: () => areasApi.getAreas({ limit: 200 }),
  });

  const products = productsData?.data || [];
  const areas = areasData?.data || [];

  // Matrix Query
  const { data: matrixData, isLoading: isMatrixLoading } = useQuery({
    queryKey: ['stock-matrix', matrixSearch, matrixProductId, matrixAreaId],
    queryFn: () =>
      reportsApi.getCurrentStockMatrix({
        search: matrixSearch || undefined,
        productId: matrixProductId || undefined,
        areaId: matrixAreaId || undefined,
      }),
    enabled: activeTab === 'matrix',
  });

  // Period Query
  const { data: periodData, isLoading: isPeriodLoading } = useQuery({
    queryKey: ['period-statement', startDate, endDate, periodProductId, periodAreaId, periodSearch],
    queryFn: () =>
      reportsApi.getPeriodStatement({
        startDate,
        endDate,
        productId: periodProductId || undefined,
        areaId: periodAreaId || undefined,
        search: periodSearch || undefined,
      }),
    enabled: activeTab === 'period',
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      if (activeTab === 'matrix') {
        const blob = await reportsApi.exportMatrixCsv({
          search: matrixSearch || undefined,
          productId: matrixProductId || undefined,
          areaId: matrixAreaId || undefined,
        });
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sifon-stock-matrix-${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Current stock matrix exported to CSV.');
      } else {
        const blob = await reportsApi.exportPeriodCsv({
          startDate,
          endDate,
          productId: periodProductId || undefined,
          areaId: periodAreaId || undefined,
          search: periodSearch || undefined,
        });
        const url = window.URL.createObjectURL(new Blob([blob]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sifon-period-statement-${startDate}-to-${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success('Period movement statement exported to CSV.');
      }
    } catch (err: any) {
      toast.error('Failed to export CSV: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Stock Statement & Reconciliation"
          subtitle="Comprehensive warehouse statements. Formulated strictly from the immutable inventory movement ledger."
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                leftIcon={<Printer className="w-4 h-4 text-slate-600" />}
              >
                Print Statement
              </Button>
              <Button
                variant="teal"
                size="sm"
                onClick={handleExportCsv}
                isLoading={isExporting}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Export CSV
              </Button>
            </div>
          }
        />
      </div>

      {/* Printable Header */}
      <div className="hidden print:block mb-6 border-b border-slate-300 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-950">Sifon Stock Management</h1>
            <h2 className="text-sm font-semibold text-slate-600 mt-1">
              {activeTab === 'matrix' ? 'Current Area-Wise Stock Matrix' : `Period Movement Statement (${startDate} to ${endDate})`}
            </h2>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Generated: {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
            <p>Timezone: Asia/Kolkata</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs and Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4 print:hidden">
        {/* Tab switch */}
        <div className="flex gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'matrix'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            View A: Current Area Stock Matrix
          </button>
          <button
            onClick={() => setActiveTab('period')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
              activeTab === 'period'
                ? 'bg-navy-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            View B: Period Movement Statement
          </button>
        </div>

        {/* View A Filters */}
        {activeTab === 'matrix' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={matrixSearch}
                onChange={e => setMatrixSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Product:</span>
              <select
                value={matrixProductId}
                onChange={e => setMatrixProductId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="">All Products</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Area:</span>
              <select
                value={matrixAreaId}
                onChange={e => setMatrixAreaId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="">All Areas</option>
                {areas.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>

            {(matrixSearch || matrixProductId || matrixAreaId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMatrixSearch('');
                  setMatrixProductId('');
                  setMatrixAreaId('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Clear
              </Button>
            )}
          </div>
        )}

        {/* View B Filters */}
        {activeTab === 'period' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Start Date:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">End Date:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Product:</span>
              <select
                value={periodProductId}
                onChange={e => setPeriodProductId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="">All Products</option>
                {products.map(p => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Area:</span>
              <select
                value={periodAreaId}
                onChange={e => setPeriodAreaId(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700"
              >
                <option value="">All Areas</option>
                {areas.map(a => (
                  <option key={a._id} value={a._id}>
                    {a.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-48">
              <input
                type="text"
                placeholder="Search..."
                value={periodSearch}
                onChange={e => setPeriodSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              />
            </div>
          </div>
        )}
      </div>

      {/* Report Data Render */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {activeTab === 'matrix' && (
          <div>
            {isMatrixLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : matrixData ? (
              <AreaMatrixView data={matrixData} />
            ) : null}
          </div>
        )}

        {activeTab === 'period' && (
          <div>
            {isPeriodLoading ? (
              <TableSkeleton rows={8} cols={8} />
            ) : periodData ? (
              <PeriodMovementView data={periodData} />
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
