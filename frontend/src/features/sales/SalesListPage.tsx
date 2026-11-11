import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Eye } from 'lucide-react';
import { salesApi } from './salesApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';

export const SalesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'list', page, statusFilter, startDate, endDate],
    queryFn: () =>
      salesApi.getSales({
        page,
        limit: 15,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const sales = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Orders"
        subtitle="Manage outbound shipments. Sales deduct stock from designated storage areas."
        action={
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="w-4 h-4 text-teal-400" />}
            onClick={() => navigate('/sales/new')}
          >
            Record Sale
          </Button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            >
              <option value="">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-500 uppercase tracking-wider">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-navy-700"
            />
          </div>
        </div>

        {(statusFilter || startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('');
              setStartDate('');
              setEndDate('');
              setPage(1);
            }}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : sales.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No sales recorded yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Post an outbound sale to reduce stock in the designated area.
            </p>
            <Button size="sm" variant="primary" onClick={() => navigate('/sales/new')}>
              Record Sale
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Reference</th>
                  <th className="py-3.5 px-6">Sale Date</th>
                  <th className="py-3.5 px-6">Items Summary</th>
                  <th className="py-3.5 px-6">Total Units Sold</th>
                  <th className="py-3.5 px-6">Active Returns</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sales.map(s => {
                  const totalUnits = s.items.reduce((sum, item) => sum + item.quantity, 0);
                  const totalReturned = s.items.reduce(
                    (sum, item) => sum + (item.returnedQuantity || 0),
                    0
                  );

                  return (
                    <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-navy-950">
                        {s.reference}
                      </td>
                      <td className="py-3.5 px-6 text-slate-600 text-xs font-mono">
                        {formatDate(s.saleDate)}
                      </td>
                      <td className="py-3.5 px-6 text-slate-700 text-xs">
                        <span className="font-semibold">{s.items.length} product(s)</span>
                        <span className="block text-[11px] text-slate-400 truncate max-w-xs">
                          {s.items
                            .map(
                              i =>
                                `${i.productId?.code || 'SKU'} (${i.quantity} from Area ${
                                  i.sourceAreaId?.areaNumber ?? '?'
                                })`
                            )
                            .join(', ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-800">
                        {totalUnits.toLocaleString()} units
                      </td>
                      <td className="py-3.5 px-6 text-xs">
                        {totalReturned > 0 ? (
                          <span className="font-semibold text-amber-700 font-mono">
                            {totalReturned} returned
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <Badge
                          variant={
                            s.status === 'POSTED'
                              ? 'posted'
                              : s.status === 'DRAFT'
                              ? 'draft'
                              : 'cancelled'
                          }
                        >
                          {s.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/sales/${s._id}`)}
                          leftIcon={<Eye className="w-3.5 h-3.5 text-teal-600" />}
                          className="text-xs"
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            totalItems={meta.total}
            onPageChange={setPage}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
};

