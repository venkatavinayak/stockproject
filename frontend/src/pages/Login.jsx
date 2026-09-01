import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { 
  KeyRound, User, AlertCircle, ShoppingBag, ArrowRight, Store, 
  ShieldCheck, LogOut, Lock, UserCheck, Smartphone, Sparkles
} from 'lucide-react';
import { useUser, useClerk, SignIn } from '@clerk/clerk-react';

const Login = () => {
  const { 
    isAuthenticated, 
    login, 
    loginCounterPin, 
    registerShop, 
    logout,
    kioskShopId, 
    isAuthenticatingBackend 
  } = useAuth();
  
  const navigate = useNavigate();

  // Clerk hook integration with fallbacks
  let clerkUser = null;
  let isClerkLoaded = true;
  let clerkSignOut = null;

  try {
    const userHook = useUser();
    clerkUser = userHook.user;
    isClerkLoaded = userHook.isLoaded;
    const clerkObj = useClerk();
    clerkSignOut = clerkObj.signOut;
  } catch (e) {
    // Clerk optional fallback
  }

  // Active view tab state
  const [authMode, setAuthMode] = useState('clerk'); // 'clerk', 'onboarding', 'shop_hub'
  const [portalTab, setPortalTab] = useState('owner'); // 'owner', 'counter', 'pin'

  // Shop status check state
  const [shopExists, setShopExists] = useState(null);
  const [shopInfo, setShopInfo] = useState({ name: '', owner_username: '' });
  const [checkingShop, setCheckingShop] = useState(false);

  // Form inputs
  const [ownerUsername, setOwnerUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  
  // Onboarding inputs
  const [shopName, setShopName] = useState('');
  const [newOwnerUsername, setNewOwnerUsername] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [newCounterPin, setNewCounterPin] = useState('');

  // Counter worker inputs
  const [counterUsername, setCounterUsername] = useState('');
  const [counterPassword, setCounterPassword] = useState('');
  const [pin, setPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-redirect if ERP session authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Check shop status when Clerk user is loaded
  useEffect(() => {
    const checkUserShop = async () => {
      if (clerkUser) {
        setCheckingShop(true);
        setError('');
        const userEmail = clerkUser.primaryEmailAddress?.emailAddress || '';
        const clerkId = clerkUser.id;
        
        try {
          const res = await authAPI.checkShop(userEmail, clerkId);
          if (res.exists) {
            setShopExists(true);
            setShopInfo({ name: res.shop_name, owner_username: res.owner_username });
            setAuthMode('shop_hub');
            setOwnerUsername(res.owner_username || 'admin');
          } else {
            setShopExists(false);
            setAuthMode('onboarding');
            setNewOwnerUsername(userEmail.split('@')[0] || 'admin');
          }
        } catch (err) {
          console.error("Shop check error:", err);
          setAuthMode('shop_hub');
        } finally {
          setCheckingShop(false);
        }
      } else {
        setAuthMode('clerk');
      }
    };

    if (isClerkLoaded) {
      checkUserShop();
    }
  }, [clerkUser, isClerkLoaded]);

  // Owner Form Submit
  const handleOwnerSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(ownerUsername, password);
      if (success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Invalid owner username or password');
    } finally {
      setLoading(false);
    }
  };

  // Counter Worker Submit
  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const targetUser = shopInfo.owner_username 
        ? `${shopInfo.owner_username}:${counterUsername}` 
        : counterUsername;
      const success = await login(targetUser, counterPassword);
      if (success) {
        navigate('/billing');
      }
    } catch (err) {
      setError(err.message || 'Invalid counter worker username or password');
    } finally {
      setLoading(false);
    }
  };

  // 4-Digit PIN Submit
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const targetShop = shopInfo.owner_username || kioskShopId || ownerUsername;
    try {
      const success = await loginCounterPin(targetShop, pin);
      if (success) {
        navigate('/billing');
      }
    } catch (err) {
      setError(err.message || 'Invalid 4-digit PIN for this shop');
    } finally {
      setLoading(false);
    }
  };

  // Onboarding Create Shop Submit
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || '';
      const clerkToken = null;
      
      const success = await registerShop(
        shopName,
        newOwnerUsername,
        newOwnerPassword,
        clerkToken,
        userEmail,
        newCounterPin
      );

      if (success) {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Failed to create shop account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300 relative">
      {/* Backend Loading Shield Overlay */}
      {(isAuthenticatingBackend || checkingShop) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md text-white animate-fade-in">
          <div className="w-14 h-14 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <h3 className="text-xl font-bold font-title">Connecting Store ERP...</h3>
          <p className="text-sm text-slate-400 mt-1">Verifying session credentials and shop permissions</p>
        </div>
      )}

      {/* Left Pane: Auth Form */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 p-8 md:p-12 lg:p-16 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="w-full max-w-md mx-auto animate-fade-in">
          
          {/* Logo Brand */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-3 text-white bg-indigo-600 rounded-2xl shadow-md shadow-indigo-600/20">
                <ShoppingBag size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  Smart Store Ai
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Retail ERP & Multi-Tenant POS Platform
                </p>
              </div>
            </div>

            {/* Kiosk Status Badge */}
            {kioskShopId && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Smartphone size={12} /> POS Kiosk Active
              </span>
            )}
          </div>

          {/* Error Alert */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 animate-shake">
              <AlertCircle size={18} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Active Clerk Gmail Banner (if logged in via Clerk) */}
          {clerkUser && (
            <div className="flex items-center justify-between p-3.5 mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70">
              <div className="flex items-center gap-3 overflow-hidden">
                <img 
                  src={clerkUser.imageUrl || 'https://via.placeholder.com/40'} 
                  alt="Clerk Avatar"
                  className="w-9 h-9 rounded-full object-cover border border-indigo-500/30 shrink-0" 
                />
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {clerkUser.fullName || clerkUser.primaryEmailAddress?.emailAddress}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {clerkUser.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => clerkSignOut ? clerkSignOut() : logout()}
                className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700/50"
                title="Sign out of Gmail / Clerk"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}

          {/* ================= STAGE 1: CLERK GMAIL AUTH ================= */}
          {!clerkUser && authMode === 'clerk' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  Sign In with Gmail
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Authenticate your identity using Clerk Google SSO to access your store ERP.
                </p>
              </div>

              {/* Clerk Sign In Widget */}
              <div className="flex justify-center p-2 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <SignIn 
                  routing="virtual"
                  afterSignInUrl="/login"
                  appearance={{
                    elements: {
                      card: "shadow-none bg-transparent border-none p-0 w-full",
                      headerTitle: "hidden",
                      headerSubtitle: "hidden"
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ================= STAGE 2A: NEW GMAIL ACCOUNT SHOP ONBOARDING ================= */}
          {authMode === 'onboarding' && (
            <div className="space-y-6 animate-fade-in">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 flex items-start gap-3">
                <Sparkles size={20} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold">New Account Setup</h4>
                  <p className="text-xs mt-0.5 text-indigo-600/80 dark:text-indigo-300/80">
                    No shop is associated with <strong>{clerkUser?.primaryEmailAddress?.emailAddress}</strong>. Create your store now to get started!
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  Create Your Shop
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter your store details and administrative credentials.
                </p>
              </div>

              <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Shop Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Store size={16} />
                    </span>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      placeholder="e.g. Grand Supermarket"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Owner Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      value={newOwnerUsername}
                      onChange={(e) => setNewOwnerUsername(e.target.value)}
                      required
                      placeholder="e.g. admin or vinayak"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Owner Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={newOwnerPassword}
                      onChange={(e) => setNewOwnerPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Default Counter 4-Digit PIN (Optional)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Lock size={16} />
                    </span>
                    <input
                      type="password"
                      maxLength={4}
                      value={newCounterPin}
                      onChange={(e) => setNewCounterPin(e.target.value)}
                      placeholder="e.g. 1234"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 outline-none tracking-widest"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                >
                  {loading ? 'Creating Shop...' : 'Create Shop & Open ERP'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}

          {/* ================= STAGE 2B: EXISTING SHOP LOGIN PORTAL ================= */}
          {authMode === 'shop_hub' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  {shopInfo.name ? shopInfo.name : 'Store Access Portal'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Select your role to sign into the store system.
                </p>
              </div>

              {/* Portal Selector Tabs */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setPortalTab('owner')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    portalTab === 'owner' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck size={14} /> Owner
                </button>
                <button
                  type="button"
                  onClick={() => setPortalTab('counter')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    portalTab === 'counter' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <UserCheck size={14} /> Counter
                </button>
                <button
                  type="button"
                  onClick={() => setPortalTab('pin')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    portalTab === 'pin' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Lock size={14} /> 4-Digit PIN
                </button>
              </div>

              {/* TAB 1: OWNER PORTAL LOGIN */}
              {portalTab === 'owner' && (
                <form onSubmit={handleOwnerSubmit} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Owner Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={ownerUsername}
                        onChange={(e) => setOwnerUsername(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Owner username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Owner Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <KeyRound size={16} />
                      </span>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                  >
                    {loading ? 'Authenticating...' : 'Sign In to Owner ERP'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {/* TAB 2: COUNTER WORKER LOGIN */}
              {portalTab === 'counter' && (
                <form onSubmit={handleCounterSubmit} className="space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Counter Worker Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={counterUsername}
                        onChange={(e) => setCounterUsername(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Cashier username (e.g. counter1)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <KeyRound size={16} />
                      </span>
                      <input
                        type="password"
                        value={counterPassword}
                        onChange={(e) => setCounterPassword(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                  >
                    {loading ? 'Authenticating...' : 'Sign In to Counter POS'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {/* TAB 3: 4-DIGIT POS PIN LOGIN */}
              {portalTab === 'pin' && (
                <form onSubmit={handlePinSubmit} className="space-y-4 animate-fade-in">
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-center">
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      POS Register ID: <span className="font-bold text-indigo-600 dark:text-indigo-400">{kioskShopId || shopInfo.owner_username || ownerUsername || 'Default Shop'}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 text-center">
                      Enter 4-Digit Shift PIN
                    </label>
                    <div className="relative max-w-xs mx-auto">
                      <input
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                        required
                        autoFocus
                        className="w-full py-3.5 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-white font-extrabold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                        placeholder="••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/15"
                  >
                    {loading ? 'Verifying PIN...' : 'Open POS Checkout'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          )}

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
            Smart & Multi-Tenant Retail Operations
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm leading-relaxed max-w-sm mx-auto font-sans">
            Real-world Clerk Google authentication, multi-tenant shop isolation, high-speed cashier checkout, and business intelligence.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
