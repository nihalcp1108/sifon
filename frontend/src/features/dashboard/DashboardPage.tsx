import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import {
  Package,
  MapPin,
  Boxes,
  Truck,
  ShoppingBag,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  Tag,
  Layers,
  ArrowRight,
  LogOut,
  AlertCircle,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { dashboardApi } from './dashboardApi';
import { useAuth } from '../auth/useAuth';
import { useCountUp } from './useCountUp';
import { StockMovementChart } from './StockMovementChart';
import { StockByLocation } from './StockByLocation';
import { InventorySnapshotTable } from './InventorySnapshotTable';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Skeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../lib/utils';

// Helper animated card component
const SummaryKpiCard: React.FC<{
  title: string;
  rawValue: number | null;
  unitLabel: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  delayMs?: number;
  badge?: string;
  isUnavailable?: boolean;
}> = ({
  title,
  rawValue,
  unitLabel,
  subtitle,
  icon: Icon,
  iconClass,
  delayMs = 0,
  badge,
  isUnavailable = false,
}) => {
  const animatedValue = useCountUp(rawValue ?? 0, 500);

  return (
    <div
      className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between group animate-dash-fade"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <div className={`p-2 rounded-lg border transition-transform duration-200 group-hover:scale-105 ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          {isUnavailable ? (
            <span className="text-2xl font-bold tracking-tight text-slate-400 font-mono">
              —
            </span>
          ) : (
            <span className="text-2xl font-bold tracking-tight text-navy-950 font-mono">
              {animatedValue.toLocaleString()}
            </span>
          )}

          {badge ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
              {badge}
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">{unitLabel}</span>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-2.5 line-clamp-1 border-t border-slate-100 pt-2">
        {subtitle}
      </p>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const {
    data: summary,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.getSummary,
    staleTime: 15000,
  });

  // Strict 1-10 module ordering required by project specification
  const systemModules = [
    {
      order: 1,
      name: 'Brand',
      description: 'Product brands and manufacturers',
      to: '/brands',
      icon: Tag,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      order: 2,
      name: 'Category',
      description: 'Item taxonomy & classifications',
      to: '/categories',
      icon: Layers,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      order: 3,
      name: 'Location',
      description: 'Warehouse storage locations',
      to: '/locations',
      icon: MapPin,
      color: 'text-teal-600 bg-teal-50 border-teal-200',
    },
    {
      order: 4,
      name: 'Product',
      description: 'Catalog items & balance ledgers',
      to: '/products',
      icon: Package,
      color: 'text-navy-700 bg-navy-50 border-navy-200',
    },
    {
      order: 5,
      name: 'Purchase',
      description: 'Inbound shipments & receiving',
      to: '/purchases',
      icon: Truck,
      color: 'text-sky-600 bg-sky-50 border-sky-200',
    },
    {
      order: 6,
      name: 'Sales',
      description: 'Outbound dispatch & fulfillment',
      to: '/sales',
      icon: ShoppingBag,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
    {
      order: 7,
      name: 'Return',
      description: 'Customer returns & restocking',
      to: '/returns',
      icon: RotateCcw,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      order: 8,
      name: 'Damage',
      description: 'Quarantined stock balance audit',
      to: '/damaged',
      icon: AlertTriangle,
      color: 'text-rose-600 bg-rose-50 border-rose-200',
    },
    {
      order: 9,
      name: 'Stock Statement',
      description: 'Stock matrix & movement ledger',
      to: '/statement',
      icon: FileSpreadsheet,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      order: 10,
      name: 'Account Settings',
      description: 'Security & user management',
      to: '/settings',
      icon: Settings,
      color: 'text-slate-600 bg-slate-50 border-slate-200',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 sm:p-6 transition-all animate-dash-fade">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-navy-950">Stock overview</h1>
              <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Live Ledger
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">A clear view of your inventory.</p>
          </div>

          {/* User authenticated action strip */}
          <div className="flex flex-wrap items-center gap-3">
            {user && (
              <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
                <div className="w-7 h-7 rounded-full bg-navy-800 text-teal-300 flex items-center justify-center font-bold text-xs shadow-xs">
                  {(user.name || user.email || 'A').charAt(0).toUpperCase()}
                </div>
                <div className="text-left text-xs pr-1">
                  <span className="font-semibold text-slate-800 block leading-tight">
                    {user.name || 'Administrator'}
                  </span>
                  <span className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider">
                    {user.role}
                  </span>
                </div>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-3.5 h-3.5 text-teal-600" />}
              onClick={() => navigate('/purchases/new')}
              className="text-xs font-semibold"
            >
              New Purchase
            </Button>

            <Button
              size="sm"
              variant="outline"
              leftIcon={<Plus className="w-3.5 h-3.5 text-navy-700" />}
              onClick={() => navigate('/sales/new')}
              className="text-xs font-semibold"
            >
              New Sale
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={logout}
              leftIcon={<LogOut className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600" />}
              className="text-xs text-slate-600 hover:text-rose-600"
              title="Sign Out of S AND M"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Summary cards (4 on desktop, 2 on tablet, 1-2 on mobile) */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : error || !summary ? (
        <div className="p-6 text-center bg-white rounded-xl border border-rose-200 text-xs">
          <AlertCircle className="w-6 h-6 text-rose-500 mx-auto mb-2" />
          <p className="text-rose-600 font-semibold">Failed to load inventory summary metrics.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total products */}
          <SummaryKpiCard
            title="Total products"
            rawValue={summary.activeProductCount}
            unitLabel="catalog items"
            subtitle="Registered active products"
            icon={Package}
            iconClass="text-navy-700 bg-navy-50 border-navy-200"
            delayMs={0}
          />

          {/* Card 2: Available stock */}
          <SummaryKpiCard
            title="Available stock"
            rawValue={summary.totalAvailableQuantity}
            unitLabel="units in ledger"
            subtitle="Ready for sales dispatch"
            icon={Boxes}
            iconClass="text-emerald-700 bg-emerald-50 border-emerald-200"
            delayMs={70}
          />

          {/* Card 3: Active locations */}
          <SummaryKpiCard
            title="Active locations"
            rawValue={summary.activeAreaCount}
            unitLabel="locations"
            subtitle="Designated storage points"
            icon={MapPin}
            iconClass="text-teal-700 bg-teal-50 border-teal-200"
            delayMs={140}
          />

          {/* Card 4: Low-stock products (Unavailable per schema rule; explicitly handled) */}
          <SummaryKpiCard
            title="Low-stock products"
            rawValue={null}
            unitLabel=""
            subtitle="Threshold rule not defined in product schema"
            icon={AlertCircle}
            iconClass="text-slate-600 bg-slate-50 border-slate-200"
            delayMs={210}
            badge="Rule unavailable"
            isUnavailable={true}
          />
        </div>
      )}

      {/* 3 & 4: Stock Movement Chart & Stock by Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Stock Movement Chart (2 columns on desktop) */}
        <div className="lg:col-span-2">
          <StockMovementChart />
        </div>

        {/* Stock by Location (1 column on desktop) */}
        <div className="lg:col-span-1">
          <StockByLocation />
        </div>
      </div>

      {/* 5. Inventory Snapshot Table */}
      <div>
        <InventorySnapshotTable />
      </div>

      {/* 6. System Modules Quick Access in Exact 1-10 Order */}
      <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-navy-950 uppercase tracking-wider">
              System Modules
            </h3>
            <p className="text-xs text-slate-500">
              Quick access in standardized system navigation sequence
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3.5">
          {systemModules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.order}
                to={mod.to}
                className="group p-3.5 rounded-xl border border-slate-200/80 hover:border-teal-500 hover:shadow-xs bg-slate-50/50 hover:bg-white transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <div
                      className={`p-2 rounded-lg border ${mod.color} transition-transform duration-200 group-hover:scale-105`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-slate-400 group-hover:text-teal-600">
                      #{mod.order}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {mod.name}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 leading-snug">
                    {mod.description}
                  </p>
                </div>
                <div className="mt-3 flex items-center text-[10px] font-semibold text-teal-600 group-hover:text-teal-700">
                  Open{' '}
                  <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 7. Recent Transactions Grid (Purchases, Sales, Customer Returns) */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Recent Purchases */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col hover:border-slate-300 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-navy-700" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  Recent Purchases
                </h3>
              </div>
              <Link
                to="/purchases"
                className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 flex-1 divide-y divide-slate-100">
              {summary.recentPurchases.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No purchases recorded yet</p>
              ) : (
                summary.recentPurchases.map((p) => (
                  <div
                    key={p._id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 rounded px-1 -mx-1"
                    onClick={() => navigate(`/purchases/${p._id}`)}
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{p.reference}</span>
                      <span className="text-slate-400 text-[11px]">
                        {formatDate(p.purchaseDate)} &bull; {p.items.length} line(s)
                      </span>
                    </div>
                    <Badge
                      variant={
                        p.status === 'POSTED'
                          ? 'posted'
                          : p.status === 'DRAFT'
                          ? 'draft'
                          : 'cancelled'
                      }
                    >
                      {p.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Sales */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col hover:border-slate-300 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  Recent Sales
                </h3>
              </div>
              <Link
                to="/sales"
                className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 flex-1 divide-y divide-slate-100">
              {summary.recentSales.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No sales recorded yet</p>
              ) : (
                summary.recentSales.map((s) => (
                  <div
                    key={s._id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 rounded px-1 -mx-1"
                    onClick={() => navigate(`/sales/${s._id}`)}
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{s.reference}</span>
                      <span className="text-slate-400 text-[11px]">
                        {formatDate(s.saleDate)} &bull; {s.items.length} line(s)
                      </span>
                    </div>
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
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Returns */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs flex flex-col hover:border-slate-300 transition-colors">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-teal-700" />
                <h3 className="text-xs font-bold text-navy-950 uppercase tracking-wider">
                  Recent Returns
                </h3>
              </div>
              <Link
                to="/returns"
                className="text-xs font-medium text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
              >
                All <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="p-4 flex-1 divide-y divide-slate-100">
              {summary.recentReturns.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No customer returns recorded yet</p>
              ) : (
                summary.recentReturns.map((r) => (
                  <div
                    key={r._id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs cursor-pointer hover:bg-slate-50/50 rounded px-1 -mx-1"
                    onClick={() => navigate(`/returns/${r._id}`)}
                  >
                    <div>
                      <span className="font-semibold text-slate-800 block">{r.reference}</span>
                      <span className="text-slate-500 text-[11px]">
                        {r.nonDamagedQuantity > 0 && (
                          <span className="text-emerald-700 font-semibold">
                            +{r.nonDamagedQuantity} avail{' '}
                          </span>
                        )}
                        {r.damagedQuantity > 0 && (
                          <span className="text-rose-700 font-semibold">
                            +{r.damagedQuantity} damaged{' '}
                          </span>
                        )}
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
      )}
    </div>
  );
};
