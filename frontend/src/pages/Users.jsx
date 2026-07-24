import React, { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { 
  Users, UserPlus, Trash2, KeyRound, 
  ShieldCheck, ShieldAlert, AlertCircle, Loader2, CheckSquare
} from 'lucide-react';

const UsersPage = () => {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Create User Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('worker');
  const [canManageStock, setCanManageStock] = useState(false);
  const [canViewExpenses, setCanViewExpenses] = useState(false);
  const [canViewAnalytics, setCanViewAnalytics] = useState(false);
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authAPI.listUsers();
      setUsersList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    
    if (!username.trim() || !password) {
      setFormError('Username and password are required');
      return;
    }
    
    if (password.length < 4) {
      setFormError('Password must be at least 4 characters long');
      return;
    }

    try {
      setFormLoading(true);
      const rights = {
        can_manage_stock: canManageStock,
        can_view_expenses: canViewExpenses,
        can_view_analytics: canViewAnalytics
      };
      await authAPI.createUser(username.trim(), password, role, rights);
      setFormSuccess(`User "${username}" created successfully as ${role}`);
      setUsername('');
      setPassword('');
      setRole('worker');
      setCanManageStock(false);
      setCanViewExpenses(false);
      setCanViewAnalytics(false);
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Failed to create user account');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleRights = async (usr, field, value) => {
    try {
      const updatedRights = {
        can_manage_stock: usr.can_manage_stock,
        can_view_expenses: usr.can_view_expenses,
        can_view_analytics: usr.can_view_analytics,
        is_active: usr.is_active
      };
      updatedRights[field] = value;
      
      await authAPI.updateUserRights(usr.username, updatedRights);
      
      // Update local state instantly so checkbox reflects change
      setUsersList(prev => prev.map(u => u.username === usr.username ? { ...u, ...updatedRights } : u));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update permissions');
    }
  };

  const handleDeleteUser = async (userToDelete) => {
    if (window.confirm(`Are you sure you want to delete worker account "${userToDelete}"?`)) {
      try {
        await authAPI.deleteUser(userToDelete);
        alert(`User "${userToDelete}" has been deleted.`);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.detail || 'Failed to delete user');
      }
    }
  };

  const handleResetPassword = async (username) => {
    const newPass = prompt(`Enter new password for user "${username}":`);
    if (!newPass) return;
    if (newPass.length < 4) {
      alert("Password must be at least 4 characters long.");
      return;
    }
    try {
      await authAPI.resetUserPassword(username, newPass);
      alert(`Password for worker "${username}" has been successfully updated.`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to reset password.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight font-title">User Accounts</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Create logins and configure granular stock and store rights for each terminal cashier.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column: Create User Form */}
        <div className="xl:col-span-1 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel bg-white dark:bg-slate-950/40 h-fit">
          <h2 className="text-lg font-bold font-title mb-4 flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <UserPlus size={20} />
            Create Login Account
          </h2>

          {formError && (
            <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold">
              <AlertCircle size={14} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold">
              <ShieldCheck size={14} className="shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. counter_1"
                required
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <KeyRound size={12} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Access Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="worker">Worker (Customized Terminal Access)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>
            </div>

            {/* Checkboxes for Worker Rights */}
            {role === 'worker' && (
              <div className="space-y-2.5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-850">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <CheckSquare size={12} className="text-indigo-500" />
                  Grant Worker Rights
                </span>
                
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={canManageStock}
                    onChange={(e) => setCanManageStock(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <span>Modify Stock Catalog</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={canViewExpenses}
                    onChange={(e) => setCanViewExpenses(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <span>Manage Expenses</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                  <input
                    type="checkbox"
                    checked={canViewAnalytics}
                    onChange={(e) => setCanViewAnalytics(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500/20 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                  />
                  <span>View Sales Analytics</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={formLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-extrabold shadow-md shadow-indigo-600/10 active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-1 text-xs"
            >
              {formLoading ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Creating...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Users List */}
        <div className="xl:col-span-3 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel bg-white dark:bg-slate-950/40">
          <h2 className="text-lg font-bold font-title mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <Users size={20} className="text-indigo-600 dark:text-indigo-400" />
            Registered Accounts & Rights Control
          </h2>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-slate-950/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b dark:bg-slate-900 dark:border-slate-800 font-bold text-slate-500 dark:text-slate-400">
                    <th className="p-4">Username</th>
                    <th className="p-4">Access Role</th>
                    <th className="p-4">Granular Worker Rights (Toggles)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Last Login</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        <Loader2 size={24} className="animate-spin mx-auto mb-2 text-slate-400" />
                        Fetching terminal user details...
                      </td>
                    </tr>
                  ) : usersList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        No user accounts registered
                      </td>
                    </tr>
                  ) : (
                    usersList.map((usr) => (
                      <tr key={usr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="p-4 font-bold text-slate-900 dark:text-white">{usr.username}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide
                            ${usr.role === 'admin' 
                              ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400' 
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400'
                            }`}
                          >
                            {usr.role === 'admin' ? (
                              <>
                                <ShieldAlert size={10} /> Admin
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={10} /> Worker
                              </>
                            )}
                          </span>
                        </td>
                        <td className="p-4">
                          {usr.role === 'admin' ? (
                            <span className="text-[10px] text-slate-400 italic font-medium">All Rights Granted (Inherited)</span>
                          ) : (
                            <div className="flex flex-col gap-1.5">
                              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={usr.can_manage_stock || false}
                                  onChange={(e) => handleToggleRights(usr, 'can_manage_stock', e.target.checked)}
                                  className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500/10 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                                />
                                <span>📦 Stock Control</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={usr.can_view_expenses || false}
                                  onChange={(e) => handleToggleRights(usr, 'can_view_expenses', e.target.checked)}
                                  className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500/10 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                                />
                                <span>💰 Expenses Access</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold text-slate-700 dark:text-slate-350 hover:text-indigo-500 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={usr.can_view_analytics || false}
                                  onChange={(e) => handleToggleRights(usr, 'can_view_analytics', e.target.checked)}
                                  className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500/10 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                                />
                                <span>📊 Analytics View</span>
                              </label>
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          {usr.username === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                            </span>
                          ) : (
                            <label className="inline-flex items-center gap-1.5 cursor-pointer text-[10px] font-bold">
                              <input
                                type="checkbox"
                                checked={usr.is_active}
                                onChange={(e) => handleToggleRights(usr, 'is_active', e.target.checked)}
                                className="w-3 h-3 text-indigo-600 rounded focus:ring-indigo-500/10 border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                              />
                              <span className={usr.is_active ? 'text-emerald-500' : 'text-slate-400'}>
                                {usr.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </label>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 dark:text-slate-400 font-mono text-[10px]">
                          {usr.last_login 
                            ? new Date(usr.last_login).toLocaleString('en-IN', { 
                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                              })
                            : 'Never'
                          }
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleResetPassword(usr.username)}
                              disabled={usr.username === 'admin'}
                              className={`p-1.5 border rounded-lg inline-flex items-center justify-center text-xs transition-colors
                                ${usr.username === 'admin'
                                  ? 'border-slate-205 text-slate-350 dark:border-slate-850 cursor-not-allowed opacity-45'
                                  : 'border-indigo-100 text-indigo-650 hover:bg-indigo-50 dark:border-indigo-950/40 dark:hover:bg-indigo-950/20 dark:text-indigo-400'
                                }`}
                              title={usr.username === 'admin' ? 'Cannot reset default admin password here' : 'Reset Password'}
                            >
                              <KeyRound size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(usr.username)}
                              disabled={usr.username === 'admin'}
                              className={`p-1.5 border rounded-lg inline-flex items-center justify-center text-xs transition-colors
                                ${usr.username === 'admin'
                                  ? 'border-slate-200 text-slate-350 dark:border-slate-850 cursor-not-allowed opacity-45'
                                  : 'border-rose-100 text-rose-500 hover:bg-rose-50 dark:border-rose-950/40 dark:hover:bg-rose-950/20'
                                }`}
                              title={usr.username === 'admin' ? 'Default admin cannot be deleted' : 'Delete Account'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersPage;
