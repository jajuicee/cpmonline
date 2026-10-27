import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
    DollarSign, TrendingUp, Boxes, Building2, Store, CreditCard,
    AlertCircle, RefreshCw, Calendar, Search, ArrowUpRight, CheckCircle2,
    Clock, Check, Filter, Layers, ArrowRight, ShieldCheck, ChevronDown
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIME_PRESETS = [
    { id: '7D', label: 'Last 7 Days', days: 7 },
    { id: '30D', label: 'Last 30 Days', days: 30 },
    { id: '90D', label: 'Last 90 Days', days: 90 },
    { id: 'ALL', label: 'All Time', days: null }
];

const AdminBatchProfitAnalytics = ({ branches = [], onSwitchMode }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedBranch, setSelectedBranch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [timePreset, setTimePreset] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const params = {};
            if (selectedBranch) params.branchId = selectedBranch;
            if (statusFilter !== 'ALL') params.status = statusFilter;

            if (timePreset !== 'ALL') {
                const presetObj = TIME_PRESETS.find(p => p.id === timePreset);
                if (presetObj && presetObj.days) {
                    const fromDate = new Date();
                    fromDate.setDate(fromDate.getDate() - presetObj.days);
                    fromDate.setHours(0, 0, 0, 0);
                    const toDate = new Date();
                    toDate.setHours(23, 59, 59, 999);
                    params.from = fromDate.toISOString().slice(0, 19);
                    params.to = toDate.toISOString().slice(0, 19);
                }
            }

            const res = await axios.get('/api/admin/allocations/batch-profit', { params });
            setData(res.data);
        } catch (err) {
            console.error('Failed to load batch profit analytics:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch batch profit analysis.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedBranch, statusFilter, timePreset]);

    const summary = data?.summary || {
        totalAllocatedUnits: 0,
        totalBilledRevenue: 0,
        totalAdminCost: 0,
        totalGrossProfit: 0,
        averageMarginPct: 0,
        totalAmountPaid: 0,
        totalOutstanding: 0,
        totalBatchesCount: 0,
        paidCount: 0,
        partialCount: 0,
        pendingCount: 0
    };

    const branchesBreakdown = data?.branchesBreakdown || [];
    const timeline = data?.timeline || [];
    const batches = data?.batches || [];

    // Filtered batches table
    const filteredBatches = useMemo(() => {
        if (!searchQuery.trim()) return batches;
        const q = searchQuery.toLowerCase();
        return batches.filter(b =>
            (b.adminBatchId || '').toLowerCase().includes(q) ||
            (b.sku || '').toLowerCase().includes(q) ||
            (b.brandName || '').toLowerCase().includes(q) ||
            (b.modelName || '').toLowerCase().includes(q) ||
            (b.branchName || '').toLowerCase().includes(q)
        );
    }, [batches, searchQuery]);

    return (
        <div className="flex flex-col space-y-6 w-full animate-fadeIn">
            {/* Header / Subtitle & Quick Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700">
                        <Store size={15} />
                        <span>Central Wholesale Hub (B2B Multi-Branch)</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-1 flex items-center gap-2.5">
                        <DollarSign className="text-emerald-600" size={26} />
                        Wholesale Batch Profit & P&L Analysis
                    </h2>
                    <p className="text-xs text-stone-500 font-medium mt-1 max-w-3xl leading-relaxed">
                        Track your wholesale margin spread across every paddle batch pushed to branches. 
                        Calculated from your <span className="font-bold text-stone-700">Admin Acquisition Cost</span> (e.g. ₱37.50) vs 
                        the <span className="font-bold text-stone-700">Branch Transfer Price</span> charged (e.g. ₱40.00 = +₱2.50 spread/unit).
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
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

            {/* Filter Controls Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50/80 border border-stone-200/80 rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Branch Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-3 py-1.5 rounded-lg shadow-2xs">
                        <Building2 size={13} className="text-stone-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Branch:</span>
                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="bg-transparent text-xs font-black text-stone-800 focus:outline-none cursor-pointer"
                        >
                            <option value="">Consolidated (All Branches)</option>
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>🏬 {b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-white border border-stone-200 px-3 py-1.5 rounded-lg shadow-2xs">
                        <CreditCard size={13} className="text-stone-400" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">Payment:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-transparent text-xs font-black text-stone-800 focus:outline-none cursor-pointer"
                        >
                            <option value="ALL">All Payment Statuses</option>
                            <option value="PAID">Paid in Full</option>
                            <option value="PARTIAL">Partially Paid</option>
                            <option value="PENDING">Pending / Unpaid</option>
                        </select>
                    </div>

                    {/* Time Range Preset */}
                    <div className="flex items-center gap-1 bg-stone-200/60 p-0.5 rounded-lg">
                        {TIME_PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setTimePreset(p.id)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                                    timePreset === p.id
                                        ? 'bg-white text-stone-900 shadow-2xs'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search SKU, paddle, branch…"
                        className="pl-7 pr-3 py-1.5 text-xs font-medium bg-white border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56 shadow-2xs"
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 text-xs font-bold">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* ─── Top 5 KPI Cards (Wholesale Financial Health) ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* 1. Billed Wholesale Revenue */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-stone-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">Total Billed to Branches</span>
                        <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-xl font-black text-stone-900 font-mono tracking-tight">
                            {loading ? '...' : formatCurrency(summary.totalBilledRevenue)}
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold mt-0.5">
                            {summary.totalAllocatedUnits.toLocaleString()} units allocated across {summary.totalBatchesCount} batches
                        </p>
                    </div>
                    <div className="w-full h-1 bg-indigo-500/20 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: '100%' }} />
                    </div>
                </div>

                {/* 2. Admin Acquisition Cost */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-stone-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">HQ Acquisition Cost</span>
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                            <Layers size={16} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-xl font-black text-stone-900 font-mono tracking-tight">
                            {loading ? '...' : formatCurrency(summary.totalAdminCost)}
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold mt-0.5">
                            Supplier cost paid by Central HQ
                        </p>
                    </div>
                    <div className="w-full h-1 bg-amber-500/20 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                </div>

                {/* 3. Admin Wholesale Gross Profit (THE SPREAD) */}
                <div className="bg-gradient-to-br from-emerald-900 to-stone-900 text-white rounded-2xl p-4 shadow-md flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between text-emerald-200">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-300">Wholesale Batch Profit</span>
                        <div className="p-1.5 rounded-lg bg-emerald-800/80 text-emerald-300">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="mt-2 relative z-10">
                        <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                            {loading ? '...' : `+${formatCurrency(summary.totalGrossProfit)}`}
                        </div>
                        <p className="text-[10px] text-emerald-200/80 font-bold mt-0.5">
                            Net spread earned from branch distribution
                        </p>
                    </div>
                    <div className="w-full h-1 bg-emerald-500/30 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(100, Math.max(5, summary.averageMarginPct))}%` }} />
                    </div>
                </div>

                {/* 4. Average Profit Margin % */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-stone-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">Wholesale Margin %</span>
                        <div className="p-1.5 rounded-lg bg-teal-50 text-teal-600">
                            <ShieldCheck size={16} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-xl font-black text-teal-700 font-mono tracking-tight">
                            {loading ? '...' : `${Number(summary.averageMarginPct || 0).toFixed(1)}%`}
                        </div>
                        <p className="text-[10px] text-stone-400 font-bold mt-0.5">
                            Spread / Billed Transfer Value
                        </p>
                    </div>
                    <div className="w-full h-1 bg-teal-500/20 rounded-full mt-3 overflow-hidden">
                        <div className="h-full bg-teal-600 rounded-full" style={{ width: `${Math.min(100, summary.averageMarginPct * 2)}%` }} />
                    </div>
                </div>

                {/* 5. Remittance & Receivables */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-4 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    <div className="flex items-center justify-between text-stone-500">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">Branch Remittances</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <CreditCard size={16} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-base font-black text-emerald-700 font-mono tracking-tight">
                            {loading ? '...' : formatCurrency(summary.totalAmountPaid)}
                            <span className="text-[10px] text-emerald-600 font-bold ml-1">Paid</span>
                        </div>
                        <div className="text-xs font-bold text-rose-600 font-mono mt-0.5">
                            {loading ? '...' : formatCurrency(summary.totalOutstanding)}
                            <span className="text-[10px] text-rose-500 font-bold ml-1">Due from Branches</span>
                        </div>
                    </div>
                    <div className="w-full h-1 bg-stone-100 rounded-full mt-3 overflow-hidden flex">
                        <div
                            className="h-full bg-emerald-500"
                            style={{
                                width: summary.totalBilledRevenue > 0
                                    ? `${Math.min(100, (summary.totalAmountPaid / summary.totalBilledRevenue) * 100)}%`
                                    : '0%'
                            }}
                        />
                        <div
                            className="h-full bg-rose-400"
                            style={{
                                width: summary.totalBilledRevenue > 0
                                    ? `${Math.min(100, (summary.totalOutstanding / summary.totalBilledRevenue) * 100)}%`
                                    : '0%'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ─── Visual Analysis: Wholesale Spread Trend & Multi-Branch Breakdown ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Timeline Trend Chart */}
                <div className="lg:col-span-2 bg-white border border-stone-200/90 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-600" />
                                Wholesale Profit Spread & Billed Revenue Timeline
                            </h3>
                            <p className="text-xs text-stone-400">Daily gross wholesale revenue billed to branches vs your batch profit spread</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-64 flex items-center justify-center text-stone-400">
                            <RefreshCw size={24} className="animate-spin" />
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-stone-400 text-center">
                            <Boxes size={32} className="opacity-20 mb-2" />
                            <p className="text-xs font-bold">No batch allocations recorded for this selected time window.</p>
                        </div>
                    ) : (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => `₱${val >= 1000 ? `${(val/1000).toFixed(0)}k` : val}`}
                                    />
                                    <RechartsTooltip
                                        formatter={(val, name) => [
                                            formatCurrency(val),
                                            name === 'grossProfit' ? 'Wholesale Profit Spread' : (name === 'billedRevenue' ? 'Billed Transfer Price' : 'Admin Cost')
                                        ]}
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                                    />
                                    <Area type="monotone" dataKey="billedRevenue" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#billedGrad)" name="billedRevenue" />
                                    <Area type="monotone" dataKey="grossProfit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" name="grossProfit" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Multi-Branch Profit Comparison */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-1">
                            <Building2 size={16} className="text-indigo-600" />
                            Branch Profit Breakdown
                        </h3>
                        <p className="text-xs text-stone-400 mb-4">Total wholesale spread generated per branch</p>

                        <div className="space-y-3 overflow-y-auto max-h-60 pr-1 custom-scrollbar">
                            {branchesBreakdown.map((b) => (
                                <div key={b.branchId} className="p-3 rounded-xl border border-stone-100 bg-stone-50/70 hover:bg-stone-50 transition-colors">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-black text-stone-800">{b.branchName}</span>
                                        <span className="font-black text-emerald-600 font-mono">+{formatCurrency(b.grossProfit)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                                        <span>{b.units?.toLocaleString()} units transferred</span>
                                        <span className="font-bold text-stone-600">{Number(b.marginPct || 0).toFixed(1)}% margin</span>
                                    </div>
                                    <div className="w-full h-1 bg-stone-200 rounded-full mt-2 overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full"
                                            style={{
                                                width: summary.totalGrossProfit > 0
                                                    ? `${Math.min(100, (b.grossProfit / summary.totalGrossProfit) * 100)}%`
                                                    : '0%'
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}

                            {branchesBreakdown.length === 0 && !loading && (
                                <div className="text-center py-10 text-stone-400 text-xs font-bold">
                                    No branch allocation data available.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-bold text-stone-500 mt-2">
                        <span>Total Branches Active:</span>
                        <span className="font-black text-stone-800">{branchesBreakdown.length}</span>
                    </div>
                </div>
            </div>

            {/* ─── Master Batch Profit Ledger Table ─── */}
            <div className="bg-white border border-stone-200/90 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h3 className="text-base font-black text-stone-900 tracking-tight flex items-center gap-2">
                            <Boxes size={18} className="text-emerald-600" />
                            Wholesale Batch Allocation Ledger
                        </h3>
                        <p className="text-xs text-stone-400 mt-0.5">
                            Detailed line-item audit of every batch pushed to branches with acquisition cost, branch price, and your spread.
                        </p>
                    </div>

                    <span className="text-xs font-bold text-stone-500 self-start sm:self-auto bg-stone-100 px-3 py-1 rounded-full">
                        {filteredBatches.length} batch items
                    </span>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-stone-50 border-b border-stone-200 text-stone-400 uppercase tracking-wider text-[10px] font-black select-none">
                                <th className="p-3.5 pl-5">Batch ID & Date</th>
                                <th className="p-3.5">Branch Destination</th>
                                <th className="p-3.5">Paddle / Product</th>
                                <th className="p-3.5 text-center">Units</th>
                                <th className="p-3.5 text-right">Admin Cost</th>
                                <th className="p-3.5 text-right">Branch Price</th>
                                <th className="p-3.5 text-right font-black text-emerald-800 bg-emerald-50/50">Unit Spread</th>
                                <th className="p-3.5 text-right font-black text-emerald-800 bg-emerald-50/50">Total Profit</th>
                                <th className="p-3.5 text-center">Margin %</th>
                                <th className="p-3.5 text-center pr-5">Payment Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
                                        <span className="font-bold">Loading batch profit ledger…</span>
                                    </td>
                                </tr>
                            ) : filteredBatches.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="text-center py-12 text-stone-400">
                                        <Boxes size={32} className="opacity-20 mx-auto mb-2" />
                                        <span className="font-bold">No batch allocation records found.</span>
                                    </td>
                                </tr>
                            ) : (
                                filteredBatches.map((b) => {
                                    const spread = Number(b.unitSpread || 0);
                                    const totalProfit = Number(b.totalBatchProfit || 0);
                                    const margin = Number(b.profitMarginPct || 0);
                                    const isPaid = b.status === 'PAID';
                                    const isPartial = b.status === 'PARTIAL';

                                    return (
                                        <tr key={b.id} className="hover:bg-stone-50/80 transition-colors group">
                                            {/* Batch ID & Date */}
                                            <td className="p-3.5 pl-5">
                                                <div className="font-mono font-bold text-stone-900 group-hover:text-emerald-700 transition-colors">
                                                    {b.adminBatchId ? b.adminBatchId.slice(0, 12) : `ALLOC-${b.id}`}
                                                </div>
                                                <div className="text-[10px] text-stone-400">
                                                    {b.allocatedAt ? b.allocatedAt.slice(0, 10) : '—'}
                                                </div>
                                            </td>

                                            {/* Branch */}
                                            <td className="p-3.5">
                                                <div className="font-bold text-stone-800 flex items-center gap-1.5">
                                                    <Store size={13} className="text-stone-400" />
                                                    <span>{b.branchName || 'Unassigned'}</span>
                                                </div>
                                            </td>

                                            {/* Product */}
                                            <td className="p-3.5">
                                                <div className="font-black text-stone-900 truncate max-w-[180px]">
                                                    {b.brandName} {b.modelName}
                                                </div>
                                                <div className="font-mono text-[10px] text-stone-400 truncate max-w-[180px]">
                                                    {b.sku}
                                                </div>
                                            </td>

                                            {/* Quantity */}
                                            <td className="p-3.5 text-center font-bold text-stone-800">
                                                {b.quantity}
                                                <span className="text-[10px] text-stone-400 block font-normal">units</span>
                                            </td>

                                            {/* Admin Cost (e.g. ₱37.50) */}
                                            <td className="p-3.5 text-right font-mono text-stone-600 font-bold">
                                                {formatCurrency(b.adminCostPerUnit)}
                                            </td>

                                            {/* Branch Price (e.g. ₱40.00) */}
                                            <td className="p-3.5 text-right font-mono text-indigo-700 font-black">
                                                {formatCurrency(b.costPerUnit)}
                                            </td>

                                            {/* Unit Spread (e.g. +₱2.50) */}
                                            <td className="p-3.5 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                                                +{formatCurrency(spread)}
                                            </td>

                                            {/* Total Profit (e.g. +₱250.00) */}
                                            <td className="p-3.5 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                                                +{formatCurrency(totalProfit)}
                                                <div className="text-[9px] text-emerald-600 font-normal">
                                                    on {b.quantity} units
                                                </div>
                                            </td>

                                            {/* Margin % */}
                                            <td className="p-3.5 text-center font-mono font-bold text-stone-700">
                                                <span className="px-2 py-0.5 rounded bg-stone-100 text-[10px]">
                                                    {margin.toFixed(1)}%
                                                </span>
                                            </td>

                                            {/* Payment Status */}
                                            <td className="p-3.5 text-center pr-5">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isPaid
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                        : isPartial
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                }`}>
                                                    {isPaid && <CheckCircle2 size={11} />}
                                                    {isPartial && <Clock size={11} />}
                                                    <span>{b.status}</span>
                                                </span>
                                                {Number(b.remainingBalance || 0) > 0 && (
                                                    <div className="text-[9px] text-rose-600 font-mono font-bold mt-0.5">
                                                        Due: {formatCurrency(b.remainingBalance)}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdminBatchProfitAnalytics;
