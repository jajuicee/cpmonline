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
    Wallet
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PIE_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#64748b'];

const BranchAnalytics = ({ branchId: propBranchId, branchName: propBranchName }) => {
    const { currentBranchId: authBranchId, user } = useAuth();
    const effectiveBranchId = propBranchId !== undefined ? propBranchId : authBranchId;
    const displayName = propBranchName || user?.branchName || 'Store';

    const [transactions, setTransactions] = useState([]);
    const [categorySales, setCategorySales] = useState(null);
    const [products, setProducts] = useState([]);
    const [duesData, setDuesData] = useState({ totalOutstanding: 0, overdueCount: 0, upcomingCount: 0, allocations: [] });
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('30D'); // '7D', '30D', 'ALL'

    const fetchBranchData = async () => {
        setLoading(true);
        const branchParam = effectiveBranchId ? `&branchId=${effectiveBranchId}` : '';
        const txUrl = `/api/transactions?limit=10000${branchParam}`;
        const catUrl = `/api/transactions/category-sales${branchParam ? `?${branchParam.substring(1)}` : ''}`;
        const prodUrl = effectiveBranchId ? `/api/products?branchId=${effectiveBranchId}` : `/api/products`;
        const duesUrl = effectiveBranchId ? `/api/allocations/branch-dues?branchId=${effectiveBranchId}` : `/api/allocations/branch-dues`;
        const expUrl = effectiveBranchId ? `/api/expenses?branchId=${effectiveBranchId}` : `/api/expenses`;

        try {
            const [txRes, catRes, prodRes, duesRes, expRes] = await Promise.all([
                axios.get(txUrl).catch(() => ({ data: [] })),
                axios.get(catUrl).catch(() => ({ data: null })),
                axios.get(prodUrl).catch(() => ({ data: [] })),
                axios.get(duesUrl).catch(() => ({ data: { totalOutstanding: 0, overdueCount: 0, upcomingCount: 0, allocations: [] } })),
                axios.get(expUrl).catch(() => ({ data: [] }))
            ]);

            setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
            setCategorySales(catRes.data || null);
            setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
            setDuesData(duesRes.data || {});
            setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        } catch (err) {
            console.error('Failed to load branch analytics data:', err);
        } finally {
            setLoading(false);
        }
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

        // Daily bucket map for trend chart
        const dayMap = {};
        const daysBack = timeRange === '7D' ? 7 : timeRange === '30D' ? 30 : 90;
        const cutoffTime = now.getTime() - (daysBack * 24 * 60 * 60 * 1000);

        for (let i = daysBack - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);
            const key = `${d.getMonth() + 1}/${d.getDate()}`;
            dayMap[key] = { date: key, revenue: 0, units: 0 };
        }

        // Product ranking map
        const prodRankMap = {};

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

            // Fill trend chart bucket
            if (t.transactionDate) {
                const txD = new Date(t.transactionDate);
                const k = `${txD.getMonth() + 1}/${txD.getDate()}`;
                if (dayMap[k]) {
                    dayMap[k].revenue += price;
                    dayMap[k].units += qty;
                }
            }

            // Fill product rank
            const v = t.variant;
            const p = v?.product;
            const prodName = p ? `${p.brandName} ${p.modelName}` : (t.productName || 'Unknown Product');
            if (!prodRankMap[prodName]) {
                prodRankMap[prodName] = { name: prodName, units: 0, revenue: 0 };
            }
            prodRankMap[prodName].units += qty;
            prodRankMap[prodName].revenue += price;
        });

        // Compute Branch Expenses in period
        let periodExpenses = 0;
        let totalExpenses = 0;
        const expensesByCategory = {};

        expenses.forEach(e => {
            if ("EXPENSE".equalsIgnoreCase ? !"EXPENSE".equalsIgnoreCase(e.type) : (e.type && e.type.toUpperCase() !== 'EXPENSE')) return;
            const cost = parseFloat(e.cost || 0);
            totalExpenses += cost;
            const expTime = e.expenseDate ? new Date(e.expenseDate).getTime() : 0;
            if (expTime >= cutoffTime) {
                periodExpenses += cost;
            }
            const cat = e.category || 'General';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + cost;
        });

        const trendData = Object.values(dayMap);
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
            totalExpenses,
            expensesByCategory,
            trendData,
            topProducts,
            lowStockItems
        };
    }, [transactions, products, expenses, timeRange]);

    // Format category pie data
    const categoryPieData = useMemo(() => {
        if (!categorySales) return [];
        return Object.entries(categorySales).map(([name, data]) => ({
            name,
            value: parseFloat(data.revenue || data.totalSales || data.amount || 0),
            units: data.quantity || data.unitsSold || 0
        })).filter(c => c.value > 0);
    }, [categorySales]);

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

                    {/* Time Range Selector */}
                    <div className="flex items-center gap-1.5 bg-stone-800/80 p-1.5 rounded-2xl border border-stone-700">
                        {[
                            { id: '7D', label: 'Last 7 Days' },
                            { id: '30D', label: 'Last 30 Days' },
                            { id: 'ALL', label: '90 Days' },
                        ].map(t => (
                            <button
                                key={t.id}
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
                    <div className="text-xs text-stone-500 mt-1 font-medium flex items-center gap-1.5">
                        <span className="font-bold text-emerald-600">Today: {formatCurrency(metrics.todayRev)}</span>
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
                    <div className="text-xs text-stone-500 mt-1 font-medium">
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
                    <div className="text-xs text-stone-500 mt-1 font-medium">
                        Sales minus Operating Expenses
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
                        {formatCurrency(duesData.totalOutstanding || 0)}
                    </div>
                    <div className="text-xs text-amber-800 mt-1 font-medium flex items-center gap-1.5">
                        {duesData.overdueCount > 0 ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                                <AlertTriangle size={12} /> {duesData.overdueCount} overdue
                            </span>
                        ) : (
                            <span>All deadlines current</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Trend Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Revenue Trend</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Daily gross sales over the selected period</p>
                        </div>
                        <div className="text-xs font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                            Daily Flow
                        </div>
                    </div>

                    <div className="h-64 w-full">
                        {loading ? (
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
                                        formatter={(val) => [formatCurrency(val), 'Revenue']}
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="revenue"
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
                            <p className="text-xs text-stone-400 mt-0.5">Revenue share breakdown</p>
                        </div>
                        <PieIcon size={18} className="text-stone-400" />
                    </div>

                    <div className="h-56 w-full flex-1 flex items-center justify-center">
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin text-stone-500" />
                        ) : categoryPieData.length === 0 ? (
                            <div className="text-xs text-stone-400 text-center">No category data yet.</div>
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
                        {categoryPieData.slice(0, 4).map((c, i) => (
                            <div key={c.name} className="flex items-center gap-1.5 truncate">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-stone-600 font-semibold truncate">{c.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Selling Products & Low Stock Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Moving Products */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Top Performing Products</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Ranked by total revenue at this branch</p>
                        </div>
                        <BarChart3 size={18} className="text-stone-400" />
                    </div>

                    {metrics.topProducts.length === 0 ? (
                        <div className="p-8 text-center text-xs text-stone-400">
                            No product sales recorded yet.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {metrics.topProducts.map((p, idx) => (
                                <div key={p.name} className="flex items-center justify-between p-3 rounded-xl bg-stone-50 hover:bg-stone-100/70 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-lg bg-stone-900 text-white font-black text-xs flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-black text-stone-900 text-xs">{p.name}</div>
                                            <div className="text-[11px] text-stone-400 font-semibold">{p.units} units sold</div>
                                        </div>
                                    </div>
                                    <div className="font-black text-stone-900 text-xs font-mono">
                                        {formatCurrency(p.revenue)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Inventory Health & Low Stock */}
                <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-black text-stone-900 text-base">Inventory Health & Low Stock</h3>
                            <p className="text-xs text-stone-400 mt-0.5">Variants that need replenishment from Admin</p>
                        </div>
                        <Boxes size={18} className="text-stone-400" />
                    </div>

                    {metrics.lowStockItems.length === 0 ? (
                        <div className="p-8 text-center text-xs text-emerald-600 font-bold bg-emerald-50 rounded-xl">
                            All paddle variants have healthy stock levels!
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {metrics.lowStockItems.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 bg-stone-50/50">
                                    <div>
                                        <div className="font-black text-stone-900 text-xs">{item.name}</div>
                                        <div className="text-[11px] font-mono text-stone-400">{item.sku}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                                            item.isOut
                                                ? 'bg-rose-100 text-rose-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {item.isOut ? 'Out of Stock' : `${item.stock} left`}
                                        </span>
                                        <div className="text-[10px] text-stone-400 mt-0.5">Threshold: {item.threshold}</div>
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
