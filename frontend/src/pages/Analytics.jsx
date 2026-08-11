import React, { useState, useEffect } from 'react';
import { analyticsAPI, aiAPI, productsAPI } from '../services/api';
import { 
  BarChart3, Sparkles, TrendingUp, Calendar, 
  Clock, Package2, ShieldAlert, BadgeAlert, AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, BarChart, 
  Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, 
  Legend, CartesianGrid 
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

const Analytics = () => {
  const [trends, setTrends] = useState([]);
  const [period, setPeriod] = useState('month'); // week, month, year
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [categoryShare, setCategoryShare] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  
  // AI Recommendations
  const [recommendations, setRecommendations] = useState([]);
  
  // AI Forecast states
  const [productsList, setProductsList] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [forecastResult, setForecastResult] = useState(null);
  
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [trendRes, payRes, catRes, heatRes, recsRes, productsRes] = await Promise.all([
        analyticsAPI.getTrends(period),
        analyticsAPI.getPaymentMethods(),
        analyticsAPI.getCategoryShare(),
        analyticsAPI.getHourlyHeatmap(),
        aiAPI.getRecommendations(),
        productsAPI.getAll()
      ]);
      
      setTrends(trendRes);
      setPaymentMethods(payRes);
      setCategoryShare(catRes);
      setHeatmapData(heatRes);
      setRecommendations(recsRes);
      setProductsList(productsRes);
      
      // Auto select first product for forecast if none selected
      if (productsRes.length > 0 && !selectedProductId) {
        setSelectedProductId(productsRes[0].id.toString());
      }
    } catch (err) {
      console.error('Analytics load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  // Handle product forecast query
  useEffect(() => {
    if (selectedProductId) {
      aiAPI.getForecast(selectedProductId)
        .then(setForecastResult)
        .catch(console.error);
    }
  }, [selectedProductId]);

  const handleTriggerRecompute = async () => {
    try {
      setLoading(true);
      await aiAPI.trigger();
      const recs = await aiAPI.getRecommendations();
      setRecommendations(recs);
      if (selectedProductId) {
        const fc = await aiAPI.getForecast(selectedProductId);
        setForecastResult(fc);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Heatmap helper: calculate background opacity based on relative hourly sales
  const getMaxBills = () => Math.max(...heatmapData.map(h => h.bills), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-title">Business Analytics & AI</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Predict product-level demand, evaluate traffic heatmaps, and action reorder warnings.</p>
        </div>
        <button 
          onClick={handleTriggerRecompute}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg"
        >
          <Sparkles size={14} /> Recompute AI Insights
        </button>
      </div>

      {/* Grid 1: Trends Selector & Primary Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <h3 className="text-md font-bold font-title flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-600" /> Sales & Profit Projections
            </h3>
            {/* Range Toggle */}
            <div className="flex p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl text-xs font-bold self-start">
              <button 
                onClick={() => setPeriod('week')}
                className={`px-3 py-1.5 rounded-lg ${period === 'week' ? 'bg-white shadow dark:bg-slate-800' : 'text-slate-500'}`}
              >
                7 Days
              </button>
              <button 
                onClick={() => setPeriod('month')}
                className={`px-3 py-1.5 rounded-lg ${period === 'month' ? 'bg-white shadow dark:bg-slate-800' : 'text-slate-500'}`}
              >
                30 Days
              </button>
              <button 
                onClick={() => setPeriod('year')}
                className={`px-3 py-1.5 rounded-lg ${period === 'year' ? 'bg-white shadow dark:bg-slate-800' : 'text-slate-500'}`}
              >
                12 Months
              </button>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={9} />
                <YAxis stroke="#94a3b8" fontSize={9} />
                <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                <Legend verticalAlign="top" height={32} iconType="circle" />
                <Line type="monotone" dataKey="revenue" name="Sales Revenue" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="profit" name="Net Margin" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods share */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel">
          <h3 className="text-md font-bold font-title mb-6 flex items-center gap-2">
            <Clock size={16} className="text-indigo-600" /> Payment Distribution
          </h3>
          <div className="h-72">
            {paymentMethods.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400 text-xs">No payment splits recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentMethods.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={8} wrapperStyle={{ fontSize: '9px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Grid 2: Hourly Sales Traffic Heatmap */}
      <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel">
        <h3 className="text-md font-bold font-title mb-4 flex items-center gap-2">
          <Clock size={16} className="text-indigo-600" /> Hourly Customer Traffic Heatmap
        </h3>
        <p className="text-xs text-slate-500 mb-6">Analyze peak store shopping hours. Darker cells represent slots with high sales volume.</p>
        
        {/* Heatmap Grid layout */}
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 text-center text-xs">
          {heatmapData.map((h) => {
            const opacity = h.bills / getMaxBills();
            const intensity = Math.max(0.05, opacity); // Min opacity for visible cells
            return (
              <div 
                key={h.hour}
                style={{ backgroundColor: `rgba(99, 102, 241, ${intensity})` }}
                className={`p-3 rounded-xl border border-indigo-100/10 flex flex-col justify-center items-center h-20 transition-all duration-300 hover:scale-105
                  ${intensity > 0.45 ? 'text-white' : 'text-slate-800 dark:text-slate-200'}
                `}
                title={`${h.bills} bills generated, ₹${h.revenue.toFixed(2)} sales`}
              >
                <span className="block font-bold text-[10px]">{h.hour}</span>
                <span className="block text-xs font-extrabold mt-1">{h.bills}</span>
                <span className="block text-[8px] opacity-75 mt-0.5">bills</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid 3: AI recommendations & Demand Forecasting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* AI Recommendations List */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel flex flex-col h-[400px]">
          <h3 className="text-md font-bold font-title mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-600" /> Actionable Recommendations
          </h3>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {recommendations.length === 0 ? (
              <div className="text-center text-slate-400 text-xs py-12">No ML recommendations generated yet</div>
            ) : (
              recommendations.map((rec) => {
                const Icon = rec.type === 'Stockout Warning' ? ShieldAlert : BadgeAlert;
                const iconColor = rec.type === 'Stockout Warning' ? 'text-rose-500' : 'text-amber-500';
                return (
                  <div key={rec.id} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-900 flex gap-3">
                    <Icon size={16} className={`${iconColor} shrink-0 mt-0.5`} />
                    <div className="space-y-1">
                      <span className="block font-bold text-[11px] uppercase tracking-wider text-slate-400">{rec.type}</span>
                      <p className="text-xs leading-relaxed">{rec.suggestion}</p>
                      <span className="inline-block text-[9px] text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/40 px-2 py-0.5 rounded font-bold">
                        Confidence: {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* AI 7-day Demand Forecasting */}
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-slate-800 glass-panel lg:col-span-2 flex flex-col h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-md font-bold font-title flex items-center gap-2">
              <Package2 size={16} className="text-indigo-600" /> Scikit-learn Demand Forecast (7 Days)
            </h3>
            
            {/* Product Selector */}
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border text-xs bg-slate-50 dark:border-slate-800 dark:bg-slate-900 max-w-xs"
            >
              <option value="">Select product to predict...</option>
              {productsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            {forecastResult ? (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecastResult.forecast}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="day_name" stroke="#94a3b8" fontSize={9} />
                      <YAxis stroke="#94a3b8" fontSize={9} />
                      <Tooltip contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '11px' }} />
                      <Bar dataKey="quantity" name="Predicted Demand" fill="#6366f1" radius={[8, 8, 0, 0]}>
                        {forecastResult.forecast.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.quantity > 5 ? '#4f46e5' : '#818cf8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100/30 dark:bg-indigo-950/10 dark:border-indigo-950/30 text-[10px]">
                  <Sparkles size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-slate-500">
                    Engine: <strong className="text-indigo-600 dark:text-indigo-400">{forecastResult.method}</strong>. 
                    Calculates predicted quantities for the upcoming week based on daily lags, weekday indicators, and month seasonality factors.
                  </span>
                </div>
              </>
            ) : (
              <div className="flex-grow flex items-center justify-center text-slate-400 text-xs">
                Select a product to view AI demand predictions.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
