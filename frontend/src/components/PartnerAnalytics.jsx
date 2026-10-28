import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    DollarSign, TrendingUp, RefreshCw, Calendar, Package, Layers,
    CheckCircle2, AlertCircle, ArrowUpRight, Handshake, Users, ShieldCheck,
    Clock, Check, Filter, Search
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';

const formatCurrency = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIME_RANGES = [
    { label: 'Today', days: 1 },
    { label: '7 Days', days: 7 },
    { label: '30 Days', days: 30 },
    { label: 'All Time', days: null }
];

const PartnerAnalytics = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('products'); // 'products' | 'ledger'
    const [selectedPartner, setSelectedPartner] = useState('ALL');
    const [timeRange, setTimeRange] = useState(TIME_RANGES[3]); // All time by default
    const [searchTerm, setSearchTerm] = useState('');
    const [settlingId, setSettlingId] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            let url = '/api/admin/analytics/partner?';
            const params = [];
            if (selectedPartner !== 'ALL') {
                params.push(`partnerName=${encodeURIComponent(selectedPartner)}`);
            }
            if (timeRange.days != null) {
                const now = new Date();
                const from = new Date(now.getTime() - timeRange.days * 24 * 60 * 60 * 1000);
                params.push(`from=${from.toISOString()}`);
                params.push(`to=${now.toISOString()}`);
            }
            url += params.join('&');

            const res = await axios.get(url);
            setData(res.data);
        } catch (err) {
            console.error('Failed to load partner analytics:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to fetch partner analytics.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedPartner, timeRange]);

    const handleToggleSettlement = async (txId, currentStatus) => {
        setSettlingId(txId);
        try {
            const nextStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
            await axios.post(`/api/admin/partner-transactions/${txId}/settle?status=${nextStatus}`);
            // Optimistically update
            setData(prev => {
                if (!prev) return prev;
                const updatedLedger = prev.salesLedger.map(item =>
                    item.id === txId ? { ...item, settlementStatus: nextStatus } : item
                );
                // Recompute summary settled / unsettled
                const targetItem = prev.salesLedger.find(i => i.id === txId);
                const shareAmt = Number(targetItem?.partnerShare || 0);
                const diffSettled = nextStatus === 'PAID' ? shareAmt : -shareAmt;

                return {
                    ...prev,
                    salesLedger: updatedLedger,
                    summary: {
                        ...prev.summary,
                        totalSettledPartnerShare: Math.max(0, Number(prev.summary.totalSettledPartnerShare || 0) + diffSettled),
                        totalUnsettledPartnerShare: Math.max(0, Number(prev.summary.totalUnsettledPartnerShare || 0) - diffSettled)
                    }
                };
            });
        } catch (err) {
            alert('Failed to update settlement status: ' + (err.response?.data?.error || err.message));
        } finally {
            setSettlingId(null);
        }
    };

    const summary = data?.summary || {
        totalGrossRevenue: 0,
        totalCost: 0,
        totalGrossProfit: 0,
        marginPct: 0,
        totalPartnerShare: 0,
        totalCpmShare: 0,
        totalSettledPartnerShare: 0,
        totalUnsettledPartnerShare: 0,
        unitsSold: 0,
        unitsOnHand: 0,
        stockCostOnHand: 0
    };

    const partnerTotals = data?.partnerTotals || {};
    const productBreakdown = data?.productBreakdown || [];
    const salesLedger = data?.salesLedger || [];
    const trend = data?.trend || [];

    const filteredProducts = productBreakdown.filter(p =>
        (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.sku || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredLedger = salesLedger.filter(l =>
        (l.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.orderId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col space-y-6 w-full animate-fadeIn">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-700">
                        <Handshake size={15} />
                        <span>Co-Ownership & Profit Share</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-1 flex items-center gap-2.5">
                        <Users className="text-purple-600" size={26} />
                        Partner Items & Split-Profit Analytics
                    </h2>
                    <p className="text-xs text-stone-500 font-medium mt-1 max-w-3xl leading-relaxed">
                        Dedicated profit tracking for stock co-owned with partners (e.g. <span className="font-bold text-stone-700">Pickle Gear 50/50</span>).
                        Separates gross margin into <span className="font-bold text-emerald-700">Ivan's Retained Net Profit</span> and <span className="font-bold text-purple-700">Partner Payout Owed</span>.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Partner Selector */}
                    <div className="flex items-center bg-stone-100 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-stone-700">
                        <Filter size={13} className="mr-1.5 text-stone-400" />
                        <select
                            value={selectedPartner}
                            onChange={e => setSelectedPartner(e.target.value)}
                            className="bg-transparent outline-none cursor-pointer pr-1"
                        >
                            <option value="ALL">All Partners</option>
                            {Object.keys(partnerTotals).map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    {/* Time Range Pills */}
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
                        {TIME_RANGES.map(t => (
                            <button
                                key={t.label}
                                onClick={() => setTimeRange(t)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                    timeRange.label === t.label ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
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

            {/* ─── Top 5 Partner KPIs ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* 1. Gross Partner Revenue */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-[11px] font-black uppercase tracking-wider">Gross Partner Revenue</span>
                        <DollarSign size={18} className="text-purple-500" />
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-stone-900 tracking-tight">
                            {formatCurrency(summary.totalGrossRevenue)}
                        </span>
                        <div className="text-[11px] text-stone-400 font-medium mt-1">
                            From {summary.unitsSold} partner units sold
                        </div>
                    </div>
                </div>

                {/* 2. Total Gross Margin */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-[11px] font-black uppercase tracking-wider">Total Gross Margin</span>
                        <TrendingUp size={18} className="text-stone-500" />
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-stone-900 tracking-tight">
                            {formatCurrency(summary.totalGrossProfit)}
                        </span>
                        <div className="text-[11px] text-stone-500 font-medium mt-1">
                            Margin: <span className="font-bold text-stone-800">+{Number(summary.marginPct || 0).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                {/* 3. Ivan Retained Profit (50%) */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-emerald-700">
                        <span className="text-[11px] font-black uppercase tracking-wider">Your Share (50% Profit)</span>
                        <ShieldCheck size={18} className="text-emerald-600" />
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-emerald-800 tracking-tight">
                            +{formatCurrency(summary.totalCpmShare)}
                        </span>
                        <div className="text-[11px] text-emerald-700 font-medium mt-1">
                            Retained earnings for CPM
                        </div>
                    </div>
                </div>

                {/* 4. Partner Payout Owed (50%) */}
                <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-purple-700">
                        <span className="text-[11px] font-black uppercase tracking-wider">Partner Share Owed (50%)</span>
                        <Handshake size={18} className="text-purple-600" />
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-purple-900 tracking-tight">
                            {formatCurrency(summary.totalPartnerShare)}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-bold mt-1.5">
                            <span className="text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded">
                                Unsettled: {formatCurrency(summary.totalUnsettledPartnerShare)}
                            </span>
                            <span className="text-emerald-700 bg-emerald-100/80 px-1.5 py-0.5 rounded">
                                Settled: {formatCurrency(summary.totalSettledPartnerShare)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 5. Partner Stock on Hand */}
                <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center justify-between text-stone-400">
                        <span className="text-[11px] font-black uppercase tracking-wider">Partner Stock On Hand</span>
                        <Package size={18} className="text-indigo-500" />
                    </div>
                    <div className="mt-3">
                        <span className="text-2xl font-black text-indigo-950 tracking-tight">
                            {summary.unitsOnHand} <span className="text-sm font-bold text-stone-500">units</span>
                        </span>
                        <div className="text-[11px] text-stone-400 font-medium mt-1">
                            Cost Value: {formatCurrency(summary.stockCostOnHand)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Trend Area Chart (if trend data exists) ─── */}
            {trend.length > 1 && (
                <div className="bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-stone-900 uppercase tracking-wide flex items-center gap-2">
                            <TrendingUp size={16} className="text-purple-600" />
                            Partner Sales Trend (Daily Gross Revenue)
                        </h3>
                    </div>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trend}>
                                <defs>
                                    <linearGradient id="partnerColor" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={v => `₱${v}`} />
                                <RechartsTooltip formatter={v => [formatCurrency(v), 'Revenue']} />
                                <Area type="monotone" dataKey="revenue" stroke="#9333ea" strokeWidth={2.5} fillOpacity={1} fill="url(#partnerColor)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ─── Detailed Section Tabs ─── */}
            <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-stone-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/70">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setActiveTab('products')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'products'
                                    ? 'bg-stone-900 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-stone-200 hover:text-stone-900'
                            }`}
                        >
                            <Package size={14} />
                            <span>Product Performance ({filteredProducts.length})</span>
                        </button>

                        <button
                            onClick={() => setActiveTab('ledger')}
                            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === 'ledger'
                                    ? 'bg-stone-900 text-white shadow-xs'
                                    : 'bg-white text-stone-600 border border-stone-200 hover:text-stone-900'
                            }`}
                        >
                            <Handshake size={14} />
                            <span>Sales & Settlement Ledger ({filteredLedger.length})</span>
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative w-full sm:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Filter by SKU or name..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-stone-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-600"
                        />
                    </div>
                </div>

                {/* TAB 1: PRODUCT PERFORMANCE BREAKDOWN */}
                {activeTab === 'products' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-stone-200 bg-stone-50/50 text-stone-500 font-bold uppercase tracking-wider">
                                    <th className="py-3 px-4">SKU / Product</th>
                                    <th className="py-3 px-3 text-center">Sold</th>
                                    <th className="py-3 px-3 text-center">On Hand</th>
                                    <th className="py-3 px-4 text-right">Gross Sales</th>
                                    <th className="py-3 px-4 text-right">Total Profit</th>
                                    <th className="py-3 px-4 text-right text-emerald-700">Ivan's Share (50%)</th>
                                    <th className="py-3 px-4 text-right text-purple-700">Partner Share (50%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredProducts.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-stone-400 font-medium">
                                            No partner sales or stock recorded yet. When adding stock, tag batches with <strong>Partner (50/50)</strong>.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProducts.map(p => (
                                        <tr key={p.sku} className="hover:bg-purple-50/30 transition-colors">
                                            <td className="py-3.5 px-4 font-bold text-stone-900">
                                                <div>{p.name}</div>
                                                <div className="text-[11px] font-mono text-stone-400 font-normal">{p.sku}</div>
                                            </td>
                                            <td className="py-3.5 px-3 text-center font-bold text-stone-800">
                                                {p.unitsSold}
                                            </td>
                                            <td className="py-3.5 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                    p.unitsOnHand > 0 ? 'bg-indigo-50 text-indigo-700 font-black' : 'text-stone-300'
                                                }`}>
                                                    {p.unitsOnHand}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-medium text-stone-900">
                                                {formatCurrency(p.revenue)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                                                {formatCurrency(p.grossProfit)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-emerald-700">
                                                +{formatCurrency(p.cpmShare)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-purple-700">
                                                +{formatCurrency(p.partnerShare)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* TAB 2: SALES & SETTLEMENT LEDGER */}
                {activeTab === 'ledger' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-stone-200 bg-stone-50/50 text-stone-500 font-bold uppercase tracking-wider">
                                    <th className="py-3 px-4">Order ID & Date</th>
                                    <th className="py-3 px-4">Item & Customer</th>
                                    <th className="py-3 px-3">Partner</th>
                                    <th className="py-3 px-3 text-right">Sale Price</th>
                                    <th className="py-3 px-3 text-right">Cost</th>
                                    <th className="py-3 px-3 text-right text-emerald-700">Ivan (50%)</th>
                                    <th className="py-3 px-3 text-right text-purple-700">Partner (50%)</th>
                                    <th className="py-3 px-4 text-center">Settlement</th>
                                    <th className="py-3 px-4 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-stone-400 font-medium">
                                            No sales for partnered items found in this date range.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLedger.map(item => {
                                        const isPaid = item.settlementStatus === 'PAID';
                                        return (
                                            <tr key={item.id} className="hover:bg-purple-50/30 transition-colors">
                                                <td className="py-3.5 px-4 font-mono">
                                                    <span className="font-bold text-stone-900 block truncate max-w-[130px]">{item.orderId}</span>
                                                    <span className="text-[10px] text-stone-400">
                                                        {item.date ? new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4">
                                                    <div className="font-bold text-stone-900">{item.productName}</div>
                                                    <div className="text-[11px] text-stone-500">{item.customerName || 'Walk-in Customer'}</div>
                                                </td>
                                                <td className="py-3.5 px-3">
                                                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                                        {item.partnerName}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-medium text-stone-900">
                                                    {formatCurrency(item.finalPrice)}
                                                </td>
                                                <td className="py-3.5 px-3 text-right text-stone-500">
                                                    {formatCurrency(item.costPrice)}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-black text-emerald-700">
                                                    +{formatCurrency(item.cpmShare)}
                                                </td>
                                                <td className="py-3.5 px-3 text-right font-black text-purple-700">
                                                    +{formatCurrency(item.partnerShare)}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                                                        isPaid
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        {isPaid ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                                                        <span>{isPaid ? 'Settled / Paid' : 'Unpaid'}</span>
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        onClick={() => handleToggleSettlement(item.id, item.settlementStatus)}
                                                        disabled={settlingId === item.id}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                                            isPaid
                                                                ? 'border border-stone-200 text-stone-500 hover:bg-stone-100'
                                                                : 'bg-purple-600 hover:bg-purple-700 text-white shadow-xs'
                                                        }`}
                                                    >
                                                        {isPaid ? 'Undo' : 'Mark Paid'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PartnerAnalytics;

