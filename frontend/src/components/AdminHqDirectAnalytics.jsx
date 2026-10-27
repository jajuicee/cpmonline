import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
    DollarSign, TrendingUp, ShoppingCart, RefreshCw, Calendar,
    Package, Layers, Trophy, CreditCard, AlertCircle, ArrowUpRight,
    Store, Sparkles
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];

const AdminHqDirectAnalytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get('/api/admin/analytics/hq-direct');
            setData(res.data);
        } catch (err) {
            console.error('Failed to load HQ direct analytics:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch HQ direct analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const summary = data?.summary || {
        totalRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        marginPct: 0,
        unitsSold: 0
    };

    const paymentMethodsList = data?.paymentMethods
        ? Object.entries(data.paymentMethods).map(([name, value]) => ({ name, value: Number(value) }))
        : [];

    const topProducts = data?.topProducts || [];
    const trend = data?.trend || [];

    return (
        <div className="flex flex-col space-y-6 w-full animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                        <ShoppingCart size={15} />
                        <span>Central HQ Direct Operations</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-1 flex items-center gap-2.5">
                        <TrendingUp className="text-emerald-600" size={26} />
                        HQ Direct Retail Sales Analytics
                    </h2>
                    <p className="text-xs text-stone-500 font-medium mt-1 max-w-3xl leading-relaxed">
                        Performance analytics for paddle gear and equipment sold directly to walk-ins, online clients, and tournament buyers 
                        deducted strictly from your <span className="font-bold text-stone-700">Central Master Inventory (Holding Pool)</span>.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                        title="Reload latest data"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-bold">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* ─── Top 4 Direct KPIs ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Direct Retail Revenue */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-xs font-black uppercase tracking-wider">Gross Direct Revenue</span>
                        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                            <DollarSign size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-stone-900 font-mono tracking-tight">
                            {loading ? '...' : formatCurrency(summary.totalRevenue)}
                        </div>
                        <p className="text-[11px] text-stone-400 font-bold mt-1">
                            {summary.unitsSold?.toLocaleString()} units sold directly
                        </p>
                    </div>
                </div>

                {/* 2. Direct COGS */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-xs font-black uppercase tracking-wider">Direct Cost of Goods</span>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <Layers size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-stone-900 font-mono tracking-tight">
                            {loading ? '...' : formatCurrency(summary.totalCost)}
                        </div>
                        <p className="text-[11px] text-stone-400 font-bold mt-1">
                            Supplier acquisition cost of sold units
                        </p>
                    </div>
                </div>

                {/* 3. Direct Retail Profit */}
                <div className="bg-gradient-to-br from-emerald-900 to-stone-950 text-white rounded-2xl p-5 shadow-md flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-emerald-200">
                        <span className="text-xs font-black uppercase tracking-wider text-emerald-300">Direct Retail Profit</span>
                        <div className="p-2 rounded-xl bg-emerald-800/80 text-emerald-300">
                            <TrendingUp size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                            {loading ? '...' : `+${formatCurrency(summary.grossProfit)}`}
                        </div>
                        <p className="text-[11px] text-emerald-200/80 font-bold mt-1">
                            Direct Selling Price − Admin Cost
                        </p>
                    </div>
                </div>

                {/* 4. Retail Margin % */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-xs font-black uppercase tracking-wider">Direct Margin %</span>
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Sparkles size={18} />
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-2xl font-black text-teal-700 font-mono tracking-tight">
                            {loading ? '...' : `${Number(summary.marginPct || 0).toFixed(1)}%`}
                        </div>
                        <p className="text-[11px] text-stone-400 font-bold mt-1">
                            Average direct markup margin
                        </p>
                    </div>
                </div>
            </div>

            {/* Visual Charts: Direct Revenue Timeline & Payment Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Timeline */}
                <div className="lg:col-span-2 bg-white border border-stone-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-1">
                        <TrendingUp size={16} className="text-emerald-600" />
                        HQ Direct Sales Daily Trend
                    </h3>
                    <p className="text-xs text-stone-400 mb-4">Daily gross direct customer sales</p>

                    {loading ? (
                        <div className="h-60 flex items-center justify-center text-stone-400"><RefreshCw size={24} className="animate-spin" /></div>
                    ) : trend.length === 0 ? (
                        <div className="h-60 flex flex-col items-center justify-center text-stone-400 text-center">
                            <Package size={32} className="opacity-20 mb-2" />
                            <p className="text-xs font-bold">No direct sales transactions recorded yet.</p>
                        </div>
                    ) : (
                        <div className="h-60 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="hqGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(val) => `₱${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`} />
                                    <RechartsTooltip formatter={(val) => [formatCurrency(val), 'Revenue']} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                    <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#hqGrad)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Direct Payment Methods Donut */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
                    <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-1">
                        <CreditCard size={16} className="text-indigo-600" />
                        Direct Payment Channels
                    </h3>
                    <p className="text-xs text-stone-400 mb-4">Channels used by direct buyers</p>

                    {paymentMethodsList.length === 0 && !loading ? (
                        <div className="h-60 flex flex-col items-center justify-center text-stone-400 text-center">
                            <CreditCard size={32} className="opacity-20 mb-2" />
                            <p className="text-xs font-bold">No payments recorded yet.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-between flex-1">
                            <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={paymentMethodsList} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3}>
                                            {paymentMethodsList.map((entry, idx) => (
                                                <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(val) => formatCurrency(val)} contentStyle={{ borderRadius: '10px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-full space-y-1.5 mt-2">
                                {paymentMethodsList.map((pm, idx) => (
                                    <div key={pm.name} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                                            <span className="font-bold text-stone-700">{pm.name}</span>
                                        </div>
                                        <span className="font-mono font-bold text-stone-900">{formatCurrency(pm.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Products Table for HQ Direct */}
            <div className="bg-white border border-stone-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500" />
                            Top Selling Products in HQ Direct Sales
                        </h3>
                        <p className="text-xs text-stone-400 mt-0.5">Paddle gear sold directly from Central Master Storage</p>
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-stone-400 uppercase tracking-wider text-[10px] font-black">
                                <th className="p-3.5 pl-5">Product Name</th>
                                <th className="p-3.5">SKU</th>
                                <th className="p-3.5 text-center">Units Sold</th>
                                <th className="p-3.5 text-right">Direct Revenue</th>
                                <th className="p-3.5 text-right font-black text-emerald-800 pr-5">Retail Profit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {topProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center py-10 text-stone-400 font-bold">
                                        No product sales recorded in HQ direct mode yet.
                                    </td>
                                </tr>
                            ) : (
                                topProducts.map((p, idx) => (
                                    <tr key={p.sku} className="hover:bg-stone-50/80 transition-colors">
                                        <td className="p-3.5 pl-5 font-bold text-stone-900 flex items-center gap-2">
                                            <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center text-[10px] font-black">
                                                {idx + 1}
                                            </span>
                                            <span>{p.name}</span>
                                        </td>
                                        <td className="p-3.5 font-mono text-stone-400">{p.sku}</td>
                                        <td className="p-3.5 text-center font-bold text-stone-800">{p.units} units</td>
                                        <td className="p-3.5 text-right font-mono font-bold text-stone-900">{formatCurrency(p.revenue)}</td>
                                        <td className="p-3.5 text-right font-mono font-black text-emerald-700 pr-5">+{formatCurrency(p.profit)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminHqDirectAnalytics;
