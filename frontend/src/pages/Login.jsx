import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useClerk, SignIn, SignUp } from '@clerk/clerk-react';
import { authAPI } from '../services/api';
import BackgroundVideo from '../components/BackgroundVideo';
import { 
  KeyRound, User, AlertCircle, ShoppingBag, ArrowRight, Store, 
  UserCheck, ShieldCheck, Monitor, CheckCircle2, Sparkles, Copy, Check
} from 'lucide-react';

const Login = () => {
  const { 
    isAuthenticated, 
    loginOwner, 
    loginCounterDirect, 
    registerShop 
  } = useAuth();
  const navigate = useNavigate();
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  // Active portal tab switcher: 'owner' | 'counter'
  const [activeTab, setActiveTab] = useState('owner');
  const [authMode, setAuthMode] = useState('sign_in');

  // Shop state & stage controls
  const [shopStatus, setShopStatus] = useState(null);
  const [checkingShop, setCheckingShop] = useState(false);

  // Form states
  const [shopName, setShopName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [counterShopCode, setCounterShopCode] = useState('');
  const [counterUsername, setCounterUsername] = useState('');
  const [counterPassword, setCounterPassword] = useState('');

  const [existingOwnerUsername, setExistingOwnerUsername] = useState('');
  const [existingOwnerPassword, setExistingOwnerPassword] = useState('');

  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Direct to dashboard if already authenticated with ERP
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Sync Clerk User -> Check if Shop Exists for this Gmail
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
          if (res?.owner_username) {
            setExistingOwnerUsername(res.owner_username);
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

  // Copy 6-character Shop Code Helper
  const copyShopCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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

    if (!shopName.trim() || !ownerUsername.trim() || !ownerPassword) {
      setError('Please fill in all fields (Shop Name, Owner Username, Password)');
      setLoading(false);
      return;
    }

    try {
      await registerShop(shopName.trim(), ownerUsername.trim(), primaryEmail, ownerPassword, clerkUser?.id);
      setSuccessMsg('Shop created successfully! Redirecting to store dashboard...');
      setTimeout(() => navigate('/'), 800);
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

    if (!existingOwnerUsername.trim() || !existingOwnerPassword) {
      setError('Please enter your Owner Username and Password');
      setLoading(false);
      return;
    }

    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
    try {
      await loginOwner(existingOwnerUsername.trim(), existingOwnerPassword, primaryEmail, clerkUser?.id);
      setSuccessMsg('Owner login successful!');
      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      setError(err.message || 'Incorrect Owner Username or Password');
    } finally {
      setLoading(false);
    }
  };

  // Handler: Counter Staff Login
  const handleCounterLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const shopCodeToUse = counterShopCode.trim() || shopStatus?.shop_code || shopStatus?.owner_username || 'admin';
    if (!counterUsername.trim() || !counterPassword) {
      setError('Please enter Counter Username and Password');
      setLoading(false);
      return;
    }

    try {
      await loginCounterDirect(shopCodeToUse, counterUsername.trim(), counterPassword);
      setSuccessMsg('Counter cashier login successful!');
      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      setError(err.message || 'Incorrect Shop Code, Counter Username, or Password');
    } finally {
      setLoading(false);
    }
  };

  const handleClerkSignOut = () => {
    signOut();
    setShopStatus(null);
    setShopName('');
    setOwnerUsername('');
    setOwnerPassword('');
    setExistingOwnerUsername('');
    setExistingOwnerPassword('');
  };

  // Clerk Appearance seamlessly matching Web UI Light Theme
  const clerkAppearance = {
    layout: {
      socialButtonsVariant: 'blockButton',
      socialButtonsBlockButtonPlacement: 'left',
      logoPlacement: 'none',
      unsafe_disableDevelopmentModeWarnings: true
    },
    variables: {
      colorPrimary: '#4f46e5',
      colorText: '#0f172a',
      colorBackground: '#ffffff',
      colorInputBackground: '#f8fafc',
      colorInputText: '#0f172a',
      borderRadius: '0.75rem',
      fontFamily: '"Plus Jakarta Sans", sans-serif'
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "w-full max-w-md shadow-none bg-white rounded-2xl border-0 p-0 overflow-hidden",
      card: "shadow-none bg-white p-0 w-full",
      headerTitle: "text-lg font-extrabold text-slate-900 font-title text-center tracking-tight",
      headerSubtitle: "text-xs font-medium text-slate-500 text-center mt-1",
      socialButtonsBlockButton: "w-full rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 font-bold py-3 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-3 hover:border-indigo-400",
      socialButtonsBlockButtonText: "font-bold text-sm text-slate-800 font-sans whitespace-nowrap",
      dividerLine: "bg-slate-200",
      dividerText: "text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white px-3 font-title",
      formFieldLabel: "text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1 font-title",
      formFieldInput: "w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-semibold text-sm transition-all",
      formButtonPrimary: "w-full py-3.5 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 text-sm transition-all cursor-pointer border-0 font-title",
      footerActionLink: "font-extrabold text-indigo-600 hover:underline",
      footerActionText: "text-slate-600 font-medium text-xs",
      footer: "bg-white border-t border-slate-100 p-3 text-center rounded-b-2xl",
      identityPreviewText: "text-slate-700 font-semibold",
      identityPreviewEditButton: "text-indigo-600 font-bold"
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-center items-center p-4 sm:p-6 font-sans overflow-hidden">
      
      {/* VIBRANT LIGHT MOTION GRAPHICS BACKGROUND */}
      <BackgroundVideo />

      {/* Main Centered Box Container */}
      <div className="relative z-10 w-full max-w-md mx-auto space-y-4">

        {/* Brand Header Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-md shadow-indigo-600/5 transition-transform hover:scale-105">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
              <ShoppingBag size={20} />
            </div>
            <div className="text-left">
              <h1 className="text-base font-extrabold text-slate-900 font-title tracking-tight leading-none">
                SmartStore AI
              </h1>
              <p className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider mt-0.5 font-title">
                Cloud Multi-Tenant ERP
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Switcher Tabs */}
        <div className="p-1 bg-slate-200/80 backdrop-blur-md rounded-2xl border border-slate-300/80 grid grid-cols-2 gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold font-title transition-all cursor-pointer ${
              activeTab === 'owner'
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Store Owner Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold font-title transition-all cursor-pointer ${
              activeTab === 'counter'
                ? 'bg-white text-emerald-600 shadow-sm border border-slate-200/50'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Monitor size={16} />
            <span>Counter Cashier POS</span>
          </button>
        </div>

        {/* Feedback Banner Alerts */}
        {error && (
          <div className="flex items-center gap-2.5 p-3.5 text-xs rounded-xl bg-rose-500/10 backdrop-blur-md border border-rose-500/20 text-rose-600 font-semibold animate-shake shadow-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 p-3.5 text-xs rounded-xl bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 text-emerald-600 font-semibold shadow-sm">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* COMPACT MAIN LOGIN CARD */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl p-6 sm:p-7 overflow-hidden">

          {/* TAB 1: STORE OWNER PORTAL */}
          {activeTab === 'owner' && (
            <div className="space-y-4">

              {/* STAGE A: NOT SIGNED IN WITH CLERK */}
              {!isSignedIn && (
                <div className="w-full flex justify-center">
                  {authMode === 'sign_in' ? (
                    <SignIn 
                      routing="virtual"
                      afterSignInUrl="/login"
                      appearance={clerkAppearance}
                    />
                  ) : (
                    <SignUp 
                      routing="virtual"
                      afterSignUpUrl="/login"
                      appearance={clerkAppearance}
                    />
                  )}
                </div>
              )}

              {/* CHECKING SHOP RECORDS */}
              {isSignedIn && checkingShop && (
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-600">
                    Verifying store records for {clerkUser?.primaryEmailAddress?.emailAddress}...
                  </p>
                </div>
              )}

              {/* STAGE B: SIGNED IN WITH CLERK */}
              {isSignedIn && !checkingShop && (
                <div className="space-y-4">
                  
                  {/* Verified Gmail Banner */}
                  <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div className="p-1.5 text-white bg-indigo-600 rounded-xl shrink-0">
                        <User size={16} />
                      </div>
                      <div className="overflow-hidden">
                        <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                          GMAIL VERIFIED
                        </span>
                        <span className="text-xs font-bold text-indigo-950 truncate block">
                          {clerkUser?.primaryEmailAddress?.emailAddress}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClerkSignOut}
                      className="px-2.5 py-1 text-[10px] font-bold text-rose-600 bg-rose-100 hover:bg-rose-200 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Sign Out
                    </button>
                  </div>

                  {/* CASE 1: EXISTING STORE -> OWNER PASSWORD LOGIN */}
                  {shopStatus && shopStatus.exists && (
                    <div className="space-y-4">
                      
                      {/* Prominent Shop Code Badge */}
                      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 flex items-center gap-1">
                            <Store size={15} />
                            {shopStatus.shop_name}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 rounded-md uppercase">
                            Registered
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-500/30">
                          <div>
                            <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">
                              YOUR SHOP CODE
                            </span>
                            <span className="text-base font-extrabold text-indigo-600 font-mono tracking-widest">
                              {shopStatus.shop_code || shopStatus.owner_username}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyShopCode(shopStatus.shop_code || shopStatus.owner_username)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                          >
                            {copiedCode ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Owner Password Form */}
                      <form onSubmit={handleOwnerLogin} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                            Owner Username
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <User size={15} />
                            </span>
                            <input
                              type="text"
                              value={existingOwnerUsername}
                              onChange={(e) => setExistingOwnerUsername(e.target.value)}
                              required
                              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                              placeholder="Enter owner username"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                            Owner Password
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <KeyRound size={15} />
                            </span>
                            <input
                              type="password"
                              value={existingOwnerPassword}
                              onChange={(e) => setExistingOwnerPassword(e.target.value)}
                              required
                              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                              placeholder="Enter your password"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-xs shadow-md shadow-indigo-600/20"
                        >
                          {loading ? 'Authenticating...' : 'Sign In to Store Dashboard'}
                          <ArrowRight size={15} />
                        </button>
                      </form>
                    </div>
                  )}

                  {/* CASE 2: NEW STORE -> CREATE STORE FORM */}
                  {shopStatus && !shopStatus.exists && (
                    <div className="space-y-3.5">
                      <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center gap-2.5">
                        <Sparkles className="text-indigo-600 shrink-0" size={18} />
                        <div>
                          <h4 className="text-xs font-bold text-indigo-950">
                            Create Your New Store
                          </h4>
                          <p className="text-[10px] text-indigo-700">
                            Set up your store below to generate your 6-character Shop Code!
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleCreateShop} className="space-y-3.5">
                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                            Shop Name
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <Store size={15} />
                            </span>
                            <input
                              type="text"
                              value={shopName}
                              onChange={(e) => setShopName(e.target.value)}
                              required
                              placeholder="e.g. Grand Supermarket"
                              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                            Owner Username
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <UserCheck size={15} />
                            </span>
                            <input
                              type="text"
                              value={ownerUsername}
                              onChange={(e) => setOwnerUsername(e.target.value)}
                              required
                              placeholder="Choose owner username"
                              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                            Owner Password
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                              <KeyRound size={15} />
                            </span>
                            <input
                              type="password"
                              value={ownerPassword}
                              onChange={(e) => setOwnerPassword(e.target.value)}
                              required
                              placeholder="Choose a password"
                              className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none focus:border-indigo-500 font-semibold text-xs"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-xs shadow-md shadow-indigo-600/20"
                        >
                          {loading ? 'Creating Store...' : 'Create Store & Generate Code'}
                          <ArrowRight size={15} />
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COUNTER CASHIER POS PORTAL */}
          {activeTab === 'counter' && (
            <div className="space-y-4 sm:space-y-5">
              <div className="text-center pb-2.5 border-b border-slate-100">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase tracking-wider font-title border border-emerald-200/60">
                  Cashier POS Terminal
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 font-title mt-2">
                  Counter Staff Access
                </h2>
              </div>

              <form onSubmit={handleCounterLoginSubmit} className="space-y-3.5 pt-1">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                    6-Character Shop Code
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Store size={16} />
                    </span>
                    <input
                      type="text"
                      value={counterShopCode}
                      onChange={(e) => setCounterShopCode(e.target.value.toUpperCase())}
                      placeholder={shopStatus?.shop_code || "e.g. SHOP01"}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-emerald-600 font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                    Counter Staff Username
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
                      placeholder="e.g. counter1"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 font-title">
                    Counter Staff Password
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
                      placeholder="Enter counter password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 font-semibold text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 transition-all cursor-pointer text-xs shadow-md shadow-emerald-600/20"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Counter POS'}
                  <ArrowRight size={16} />
                </button>
              </form>

              <div className="text-center pt-2">
                <Link
                  to="/pos"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:underline"
                >
                  <span>Go to Standalone POS Page (/pos)</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Login;
