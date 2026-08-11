import React, { useState, useEffect } from 'react';
import { transactionsAPI, settingsAPI, authAPI, API_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  History, Search, Calendar, CreditCard, 
  FileDown, Printer, RefreshCcw, Check, 
  AlertCircle, ArrowUpRight
} from 'lucide-react';

const Transactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [activeTab, setActiveTab] = useState('sales'); // sales, returns
  const [cashierSummary, setCashierSummary] = useState({ total_sales: 0, invoice_count: 0, total_items: 0 });

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const cleanStr = dateStr.endsWith('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z';
    return new Date(cleanStr).toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  // Filters
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCashier, setSelectedCashier] = useState('');
  const [cashiers, setCashiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Settings
  const [settings, setSettings] = useState({ currency_symbol: '₹' });

  // Refund Modal
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [refundQuantities, setRefundQuantities] = useState({});
  const [refundReason, setRefundReason] = useState('Customer Unsatisfied');

  // Receipt Modal
  const [previewTx, setPreviewTx] = useState(null);

  const fetchTransactionsData = async () => {
    try {
      setLoading(true);
      const params = {
        invoice_number: search || undefined,
        payment_method: paymentMethod || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        cashier_username: selectedCashier || undefined
      };
      
      const promises = [
        transactionsAPI.getAll(params),
        transactionsAPI.getReturns(),
        settingsAPI.get()
      ];
      
      if (user?.role === 'worker') {
        promises.push(transactionsAPI.getMySummary());
      } else if (user?.role === 'admin') {
        promises.push(authAPI.listUsers());
      }
      
      const results = await Promise.all(promises);
      
      setTransactions(results[0]);
      setReturnsList(results[1]);
      setSettings(results[2]);
      
      if (user?.role === 'worker' && results[3]) {
        setCashierSummary(results[3]);
      } else if (user?.role === 'admin' && results[3]) {
        setCashiers(results[3]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactionsData();
  }, [search, paymentMethod, startDate, endDate, user, selectedCashier]);

  const handleRefund = async (e) => {
    e.preventDefault();
    const itemsToRefund = Object.entries(refundQuantities).filter(([_, qty]) => qty > 0);
    if (itemsToRefund.length === 0) {
      alert("Please select at least one item to return/refund.");
      return;
    }
    
    try {
      for (const [prodId, qty] of itemsToRefund) {
        await transactionsAPI.refund(
          selectedTx.id,
          prodId,
          Number(qty),
          refundReason
        );
      }
      alert('Return processed successfully! Stock restocked and sales dashboards updated.');
      setShowRefundModal(false);
      setRefundQuantities({});
      fetchTransactionsData();
    } catch (err) {
      const errMsg = typeof err.response?.data?.detail === 'string'
        ? err.response.data.detail
        : Array.isArray(err.response?.data?.detail)
          ? err.response.data.detail.map(d => d.msg).join(', ')
          : 'Refund failed';
      alert(errMsg);
    }
  };

  const handleDownloadPDF = (tx) => {
    const token = localStorage.getItem('smartstock_token');
    const url = `${API_BASE_URL}/transactions/${tx.id}/pdf?token=${encodeURIComponent(token || '')}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title">Sales History</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Review bills, issue refunds/returns, and download PDF tax invoices.</p>
        </div>
        
        {(user?.role === 'admin' || user?.can_view_analytics) && (
          <button
            onClick={() => {
              const token = localStorage.getItem('smartstock_token');
              let url = `http://localhost:8000/api/analytics/report/pdf?period=all&token=${encodeURIComponent(token || '')}`;
              if (startDate) url += `&start_date=${startDate}`;
              if (endDate) url += `&end_date=${endDate}`;
              if (user?.role === 'worker') {
                url += `&cashier_username=${user.username}`;
              } else if (selectedCashier) {
                url += `&cashier_username=${selectedCashier}`;
              }
              window.open(url, '_blank');
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg active:scale-95 transition-all self-start sm:self-center"
          >
            <FileDown size={14} /> {
              user?.role === 'worker' 
                ? 'Download My Sales PDF Report' 
                : selectedCashier === '' 
                  ? 'Download Total Sales PDF Report' 
                  : selectedCashier === 'admin' 
                    ? 'Download Admin Sales PDF Report' 
                    : `Download ${selectedCashier} Sales PDF Report`
            }
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b dark:border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${activeTab === 'sales' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Sales Transactions Ledger
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all duration-200 ${activeTab === 'returns' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          Returns & Refunds Log
        </button>
      </div>

      {activeTab === 'sales' ? (
        <>
          {/* Cashier Daily Summary (Worker only) */}
          {user?.role === 'worker' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-5 rounded-3xl border border-indigo-100 dark:border-indigo-950/40 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 dark:from-indigo-950/20 dark:to-indigo-900/10 shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Your Register Sales (Today)</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">₹{(cashierSummary?.total_sales || 0).toFixed(2)}</span>
                </div>
                <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-md shadow-indigo-600/20">
                  <CreditCard size={20} />
                </div>
              </div>

              <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Invoices Processed (Today)</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{cashierSummary?.invoice_count || 0} bills</span>
                </div>
                <div className="p-3 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-450 rounded-2xl">
                  <History size={20} />
                </div>
              </div>

              <div className="p-5 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Units Sold (Today)</span>
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{cashierSummary?.total_items || 0} items</span>
                </div>
                <div className="p-3 bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-450 rounded-2xl">
                  <Check size={20} />
                </div>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className={`p-4 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel grid grid-cols-1 ${user?.role === 'admin' ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-4`}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by invoice no..."
              className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
            />
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs"
            >
              <option value="">All Payment Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Mixed">Mixed</option>
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
            {user?.role === 'admin' && (
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="px-4 py-2 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-250"
              >
                <option value="">All Cashiers</option>
                <option value="admin">System Admin</option>
                {cashiers.map(c => c.username !== 'admin' && (
                  <option key={c.id} value={c.username}>{c.username}</option>
                ))}
              </select>
            )}
          </div>

          {/* Ledger Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b dark:bg-slate-900 dark:border-slate-800 font-bold">
                    <th className="p-4">Invoice No</th>
                    <th className="p-4">Date & Time</th>
                    <th className="p-4">Payment Method</th>
                    <th className="p-4">Items Count</th>
                    <th className="p-4">Grand Total</th>
                    {user?.role === 'admin' && <th className="p-4">Profit</th>}
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900">
                  {loading && transactions.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'admin' ? 7 : 6} className="p-8 text-center text-slate-400">Loading sales records...</td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={user?.role === 'admin' ? 7 : 6} className="p-8 text-center text-slate-400">No transactions recorded in this date range</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="p-4 font-bold font-mono">
                          <button 
                            onClick={() => setPreviewTx(tx)}
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            {tx.invoice_number}
                          </button>
                        </td>
                        <td className="p-4">{formatDateTime(tx.timestamp)}</td>
                        <td className="p-4">{tx.payment_method}</td>
                        <td className="p-4">{tx.items_count} items</td>
                        <td className="p-4 font-mono font-bold">₹{tx.grand_total.toFixed(2)}</td>
                        {user?.role === 'admin' && <td className="p-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{tx.profit.toFixed(2)}</td>}
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <button 
                              onClick={() => handleDownloadPDF(tx)}
                              title="Download Invoice PDF"
                              className="p-2 border border-slate-200 hover:border-indigo-400 dark:border-slate-800 rounded-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-950/25 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all"
                            >
                              <FileDown size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedTx(tx);
                                const q = {};
                                tx.items.forEach(item => {
                                  const pId = item.product?.id || item.product_id;
                                  q[pId] = 0;
                                });
                                setRefundQuantities(q);
                                setShowRefundModal(true);
                              }}
                              title="Refund / Return Items"
                              className="p-2 border border-slate-200 hover:border-rose-400 dark:border-slate-800 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/25 text-slate-500 hover:text-rose-600 dark:hover:text-rose-450 active:scale-95 transition-all"
                            >
                              <RefreshCcw size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Returns Tab */
        <div className="border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden glass-panel">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b dark:bg-slate-900 dark:border-slate-800 font-bold">
                  <th className="p-4">Timestamp</th>
                  <th className="p-4">Invoice No</th>
                  <th className="p-4">Product Name</th>
                  <th className="p-4">Returned Qty</th>
                  <th className="p-4">Refunded Cash</th>
                  <th className="p-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-slate-900">
                {returnsList.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-slate-400">No product returns logged</td>
                  </tr>
                ) : (
                  returnsList.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="p-4">{formatDateTime(ret.timestamp)}</td>
                      <td className="p-4 font-mono">{ret.transaction_id}</td>
                      <td className="p-4 font-bold">{ret.product?.name || 'Deleted Product'}</td>
                      <td className="p-4">{ret.quantity} units</td>
                      <td className="p-4 font-mono font-bold text-rose-600">₹{ret.refund_amount.toFixed(2)}</td>
                      <td className="p-4 text-slate-500 italic">{ret.reason}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return Item Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-800">
            <h3 className="text-md font-bold font-title border-b pb-3 mb-4 text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCcw size={16} className="text-rose-500" />
              Process Refund Return
            </h3>
            <form onSubmit={handleRefund} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border dark:border-slate-850 flex justify-between items-center">
                <span className="text-slate-450 font-bold uppercase tracking-wider text-[9px]">Invoice Reference:</span>
                <span className="font-mono font-bold text-sm text-indigo-600 dark:text-indigo-400">{selectedTx?.invoice_number}</span>
              </div>
              
              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">QUANTITIES TO RETURN / REFUND</label>
                
                <div className="max-h-60 overflow-y-auto border rounded-xl divide-y dark:border-slate-800 dark:divide-slate-850 bg-slate-50/50 dark:bg-slate-950/30">
                  {selectedTx?.items.map((item) => {
                    const pId = item.product?.id || item.product_id;
                    const maxQty = item.quantity;
                    const currentVal = refundQuantities[pId] || 0;
                    
                    return (
                      <div key={pId} className="p-3 flex justify-between items-center gap-4">
                        <div className="flex-1">
                          <span className="block font-bold text-slate-800 dark:text-slate-200">{item.product_name || 'Retail Item'}</span>
                          <span className="block text-[9px] text-slate-400 font-semibold">
                            Purchased: {item.quantity} units x {settings.currency_symbol}{item.unit_selling_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={currentVal <= 0}
                            onClick={() => setRefundQuantities(prev => ({ ...prev, [pId]: Math.max(0, currentVal - 1) }))}
                            className="w-7 h-7 flex items-center justify-center border rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-900 dark:hover:bg-slate-850 dark:border-slate-800 font-extrabold text-sm transition-colors text-slate-800 dark:text-slate-200"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={maxQty}
                            value={currentVal}
                            onChange={(e) => {
                              const val = Math.min(maxQty, Math.max(0, Number(e.target.value)));
                              setRefundQuantities(prev => ({ ...prev, [pId]: val }));
                            }}
                            className="w-10 p-1 text-center font-bold border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            disabled={currentVal >= maxQty}
                            onClick={() => setRefundQuantities(prev => ({ ...prev, [pId]: Math.min(maxQty, currentVal + 1) }))}
                            className="w-7 h-7 flex items-center justify-center border rounded-lg bg-white hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-900 dark:hover:bg-slate-850 dark:border-slate-800 font-extrabold text-sm transition-colors text-slate-800 dark:text-slate-200"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1.5 uppercase tracking-wider text-[9px]">REFUND REASON *</label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 dark:border-slate-800 dark:bg-slate-950 transition-all font-semibold"
                >
                  <option value="Damaged / Defective Product">Defective Product</option>
                  <option value="Customer Unsatisfied">Customer Unsatisfied</option>
                  <option value="Wrong Item Checked Out">Wrong Checkout</option>
                  <option value="Product Expired">Product Expired</option>
                </select>
              </div>

              <div className="flex gap-2.5 pt-3 border-t dark:border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowRefundModal(false)}
                  className="w-full py-2.5 border border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl font-bold text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/10 active:scale-[0.98] transition-all rounded-xl"
                >
                  Process Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Preview Modal */}
      {previewTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border shadow-2xl dark-mode:bg-slate-950 dark-mode:border-slate-800 max-h-[85vh] flex flex-col justify-between">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold font-title">Invoicing Receipt Preview</h3>
              <span className="text-xs text-slate-400">{previewTx.invoice_number}</span>
            </div>

            {/* Thermal Receipt Print Area */}
            <div className="flex-1 border rounded-2xl p-4 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 mb-4" id="thermal-receipt-print-area">
              <div className="text-center font-sans text-xs mb-3">
                <span className="block font-bold text-sm">{settings.store_name}</span>
                {settings.address && <span className="block text-[10px] text-slate-400">{settings.address}</span>}
                {settings.contact_info && <span className="block text-[10px] text-slate-400">Tel: {settings.contact_info}</span>}
                {settings.gst_number && <span className="block text-[10px] text-slate-400">GSTIN: {settings.gst_number}</span>}
                <span className="block border-b border-dashed my-2"></span>
              </div>
              
              <div className="space-y-2 text-[10px] font-mono">
                {previewTx.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between border-b border-dashed pb-1">
                    <div>
                      <span className="block font-bold">{item.product?.name || 'Item'}</span>
                      <span>{item.quantity} x {settings.currency_symbol}{item.unit_selling_price.toFixed(2)}</span>
                    </div>
                    <span className="self-center">{settings.currency_symbol}{item.total_amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 text-[10px] font-mono space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>{settings.currency_symbol}{previewTx.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span>-{settings.currency_symbol}{previewTx.discount_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST:</span>
                  <span>{settings.currency_symbol}{previewTx.gst_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs border-t border-dashed pt-1">
                  <span>GRAND TOTAL:</span>
                  <span>{settings.currency_symbol}{previewTx.grand_total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Print control */}
            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Printer size={16} /> Reprint Receipt
              </button>
              <button
                onClick={() => setPreviewTx(null)}
                className="w-full py-2 text-xs border rounded-xl hover:bg-slate-50 dark:border-slate-800"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
