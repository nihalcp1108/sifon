import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Plus, Eye } from 'lucide-react';
import { returnsApi } from './returnsApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { TableSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';

export const ReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['returns', 'list', page, statusFilter, startDate, endDate],
    queryFn: () =>
      returnsApi.getReturns({
        page,
        limit: 15,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
  });

  const returns = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Sales Returns"
        subtitle="Manage returned stock. Restores available stock or places damaged units into separate damaged inventory."
        action={
          <Button
            size="sm"
            variant="teal"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => navigate('/returns/new')}
          >
            Record Customer Return
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
          <TableSkeleton rows={6} cols={7} />
        ) : returns.length === 0 ? (
          <div className="p-12 text-center">
            <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">No customer returns found</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              Returns restore available stock or allocate defective items into damaged inventory.
            </p>
            <Button size="sm" variant="teal" onClick={() => navigate('/returns/new')}>
              Record Return
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-6">Return Reference</th>
                  <th className="py-3.5 px-6">Return Date</th>
                  <th className="py-3.5 px-6">Sale Reference</th>
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-6">Receiving Area</th>
                  <th className="py-3.5 px-6 text-right">Non-Damaged</th>
                  <th className="py-3.5 px-6 text-right">Damaged</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {returns.map(r => (
                  <tr key={r._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-bold text-navy-950">
                      {r.reference}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 text-xs font-mono">
                      {formatDate(r.returnDate)}
                    </td>
                    <td className="py-3.5 px-6 font-mono font-medium text-slate-800 text-xs">
                      {r.saleId?.reference || '-'}
                    </td>
                    <td className="py-3.5 px-6 text-slate-800 text-xs">
                      <span className="font-semibold block">{r.productId?.name}</span>
                      <span className="font-mono text-[11px] text-slate-400">{r.productId?.code}</span>
                    </td>
                    <td className="py-3.5 px-6 text-xs font-semibold text-navy-900">
                      {r.receivingAreaId?.displayName || 'Area'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-emerald-700">
                      {r.nonDamagedQuantity > 0 ? `+${r.nonDamagedQuantity}` : '-'}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono font-bold text-rose-600">
                      {r.damagedQuantity > 0 ? `+${r.damagedQuantity}` : '-'}
                    </td>
                    <td className="py-3.5 px-6">
                      <Badge variant={r.status === 'POSTED' ? 'posted' : 'cancelled'}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/returns/${r._id}`)}
                        leftIcon={<Eye className="w-3.5 h-3.5 text-teal-600" />}
                        className="text-xs"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
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

