import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, AlertCircle, ShoppingBag, Store, Mail, Lock, CheckCircle2 } from 'lucide-react';
import { authAPI } from '../services/api';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [portal, setPortal] = useState('owner'); // 'owner' or 'counter'
  
  // Registration fields
  const [shopName, setShopName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  // Login fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterSuccess('');
    setLoading(true);
    
    if (mode === 'register') {
      try {
        const response = await authAPI.registerShop(shopName, ownerEmail, createPassword);
        setRegisterSuccess(response.message || 'Shop registered successfully! You can now sign in.');
        setMode('login');
        setPortal('owner');
        setUsername(ownerEmail);
        setPassword('');
        // Clear registration fields
        setShopName('');
        setOwnerEmail('');
        setCreatePassword('');
      } catch (err) {
        setError(err.response?.data?.detail || err.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        const success = await login(username, password);
        if (success) {
          navigate('/');
        }
      } catch (err) {
        setError(err.message || 'Invalid username or password');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Pane: Auth Forms */}
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
                Store Owner Portal & Business ERP
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b dark:border-slate-800 gap-6 mb-6 text-sm">
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setRegisterSuccess('');
              }}
              className={`pb-3 font-extrabold border-b-2 transition-all duration-200 ${mode === 'login' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-450 hover:text-slate-200'}`}
            >
              Existing Shop Login
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
                setRegisterSuccess('');
              }}
              className={`pb-3 font-extrabold border-b-2 transition-all duration-200 ${mode === 'register' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-450 hover:text-slate-200'}`}
            >
              Create Shop
            </button>
          </div>

          {/* Portal Selector for Login */}
          {mode === 'login' && (
            <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl border dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setPortal('owner');
                  setUsername('');
                  setPassword('');
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${portal === 'owner' ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
              >
                Owner Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setPortal('counter');
                  setUsername('');
                  setPassword('');
                }}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${portal === 'counter' ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
              >
                Counter Login
              </button>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
              {mode === 'register' ? 'Create Your Shop' : portal === 'owner' ? 'Shop Owner Portal' : 'Counter Cashier Terminal'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {mode === 'register' 
                ? 'Register your business on Smart Store Ai to spin up your custom cloud dashboard.' 
                : portal === 'owner' 
                  ? 'Access administrative controls, financial P&L statements, and advanced sales analytics.' 
                  : 'Log in to the POS billing register counter to scan products and print tax invoices.'}
            </p>
          </div>

          {/* Success Alert */}
          {registerSuccess && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-fade-in">
              <CheckCircle2 size={18} className="shrink-0" />
              <span className="font-semibold">{registerSuccess}</span>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 animate-fade-in">
              <AlertCircle size={18} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Registration Form */}
          {mode === 'register' ? (
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Shop Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                    <Store size={16} />
                  </span>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                    placeholder="e.g. Vinayak Supermarket"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Owner Email / Google Mail
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                    placeholder="name@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Create Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-450 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all cursor-pointer text-sm"
              >
                {loading ? 'Registering Shop...' : 'Create Shop'}
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {portal === 'owner' ? 'Owner Email / Username' : 'Counter Username'}
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
                    placeholder={portal === 'owner' ? 'admin or email' : 'e.g. counter1'}
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
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-450 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all cursor-pointer text-sm"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Right Pane: Graphic Illustration */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100 dark:bg-slate-950 items-center justify-center p-12 relative overflow-hidden transition-colors duration-300">
        {/* Soft background glow decoration */}
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
