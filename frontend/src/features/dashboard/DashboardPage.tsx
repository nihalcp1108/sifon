import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  Boxes,
  CheckCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Plus,
  ShoppingBag,
  Truck,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { dashboardApi } from './dashboardApi';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.getSummary,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory Dashboard" subtitle="Loading metrics..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-rose-200">
        <p className="text-rose-600 font-medium">Failed to load dashboard metrics.</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Active Products',
      value: summary.activeProductCount,
      unit: 'items',
      icon: Package,
      iconColor: 'text-navy-700 bg-navy-50 border-navy-200',
    },
    {
      title: 'Active Areas',
      value: summary.activeAreaCount,
      unit: 'zones',
      icon: Boxes,
      iconColor: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      title: 'Available Stock',
      value: summary.totalAvailableQuantity.toLocaleString(),
      unit: 'units',
      icon: CheckCircle,
      iconColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Damaged Stock',
      value: summary.totalDamagedQuantity.toLocaleString(),
      unit: 'units',
      icon: AlertTriangle,
      iconColor: 'text-rose-700 bg-rose-50 border-rose-200',
    },
    {
      title: "Today's Purchases",
      value: summary.todayPurchasedQuantity.toLocaleString(),
      unit: 'units',
      icon: ArrowDownToLine,
      iconColor: 'text-sky-700 bg-sky-50 border-sky-200',
    },
    {
      title: "Today's Sales",
      value: summary.todaySoldQuantity.toLocaleString(),
      unit: 'units',
      icon: ArrowUpFromLine,
      iconColor: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Stock Dashboard"
        subtitle="Real-time ledger overview & recent movement activities"
        action={
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-4 h-4 text-teal-600" />}
              onClick={() => navigate('/products?action=new')}
            >
              Add Product
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<Truck className="w-4 h-4 text-navy-600" />}
              onClick={() => navigate('/purchases/new')}
            >
              Record Purchase
            </Button>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<ShoppingBag className="w-4 h-4 text-emerald-600" />}
              onClick={() => navigate('/sales/new')}
            >
              Record Sale
            </Button>
            <Button
              size="sm"
              variant="teal"
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={() => navigate('/returns/new')}
            >
              Record Return
            </Button>
          </div>
        }
      />

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.title}
                </span>
                <div className={`p-2 rounded-lg border ${card.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold tracking-tight text-navy-950">
                  {card.value}
                </span>
                <span className="text-xs text-slate-500 font-medium">{card.unit}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent Movements Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Purchases */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-navy-700" />
              <h3 className="text-sm font-bold text-navy-950">Recent Purchases</h3>
            </div>
            <Link
              to="/purchases"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 flex-1 divide-y divide-slate-100">
            {summary.recentPurchases.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No purchases recorded yet</p>
            ) : (
              summary.recentPurchases.map(p => (
                <div key={p._id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{p.reference}</span>
                    <span className="text-slate-400">{formatDate(p.purchaseDate)} &bull; {p.items.length} line(s)</span>
                  </div>
                  <Badge variant={p.status === 'POSTED' ? 'posted' : p.status === 'DRAFT' ? 'draft' : 'cancelled'}>
                    {p.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-navy-950">Recent Sales</h3>
            </div>
            <Link
              to="/sales"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 flex-1 divide-y divide-slate-100">
            {summary.recentSales.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No sales recorded yet</p>
            ) : (
              summary.recentSales.map(s => (
                <div key={s._id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{s.reference}</span>
                    <span className="text-slate-400">{formatDate(s.saleDate)} &bull; {s.items.length} line(s)</span>
                  </div>
                  <Badge variant={s.status === 'POSTED' ? 'posted' : s.status === 'DRAFT' ? 'draft' : 'cancelled'}>
                    {s.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Returns */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-bold text-navy-950">Recent Customer Returns</h3>
            </div>
            <Link
              to="/returns"
              className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-4 flex-1 divide-y divide-slate-100">
            {summary.recentReturns.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No customer returns recorded yet</p>
            ) : (
              summary.recentReturns.map(r => (
                <div key={r._id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-800 block">{r.reference}</span>
                    <span className="text-slate-500">
                      {r.nonDamagedQuantity > 0 && <span className="text-emerald-700 font-medium">+{r.nonDamagedQuantity} avail </span>}
                      {r.damagedQuantity > 0 && <span className="text-rose-700 font-medium">+{r.damagedQuantity} damaged </span>}
                    </span>
                  </div>
                  <Badge variant={r.status === 'POSTED' ? 'posted' : 'cancelled'}>
                    {r.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

