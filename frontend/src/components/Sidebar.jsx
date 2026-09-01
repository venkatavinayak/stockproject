import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, ShoppingCart, Package, 
  History, DollarSign, BarChart3, Settings, 
  Database, Bell, AlertTriangle, Users as UsersIcon
} from 'lucide-react';

const Sidebar = ({ isCollapsed, isMobileOpen, closeMobile }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: true },
    { name: 'Billing (POS)', path: '/billing', icon: ShoppingCart },
    { name: 'Inventory Catalog', path: '/inventory', icon: Package },
    { name: 'Sales History', path: '/transactions', icon: History },
    { name: 'Store Expenses', path: '/expenses', icon: DollarSign, adminOnly: true },
    { name: 'Advanced Analytics', path: '/analytics', icon: BarChart3, adminOnly: true },
    { name: 'User Accounts', path: '/users', icon: UsersIcon, adminOnly: true },
    { name: 'Store Settings', path: '/settings', icon: Settings, adminOnly: true },
  ];

  const filteredItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside 
      className={`fixed top-0 left-0 z-50 h-screen border-r transition-all duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
        ${isCollapsed ? 'md:w-20' : 'md:w-64'} 
        bg-white border-slate-200 text-slate-800
        dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200`}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="p-2 text-white bg-indigo-600 rounded-lg shadow-md shrink-0">
              <Package size={20} />
            </div>
            {(!isCollapsed || isMobileOpen) && (
              <span className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-500 font-title text-md">
                Smart Store Ai
              </span>
            )}
          </div>
        </div>
 
        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobile}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all duration-300 transform active:scale-[0.98]
                  ${isActive 
                    ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/30 text-indigo-600 dark:from-indigo-950/40 dark:to-indigo-900/10 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 hover:translate-x-1 dark:text-slate-400 dark:hover:bg-slate-900/50 dark:hover:text-slate-100'}
                `}
              >
                <Icon size={18} className="shrink-0" />
                {(!isCollapsed || isMobileOpen) && <span className="font-sans">{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        {!isCollapsed && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="p-3 text-center rounded-xl bg-slate-50 dark:bg-slate-900/50">
              <span className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400">Retail ERP v1.0</span>
              <span className="block text-[10px] text-slate-400">Smart Store Engine</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
