import React, { useState, useEffect } from 'react';
import { expensesAPI, settingsAPI } from '../services/api';
import { 
  DollarSign, Plus, Trash2, Calendar, 
  FileText, Sliders, Coins
} from 'lucide-react';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Settings
  const [settings, setSettings] = useState({ currency_symbol: '₹' });

  // Add Expense form
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Electricity',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        category: categoryFilter || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      };
      
      const [expData, settingsData] = await Promise.all([
        expensesAPI.getAll(params),
        settingsAPI.get()
      ]);
      
      setExpenses(expData);
      setSettings(settingsData);
      
      // Calculate total
      const total = expData.reduce((sum, e) => sum + e.amount, 0);
      setTotalExpenses(total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [categoryFilter, startDate, endDate]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!formData.amount) return;
    
    try {
      await expensesAPI.create({
        ...formData,
        amount: Number(formData.amount)
      });
      setShowAddModal(false);
      setFormData({
        category: 'Electricity',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: ''
      });
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add expense');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('Are you sure you want to remove this expense entry?')) {
      try {
        await expensesAPI.delete(id);
        fetchExpenses();
      } catch (err) {
        alert(err.response?.data?.detail || 'Delete failed');
      }
    }
  };

  const categoriesList = ['Electricity', 'Rent', 'Internet', 'Maintenance', 'Miscellaneous'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title">Operational Expenses</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Log bills, rent, maintenance, and miscellaneous operating expenses.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg self-start sm:self-center"
        >
          <Plus size={14} /> Log Expense
        </button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total logged costs</span>
            <h3 className="text-2xl font-bold tracking-tight text-rose-500">₹{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</h3>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 dark:bg-rose-950/40">
            <Coins size={20} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel grid grid-cols-1 sm:grid-cols-3 gap-4">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
        >
          <option value="">All Categories</option>
          {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Calendar size={12} /></span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
          />
        </div>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400"><Calendar size={12} /></span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full pl-8 pr-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
          />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden glass-panel">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b dark:bg-slate-900 dark:border-slate-800 font-bold">
                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-900">
              {loading && expenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">Loading expense logs...</td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400">No operational expenses logged</td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <td className="p-4">{new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="p-4 font-bold">{exp.category}</td>
                    <td className="p-4 font-mono font-bold text-rose-500">₹{exp.amount.toFixed(2)}</td>
                    <td className="p-4 text-slate-500">{exp.description || 'N/A'}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteExpense(exp.id)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border shadow-2xl dark-mode:bg-slate-950 dark-mode:border-slate-800">
            <h3 className="text-md font-bold font-title border-b pb-3 mb-4">Log Operational Expense</h3>
            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">EXPENSE CATEGORY</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                >
                  {categoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">AMOUNT (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="0.00"
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">DATE OF EXPENSE</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-400 mb-1">DESCRIPTION / NOTES</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Rent for July, Electricity bill, etc."
                  rows="3"
                  className="w-full p-2.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 dark:border-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
