import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useClerk, useSignIn, SignIn, SignUp } from '@clerk/clerk-react';
import { authAPI } from '../services/api';
import { 
  KeyRound, User, AlertCircle, ShoppingBag, ArrowRight, Store, 
  UserCheck, ShieldCheck, Monitor, LogOut, CheckCircle2, Sparkles, Copy, Check, Lock, Send, X, Mail
} from 'lucide-react';

const Login = () => {
  const { isAuthenticated, loginOwner, loginCounter, registerShop, requestOTP, verifyOTP, resetPasswordOTP } = useAuth();
  const navigate = useNavigate();
  const { isSignedIn, user: clerkUser } = useUser();
  const { signOut } = useClerk();

  // Active portal tab switcher: 'owner' | 'counter'
  const [activeTab, setActiveTab] = useState('owner');
  const [authMode, setAuthMode] = useState('sign_in'); // 'sign_in' | 'sign_up'

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

  // Forgot password OTP modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1);
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

  // Handler: Counter Login directly on Login page
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
      await loginCounter(shopCodeToUse, counterUsername.trim(), counterPassword);
      setSuccessMsg('Counter cashier login successful!');
      setTimeout(() => navigate('/'), 500);
    } catch (err) {
      setError(err.message || 'Incorrect Shop Code, Counter Username, or Password');
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
      setExistingOwnerPassword(newPassword);
    } catch (err) {
      setForgotError(err.message || 'Failed to reset password');
    } finally {
      setForgotLoading(false);
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

  // Modern Responsive Clerk Styling
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
      colorBackground: 'transparent',
      colorInputBackground: '#f8fafc',
      colorInputText: '#0f172a',
      borderRadius: '0.75rem',
      fontFamily: '"Plus Jakarta Sans", sans-serif'
    },
    elements: {
      rootBox: "w-full flex justify-center",
      cardBox: "w-full max-w-md shadow-none bg-transparent rounded-2xl border-0 p-0 overflow-visible",
      card: "shadow-none bg-transparent p-0 w-full",
      headerTitle: "text-xl font-extrabold text-slate-900 dark:text-white font-title text-center tracking-tight",
      headerSubtitle: "text-xs font-medium text-slate-500 dark:text-slate-400 text-center mt-1",
      socialButtonsBlockButton: "w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/50 font-bold py-3 transition-all cursor-pointer shadow-sm flex items-center justify-center gap-3 hover:border-indigo-400 dark:hover:border-indigo-600",
      socialButtonsBlockButtonText: "font-bold text-sm text-slate-800 dark:text-slate-200 font-sans whitespace-nowrap",
      dividerLine: "bg-slate-200 dark:bg-slate-800",
      dividerText: "text-[10px] font-extrabold text-slate-400 uppercase tracking-widest bg-white dark:bg-slate-950 px-3 font-title",
      formFieldLabel: "text-[10px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1 font-title",
      formFieldInput: "w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 font-semibold text-sm transition-all",
      formButtonPrimary: "w-full py-3.5 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20 text-sm transition-all cursor-pointer border-0 font-title",
      footerActionLink: "font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline",
      footer: "p-2 text-center"
    }
  };

  return (
    <div className="min-h-screen bg-slate-900/5 dark:bg-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans transition-colors">
      
      {/* Background Decorative Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Main Centered Box Container */}
      <div className="relative z-10 w-full max-w-xl mx-auto">

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3 p-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-lg mb-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
              <ShoppingBag size={24} />
            </div>
            <div className="text-left pr-3">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-white font-title tracking-tight">
                SmartStore AI
              </h1>
              <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                Cloud Multi-Tenant Store ERP
              </p>
            </div>
          </div>
        </div>

        {/* Segmented Portal Switcher Tabs */}
        <div className="p-1.5 mb-6 bg-slate-200/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-slate-300/50 dark:border-slate-800 grid grid-cols-2 gap-1 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('owner')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold font-title transition-all cursor-pointer ${
              activeTab === 'owner'
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck size={16} />
            <span>Store Owner Portal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('counter')}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-bold font-title transition-all cursor-pointer ${
              activeTab === 'counter'
                ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-md'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor size={16} />
            <span>Counter Cashier POS</span>
          </button>
        </div>

        {/* Feedback Banner Alerts */}
        {error && (
          <div className="flex items-center gap-3 p-4 mb-5 text-xs rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold animate-shake">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 p-4 mb-5 text-xs rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 size={18} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* CARD CONTAINER */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 backdrop-blur-xl">

          {/* TAB 1: STORE OWNER PORTAL */}
          {activeTab === 'owner' && (
            <div className="space-y-6">

              {/* STAGE A: NOT SIGNED IN WITH CLERK */}
              {!isSignedIn && (
                <div className="space-y-5">
                  <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold uppercase tracking-wider font-title">
                      Owner Gmail Sign In
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-title mt-2">
                      Sign In with Store Gmail Account
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Authenticated via real-world Clerk SSO for total store security.
                    </p>
                  </div>

                  <div className="w-full flex justify-center py-2">
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
              )}

              {/* CHECKING SHOP RECORDS */}
              {isSignedIn && checkingShop && (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Verifying store records for {clerkUser?.primaryEmailAddress?.emailAddress}...
                  </p>
                </div>
              )}

              {/* STAGE B: SIGNED IN WITH CLERK */}
              {isSignedIn && !checkingShop && (
                <div className="space-y-5">
                  
                  {/* Verified Gmail Account Banner */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 text-white bg-indigo-600 rounded-xl shrink-0">
                        <User size={18} />
                      </div>
                      <div className="overflow-hidden">
                        <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          GMAIL VERIFIED
                        </span>
                        <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 truncate block">
                          {clerkUser?.primaryEmailAddress?.emailAddress}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClerkSignOut}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl transition-colors cursor-pointer shrink-0"
                    >
                      Sign Out
                    </button>
                  </div>

                  {/* CASE 1: EXISTING STORE -> OWNER PASSWORD LOGIN */}
                  {shopStatus && shopStatus.exists && (
                    <div className="space-y-5 pt-1">
                      
                      {/* Prominent Shop Code Badge */}
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                            <Store size={16} />
                            {shopStatus.shop_name}
                          </span>
                          <span className="px-2 py-0.5 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 rounded-md uppercase">
                            Registered
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30">
                          <div>
                            <span className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                              YOUR SHOP CODE
                            </span>
                            <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono tracking-widest">
                              {shopStatus.shop_code || shopStatus.owner_username}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyShopCode(shopStatus.shop_code || shopStatus.owner_username)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                          >
                            {copiedCode ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Owner Password Form */}
                      <form onSubmit={handleOwnerLogin} className="space-y-4">
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
                              value={existingOwnerUsername}
                              onChange={(e) => setExistingOwnerUsername(e.target.value)}
                              required
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                              placeholder="Enter owner username"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
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
                              }}
                              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              Forgot Password?
                            </button>
                          </div>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                              <KeyRound size={16} />
                            </span>
                            <input
                              type="password"
                              value={existingOwnerPassword}
                              onChange={(e) => setExistingOwnerPassword(e.target.value)}
                              required
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                              placeholder="Enter your password"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                        >
                          {loading ? 'Authenticating...' : 'Sign In to Store Dashboard'}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    </div>
                  )}

                  {/* CASE 2: NEW STORE -> CREATE STORE FORM */}
                  {shopStatus && !shopStatus.exists && (
                    <div className="space-y-4 pt-1">
                      <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 flex items-center gap-3">
                        <Sparkles className="text-indigo-600 dark:text-indigo-400 shrink-0" size={20} />
                        <div>
                          <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                            Create Your New Store
                          </h4>
                          <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                            Set up your store below to generate your 6-character Shop Code!
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleCreateShop} className="space-y-4">
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
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                            Owner Username
                          </label>
                          <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                              <UserCheck size={16} />
                            </span>
                            <input
                              type="text"
                              value={ownerUsername}
                              onChange={(e) => setOwnerUsername(e.target.value)}
                              required
                              placeholder="Choose owner username"
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
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
                              value={ownerPassword}
                              onChange={(e) => setOwnerPassword(e.target.value)}
                              required
                              placeholder="Choose a password"
                              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-semibold text-sm"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 transition-all cursor-pointer text-sm shadow-lg shadow-indigo-600/20"
                        >
                          {loading ? 'Creating Store...' : 'Create Store & Generate Code'}
                          <ArrowRight size={16} />
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
            <div className="space-y-5">
              <div className="text-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold uppercase tracking-wider font-title">
                  Cashier Billing Terminal
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white font-title mt-2">
                  Counter Staff Access
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Log into your store billing counter using your assigned 6-character Shop Code.
                </p>
              </div>

              <form onSubmit={handleCounterLoginSubmit} className="space-y-4 pt-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 font-mono font-bold tracking-widest text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 transition-all cursor-pointer text-sm shadow-lg shadow-emerald-600/20"
                >
                  {loading ? 'Authenticating Terminal...' : 'Sign In to Counter POS'}
                  <ArrowRight size={16} />
                </button>
              </form>

              <div className="text-center pt-2">
                <Link
                  to="/pos"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>Go to Standalone POS Page (/pos)</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* FORGOT PASSWORD OTP MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 relative">
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
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                <Lock size={22} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-title">
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
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <Mail size={16} />
                    </span>
                    <input
                      type="text"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      placeholder="e.g. owner@example.com or admin"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
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
                      className="w-full text-center tracking-[10px] font-mono text-2xl font-bold py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
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
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="Enter new password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 font-title">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <KeyRound size={16} />
                    </span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-900 dark:text-white font-semibold text-sm focus:outline-none focus:border-indigo-500"
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
