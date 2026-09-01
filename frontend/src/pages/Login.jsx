import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { KeyRound, User, AlertCircle, ShoppingBag, Store, Mail, Lock, CheckCircle2, ArrowRight, LogOut, Loader2 } from 'lucide-react';
import { authAPI } from '../services/api';
import { useSignIn, useSignUp, useUser, useClerk } from '@clerk/clerk-react';

const Login = () => {
  const { login, setToken, setUser } = useAuth();
  const navigate = useNavigate();
  
  // Detect if Clerk keys are configured locally
  const clerkEnabled = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && import.meta.env.VITE_CLERK_PUBLISHABLE_KEY !== 'your_clerk_publishable_key_here';
  
  let signInHook = null;
  let signUpHook = null;
  let userHook = null;
  let clerkInstance = null;
  
  try {
    if (clerkEnabled) {
      signInHook = useSignIn();
      signUpHook = useSignUp();
      userHook = useUser();
      clerkInstance = useClerk();
    }
  } catch (e) {
    console.warn("Clerk hooks failed to load. Make sure ClerkProvider wraps the App component.", e);
  }

  const { user, isSignedIn } = userHook || { user: null, isSignedIn: false };

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [portal, setPortal] = useState('owner'); // 'owner' or 'counter'
  
  // Step 2 flow states
  const [shopExists, setShopExists] = useState(null); // null, true, false
  const [detectedShopName, setDetectedShopName] = useState('');
  const [checkingShop, setCheckingShop] = useState(false);

  // Registration fields (Step 2 New Shop)
  const [shopName, setShopName] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  // Local/Counter fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check shop status whenever Clerk user signs in
  useEffect(() => {
    const runCheck = async () => {
      if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
        setCheckingShop(true);
        setError('');
        try {
          const email = user.primaryEmailAddress.emailAddress;
          const res = await authAPI.checkShop(email);
          if (res.exists) {
            setShopExists(true);
            setDetectedShopName(res.shop_name);
            setMode('login');
          } else {
            setShopExists(false);
            setMode('register');
          }
        } catch (err) {
          console.error("Failed to check shop", err);
          setError("Connection to local server failed. Working in fallback mode.");
        } finally {
          setCheckingShop(false);
        }
      } else {
        setShopExists(null);
        setDetectedShopName('');
      }
    };
    runCheck();
  }, [isSignedIn, user]);

  const handleGoogleLogin = async () => {
    if (!clerkEnabled || !signInHook?.isLoaded) return;
    setError('');
    setLoading(true);
    try {
      await signInHook.signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: window.location.origin + "/login",
        redirectUrlComplete: window.location.origin + "/login"
      });
    } catch (err) {
      setError(err.errors?.[0]?.message || err.message || 'Google Auth redirection failed');
      setLoading(false);
    }
  };

  const handleSignOutClerk = async () => {
    if (clerkInstance) {
      setLoading(true);
      await clerkInstance.signOut();
      setShopExists(null);
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterSuccess('');
    setLoading(true);
    
    if (isSignedIn && user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      if (mode === 'register') {
        // Step 2: Register shop for authenticated Clerk user
        try {
          const localAuth = await authAPI.clerkLogin(email, user.id, shopName, 'admin', createPassword); 
          localStorage.setItem('smartstock_token', localAuth.access_token);
          localStorage.setItem('smartstock_user', JSON.stringify({ username: email, role: 'admin' }));
          setToken(localAuth.access_token);
          setUser({ username: email, role: 'admin' });
          navigate('/');
        } catch (err) {
          setError(err.response?.data?.detail || err.message || 'Failed to setup shop');
        } finally {
          setLoading(false);
        }
      } else {
        // Step 2: Login for existing shop
        if (portal === 'owner') {
          // Owner login requiring store owner password authentication
          try {
            const localAuth = await authAPI.clerkLogin(email, user.id, null, 'admin', password);
            localStorage.setItem('smartstock_token', localAuth.access_token);
            localStorage.setItem('smartstock_user', JSON.stringify({ username: email, role: 'admin' }));
            setToken(localAuth.access_token);
            setUser({ username: email, role: 'admin' });
            navigate('/');
          } catch (err) {
            setError(err.response?.data?.detail || err.message || 'Launch failed');
          } finally {
            setLoading(false);
          }
        } else {
          // Counter login with manual credentials
          try {
            const success = await login(`${email}:${username}`, password);
            if (success) navigate('/');
          } catch (err) {
            setError(err.message || 'Invalid cashier username or password');
          } finally {
            setLoading(false);
          }
        }
      }
    } else {
      // Fallback local sign in when Clerk is not configured or offline
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
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-955 transition-colors duration-300">
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

          {/* Loader when checking database */}
          {checkingShop ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs font-semibold">Verifying email with database...</span>
            </div>
          ) : isSignedIn ? (
            /* STEP 2: Authenticated View - Existing or New Shop */
            <div className="animate-fade-in">
              {/* Authenticated User Badge */}
              <div className="flex items-center justify-between bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-150/10 p-3.5 rounded-2xl mb-6">
                <div className="flex items-center gap-2.5">
                  {user.imageUrl ? (
                    <img src={user.imageUrl} className="w-8 h-8 rounded-full shadow-sm" alt="Profile" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-indigo-600 uppercase text-sm">
                      {user.primaryEmailAddress?.emailAddress.charAt(0)}
                    </div>
                  )}
                  <div className="text-left">
                    <span className="block text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email Verified</span>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-44">{user.primaryEmailAddress?.emailAddress}</span>
                  </div>
                </div>
                <button
                  onClick={handleSignOutClerk}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all active:scale-95"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {shopExists ? (
                /* EXISTING SHOP LOGON (FLOW DIAGRAM BRANCH) */
                <div className="space-y-6">
                  {/* Shop Details Header */}
                  <div className="mb-6">
                    <span className="inline-block text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md mb-2">Connected Shop</span>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                      {detectedShopName}
                    </h2>
                  </div>

                  {/* Portal Selection Tabs */}
                  <div className="grid grid-cols-2 gap-3 mb-6 bg-slate-50 dark:bg-slate-950 p-1.5 rounded-2xl border dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setPortal('owner')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${portal === 'owner' ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                    >
                      Owner Portal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortal('counter')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all ${portal === 'counter' ? 'bg-white text-indigo-600 dark:bg-slate-900 dark:text-indigo-400 shadow-sm' : 'text-slate-500'}`}
                    >
                      Counter Cashier
                    </button>
                  </div>

                  {portal === 'owner' ? (
                    /* Owner Password Authentication Form */
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Store Owner Password
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
                            <Lock size={16} />
                          </span>
                          <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                            placeholder="Enter your owner password"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                      >
                        {loading ? 'Launching Dashboard...' : 'Launch Owner Dashboard'}
                        <ArrowRight size={16} />
                      </button>
                    </form>
                  ) : (
                    /* Counter Cashier Credentials Form */
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Counter Username
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
                            placeholder="e.g. counter1"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Cashier Password
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
                            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-955/50 dark:text-white placeholder-slate-450 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                      >
                        {loading ? 'Authenticating...' : 'Log In to Terminal'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* NEW SHOP REGISTRATION (FLOW DIAGRAM BRANCH) */
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="mb-4">
                    <span className="inline-block text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-md mb-2">New Business</span>
                    <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                      Setup Your Shop
                    </h2>
                  </div>

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
                        placeholder="Shop Name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Create Admin Password
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
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-955/50 dark:text-white placeholder-slate-450 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                  >
                    {loading ? 'Setting up Shop...' : 'Create & Launch Shop'}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* STEP 1: Initial Clerk Google Email Authentication */
            <div className="animate-fade-in">
              <div className="mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  Welcome to Smart Store Ai
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  Sign in with your verified Google email account to access existing shops or build a new store dashboard.
                </p>
              </div>

              {/* Error Alert */}
              {error && (
                <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                  <AlertCircle size={18} className="shrink-0" />
                  <span className="font-medium">{error}</span>
                </div>
              )}

              {/* Premium Clerk Google OAuth Button */}
              {clerkEnabled ? (
                <div className="space-y-6">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold border border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 transition-all cursor-pointer text-sm active:scale-[0.99]"
                  >
                    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#EA4335"
                        d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.62 14.97 1 12 1 7.35 1 3.37 3.65 1.42 7.55l3.86 3C6.2 7.78 8.87 5.04 12 5.04z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.48-1.12 2.74-2.38 3.58l3.7 2.87c2.16-2 3.71-4.94 3.71-8.6z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.55c-.24-.72-.38-1.5-.38-2.3s.14-1.58.38-2.3l-3.86-3C.56 8.52 0 10.19 0 12s.56 3.48 1.42 5.05l3.86-3z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.7-2.87c-1.1.74-2.51 1.18-4.26 1.18-3.13 0-5.8-2.74-6.72-6.51l-3.86 3C3.37 20.35 7.35 23 12 23z"
                      />
                    </svg>
                    <span>{loading ? 'Connecting Google Account...' : 'Continue with Google'}</span>
                  </button>
                </div>
              ) : (
                /* Local Credentials Fallback Form (Only shown if Clerk key is not configured locally) */
                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">
                      Offline Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-450">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all font-sans text-sm font-semibold"
                        placeholder="e.g. admin or counter username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-450 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-450">
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
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-850 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all cursor-pointer text-sm"
                  >
                    {loading ? 'Authenticating...' : 'Sign In Offline'}
                  </button>
                </form>
              )}
            </div>
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
