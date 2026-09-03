import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Monitor, KeyRound, AlertCircle, ShoppingBag, ArrowRight, Store, UserCheck, ShieldCheck } from 'lucide-react';
import BackgroundVideo from '../components/BackgroundVideo';

const CounterLogin = () => {
  const { isAuthenticated, loginCounterDirect } = useAuth();
  const navigate = useNavigate();

  const [shopCode, setShopCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/billing', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginCounterDirect(shopCode, username, password);
      navigate('/billing');
    } catch (err) {
      setError(err.message || 'Incorrect Shop Code, Counter Username, or Password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen relative text-white items-center justify-center p-4">
      <BackgroundVideo />
      <div className="relative z-10 flex flex-col justify-center w-full max-w-md mx-auto p-2">


        
        {/* Brand Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 text-white bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-600/30">
            <Monitor size={28} />
          </div>
          <div className="text-left">
            <h1 className="text-2xl font-extrabold tracking-tight text-white font-title">
              Smart POS Terminal
            </h1>
            <p className="text-xs text-emerald-400 font-semibold tracking-wider uppercase">
              Counter Cashier Checkout
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="p-8 rounded-3xl bg-slate-950/80 border border-slate-800 backdrop-blur-xl shadow-2xl">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold text-white font-title">
              Sign In to Counter
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your assigned shop code and cashier credentials to start billing.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 text-xs font-semibold rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                6-Character Shop Code / Owner Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  <Store size={16} />
                </span>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  required
                  placeholder="e.g. STK849 or admin"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-semibold text-sm uppercase tracking-wider"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Counter Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  <UserCheck size={16} />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="e.g. cashier1"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-semibold text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Counter Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-500">
                  <KeyRound size={16} />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-semibold text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 transition-all cursor-pointer text-sm shadow-lg shadow-emerald-600/20"
            >
              {loading ? 'Authenticating POS...' : 'Open Counter POS'}
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Footer Link to Owner Portal */}
          <div className="mt-8 pt-4 border-t border-slate-800 text-center">
            <p className="text-xs text-slate-400">
              Are you a Store Owner?{' '}
              <Link to="/login" className="font-bold text-indigo-400 hover:underline flex items-center justify-center gap-1 mt-1 inline-flex">
                <ShieldCheck size={14} />
                Store Owner Portal (Clerk Gmail SSO)
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CounterLogin;
