import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import {
    TrendingUp,
    DollarSign,
    Boxes,
    ShoppingBag,
    Calendar,
    Clock,
    AlertTriangle,
    CreditCard,
    CheckCircle2,
    ArrowUpRight,
    Loader2,
    PieChart as PieIcon,
    BarChart3,
    Sparkles,
    ShieldAlert,
    Receipt,
    Wallet,
    Store,
    ChevronDown,
    Layers,
    ArrowDownRight,
    Tag,
    RefreshCw
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#06b6d4', '#64748b'];

const BranchAnalytics = ({ branchId: propBranchId, branchName: propBranchName }) => {
    const { currentBranchId: authBranchId, user, isAdmin, isBranch } = useAuth();
    
    // Admin branch selector state when viewing standalone /branch-analytics
    const [branches, setBranches] = useState([]);
    const [adminSelectedBranchId, setAdminSelectedBranchId] = useState(authBranchId || null);

    // If propBranchId is passed (e.g. inside BranchDetail.jsx), strictly use it
    // Otherwise, if admin, use adminSelectedBranchId; if branch user, use user.branchId
    const effectiveBranchId = propBranchId !== undefined
        ? propBranchId
        : (isBranch ? user?.branchId : adminSelectedBranchId);

    const [transactions, setTransactions] = useState([]);
    const [categorySales, setCategorySales] = useState(null);
    const [products, setProducts] = useState([]);
    const [duesData, setDuesData] = useState({ totalOutstanding: 0, overdueCount: 0, upcomingCount: 0, allocations: [] });
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingCharts, setLoadingCharts] = useState(true);
    const [loadingDues, setLoadingDues] = useState(true);
    const [loadingInventory, setLoadingInventory] = useState(true);
    const [timeRange, setTimeRange] = useState('30D'); // '7D', '30D', '90D', 'ALL'

    // Fetch branches list for admin dropdown
    useEffect(() => {
        if (isAdmin && propBranchId === undefined) {
            axios.get('/api/admin/branches')
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data.filter(b => b.active) : [];
                    setBranches(list);
                })
                .catch(err => console.error('Failed to load branches:', err));
        }
    }, [isAdmin, propBranchId]);

    // Resolved display name
    const activeBranchObj = useMemo(() => {
        if (effectiveBranchId && branches.length > 0) {
            return branches.find(b => String(b.id) === String(effectiveBranchId));
        }
        return null;
    }, [effectiveBranchId, branches]);

    const displayName = propBranchName
        || activeBranchObj?.name
        || user?.branchName
        || (effectiveBranchId ? `Branch #${effectiveBranchId}` : 'All Branches');

    const fetchBranchData = () => {
        setLoading(true);
        setLoadingCharts(true);
        setLoadingDues(true);
        setLoadingInventory(true);

        const branchParam = effectiveBranchId ? `&branchId=${effectiveBranchId}` : '';
        const txUrl = `/api/transactions?limit=10000${branchParam}`;
        const catUrl = `/api/transactions/category-sales${branchParam ? `?${branchParam.substring(1)}` : ''}`;
        const prodUrl = effectiveBranchId ? `/api/products?branchId=${effectiveBranchId}` : `/api/products`;
        const duesUrl = effectiveBranchId ? `/api/allocations/branch-dues?branchId=${effectiveBranchId}` : `/api/allocations/branch-dues`;
        const expUrl = effectiveBranchId ? `/api/expenses?branchId=${effectiveBranchId}` : `/api/expenses`;

        const pTx = axios.get(txUrl)
            .then(res => setTransactions(Array.isArray(res.data) ? res.data : []))
            .catch(() => setTransactions([]))
            .finally(() => setLoadingCharts(false));

        const pCat = axios.get(catUrl)
            .then(res => setCategorySales(res.data || null))
            .catch(() => setCategorySales(null));

        const pDues = axios.get(duesUrl)
            .then(res => setDuesData(res.data || {}))
            .catch(() => setDuesData({ totalOutstanding: 0, overdueCount: 0, upcomingCount: 0, allocations: [] }))
            .finally(() => setLoadingDues(false));

        const pExp = axios.get(expUrl)
            .then(res => setExpenses(Array.isArray(res.data) ? res.data : []))
            .catch(() => setExpenses([]));

        const pProd = axios.get(prodUrl)
            .then(res => setProducts(Array.isArray(res.data) ? res.data : []))
            .catch(() => setProducts([]))
            .finally(() => setLoadingInventory(false));

        Promise.allSettled([pTx, pCat, pDues, pExp, pProd]).finally(() => {
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchBranchData();
    }, [effectiveBranchId]);

    // Compute key metrics
    const metrics = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfWeekTime = startOfWeek.getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let todayRev = 0;
        let todayUnits = 0;
        let weekRev = 0;
        let monthRev = 0;
        let monthUnits = 0;
        let totalRev = 0;
        let totalUnits = 0;

        // Daily bucket map for trend chart with exact YYYY-MM-DD keys to prevent cross-year collisions
        const dayMap = {};
        const daysBack = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : timeRange === '90D' ? 90 : 365;
        const cutoffTime = timeRange === 'ALL' ? 0 : now.getTime() - (daysBack * 24 * 60 * 60 * 1000);

        const pad = (n) => String(n).padStart(2, '0');
        for (let i = daysBack - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const isoKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            const displayKey = `${d.getMonth() + 1}/${d.getDate()}`;
            dayMap[isoKey] = {
                iso: isoKey,
                date: displayKey,
                revenue: 0,
                units: 0,
                orders: new Set()
            };
        }

        // Product ranking & Category maps for the active time range
        const prodRankMap = {};
        const catMap = {};
        const paymentMap = {};
        const periodOrdersSet = new Set();
        let periodUnits = 0;

        transactions.forEach(t => {
            const price = parseFloat(t.finalPrice || t.totalPrice || 0);
            const qty = parseInt(t.quantity || 1, 10);
            const txTime = t.transactionDate ? new Date(t.transactionDate).getTime() : 0;

            totalRev += price;
            totalUnits += qty;

            if (txTime >= startOfToday) {
                todayRev += price;
                todayUnits += qty;
            }
            if (txTime >= startOfWeekTime) {
                weekRev += price;
            }
            if (txTime >= startOfMonth) {
                monthRev += price;
                monthUnits += qty;
            }

            // Trend chart bucket (exact ISO date match)
            if (t.transactionDate) {
                const txD = new Date(t.transactionDate);
                const isoKey = `${txD.getFullYear()}-${pad(txD.getMonth() + 1)}-${pad(txD.getDate())}`;
                if (dayMap[isoKey]) {
                    dayMap[isoKey].revenue += price;
                    dayMap[isoKey].units += qty;
                    if (t.transactionId) dayMap[isoKey].orders.add(t.transactionId);
                }
            }

            // Scoped to active timeRange cutoff
            if (txTime >= cutoffTime) {
                periodUnits += qty;
                if (t.transactionId) periodOrdersSet.add(t.transactionId);

                // Product rank
                const v = t.variant;
                const p = v?.product;
                const prodName = p ? `${p.brandName} ${p.modelName}` : (t.productName || 'Unknown Product');
                if (!prodRankMap[prodName]) {
                    prodRankMap[prodName] = { name: prodName, sku: v?.sku || '', units: 0, revenue: 0 };
                }
                prodRankMap[prodName].units += qty;
                prodRankMap[prodName].revenue += price;

                // Category distribution
                const cat = p?.category || t.category || 'General';
                if (!catMap[cat]) {
                    catMap[cat] = { name: cat, value: 0, units: 0 };
                }
                catMap[cat].value += price;
                catMap[cat].units += qty;

                // Payment distribution
                const pMethod = t.paymentMethod || 'Other';
                paymentMap[pMethod] = (paymentMap[pMethod] || 0) + price;
            }
        });

        // Compute Branch Expenses in period
        let periodExpenses = 0;
        let totalExpenses = 0;
        const expensesByCategory = {};

        expenses.forEach(e => {
            if (e.type && e.type.toUpperCase() !== 'EXPENSE') return;
            const cost = parseFloat(e.cost || 0);
            totalExpenses += cost;
            const expTime = e.expenseDate ? new Date(e.expenseDate).getTime() : 0;
            if (expTime >= cutoffTime) {
                periodExpenses += cost;
            }
            const cat = e.category || 'General';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + cost;
        });

        const trendData = Object.values(dayMap).map(d => ({
            date: d.date,
            revenue: d.revenue,
            units: d.units,
            orders: d.orders.size
        }));

        const topProducts = Object.values(prodRankMap)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);

        // Low stock items
        const lowStockItems = [];
        products.forEach(p => {
            (p.variants || []).forEach(v => {
                const stock = v.stockQuantity ?? 0;
                const threshold = v.lowStockThreshold ?? 5;
                if (stock <= threshold) {
                    lowStockItems.push({
                        id: v.id,
                        name: `${p.brandName} ${p.modelName}`,
                        sku: v.sku,
                        color: v.color && v.color !== 'N/A' ? v.color : '',
                        stock,
                        threshold,
                        isOut: stock === 0
                    });
                }
            });
        });

        // Period Sales in the trend days
        const periodRevenue = trendData.reduce((acc, d) => acc + d.revenue, 0);
        const periodNetProfit = periodRevenue - periodExpenses;
        const periodOrdersCount = periodOrdersSet.size || Math.min(periodUnits, transactions.filter(t => (t.transactionDate ? new Date(t.transactionDate).getTime() : 0) >= cutoffTime).length);
        const aov = periodOrdersCount > 0 ? (periodRevenue / periodOrdersCount) : 0;

        const dynamicCategories = Object.values(catMap).filter(c => c.value > 0).sort((a, b) => b.value - a.value);

        return {
            todayRev,
            todayUnits,
            weekRev,
            monthRev,
            monthUnits,
            totalRev,
            totalUnits,
            periodRevenue,
            periodExpenses,
            periodNetProfit,
            periodUnits,
            periodOrdersCount,
            aov,
            totalExpenses,
            expensesByCategory,
            trendData,
            topProducts,
            lowStockItems,
            dynamicCategories,
            paymentMap
        };
    }, [transactions, products, expenses, timeRange]);

    // Format category pie data: prioritize live transactions in selected period, fallback to categorySales endpoint
    const categoryPieData = useMemo(() => {
        if (metrics.dynamicCategories && metrics.dynamicCategories.length > 0) {
            return metrics.dynamicCategories;
        }

        if (!categorySales) return [];

        const list = Array.isArray(categorySales.categories)
            ? categorySales.categories
            : Array.isArray(categorySales)
                ? categorySales
                : null;

        if (list) {
            return list.map(c => ({
                name: c.category || c.name || 'Uncategorized',
                value: parseFloat(c.revenue || c.totalSales || c.amount || 0),
                units: c.unitsSold || c.quantity || 0
            })).filter(c => c.value > 0);
        }

        if (typeof categorySales === 'object') {
            return Object.entries(categorySales).map(([name, data]) => ({
                name,
                value: typeof data === 'number' ? data : parseFloat(data?.revenue || data?.totalSales || data?.amount || 0),
                units: data?.quantity || data?.unitsSold || 0
            })).filter(c => c.value > 0);
        }

        return [];
    }, [metrics.dynamicCategories, categorySales]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-12">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-stone-800">
                <div className="absolute right-0 top-0 w-96 h-full bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-2">
                            <Sparkles size={13} />
                            {displayName} Performance & P&L
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Branch Analytics & P&L
                        </h2>
                        <p className="text-stone-300 text-sm mt-1 max-w-2xl">
                            Real-time sales velocity, revenue trends, local operating costs, and net store profit.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Admin Branch Selector (when viewing standalone page) */}
                        {isAdmin && propBranchId === undefined && branches.length > 0 && (
                            <div className="flex items-center gap-2 bg-stone-800/90 border border-stone-700 px-3 py-1.5 rounded-2xl">
                                <Store size={14} className="text-emerald-400" />
                                <span className="text-xs font-bold text-stone-300">Branch:</span>
                                <select
                                    value={adminSelectedBranchId || ''}
                                    onChange={(e) => setAdminSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                                    className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
                                >
                                    <option value="" className="bg-stone-900 text-white">All Branches Consolidated</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id} className="bg-stone-900 text-white">
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Refresh Button */}
                        <button
                            type="button"
                            onClick={fetchBranchData}
                            disabled={loading}
                            className="p-2 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white rounded-xl border border-stone-700 transition-colors cursor-pointer"
                            title="Refresh data"
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {/* Time Range Selector */}
                        <div className="flex items-center gap-1 bg-stone-800/80 p-1.5 rounded-2xl border border-stone-700">
                            {[
                                { id: '7D', label: '7 Days' },
                                { id: '30D', label: '30 Days' },
                                { id: '90D', label: '90 Days' },
                                { id: 'ALL', label: 'All Time' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setTimeRange(t.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        timeRange === t.id
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Period Sales */}
                <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">
                            Sales ({timeRange})
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                            <TrendingUp size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2 font-mono">
                        {formatCurrency(metrics.periodRevenue)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1.5 font-medium flex items-center justify-between">
                        <span className="font-bold text-emerald-600">Today: {formatCurrency(metrics.todayRev)}</span>
                        <span className="text-stone-400">{metrics.periodUnits} units sold</span>
                    </div>
                </div>

                {/* Operating Expenses */}
                <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-500">
                            Operating Expenses
                        </span>
                        <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                            <Receipt size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
                        {formatCurrency(metrics.periodExpenses)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1.5 font-medium">
                        Rent, utilities, local branch costs
                    </div>
                </div>

                {/* Net Operating Profit */}
                <div className={`bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden ${
                    metrics.periodNetProfit >= 0 ? 'border-emerald-200 bg-emerald-50/10' : 'border-rose-200 bg-rose-50/10'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-500">
                            Net Operating Profit
                        </span>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                            metrics.periodNetProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className={`text-2xl font-black mt-2 font-mono ${
                        metrics.periodNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                        {formatCurrency(metrics.periodNetProfit)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1.5 font-medium flex items-center justify-between">
                        <span>Sales minus Expenses</span>
                        {metrics.aov > 0 && (
                            <span className="font-bold text-stone-600">AOV: {formatCurrency(metrics.aov)}</span>
                        )}
                    </div>
                </div>

                {/* Outstanding Dues to Admin */}
                <div className={`bg-white rounded-2xl p-5 border shadow-sm relative overflow-hidden ${
                    (duesData.totalOutstanding || 0) > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200'
                }`}>
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Dues to Admin</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                            <CreditCard size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-700 mt-2 font-mono">
                        {loadingDues ? (
                            <span className="text-amber-400 text-lg animate-pulse">Loading...</span>
                        ) : (
                            formatCurrency(duesData.totalOutstanding || 0)
                        )}
                    </div>
                    <div className="text-xs text-amber-800 mt-1.5 font-medium flex items-center gap-1.5">
                        {duesData.overdueCount > 0 ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                                <AlertTriangle size={12} /> {duesData.overdueCount} overdue batch(es)
                            </span>
                        ) : (
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 size={12} /> All deadlines current
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Revenue & Velocity Trend</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Daily gross sales over the selected period ({timeRange})</p>
                        </div>
                        <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            Daily Flow
                        </div>
                    </div>

                    <div className="h-64 w-full flex-1 min-h-[250px]">
                        {loadingCharts ? (
                            <div className="h-full flex items-center justify-center text-stone-400">
                                <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
                            </div>
                        ) : metrics.trendData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-stone-400 text-xs">
                                No sales data recorded in this period.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={metrics.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                                    <YAxis
                                        stroke="#94a3b8"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `₱${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
                                    />
                                    <RechartsTooltip
                                        formatter={(val, name) => [
                                            name === 'revenue' ? formatCurrency(val) : val,
                                            name === 'revenue' ? 'Sales Revenue' : 'Units Sold'
                                        ]}
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="revenue"
                                        name="revenue"
                                        stroke="#10b981"
                                        strokeWidth={3}
                                        dot={{ fill: '#10b981', r: 3 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Category Sales Breakdown */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Sales by Category</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Revenue share breakdown ({timeRange})</p>
                        </div>
                        <PieIcon size={18} className="text-stone-400" />
                    </div>

                    <div className="h-56 w-full flex-1 flex items-center justify-center min-h-[220px]">
                        {loadingCharts ? (
                            <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
                        ) : categoryPieData.length === 0 ? (
                            <div className="text-xs text-stone-400 text-center py-8">No category sales in this period.</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={categoryPieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={75}
                                        paddingAngle={4}
                                    >
                                        {categoryPieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(val) => [formatCurrency(val), 'Sales']}
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {categoryPieData.slice(0, 6).map((c, i) => (
                            <div key={c.name} className="flex items-center gap-1.5 truncate">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-stone-600 font-semibold truncate">{c.name}</span>
                                <span className="text-stone-400 text-[10px] ml-auto font-mono">{formatCurrency(c.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Selling Products & Low Stock Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Moving Products */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Top Performing Products</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Ranked by revenue at this branch ({timeRange})</p>
                        </div>
                        <BarChart3 size={18} className="text-stone-400" />
                    </div>

                    {loadingCharts ? (
                        <div className="p-12 text-center text-xs text-stone-400 bg-stone-50 rounded-xl my-auto flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                        </div>
                    ) : metrics.topProducts.length === 0 ? (
                        <div className="p-12 text-center text-xs text-stone-400 bg-stone-50 rounded-xl my-auto">
                            No product sales recorded in this period.
                        </div>
                    ) : (
                        <div className="space-y-3 flex-1">
                            {metrics.topProducts.map((p, idx) => (
                                <div key={p.name} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100/70 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className={`w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 ${
                                            idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-stone-500' : idx === 2 ? 'bg-amber-700' : 'bg-stone-900'
                                        }`}>
                                            {idx + 1}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-black text-stone-900 text-xs truncate">{p.name}</div>
                                            <div className="text-[11px] text-stone-400 font-semibold">
                                                {p.units} units sold {p.sku && `• ${p.sku}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="font-black text-stone-900 text-xs font-mono shrink-0 ml-3">
                                        {formatCurrency(p.revenue)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inventory Health & Low Stock */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Inventory Health & Stock Alerts</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Variants that need replenishment from Admin HQ</p>
                        </div>
                        <Boxes size={18} className="text-stone-400" />
                    </div>

                    {loadingInventory ? (
                        <div className="p-12 text-center text-xs text-stone-400 bg-stone-50 rounded-xl my-auto flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
                        </div>
                    ) : metrics.lowStockItems.length === 0 ? (
                        <div className="p-12 text-center text-xs text-emerald-700 font-bold bg-emerald-50 rounded-xl my-auto border border-emerald-100">
                            ✓ All paddle variants have healthy stock levels!
                        </div>
                    ) : (
                        <div className="space-y-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1 flex-1">
                            {metrics.lowStockItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-colors">
                                    <div className="min-w-0 pr-2">
                                        <div className="font-black text-stone-900 text-xs truncate">{item.name}</div>
                                        <div className="text-[11px] font-mono text-stone-400">
                                            {item.sku} {item.color && `• ${item.color}`}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                            item.isOut
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {item.isOut ? 'Out of Stock' : `${item.stock} left`}
                                        </span>
                                        <div className="text-[10px] text-stone-400 mt-0.5">Alert &le; {item.threshold}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BranchAnalytics;
