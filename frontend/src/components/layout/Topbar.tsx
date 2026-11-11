import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, LogOut, Settings } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { Button } from '../common/Button';

export const Topbar: React.FC<{ onOpenMobileMenu: () => void }> = ({ onOpenMobileMenu }) => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-navy-800"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:block">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
            Real-Time Inventory Ledger
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 pl-3">
            <div className="w-8 h-8 rounded-full bg-navy-100 border border-navy-200 text-navy-900 flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden md:block text-left text-xs">
              <span className="block font-semibold text-slate-800">{user.name}</span>
              <span className="block text-slate-400 font-mono text-[11px]">{user.email}</span>
            </div>
            <Link
              to="/settings"
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-navy-900 transition-colors flex items-center gap-1.5 text-xs font-medium border border-transparent hover:border-slate-200"
              title="Account Settings"
            >
              <Settings className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline text-slate-600">Settings</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              leftIcon={<LogOut className="w-4 h-4 text-slate-500 hover:text-rose-600" />}
              className="text-xs text-slate-600 hover:text-rose-600"
              title="Sign Out"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
