import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
import { authAPI } from '../services/api';
import { 
  KeyRound, User, AlertCircle, ShoppingBag, ArrowRight, Store, 
  UserCheck, ShieldCheck, Monitor, LogOut, CheckCircle2, Sparkles
} from 'lucide-react';

const Login = () => {
  const { isAuthenticated, loginOwner, loginCounter, registerShop } = useAuth();
  const navigate = useNavigate();
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  // Shop state & stage controls
  const [shopStatus, setShopStatus] = useState(null); // { exists: boolean, shop_name?: string, owner_username?: string }
  const [checkingShop, setCheckingShop] = useState(false);
  const [authMode, setAuthMode] = useState('sign_in'); // 'sign_in' | 'sign_up'
  const [loginType, setLoginType] = useState('owner'); // 'owner' | 'counter'

  // Form states
  const [shopName, setShopName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [counterUsername, setCounterUsername] = useState('cashier1');
  const [counterPassword, setCounterPassword] = useState('');

  const [existingOwnerUsername, setExistingOwnerUsername] = useState('');
  const [existingOwnerPassword, setExistingOwnerPassword] = useState('');

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Direct to dashboard if already authenticated with ERP
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Sync Clerk User -> Check if Shop Exists
  useEffect(() => {
    const fetchShopInfo = async () => {
      if (isSignedIn && clerkUser) {
        const primaryEmail = clerkUser.primaryEmailAddress?.emailAddress;
        if (!primaryEmail) return;

        setCheckingShop(true);
        setError('');
        try {
          const res = await authAPI.checkShop(primaryEmail, clerkUser.id);
          setShopStatus(res);
          if (res.exists) {
            setExistingOwnerUsername(res.owner_username || 'admin');
          } else {
            // Suggest default owner username based on email prefix
            const emailPrefix = primaryEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
            setOwnerUsername(emailPrefix || 'admin');
            setShopName(`${clerkUser.firstName || 'My'} Store`);
          }
        } catch (err) {
          console.error('Failed to check shop status:', err);
          setError('Could not connect to backend store service.');
        } finally {
          setCheckingShop(false);
        }
      }
    };

    fetchShopInfo();
  }, [isSignedIn, clerkUser]);

  // Handler: Create New Shop
  const handleCreateShop = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
    if (!primaryEmail) {
      setError('Clerk Gmail address not found');
      setLoading(false);
      return;
    }

    try {
      await registerShop(shopName, ownerUsername, primaryEmail, ownerPassword, clerkUser?.id);
      setSuccessMsg('Shop created successfully! Directing to store dashboard...');
      setTimeout(() => {
        navigate('/');
      }, 800);
    } catch (err) {
      setError(err.message || 'Failed to create shop');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Owner Login
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
    try {
      await loginOwner(existingOwnerUsername, existingOwnerPassword, primaryEmail, clerkUser?.id);
      setSuccessMsg('Owner login successful!');
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err) {
      setError(err.message || 'Incorrect Owner Username or Password');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Counter Login
  const handleCounterLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const ownerName = shopStatus?.owner_username || existingOwnerUsername || 'admin';
    try {
      await loginCounter(ownerName, counterUsername, counterPassword);
      setSuccessMsg('Counter login successful!');
      setTimeout(() => {
        navigate('/');
      }, 500);
    } catch (err) {
      setError(err.message || 'Incorrect Counter Username or Password');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Clerk Sign Out
  const handleClerkSignOut = () => {
    signOut();
    setShopStatus(null);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Container */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 p-6 md:p-12 lg:p-14 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="w-full max-w-md mx-auto">
          {/* Header Brand */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20">
                <ShoppingBag size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
                  SmartStore AI
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Cloud Multi-Tenant Store ERP
                </p>
              </div>
            </div>

            {/* Clerk User Badge if Signed In */}
            {isSignedIn && clerkUser && (
              <button
                onClick={handleClerkSignOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
                title="Sign Out Gmail Account"
              >
                <LogOut size={14} />
                Sign Out Gmail
              </button>
            )}
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 animate-shake">
              <AlertCircle size={18} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-3 p-4 mb-6 text-sm rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={18} className="shrink-0" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* STAGE 1: NOT SIGNED IN WITH CLERK */}
          {!isSignedIn && (
            <div className="animate-fade-in space-y-5">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Step 1: Sign in with Gmail
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Authenticate using your Google/Gmail account to access your store or create a new one.
                </p>
              </div>

              {/* Clerk Sign In / Sign Up Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex justify-center">
                {authMode === 'sign_in' ? (
                  <SignIn 
                    routing="virtual"
                    afterSignInUrl="/login"
                    appearance={{
                      elements: {
                        card: "shadow-none bg-transparent w-full",
                        headerTitle: "text-slate-900 dark:text-white font-bold",
                        headerSubtitle: "text-slate-500 dark:text-slate-400",
                        socialButtonsBlockButton: "rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
                        formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 rounded-xl",
                        footerActionLink: "text-indigo-600 dark:text-indigo-400 font-bold"
                      }
                    }}
                  />
                ) : (
                  <SignUp 
                    routing="virtual"
                    afterSignUpUrl="/login"
                    appearance={{
                      elements: {
                        card: "shadow-none bg-transparent w-full",
                        headerTitle: "text-slate-900 dark:text-white font-bold",
                        headerSubtitle: "text-slate-500 dark:text-slate-400",
                        socialButtonsBlockButton: "rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800",
                        formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500 rounded-xl",
                        footerActionLink: "text-indigo-600 dark:text-indigo-400 font-bold"
                      }
                    }}
                  />
                )}
              </div>

              <div className="flex justify-center text-xs text-slate-500">
                {authMode === 'sign_in' ? (
                  <p>
                    Don't have a Gmail account ready?{' '}
                    <button 
                      onClick={() => setAuthMode('sign_up')} 
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Sign Up with Clerk
                    </button>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <button 
                      onClick={() => setAuthMode('sign_in')} 
                      className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>

              {/* Direct POS Cashier Login Prompt */}
              <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Are you a Cashier or Counter Staff?
                </p>
                <Link
                  to="/pos"
                  className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-600/20"
                >
                  <Monitor size={14} />
                  Open Counter POS Login (/pos)
                </Link>
              </div>
            </div>
          )}

          {/* CHECKING SHOP STATUS */}
          {isSignedIn && checkingShop && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Checking store account for {clerkUser?.primaryEmailAddress?.emailAddress}...
              </p>
            </div>
          )}

          {/* STAGE 2A: NEW GMAIL ACCOUNT -> CREATE SHOP */}
          {isSignedIn && !checkingShop && shopStatus && !shopStatus.exists && (
            <div className="animate-fade-in space-y-5">
              <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-3">
                <div className="p-2.5 text-white bg-indigo-600 rounded-xl">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    Welcome, {clerkUser.firstName || clerkUser.primaryEmailAddress?.emailAddress}!
                  </h3>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    No store registered for <span className="font-semibold">{clerkUser.primaryEmailAddress?.emailAddress}</span> yet. Let's create your shop!
                  </p>
                </div>
              </div>

              <div className="mb-2">
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-title">
                  Create Your Store
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Set up your store name, owner username, and password.
                </p>
              </div>

              <form onSubmit={handleCreateShop} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Shop Name
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Store size={16} />
                    </span>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      required
                      placeholder="e.g. Grand Supermarket"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Owner Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <UserCheck size={16} />
                    </span>
                    <input
                      type="text"
                      value={ownerUsername}
                      onChange={(e) => setOwnerUsername(e.target.value)}
                      required
                      placeholder="e.g. admin or owner1"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Owner Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                >
                  {loading ? 'Creating Shop...' : 'Create & Enter Store'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          )}

          {/* STAGE 2B: EXISTING SHOP ACCOUNT -> OWNER OR COUNTER LOGIN */}
          {isSignedIn && !checkingShop && shopStatus && shopStatus.exists && (
            <div className="animate-fade-in space-y-5">
              {/* Store Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 text-white bg-emerald-600 rounded-xl">
                    <Store size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      {shopStatus.shop_name}
                    </h3>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                      Owner Email: <span className="font-semibold">{clerkUser?.primaryEmailAddress?.emailAddress}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Login Portal Toggle */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setLoginType('owner'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    loginType === 'owner' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck size={16} />
                  Owner Login
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginType('counter'); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    loginType === 'counter' 
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Monitor size={16} />
                  Counter Login
                </button>
              </div>

              {/* OWNER LOGIN FORM */}
              {loginType === 'owner' ? (
                <form onSubmit={handleOwnerLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Owner Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <User size={16} />
                      </span>
                      <input
                        type="text"
                        value={existingOwnerUsername}
                        onChange={(e) => setExistingOwnerUsername(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                        placeholder="Owner username"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Owner Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <KeyRound size={16} />
                      </span>
                      <input
                        type="password"
                        value={existingOwnerPassword}
                        onChange={(e) => setExistingOwnerPassword(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                  >
                    {loading ? 'Authenticating Owner...' : 'Sign In as Store Owner'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              ) : (
                /* COUNTER LOGIN FORM */
                <form onSubmit={handleCounterLogin} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Counter / Cashier Username
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <Monitor size={16} />
                      </span>
                      <input
                        type="text"
                        value={counterUsername}
                        onChange={(e) => setCounterUsername(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                        placeholder="e.g. cashier1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Counter Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                        <KeyRound size={16} />
                      </span>
                      <input
                        type="password"
                        value={counterPassword}
                        onChange={(e) => setCounterPassword(e.target.value)}
                        required
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 transition-all cursor-pointer text-sm shadow-lg shadow-emerald-600/20"
                  >
                    {loading ? 'Authenticating Counter...' : 'Sign In as Counter Cashier'}
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Container: Visual Art & Information */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-100 dark:bg-slate-950 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative max-w-md text-center z-10">
          <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-indigo-600/30">
            <ShoppingBag size={48} />
          </div>
          
          <h3 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white font-title">
            Smart & Multi-Tenant Store ERP
          </h3>
          
          <p className="text-slate-600 dark:text-slate-400 mt-4 text-sm leading-relaxed max-w-sm mx-auto">
            Powered by real-world Clerk authentication. Manage multiple store branches, assign counter worker accounts, and oversee billing & stock analytics seamlessly.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400 mb-2" size={20} />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Owner Portal</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Full control over inventory, expenses, analytics & staff.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
              <Monitor className="text-emerald-600 dark:text-emerald-400 mb-2" size={20} />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Counter Billing</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Fast checkout billing & POS transactions for cashiers.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
