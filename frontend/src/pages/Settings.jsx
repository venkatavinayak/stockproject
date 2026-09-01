import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClerk } from '@clerk/clerk-react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI, backupAPI, authAPI } from '../services/api';
import { 
  Settings, Database, Save, Plus, 
  Download, RefreshCw, CheckCircle2, 
  AlertTriangle, Lock, KeyRound, X, Trash2, AlertOctagon
} from 'lucide-react';

const SettingsPage = () => {
  const { deleteAccount, user } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  // Store Settings (Admin Only)
  const [formData, setFormData] = useState({
    store_name: 'Smart Store Ai Store',
    gst_number: '',
    address: '',
    contact_info: '',
    currency_symbol: '₹',
    receipt_format: 'Thermal',
    invoice_footer: 'Thank you for shopping with us!',
    email_enable: false,
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_sender: ''
  });
  
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Password Change State (Admin Only)
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState('');

  const fetchSettingsAndBackups = async () => {
    try {
      setLoading(true);
      const [settingsData, backupsData] = await Promise.all([
        settingsAPI.get(),
        backupAPI.getAll()
      ]);
      setFormData(settingsData);
      setBackups(backupsData);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndBackups();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaveSuccess(false);
    setSaving(true);

    if (formData.email_enable) {
      if (!formData.smtp_host?.trim() || !formData.smtp_user?.trim() || !formData.smtp_password?.trim()) {
        alert("Please enter your SMTP Host, User Email, and App Password before saving with Active Dispatch enabled.");
        setSaving(false);
        return;
      }
    }

    try {
      const data = await settingsAPI.update(formData);
      setFormData(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess(false);

    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPassError('New password must be at least 4 characters long');
      return;
    }

    setPassSaving(true);
    try {
      await authAPI.changePassword(oldPassword, newPassword);
      setPassSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPassSuccess(false), 4000);
    } catch (err) {
      setPassError(err.response?.data?.detail || 'Incorrect current password');
    } finally {
      setPassSaving(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await backupAPI.create();
      alert('Database backup created successfully.');
      const backupsData = await backupAPI.getAll();
      setBackups(backupsData);
    } catch (err) {
      alert(err.response?.data?.detail || 'Backup failed');
    }
  };

  const handleRestoreBackup = async (id, filename) => {
    const confirm = window.confirm(`WARNING: Are you sure you want to restore the database to the snapshot "${filename}"? This will overwrite all current catalog, stock, and transaction details.`);
    if (confirm) {
      try {
        const res = await backupAPI.restore(id);
        alert(res.message);
        window.location.reload();
      } catch (err) {
        alert(err.response?.data?.detail || 'Restore failed');
      }
    }
  };

  const handleDeleteStoreAccount = async (e) => {
    e.preventDefault();
    if (deleteConfirmInput.trim().toUpperCase() !== 'DELETE') return;

    setDeleting(true);
    try {
      await deleteAccount();
      alert('Your store account and all associated data have been permanently deleted.');
      try {
        if (signOut) await signOut();
      } catch (err) {
        console.warn('Clerk signout notice:', err);
      }
      navigate('/login');
    } catch (err) {
      alert(err.response?.data?.detail || err.message || 'Failed to delete store account');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400 text-xs">
        <RefreshCw size={24} className="animate-spin mr-2" />
        Syncing store configurations...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title text-slate-900 dark:text-white">Store Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Configure invoice print layouts, business properties, SMTP triggers, and database snapshots.</p>
        </div>
        <button 
          onClick={() => setShowPasswordModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg active:scale-95 transition-all self-start sm:self-center"
        >
          <Lock size={14} /> Change Admin Password
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Profile Settings */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel bg-white dark:bg-slate-950/40">
          <h3 className="text-md font-bold font-title border-b pb-3 mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <Settings size={16} className="text-indigo-600" /> Store Profile Configuration
          </h3>

          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold">
              <CheckCircle2 size={14} className="shrink-0" />
              <span>Store configuration saved successfully!</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Store Name</label>
                <input
                  type="text"
                  value={formData.store_name}
                  onChange={(e) => setFormData({...formData, store_name: e.target.value})}
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">GSTIN Number (Optional)</label>
                <input
                  type="text"
                  value={formData.gst_number || ''}
                  onChange={(e) => setFormData({...formData, gst_number: e.target.value})}
                  placeholder="e.g. 27AAAAA1111A1Z1"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Store Address</label>
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                rows="2"
                placeholder="Enter store physical address details"
                className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Store Contact Ph/Email</label>
                <input
                  type="text"
                  value={formData.contact_info || ''}
                  onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
                  placeholder="e.g. +91 99999 88888"
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Currency Symbol</label>
                <input
                  type="text"
                  value={formData.currency_symbol}
                  onChange={(e) => setFormData({...formData, currency_symbol: e.target.value})}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Bill receipt format options */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 dark:border-slate-850">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Receipt print format</label>
                <select
                  value={formData.receipt_format}
                  onChange={(e) => setFormData({...formData, receipt_format: e.target.value})}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="Thermal">Thermal Receipt (80mm standard width)</option>
                  <option value="A4">A4 Full Page Document Invoice</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Invoice Footer Message</label>
                <input
                  type="text"
                  value={formData.invoice_footer || ''}
                  onChange={(e) => setFormData({...formData, invoice_footer: e.target.value})}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* SMTP Settings */}
            <div className="border-t pt-4 dark:border-slate-850 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold font-title text-indigo-500 uppercase tracking-wider">SMTP Email Billing Settings</h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.email_enable}
                    onChange={(e) => setFormData({...formData, email_enable: e.target.checked})}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-655"></div>
                  <span className="ml-2 text-[10px] font-bold text-slate-550">Active Dispatch</span>
                </label>
              </div>

              {formData.email_enable && (
                <div className="space-y-4 animate-fade-in text-[10px]">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">SMTP Server Host</label>
                      <input
                        type="text"
                        value={formData.smtp_host || ''}
                        onChange={(e) => setFormData({...formData, smtp_host: e.target.value})}
                        placeholder="smtp.gmail.com"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">SMTP Port</label>
                      <input
                        type="number"
                        value={formData.smtp_port || 587}
                        onChange={(e) => setFormData({...formData, smtp_port: Number(e.target.value)})}
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">SMTP User Email</label>
                      <input
                        type="text"
                        value={formData.smtp_user || ''}
                        onChange={(e) => setFormData({...formData, smtp_user: e.target.value})}
                        placeholder="yourstore@gmail.com"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">SMTP App Password (16-char)</label>
                      <input
                        type="password"
                        value={formData.smtp_password || ''}
                        onChange={(e) => setFormData({...formData, smtp_password: e.target.value})}
                        placeholder="Gmail App Password"
                        className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Sender Email Address (Optional)</label>
                    <input
                      type="text"
                      value={formData.smtp_sender || ''}
                      onChange={(e) => setFormData({...formData, smtp_sender: e.target.value})}
                      placeholder="Same as SMTP user if empty"
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-extrabold shadow active:scale-[0.98] transition-all rounded-xl text-xs flex items-center justify-center gap-1"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Configuration Changes'}
            </button>
          </form>
        </div>

        {/* Database Snapshots & Backup Manager */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel bg-white dark:bg-slate-950/40 h-fit">
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <h3 className="text-md font-bold font-title flex items-center gap-2 text-slate-900 dark:text-white">
              <Database size={16} className="text-indigo-600" /> Database Backup Manager
            </h3>
            <button 
              onClick={handleCreateBackup}
              className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow active:scale-[0.98] transition-all"
            >
              <Plus size={12} /> Create Backup
            </button>
          </div>

          <div className="p-3.5 mb-6 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-500 flex gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              Restoring databases will reset all current product stocks and transaction records. 
              Always download backups to local storage to maintain data history safety.
            </span>
          </div>

          {/* Backups List */}
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
            {backups.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">No previous database backups recorded</div>
            ) : (
              backups.map((bk) => (
                <div key={bk.id} className="flex items-center justify-between p-3.5 rounded-2xl border dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/10">
                  <div className="text-[11px] space-y-1">
                    <span className="block font-mono font-bold leading-none">{bk.filename}</span>
                    <span className="block text-[9px] text-slate-400">
                      Type: {bk.backup_type} | Date: {new Date(bk.timestamp).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <a 
                      href={backupAPI.downloadUrl(bk.id)}
                      className="p-1.5 border rounded-lg hover:bg-slate-100 dark:border-slate-800 text-slate-500 flex items-center justify-center"
                      title="Download DB file"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download size={12} />
                    </a>
                    
                    <button 
                      onClick={() => handleRestoreBackup(bk.id, bk.filename)}
                      className="p-1.5 border border-rose-200 dark:border-rose-950 text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-[10px] font-semibold"
                      title="Restore DB to this point"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100/10 text-[10px] text-indigo-500 dark:bg-indigo-950/10 mt-6 flex gap-2">
            <Database size={14} className="shrink-0 mt-0.5" />
            <span>
              Scheduled Nightly backups automatically run at **2:00 AM** and closing business summaries compile at **11:59 PM** daily.
            </span>
          </div>
        </div>
      </div>

      {/* Change Password Modal (Admin only) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in text-slate-800 dark:text-slate-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-850">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <h3 className="text-md font-bold font-title flex items-center gap-2 text-slate-900 dark:text-white">
                <Lock size={16} className="text-indigo-600" /> Change Admin Password
              </h3>
              <button 
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassError('');
                  setPassSuccess(false);
                }} 
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <X size={16} />
              </button>
            </div>

            {passError && (
              <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-semibold">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{passError}</span>
              </div>
            )}

            {passSuccess && (
              <div className="flex items-center gap-2 p-3 mb-4 text-xs rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-semibold">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>Admin password updated successfully!</span>
              </div>
            )}

            <form onSubmit={handleSavePassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Current Password</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:border-slate-850 dark:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-slate-200"
                />
              </div>

              <button
                type="submit"
                disabled={passSaving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-850 text-white font-extrabold shadow active:scale-[0.98] transition-all rounded-xl text-xs flex items-center justify-center gap-1"
              >
                <KeyRound size={14} /> {passSaving ? 'Resetting...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DANGER ZONE: DELETE STORE ACCOUNT */}
      <div className="p-6 mt-8 rounded-3xl bg-rose-500/5 border border-rose-500/20 text-rose-900 dark:text-rose-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-rose-700 dark:text-rose-400 font-title">
                Delete Store Account
              </h3>
              <p className="text-xs text-rose-600/80 dark:text-rose-300/80 mt-0.5 max-w-xl">
                Permanently delete your store account, products, categories, transactions, cashier accounts, and settings. This action cannot be undone.
              </p>
            </div>
          </div>

          <button
            onClick={() => { setShowDeleteModal(true); setDeleteConfirmInput(''); }}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition-all shadow-md shadow-rose-600/20 cursor-pointer flex items-center gap-2"
          >
            <Trash2 size={14} />
            <span>Delete Store Account</span>
          </button>
        </div>
      </div>

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl border border-rose-500/30 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 text-white bg-rose-600 rounded-2xl shadow-md">
                <AlertOctagon size={24} />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-white font-title">
                  Permanently Delete Account?
                </h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                  Warning: All store data will be deleted immediately.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-2">
              <p className="font-bold">This operation will permanently remove:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] opacity-90">
                <li>Store owner account & credentials</li>
                <li>All counter cashier staff accounts</li>
                <li>All product inventory catalog items</li>
                <li>All sales history, invoices, & billing records</li>
                <li>All store expenses & ERP settings</li>
              </ul>
            </div>

            <form onSubmit={handleDeleteStoreAccount} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Type <strong className="text-rose-600 dark:text-rose-400">DELETE</strong> to confirm
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  required
                  placeholder="Type DELETE"
                  className="w-full text-center font-mono font-bold uppercase py-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-100 focus:outline-none focus:border-rose-600"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="w-1/2 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleting || deleteConfirmInput.trim().toUpperCase() !== 'DELETE'}
                  className="w-1/2 py-3 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:bg-rose-900 transition-all cursor-pointer text-xs shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>{deleting ? 'Deleting...' : 'Delete Permanently'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
