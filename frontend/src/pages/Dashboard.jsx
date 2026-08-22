import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, aiAPI, productsAPI, transactionsAPI, expensesAPI, API_BASE_URL } from '../services/api';
import { 
  TrendingUp, TrendingDown, Coins, Receipt, 
  Layers, Package, AlertTriangle, Activity, 
  Sparkles, FileText, Database, ShieldAlert,
  ArrowUpRight, ShoppingBag, DollarSign, X, ArrowDownRight, ArrowRight
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, 
  Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, 
  Legend, CartesianGrid 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

const Dashboard = () => {
  const { user } = useAuth();
  const [kpis, setKpis] = useState(null);
  const [activity, setActivity] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [categoryShare, setCategoryShare] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modals state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [productHistoryList, setProductHistoryList] = useState([]);

  const [showDeadStockModal, setShowDeadStockModal] = useState(false);
  const [deadStockList, setDeadStockList] = useState([]);

  const [showTxsModal, setShowTxsModal] = useState(false);
  const [txsList, setTxsList] = useState([]);

  const [showExpensesModal, setShowExpensesModal] = useState(false);
  const [expensesList, setExpensesList] = useState([]);

  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerData, setLedgerData] = useState({ revenue: 0, profit: 0, expenses: 0, net: 0 });

  const [period, setPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const filterByPeriod = (items, timestampField) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return items.filter(item => {
      const itemDate = new Date(item[timestampField]);
      if (period === 'today') {
        return itemDate >= today;
      } else if (period === 'week') {
        const startOfWeek = new Date();
        startOfWeek.setDate(today.getDate() - 6);
        startOfWeek.setHours(0, 0, 0, 0);
        return itemDate >= startOfWeek;
      } else if (period === 'month') {
        const startOfMonth = new Date();
        startOfMonth.setDate(today.getDate() - 29);
        startOfMonth.setHours(0, 0, 0, 0);
        return itemDate >= startOfMonth;
      } else { // 'all'
        return true;
      }
    });
  };

  const fetchDashboardData = async (activePeriod = period) => {
    try {
      const trendPeriod = activePeriod === 'today' ? 'month' : activePeriod === 'week' ? 'week' : activePeriod === 'month' ? 'month' : 'year';
      
      const promises = [
        analyticsAPI.getKPIs(
          activePeriod, 
          activePeriod === 'custom' ? customStartDate : null, 
          activePeriod === 'custom' ? customEndDate : null
        ),
        analyticsAPI.getRecentActivity(),
        aiAPI.getRecommendations(),
        analyticsAPI.getTrends(trendPeriod),
        analyticsAPI.getCategoryShare()
      ];
      
      const [kpiData, activityData, recData, trendData, catData] = await Promise.all(promises);
      
      setKpis(kpiData);
      setActivity(activityData);
      setRecommendations(recData);
      setSalesTrend(trendData);
      setCategoryShare(catData);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(period);
    const interval = setInterval(() => fetchDashboardData(period), 30000);
    return () => clearInterval(interval);
  }, [period, customStartDate, customEndDate]);

  const handlePrintReport = async () => {
    try {
      setLoadingDetails(true);
      const token = localStorage.getItem('smartstock_token');
      let url = `${API_BASE_URL}/analytics/report/pdf?period=${period}&token=${encodeURIComponent(token || '')}`;
      if (period === 'custom') {
        if (customStartDate) url += `&start_date=${customStartDate}`;
        if (customEndDate) url += `&end_date=${customEndDate}`;
      }
      window.open(url, '_blank');
    } catch (e) {
      console.error(e);
      alert("Failed to download PDF report");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Format currency
  const fmt = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  // Handle drill downs
  const handleProductClick = async (productName) => {
    if (!productName || productName === 'N/A') return;
    try {
      setLoadingDetails(true);
      const prods = await productsAPI.getAll({ query: productName });
      if (prods.length > 0) {
        const p = prods[0];
        setHistoryProduct(p);
        const history = await productsAPI.getHistory(p.id);
        setProductHistoryList(history);
        setShowHistoryModal(true);
      } else {
        alert(`Product "${productName}" details could not be found.`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDeadStockClick = async () => {
    try {
      setLoadingDetails(true);
      const prods = await productsAPI.getAll();
      const recs = recommendations.length > 0 ? recommendations : await aiAPI.getRecommendations();
      
      const dead = prods.filter(p => {
        return p.current_stock > 0 && recs.some(r => r.type === 'Dead Stock' && r.product_id === p.id);
      });
      
      const enrichedDead = dead.map(p => {
        const rec = recs.find(r => r.product_id === p.id && r.type === 'Dead Stock');
        return {
          ...p,
          suggestion: rec ? rec.suggestion : `Product '${p.name}' is carrying idle inventory (${p.current_stock} units). Recommend promotional discounting.`
        };
      });

      setDeadStockList(enrichedDead);
      setShowDeadStockModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTodayTxsClick = async () => {
    try {
      setLoadingDetails(true);
      const allTxs = await transactionsAPI.getAll();
      const filteredTxs = filterByPeriod(allTxs, 'timestamp');
      setTxsList(filteredTxs);
      setShowTxsModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTodayExpensesClick = async () => {
    try {
      setLoadingDetails(true);
      const allExps = await expensesAPI.getAll();
      const filteredExps = filterByPeriod(allExps, 'date');
      setExpensesList(filteredExps);
      setShowExpensesModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleTodayLedgerClick = async () => {
    try {
      setLoadingDetails(true);
      const [allTxs, allExps] = await Promise.all([
        transactionsAPI.getAll(),
        expensesAPI.getAll()
      ]);
      const filteredTxs = filterByPeriod(allTxs, 'timestamp');
      const filteredExps = filterByPeriod(allExps, 'date');
      
      const revenue = filteredTxs.reduce((sum, t) => sum + t.grand_total, 0);
      const profit = filteredTxs.reduce((sum, t) => sum + t.profit, 0);
      const expenses = filteredExps.reduce((sum, e) => sum + e.amount, 0);
      
      setLedgerData({
        revenue,
        profit,
        expenses,
        net: profit - expenses
      });
      setShowLedgerModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading && !kpis) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getPeriodLabel = () => {
    if (period === 'today') return "Today's";
    if (period === 'week') return "This Week's";
    if (period === 'month') return "This Month's";
    return "All-Time";
  };
  
  const getPeriodDescSuffix = () => {
    if (period === 'today') return "today";
    if (period === 'week') return "this week";
    if (period === 'month') return "this month";
    return "all time";
  };

  const kpiCards = [
    { 
      name: `${getPeriodLabel()} Revenue`, 
      value: fmt(kpis?.today_revenue), 
      icon: Coins, 
      color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400', 
      desc: `Total billing sales ${getPeriodDescSuffix()} (Click to view bills)`,
      handler: handleTodayTxsClick
    },
    { 
      name: `${getPeriodLabel()} Profit`, 
      value: fmt(kpis?.today_profit), 
      icon: TrendingUp, 
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400', 
      desc: `Net item margin ${getPeriodDescSuffix()} (Click to view ledger)`,
      handler: handleTodayLedgerClick
    },
    { 
      name: `Logged Expenses (${period === 'all' ? 'All-Time' : period})`, 
      value: fmt(kpis?.today_expenses), 
      icon: TrendingDown, 
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-450', 
      desc: `Operational costs ${getPeriodDescSuffix()} (Click to view expenses)`,
      handler: handleTodayExpensesClick
    },
    { 
      name: `Net Profit (${period === 'all' ? 'All-Time' : period})`, 
      value: fmt(kpis?.net_profit), 
      icon: DollarSign, 
      color: kpis?.net_profit >= 0 ? 'text-teal-600 bg-teal-50 dark:bg-teal-950/50 dark:text-teal-400' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-400', 
      desc: `Gross profit minus expenses ${getPeriodDescSuffix()} (Click to view ledger)`,
      handler: handleTodayLedgerClick
    },
    { 
      name: "Inventory Valuation", 
      value: fmt(kpis?.inventory_value), 
      icon: Package, 
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400', 
      desc: "Selling value of catalog" 
    },
    { 
      name: "Current Stock Cost", 
      value: fmt(kpis?.current_stock_value), 
      icon: Layers, 
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400', 
      desc: "Acquisition value of stock" 
    },
    { 
      name: "Expected Profit", 
      value: fmt(kpis?.potential_profit), 
      icon: ArrowUpRight, 
      color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/50 dark:text-violet-400', 
      desc: "Margin of remaining stock" 
    },
    { 
      name: `Bills Issued (${period === 'all' ? 'All-Time' : period})`, 
      value: kpis?.bills_today || 0, 
      icon: Receipt, 
      color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-400', 
      desc: `Invoices logged ${getPeriodDescSuffix()} (Click to view bills)`,
      handler: handleTodayTxsClick
    },
    { 
      name: `Items Sold (${period === 'all' ? 'All-Time' : period})`, 
      value: kpis?.items_sold || 0, 
      icon: ShoppingBag, 
      color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/50 dark:text-pink-400', 
      desc: `Total quantity scanned ${getPeriodDescSuffix()} (Click to view bills)`,
      handler: handleTodayTxsClick
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Real-time store overview, performance summaries, and AI projections.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 md:mt-0">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border dark:border-slate-800">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'all', label: 'All-Time' },
              { id: 'custom', label: 'Custom Range' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="flex items-center gap-2 animate-fade-in">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
              <span className="text-slate-400 text-xs font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200"
              />
            </div>
          )}

          <button
            onClick={handlePrintReport}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-600/10 transition-all transform active:scale-95"
          >
            <FileText size={14} />
            <span>Print PDF Report</span>
          </button>
        </div>
        {loadingDetails && (
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold bg-indigo-50 dark:bg-indigo-950/30 px-3 py-1.5 rounded-full">
            <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Fetching details...</span>
          </div>
        )}
      </div>

      {/* Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700 text-white p-6 md:p-8 shadow-xl shadow-indigo-600/10">
        {/* Decorative background glows */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-xl text-center md:text-left">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold backdrop-blur-md">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              Live store system operational
            </span>
            <h2 className="text-3xl font-extrabold tracking-tight font-title md:text-4xl">
              Welcome back, {user?.role === 'admin' ? 'Owner' : user?.username || 'Owner'}!
            </h2>
            <p className="text-indigo-100 text-sm leading-relaxed max-w-md">
              Here is your departmental store status overview. Check inventory alerts, review transaction ledgers, or browse recent AI insights.
            </p>
          </div>
          <div className="shrink-0 hidden md:block">
            <img 
              src="/assets/dashboard_welcome.jpg" 
              alt="Welcome Illustration" 
              className="h-32 lg:h-36 object-contain rounded-2xl shadow-lg border border-white/10 aspect-[3/2] object-cover"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          const isClickable = !!card.handler;
          return (
            <div 
              key={idx} 
              onClick={card.handler || undefined}
              className={`p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 shadow-sm transition-all duration-305 ${
                isClickable 
                  ? 'cursor-pointer hover:-translate-y-1 hover:border-indigo-400 hover:shadow-md' 
                  : ''
              } glow-card-indigo`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {card.name}
                  </span>
                  <h3 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {card.value}
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-none">
                    {card.desc}
                  </p>
                </div>
                <div className={`p-3 rounded-2xl ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Speed Insights (Turnover rates) */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
        <button 
          onClick={() => handleProductClick(kpis?.best_seller)}
          disabled={!kpis?.best_seller || kpis?.best_seller === 'N/A'}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 text-center shadow-sm cursor-pointer hover:border-indigo-400 hover:scale-[1.02] transition-all"
        >
          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">BEST SELLING PRODUCT</span>
          <span className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400 block truncate">{kpis?.best_seller || 'N/A'}</span>
          <span className="text-[9px] text-slate-400 block mt-1">Click to view sales logs</span>
        </button>

        <button 
          onClick={() => handleProductClick(kpis?.fast_moving)}
          disabled={!kpis?.fast_moving || kpis?.fast_moving === 'N/A'}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 text-center shadow-sm cursor-pointer hover:border-emerald-400 hover:scale-[1.02] transition-all"
        >
          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">FAST MOVING PRODUCT</span>
          <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 block truncate">{kpis?.fast_moving || 'N/A'}</span>
          <span className="text-[9px] text-slate-400 block mt-1">Click to view sales logs</span>
        </button>

        <button 
          onClick={() => handleProductClick(kpis?.slow_moving)}
          disabled={!kpis?.slow_moving || kpis?.slow_moving === 'N/A'}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 text-center shadow-sm cursor-pointer hover:border-amber-400 hover:scale-[1.02] transition-all"
        >
          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">SLOW MOVING PRODUCT</span>
          <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 block truncate">{kpis?.slow_moving || 'N/A'}</span>
          <span className="text-[9px] text-slate-400 block mt-1">Click to view sales logs</span>
        </button>

        <button 
          onClick={handleDeadStockClick}
          className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 text-center shadow-sm cursor-pointer hover:border-rose-400 hover:scale-[1.02] transition-all"
        >
          <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">DEAD STOCK COUNT</span>
          <span className="text-sm font-extrabold text-rose-600 dark:text-rose-400 block">{kpis?.dead_stock_count || 0} items</span>
          <span className="text-[9px] text-slate-400 block mt-1">Click to view idle stock</span>
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Sales Trend Chart */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 lg:col-span-2 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-md font-bold font-title text-slate-955 dark:text-white">Revenue & Profit Trend (Last 30 Days)</h3>
            <span className="text-xs text-indigo-500 font-semibold">Live values</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="profit" name="Net Margin" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Share Pie Chart */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-md font-bold font-title text-slate-950 dark:text-white">Category Sales Breakdown</h3>
          </div>
          <div className="h-80">
            {categoryShare.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-500 dark:text-slate-400 text-xs">No sales logged in categories</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryShare}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryShare.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} formatter={(value) => fmt(value)} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations & Recent Activity Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* AI Insights Recommendations */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex flex-col shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg dark:bg-indigo-950/40 dark:text-indigo-400 animate-pulse">
              <Sparkles size={16} />
            </div>
            <h3 className="text-md font-bold font-title text-slate-950 dark:text-white">Smart Store Ai Insights</h3>
          </div>
          
          <div className="flex-1 space-y-4">
            {recommendations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400 text-xs">
                <Sparkles size={24} className="mb-2 text-indigo-400 animate-pulse" />
                <span>Running ML catalog checks...</span>
              </div>
            ) : (
              recommendations.slice(0, 3).map((rec) => (
                <div 
                  key={rec.id} 
                  className="flex gap-3 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/20 dark:border-indigo-950/30"
                >
                  <div className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                    {rec.type === 'Stockout Warning' ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div>
                    <span className="block text-xs font-extrabold text-indigo-900 dark:text-indigo-300">{rec.type}</span>
                    <p className="text-xs text-slate-700 dark:text-slate-350 mt-1 leading-snug">{rec.suggestion}</p>
                    <span className="inline-block text-[9px] font-bold text-indigo-700 dark:text-indigo-400 mt-2 bg-indigo-50/80 dark:bg-indigo-950/60 px-2 py-0.5 rounded">
                      Confidence: {Math.round(rec.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity Panel */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 flex flex-col shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 bg-slate-50 text-slate-600 rounded-lg dark:bg-slate-900 dark:text-slate-400">
              <Activity size={16} />
            </div>
            <h3 className="text-md font-bold font-title text-slate-955 dark:text-white">Recent System Events</h3>
          </div>
          
          <div className="flex-1 space-y-4 max-h-[300px] overflow-y-auto pr-2">
            {activity.length === 0 ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-xs">No recent events logged</div>
            ) : (
              activity.map((act, index) => {
                const Icon = {
                  invoice: FileText,
                  stock: Package,
                  expense: DollarSign,
                  backup: Database
                }[act.type] || Activity;
                
                const iconColor = {
                  invoice: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400',
                  stock: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400',
                  expense: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-405',
                  backup: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400'
                }[act.type] || 'text-slate-600 bg-slate-50';

                return (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 dark:border-slate-800/50">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${iconColor}`}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{act.description}</span>
                        <span className="block text-[10px] text-slate-500 dark:text-slate-450 mt-0.5">{act.time}</span>
                      </div>
                    </div>
                    {act.amount !== null && (
                      <span className={`text-xs font-mono font-extrabold ${act.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-850 dark:text-slate-150'}`}>
                        {act.type === 'expense' ? '-' : ''}{fmt(act.amount)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 1. Modal: Product History Ledger */}
      {showHistoryModal && historyProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-800 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <div>
                <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">Sales & Stock Audit Ledger</h3>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">{historyProduct.name} ({historyProduct.brand || 'Generic'})</span>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-900">
                  <span className="block text-[9px] text-slate-400 uppercase font-bold">In Stock</span>
                  <span className="text-base font-extrabold">{historyProduct.current_stock}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-900">
                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Selling Price</span>
                  <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">{fmt(historyProduct.selling_price)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-900">
                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Buying Price</span>
                  <span className="text-base font-extrabold">{fmt(historyProduct.buying_price)}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border dark:border-slate-900">
                  <span className="block text-[9px] text-slate-400 uppercase font-bold">Expected Margin</span>
                  <span className="text-base font-extrabold text-emerald-600">+{fmt(historyProduct.selling_price - historyProduct.buying_price)}</span>
                </div>
              </div>

              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Chronological Stock Logs</h4>
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b dark:border-slate-900 text-slate-500 uppercase text-[10px] tracking-wider">
                    <th className="py-2">Time</th>
                    <th className="py-2">Event</th>
                    <th className="py-2 text-right">Adjustment</th>
                    <th className="py-2 text-right">Stock Level</th>
                    <th className="py-2 pl-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900 font-semibold">
                  {productHistoryList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">No stock ledger entries recorded.</td>
                    </tr>
                  ) : (
                    productHistoryList.map((hist) => {
                      const adjustColor = hist.quantity_change > 0 ? 'text-emerald-600' : hist.quantity_change < 0 ? 'text-rose-600' : 'text-slate-500';
                      const eventBg = {
                        Sold: 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-450',
                        Purchased: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450',
                        Adjusted: 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-450',
                        Created: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-450'
                      }[hist.event] || 'bg-slate-50 text-slate-600';

                      return (
                        <tr key={hist.id}>
                          <td className="py-2.5 text-[10px] text-slate-500">
                            {new Date(hist.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${eventBg}`}>
                              {hist.event}
                            </span>
                          </td>
                          <td className={`py-2.5 text-right font-bold ${adjustColor}`}>
                            {hist.quantity_change > 0 ? '+' : ''}{hist.quantity_change}
                          </td>
                          <td className="py-2.5 text-right font-mono">{hist.stock_after}</td>
                          <td className="py-2.5 pl-4 text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-[200px]">
                            {hist.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <button onClick={() => setShowHistoryModal(false)} className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                Close Audit Logs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Dead Stock Capital tied-up list */}
      {showDeadStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-800 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <div>
                <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">Dead Stock Inventory Analysis</h3>
                <p className="text-xs text-slate-500">Products currently carrying stock with 0 sales in the last 30 days.</p>
              </div>
              <button onClick={() => setShowDeadStockModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
              <div className="bg-rose-50/50 border border-rose-100/10 dark:bg-rose-950/10 dark:border-rose-950/20 p-4 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="text-rose-500 shrink-0" size={24} />
                <div>
                  <span className="block text-xs font-bold text-rose-955 dark:text-rose-350">Tied-Up Capital Warning</span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    Currently, <strong>{deadStockList.length} items</strong> are holding up capital with zero sales conversions. We recommend clearance discounting or bundling.
                  </p>
                </div>
              </div>

              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b dark:border-slate-900 text-slate-500 uppercase text-[10px] tracking-wider">
                    <th className="py-2">Product Name</th>
                    <th className="py-2 text-right">Units Stocked</th>
                    <th className="py-2 text-right">Buying price</th>
                    <th className="py-2 text-right">Tied Capital</th>
                    <th className="py-2 pl-6">AI Recommendation Suggestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900 font-semibold text-slate-850 dark:text-slate-150">
                  {deadStockList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">Excellent! Zero dead stock items identified.</td>
                    </tr>
                  ) : (
                    deadStockList.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3">
                          <span className="block font-bold">{prod.name}</span>
                          <span className="block text-[9px] text-slate-400">{prod.brand || 'Generic'}</span>
                        </td>
                        <td className="py-3 text-right font-mono">{prod.current_stock}</td>
                        <td className="py-3 text-right font-mono">{fmt(prod.buying_price)}</td>
                        <td className="py-3 text-right font-mono text-rose-600 dark:text-rose-450 font-extrabold">
                          {fmt(prod.current_stock * prod.buying_price)}
                        </td>
                        <td className="py-3 pl-6 text-slate-500 dark:text-slate-400 text-[10px] leading-relaxed max-w-[250px]">
                          {prod.suggestion}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <button onClick={() => setShowDeadStockModal(false)} className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                Close dead stock analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Today's Bills / Transactions List */}
      {showTxsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-3xl p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-800 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <div>
                <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">Today's Issued Bills</h3>
                <p className="text-xs text-slate-500">Chronological transaction logs generated in the system today.</p>
              </div>
              <button onClick={() => setShowTxsModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b dark:border-slate-900 text-slate-500 uppercase text-[10px] tracking-wider">
                    <th className="py-2">Time</th>
                    <th className="py-2">Invoice No</th>
                    <th className="py-2">Customer Details</th>
                    <th className="py-2">Payment Method</th>
                    <th className="py-2 text-right">Items</th>
                    <th className="py-2 text-right">Total amount</th>
                    <th className="py-2 text-right">Margin profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900 font-semibold text-slate-850 dark:text-slate-150">
                  {txsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">No bills generated today yet.</td>
                    </tr>
                  ) : (
                    txsList.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-3 text-[10px] text-slate-500">
                          {new Date(tx.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{tx.invoice_number}</td>
                        <td className="py-3">
                          <span className="block font-bold">{tx.customer_name || 'Generic Customer'}</span>
                          {tx.customer_phone && <span className="block text-[8px] text-slate-450">{tx.customer_phone}</span>}
                        </td>
                        <td className="py-3 uppercase text-[10px] tracking-wide font-bold">{tx.payment_method}</td>
                        <td className="py-3 text-right font-mono">{tx.items_count}</td>
                        <td className="py-3 text-right font-mono font-bold">{fmt(tx.grand_total)}</td>
                        <td className="py-3 text-right font-mono text-emerald-600 font-bold">{fmt(tx.profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <button onClick={() => setShowTxsModal(false)} className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                Close Transaction List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Today's Expenses List */}
      {showExpensesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-2xl p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-955 dark:border-slate-800 max-h-[85vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <div>
                <h3 className="text-lg font-bold font-title text-slate-900 dark:text-white">Today's Logged Expenses</h3>
                <p className="text-xs text-slate-500">Detailed list of operational overheads compiled today.</p>
              </div>
              <button onClick={() => setShowExpensesModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b dark:border-slate-900 text-slate-500 uppercase text-[10px] tracking-wider">
                    <th className="py-2">Description</th>
                    <th className="py-2">Expense Category</th>
                    <th className="py-2">Logged By</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-900 font-semibold text-slate-850 dark:text-slate-150">
                  {expensesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-400">No operational expenses recorded today.</td>
                    </tr>
                  ) : (
                    expensesList.map((exp) => (
                      <tr key={exp.id}>
                        <td className="py-3 font-bold">{exp.description}</td>
                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-455">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500">{exp.created_by || 'Admin'}</td>
                        <td className="py-3 text-right font-mono font-extrabold text-rose-600 dark:text-rose-450">
                          -{fmt(exp.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <button onClick={() => setShowExpensesModal(false)} className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">
                Close Expense List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Today's Profit & Loss Ledger */}
      {showLedgerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border shadow-2xl dark:bg-slate-950 dark:border-slate-800">
            <div className="flex items-center justify-between border-b pb-3 mb-4 dark:border-slate-850">
              <h3 className="text-md font-bold font-title text-slate-900 dark:text-white">Daily Profit & Loss Ledger</h3>
              <button onClick={() => setShowLedgerModal(false)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 mt-2">
              <div className="flex justify-between items-center py-2.5 border-b dark:border-slate-900 text-xs">
                <span className="text-slate-500 font-bold">TOTAL REVENUE (SALES)</span>
                <span className="font-mono font-extrabold text-slate-900 dark:text-white">{fmt(ledgerData.revenue)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b dark:border-slate-900 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1">
                  <ArrowUpRight size={14} className="text-emerald-500" /> COGS MARGIN PROFIT
                </span>
                <span className="font-mono font-extrabold text-emerald-600">+{fmt(ledgerData.profit)}</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b dark:border-slate-900 text-xs">
                <span className="text-slate-500 font-bold flex items-center gap-1">
                  <ArrowDownRight size={14} className="text-rose-500" /> OPERATIONAL EXPENSES
                </span>
                <span className="font-mono font-extrabold text-rose-600">-{fmt(ledgerData.expenses)}</span>
              </div>
              <div className="flex justify-between items-center py-3.5 bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl border dark:border-slate-850 text-sm">
                <span className="font-black text-slate-950 dark:text-white">NET PROFIT (TAKE HOME)</span>
                <span className={`font-mono font-black text-base ${ledgerData.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {ledgerData.net >= 0 ? '+' : ''}{fmt(ledgerData.net)}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowLedgerModal(false)} className="w-full py-2.5 rounded-xl border text-xs font-bold hover:bg-slate-50 dark:border-slate-850">
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setShowLedgerModal(false);
                  await handleTodayTxsClick();
                }} 
                className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow-md hover:bg-indigo-500"
              >
                Inspect Sales <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
