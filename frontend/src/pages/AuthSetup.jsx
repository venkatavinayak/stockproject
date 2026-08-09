import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { KeyRound, User, AlertCircle, ShoppingBag, Shield, Users } from 'lucide-react';

const AuthSetup = () => {
  const { syncProfile } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('link'); // 'link' or 'create'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(false);

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters long');
      return;
    }

    setLoading(true);
    const action = activeTab === 'create' ? 'create_admin' : 'link_user';

    try {
      await authAPI.setup(action, username, password);
      // Synchronize the profile context
      await syncProfile();
      // Redirect home
      navigate('/');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Setup failed. Please check credentials or try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-900 to-black p-4">
      <div className="w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-xl bg-slate-950/60 animate-fade-in">
        {/* App Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-4 mb-4 text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/30">
            <ShoppingBag size={32} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white font-title">
            SmartStock AI
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Link Gmail Account to Store Profile
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 mb-6">
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'link'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            Link Shop Account
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setError('');
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === 'create'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Shield size={16} />
            Create Owner Profile
          </button>
        </div>

        {/* Info Box */}
        <div className="p-4 mb-6 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 leading-relaxed">
          {activeTab === 'create' ? (
            <span>
              <strong>New Store Setup:</strong> This action will create a brand new store database administrator with full dashboard, billing, and system customization rights.
            </span>
          ) : (
            <span>
              <strong>Connect Counter/Admin:</strong> Enter your existing shop account credentials (username/password) provided by the administrator to link your Gmail account.
            </span>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 mb-6 text-sm rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Store Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                placeholder={activeTab === 'create' ? 'Set admin username' : 'Enter your shop username'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Store Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <KeyRound size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all duration-200"
                placeholder={activeTab === 'create' ? 'Set profile password' : '••••••••'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 active:scale-95 shadow-lg shadow-indigo-600/20 transition-all duration-150"
          >
            {loading ? 'Processing setup...' : activeTab === 'create' ? 'Initialize Store Admin' : 'Verify & Link Profile'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthSetup;
