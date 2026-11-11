import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { damagedApi } from './damagedApi';
import { productsApi } from '../products/productsApi';
import { areasApi } from '../areas/areasApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';

export const DamagedListPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'balances' | 'history'>('balances');
  const [productId, setProductId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const { data: productsData } = useQuery({
    queryKey: ['products', 'filter'],
    queryFn: () => productsApi.getProducts({ limit: 500 }),
  });

  const { data: areasData } = useQuery({
    queryKey: ['areas', 'filter'],
    queryFn: () => areasApi.getAreas({ limit: 200 }),
  });

  const { data: balancesData, isLoading: isBalancesLoading } = useQuery({
    queryKey: ['damaged-balances', productId, areaId],
    queryFn: () =>
      damagedApi.getDamagedBalances({
        productId: productId || undefined,
        areaId: areaId || undefined,
      }),
    enabled: activeTab === 'balances',
  });

  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['damaged-history', historyPage, productId, areaId, startDate, endDate],
    queryFn: () =>
      damagedApi.getDamagedHistory({
        page: historyPage,
        limit: 15,
        productId: productId || undefined,
        areaId: areaId || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    enabled: activeTab === 'history',
  });

  const products = productsData?.data || [];
  const areas = areasData?.data || [];

  const balances = balancesData?.balances || [];
  const totalDamagedUnits = balancesData?.totalDamagedQuantity || 0;

  const history = historyData?.data || [];
  const historyMeta = historyData?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Damaged Products Inventory"
        subtitle="Quarantined defective inventory tracked strictly separate from saleable stock."
      />

      {/* Strict Accounting Notice */}
      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-start gap-3 text-xs text-amber-800">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block font-semibold mb-0.5">Segregated Inventory Guard</strong>
          Damaged stock quantities are strictly excluded from available inventory balances and can
          never be dispatched or allocated for sales. Balances are derived solely from customer
          return inspections.
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('balances')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'balances'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Current Damaged Balances
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
                activeTab === 'history'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Supporting Return History
            </button>
          </div>

          {activeTab === 'balances' && (
            <div className="text-xs">
              <span className="text-slate-500 mr-2">Total Quarantined Damaged Stock:</span>
              <span className="font-mono font-bold text-rose-600 text-base">
                {totalDamagedUnits.toLocaleString()} units
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">Product:</span>
            <select
              value={productId}
              onChange={e => {
                setProductId(e.target.value);
                setHistoryPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
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
              value={areaId}
              onChange={e => {
                setAreaId(e.target.value);
                setHistoryPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            >
              <option value="">All Areas</option>
              {areas.map(a => (
                <option key={a._id} value={a._id}>
                  {a.displayName}
                </option>
              ))}
            </select>
          </div>

          {activeTab === 'history' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => {
                    setStartDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-500 uppercase tracking-wider">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => {
                    setEndDate(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
                />
              </div>
            </>
          )}

          {(productId || areaId || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProductId('');
                setAreaId('');
                setStartDate('');
                setEndDate('');
                setHistoryPage(1);
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Tab 1: Current Damaged Balances */}
      {activeTab === 'balances' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {isBalancesLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : balances.length === 0 ? (
            <div className="p-12 text-center">
              <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-base font-bold text-slate-700">Zero damaged inventory</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                There are currently no damaged stock units recorded across any areas.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-6">SKU / Code</th>
                    <th className="py-3.5 px-6">Product Name</th>
                    <th className="py-3.5 px-6">Storage Area</th>
                    <th className="py-3.5 px-6 text-right">Damaged Quantity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {balances.map(b => (
                    <tr key={b._id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-6 font-mono font-bold text-navy-950">
                        {b.productId?.code}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        {b.productId?.name}
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-navy-900">
                        {b.areaId?.displayName || 'Area'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-rose-600">
                        {b.damagedQuantity.toLocaleString()} {b.productId?.unit || 'pcs'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Supporting Return History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {isHistoryLoading ? (
            <TableSkeleton rows={5} cols={7} />
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">
              No damaged return history records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-6">Return Ref</th>
                    <th className="py-3.5 px-6">Return Date</th>
                    <th className="py-3.5 px-6">Original Sale</th>
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-6">Area</th>
                    <th className="py-3.5 px-6 text-right">Damaged Qty</th>
                    <th className="py-3.5 px-6">Reason / Defect Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {history.map(r => (
                    <tr key={r._id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-6 font-mono font-bold text-navy-950">
                        {r.reference}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-600">
                        {formatDate(r.returnDate)}
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-800">
                        {r.saleId?.reference || '-'}
                      </td>
                      <td className="py-3.5 px-6 font-medium text-slate-900">
                        {r.productId?.name} ({r.productId?.code})
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-navy-900">
                        {r.receivingAreaId?.displayName}
                      </td>
                      <td className="py-3.5 px-6 text-right font-mono font-bold text-rose-600">
                        +{r.damagedQuantity} {r.productId?.unit || 'pcs'}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 max-w-xs truncate">
                        {r.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {historyMeta && (
            <Pagination
              page={historyMeta.page}
              totalPages={historyMeta.totalPages}
              totalItems={historyMeta.total}
              onPageChange={setHistoryPage}
              isLoading={isHistoryLoading}
            />
          )}
        </div>
      )}
    </div>
  );
};
