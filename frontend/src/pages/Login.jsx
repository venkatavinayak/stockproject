import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useClerk, useSignIn, SignIn, SignUp } from '@clerk/clerk-react';
import { authAPI } from '../services/api';
import { 
  KeyRound, User, AlertCircle, ShoppingBag, ArrowRight, Store, 
  UserCheck, ShieldCheck, Monitor, LogOut, CheckCircle2, Sparkles, Copy, Check, PlusCircle, LogIn, Lock, Send, X, Mail
} from 'lucide-react';

const Login = () => {
  const { isAuthenticated, loginOwner, loginCounter, registerShop, requestOTP, verifyOTP, resetPasswordOTP } = useAuth();
  const navigate = useNavigate();
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();

  // Shop state & stage controls
  const [shopStatus, setShopStatus] = useState(null); // { exists: boolean, shop_name?: string, owner_username?: string, shop_code?: string }
  const [checkingShop, setCheckingShop] = useState(false);
  const [authMode, setAuthMode] = useState('sign_in'); // 'sign_in' | 'sign_up'
  const [loginType, setLoginType] = useState('owner'); // 'owner' | 'counter'

  // Form states - Empty defaults
  const [shopName, setShopName] = useState('');
  const [ownerUsername, setOwnerUsername] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');

  const [counterUsername, setCounterUsername] = useState('');
  const [counterPassword, setCounterPassword] = useState('');

  const [existingOwnerUsername, setExistingOwnerUsername] = useState('');
  const [existingOwnerPassword, setExistingOwnerPassword] = useState('');

  // Forgot password OTP modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

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
          setForgotEmail(primaryEmail);
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

  // Handler: Create New Shop (1-Email 1-Shop Rule enforced)
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

    if (!existingOwnerUsername.trim() || !existingOwnerPassword) {
      setError('Please enter your Owner Username and Password');
      setLoading(false);
      return;
    }

    const primaryEmail = clerkUser?.primaryEmailAddress?.emailAddress;
    try {
      await loginOwner(existingOwnerUsername.trim(), existingOwnerPassword, primaryEmail, clerkUser?.id);
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

    const ownerName = shopStatus?.shop_code || shopStatus?.owner_username || existingOwnerUsername.trim() || 'admin';
    if (!counterUsername.trim() || !counterPassword) {
      setError('Please enter Counter Username and Password');
      setLoading(false);
      return;
    }

    try {
      await loginCounter(ownerName, counterUsername.trim(), counterPassword);
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

  // OTP Password Reset Handlers
  const handleRequestOTP = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    const target = forgotEmail.trim() || clerkUser?.primaryEmailAddress?.emailAddress || existingOwnerUsername.trim();
    if (!target) {
      setForgotError('Please enter your registered email address or owner username');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await requestOTP(target);
      setForgotSuccess(res.message || 'OTP code sent successfully!');
      if (res.email) setForgotEmail(res.email);
      setForgotStep(2);
    } catch (err) {
      setForgotError(err.message || 'Failed to send OTP code');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!otpCode || otpCode.length !== 6) {
      setForgotError('Please enter a valid 6-digit OTP code');
      return;
    }
    setForgotLoading(true);
    try {
      await verifyOTP(forgotEmail.trim(), otpCode.trim());
      setForgotSuccess('OTP code verified! Please set your new password.');
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message || 'Invalid or expired OTP code');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!newPassword || newPassword.length < 4) {
      setForgotError('Password must be at least 4 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await resetPasswordOTP(forgotEmail.trim(), otpCode.trim(), newPassword);
      setSuccessMsg(res.message || 'Password reset successfully! You can now log in.');
      setShowForgotModal(false);
      setForgotStep(1);
      setOtpCode('');
      setNewPassword('');
      setConfirmPassword('');
      if (shopStatus?.owner_username) {
        setExistingOwnerUsername(shopStatus.owner_username);
      }
      setExistingOwnerPassword(newPassword);
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
    }
  };



  // Handler: Clerk Sign Out
  const handleClerkSignOut = () => {
    signOut();
    setShopStatus(null);
    setShopName('');
    setOwnerUsername('');
    setOwnerPassword('');
    setExistingOwnerUsername('');
    setExistingOwnerPassword('');
  };

  // Modern Iris-Violet Clerk Appearance Configuration
  const clerkAppearance = {
    layout: {
      socialButtonsVariant: 'blockButton',
      socialButtonsBlockButtonPlacement: 'left',
      logoPlacement: 'none',
      unsafe_disableDevelopmentModeWarnings: true
    },
    variables: {
      colorPrimary: '#6d28d9',
      colorText: '#1c1917',
      colorBackground: '#ffffff',
      colorInputBackground: '#fafaf9',
      colorInputText: '#1c1917',
      colorDanger: '#ef4444',
      borderRadius: '0.875rem',
      fontFamily: '"Plus Jakarta Sans", sans-serif'
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "w-full max-w-md shadow-2xl rounded-3xl border border-indigo-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all overflow-hidden",
      card: "shadow-none bg-transparent p-6 sm:p-8 w-full",
      headerTitle: "text-2xl font-extrabold text-slate-900 dark:text-white font-title text-center tracking-tight",
      headerSubtitle: "text-xs font-medium text-slate-500 dark:text-slate-400 text-center mt-1",
      socialButtonsBlockButton: "rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold py-3 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-3 hover:border-indigo-400 dark:hover:border-indigo-600",
      socialButtonsBlockButtonText: "font-bold text-sm text-slate-800 dark:text-slate-200 font-sans",
      dividerLine: "bg-slate-200 dark:bg-slate-800",
      dividerText: "text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-900 px-3 font-title",
      formFieldLabel: "text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 font-title",
      formFieldInput: "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-semibold text-sm transition-all shadow-inner",
      formButtonPrimary: "w-full py-3.5 rounded-xl font-extrabold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/25 text-sm transition-all transform active:scale-95 cursor-pointer border-0 font-title",
      footerActionLink: "font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline",
      footer: "bg-slate-50/60 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 p-4 text-center rounded-b-3xl"
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Left Container */}
      <div className="flex flex-col justify-center w-full lg:w-1/2 p-6 md:p-12 lg:p-14 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className={`w-full ${!isSignedIn ? 'max-w-3xl' : 'max-w-md'} mx-auto transition-all`}>
          
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl transition-colors cursor-pointer"
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
            <div className="animate-fade-in space-y-6">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white font-title">
                  Store Access Portals
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose your login portal below to access store ERP management or counter cashier POS.
                </p>
              </div>

              {/* SIDE-BY-SIDE CARDS GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch w-full">
                
                {/* PORTAL 1: STORE OWNER SIGN IN (CLERK GMAIL SSO) */}
                <div className="flex flex-col justify-between p-6 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-xl shadow-indigo-600/5 transition-all hover:border-indigo-300">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider">
                        Store Owner
                      </span>
                    </div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-title">
                      Owner Gmail Sign In
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Sign in with Google/Gmail to access store setup, inventory & analytics.
                    </p>
                  </div>

                  <div className="my-4 flex justify-center">
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
                </div>

                {/* PORTAL 2: CASHIER & COUNTER POS LOGIN (/pos) */}
                <div className="flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl transition-all hover:border-indigo-300">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider border border-emerald-200 dark:border-emerald-800">
                        Counter Cashier
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-800/60 shrink-0">
                        <Monitor size={26} />
                      </div>
                      <div>
                        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white font-title">
                          Counter POS Terminal
                        </h3>
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Dedicated Billing Portal
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed pt-1">
                      Are you a Cashier or Counter Staff? Log into your assigned billing terminal directly using your store's 6-character Shop Code.
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <Link
                      to="/pos"
                      className="w-full inline-flex items-center justify-center gap-2.5 py-3.5 px-5 rounded-xl font-extrabold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-600/20 text-sm transition-all transform active:scale-95 cursor-pointer"
                    >
                      <Monitor size={18} />
                      <span>Open Counter POS Login (/pos)</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CHECKING SHOP STATUS */}
          {isSignedIn && checkingShop && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Verifying store records for {clerkUser?.primaryEmailAddress?.emailAddress}...
              </p>
            </div>
          )}

          {/* STAGE 2: SIGNED IN WITH CLERK */}
          {isSignedIn && !checkingShop && (
            <div className="animate-fade-in space-y-6">

              {/* Verified Gmail Account Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 text-white bg-indigo-600 rounded-xl">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                      Gmail Verified
                    </h3>
                    <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {clerkUser?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 rounded-full">
                  Authenticated
                </span>
              </div>

              {/* CASE A: EXISTING STORE -> SHOW 6-CHARACTER SHOP CODE BADGE & OWNER LOGIN */}
              {shopStatus && shopStatus.exists && (
                <div className="space-y-5">
                  {/* PROMINENT 6-CHARACTER ALPHANUMERIC SHOP CODE BADGE */}
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Store className="text-emerald-600 dark:text-emerald-400" size={18} />
                        <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                          {shopStatus.shop_name}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-sm">
                      <div>
                        <span className="block text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                          YOUR SHOP CODE (SHARE WITH CASHIERS)
                        </span>
                        <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest">
                          {shopStatus.shop_code || shopStatus.owner_username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyShopCode(shopStatus.shop_code || shopStatus.owner_username)}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                        title="Copy Shop Code"
                      >
                        {copiedCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                        {copiedCode ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                  </div>

                  {/* Notice: 1-Email 1-Shop Restriction */}
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Store already registered for this Gmail address. Enter owner credentials below to access dashboard.
                  </div>

                  {/* OWNER LOGIN FORM */}
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
                          placeholder="Enter your owner username"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Owner Password
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setShowForgotModal(true);
                            setForgotStep(1);
                            setForgotError('');
                            setForgotSuccess('');
                            if (clerkUser?.primaryEmailAddress?.emailAddress) {
                              setForgotEmail(clerkUser.primaryEmailAddress.emailAddress);
                            }
                          }}
                          className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Forgot Password?
                        </button>
                      </div>
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
                          placeholder="Enter your password"
                        />
                      </div>
                    </div>


                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                    >
                      {loading ? 'Authenticating...' : 'Sign In as Store Owner'}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
              )}

              {/* CASE B: NEW STORE -> SHOW CREATE STORE FORM */}
              {shopStatus && !shopStatus.exists && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-3">
                    <Sparkles className="text-indigo-600 dark:text-indigo-400 shrink-0" size={20} />
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                        Create Your Store
                      </h4>
                      <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                        No shop registered for <span className="font-semibold">{clerkUser?.primaryEmailAddress?.emailAddress}</span> yet. Set up your store below!
                      </p>
                    </div>
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
                          placeholder="Enter your store name (e.g. Grand Supermarket)"
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
                          placeholder="Enter your owner username"
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
                          placeholder="Choose a strong password"
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                    >
                      {loading ? 'Generating Shop Code & Creating...' : 'Create Store & Generate Code'}
                      <ArrowRight size={16} />
                    </button>
                  </form>
                </div>
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
            Powered by real-world Clerk authentication. Generate 6-character shop codes, assign counter worker accounts, and oversee billing & stock analytics seamlessly.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
              <ShieldCheck className="text-indigo-600 dark:text-indigo-400 mb-2" size={20} />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Owner Portal</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Full control over inventory, expenses, analytics & staff.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
              <Monitor className="text-emerald-600 dark:text-emerald-400 mb-2" size={20} />
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Counter POS (/pos)</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Fast cashier billing using 6-character shop code.</p>
            </div>
          </div>
        </div>
      </div>

      {/* FORGOT PASSWORD OTP MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 md:p-8 relative">
            <button
              onClick={() => {
                setShowForgotModal(false);
                setForgotStep(1);
                setForgotError('');
                setForgotSuccess('');
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-xl cursor-pointer"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                <Lock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white font-title">
                  Reset Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {forgotStep === 1 && "Enter registered email or username to receive OTP"}
                  {forgotStep === 2 && `Enter 6-digit OTP code sent to ${forgotEmail}`}
                  {forgotStep === 3 && "Set your new store owner password"}
                </p>
              </div>
            </div>

            {/* Feedback alerts */}
            {forgotError && (
              <div className="flex items-center gap-2.5 p-3.5 mb-4 text-xs rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold">
                <AlertCircle size={16} className="shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="flex items-center gap-2.5 p-3.5 mb-4 text-xs rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            {/* STEP 1: REQUEST OTP */}
            {forgotStep === 1 && (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-title">
                    Registered Email or Username
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <Mail size={16} />
                    </span>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="e.g. owner@example.com or admin"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Send Security OTP Email</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: VERIFY OTP */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-title">
                    6-Digit OTP Code
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      required
                      placeholder="123456"
                      className="w-full text-center tracking-[10px] font-mono text-2xl font-bold py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-indigo-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 text-center font-medium">
                    Please check your spam or inbox folder. OTP is valid for 10 minutes.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Verify OTP Code</span>
                    </>
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    disabled={forgotLoading}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Didn't receive email? Resend OTP
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: NEW PASSWORD */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-title">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-title">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                >
                  {forgotLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Save New Password & Login</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


export default Login;
