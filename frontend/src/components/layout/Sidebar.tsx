import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingBag,
  Truck,
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  Boxes,
  X,
  Settings,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Products', to: '/products', icon: Package },
  { label: 'Areas', to: '/areas', icon: Boxes },
  { label: 'Purchases', to: '/purchases', icon: Truck },
  { label: 'Sales', to: '/sales', icon: ShoppingBag },
  { label: 'Returns', to: '/returns', icon: RotateCcw },
  { label: 'Damaged Products', to: '/damaged', icon: AlertTriangle },
  { label: 'Stock Statement', to: '/statement', icon: FileSpreadsheet },
  { label: 'Account Settings', to: '/settings', icon: Settings },
];

export const Sidebar: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-navy-950 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 border-r border-navy-900',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Brand header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-navy-900/80 bg-navy-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-navy-800 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">Sifon</span>
              <span className="block text-[10px] text-teal-400 font-medium tracking-wider uppercase -mt-1">
                Stock Management
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-teal-600/15 text-teal-400 font-semibold border-l-4 border-teal-500 pl-2'
                      : 'text-slate-300 hover:bg-navy-900 hover:text-white'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'w-5 h-5 transition-colors',
                        isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'
                      )}
                    />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom footer status */}
        <div className="p-4 border-t border-navy-900/80 bg-navy-900/30 text-xs text-slate-400">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-slate-300 font-medium">System Online</span>
          </div>
          <p className="text-[11px] text-slate-400">Business TZ: Asia/Kolkata</p>
        </div>
      </aside>
    </>
  );
};

