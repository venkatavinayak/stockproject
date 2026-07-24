import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { notificationsAPI } from '../services/api';
import { 
  Menu, Bell, Sun, Moon, LogOut, User, 
  AlertTriangle, Check, Trash
} from 'lucide-react';

const Navbar = ({ toggleSidebar, isSidebarCollapsed }) => {
  const { logout, user } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Digital clock refresh
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      // Fetch only unread alerts
      const data = await notificationsAPI.getAll(true);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 20 seconds for low stock / backup alerts
    const poll = setInterval(fetchNotifications, 20000);
    return () => clearInterval(poll);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkOneRead = async (id) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white/80 border-b border-slate-200 backdrop-blur-md dark:bg-slate-950/80 dark:border-slate-800">
      {/* Left section: Collapse Toggle & Clock */}
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleSidebar}
          className="p-2 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200"
        >
          <Menu size={20} />
        </button>
        <div className="hidden text-xs font-semibold text-slate-500 md:block dark:text-slate-400">
          {currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          <span className="mx-2 font-light">|</span>
          <span className="font-mono text-indigo-600 dark:text-indigo-400">
            {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Right section: Theme, Notifications, User */}
      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleDarkMode}
          className="p-2 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200"
        >
          {darkMode ? <Sun size={20} className="text-amber-500" /> : <Moon size={20} />}
        </button>

        {/* Notifications Icon and Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative p-2 text-slate-500 rounded-lg hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-200"
          >
            <Bell size={20} />
            {notifications.length > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
                {notifications.length}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white border border-slate-200 shadow-xl dark:bg-slate-950 dark:border-slate-800 animate-fade-in">
              <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Live Alerts ({notifications.length})</span>
                {notifications.length > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">No active stock alerts</div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      className="flex gap-2 p-3 border-b border-slate-50 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/50"
                    >
                      <div className="text-rose-500 shrink-0 mt-0.5">
                        <AlertTriangle size={14} />
                      </div>
                      <div className="flex-1">
                        <span className="block text-[11px] leading-snug text-slate-700 dark:text-slate-300">{notif.message}</span>
                        <span className="block text-[9px] text-slate-400 mt-1">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleMarkOneRead(notif.id)}
                        className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-400 self-center"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-800">
          <div className="hidden text-right md:block">
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              {user?.role === 'admin' ? 'Owner Account' : `${user?.username || 'Worker'} (Cashier)`}
            </span>
            <span className="block text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Online</span>
          </div>
          <div className="p-2 text-indigo-600 bg-indigo-50 rounded-full dark:bg-indigo-950/60 dark:text-indigo-400">
            <User size={18} />
          </div>
          <button
            onClick={logout}
            className="p-2 text-slate-400 rounded-lg hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 dark:hover:text-rose-400"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
