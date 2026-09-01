import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, AlertCircle, ShoppingBag, ArrowRight } from 'lucide-react';

const Login = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || err.response?.data?.detail || 'Invalid username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Pane: Auth Form */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 p-8 md:p-12 lg:p-16 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="w-full max-w-md mx-auto animate-fade-in">
          {/* Logo Brand */}
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 text-white bg-indigo-600 rounded-2xl shadow-md shadow-indigo-600/20">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                Smart Store Ai
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Store Operations & Business ERP
              </p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
              Sign In to Store
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your store credentials to access billing, inventory, and analytics.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
              <AlertCircle size={18} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                  placeholder="admin or cashier username"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Credential Hint */}
          <div className="mt-8 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              Default Admin Login: <span className="font-bold text-indigo-600 dark:text-indigo-400">admin</span> / <span className="font-bold text-indigo-600 dark:text-indigo-400">admin123</span>
            </p>
          </div>
        </div>
      </div>

      {/* Right Pane: Graphic Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100 dark:bg-slate-950 items-center justify-center p-12 relative overflow-hidden transition-colors duration-300">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative max-w-md text-center z-10">
          <img 
            src="/assets/login_illustration.jpg" 
            alt="Store Management Illustration" 
            className="w-full max-w-sm mx-auto mb-8 rounded-2xl shadow-xl shadow-slate-900/5 border border-slate-200/50 dark:border-slate-800/50 object-cover aspect-square interactive-image"
          />
          <h3 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white font-title">
            Smart & Clean Store Operations
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm leading-relaxed max-w-sm mx-auto font-sans">
            Optimize your inventory, streamline cashier checkouts, and discover business growth insights using our ERP platform.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
