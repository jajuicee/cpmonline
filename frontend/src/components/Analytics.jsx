import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Legend, LabelList, PieChart, Pie, Cell
} from 'recharts';
import {
    BarChart3, TrendingUp, DollarSign, Package, AlertCircle, RefreshCw, Trophy, Calendar,
    X, ChevronLeft, ChevronRight, CreditCard, ChevronDown, Store, PieChart as PieIcon, Layers,
    Receipt, Sparkles
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CurrencyDisplay = ({ value }) => (
    <span>
        <span style={{ fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontWeight: 'normal', marginRight: '2px' }}>₱</span>
        {(Number(value) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
);

const CATEGORY_COLORS = {
    Paddles: '#4f46e5',
    Accessories: '#059669',
    Balls: '#d97706',
    Shoes: '#9333ea',
    Bags: '#e11d48',
    Apparel: '#0891b2',
    Default: '#52525b'
};
const PIE_COLORS = ['#4f46e5', '#059669', '#d97706', '#9333ea', '#e11d48', '#0891b2', '#52525b', '#84cc16'];

const getStartOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const getStartOfWeek = (d) => {
    const date = new Date(d);
    date.setDate(date.getDate() - date.getDay());
    return getStartOfDay(date);
};

const TIME_RANGES = [
    { id: '1D', label: 'Today', groupBy: 'hour', days: 0 },
    { id: '7D', label: 'Last 7 Days', groupBy: 'day', days: 7 },
    { id: '30D', label: 'Last 30 Days', groupBy: 'day', days: 30 },
    { id: '6M', label: 'Last 6 Months', groupBy: 'month', days: 180 },
    { id: '1Y', label: 'Last 12 Months', groupBy: 'month', days: 365 }
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const isInRange = (date, start, end) => {
    if (!start || !end) return false;
    const t = date.getTime();
    return t > Math.min(start.getTime(), end.getTime()) && t < Math.max(start.getTime(), end.getTime());
};

const CalendarPicker = ({ onApply, onClose }) => {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [hoverDate, setHoverDate] = useState(null);

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
    const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

    const handleDayClick = (day) => {
        const clicked = new Date(viewYear, viewMonth, day);
        if (!startDate || (startDate && endDate)) { setStartDate(clicked); setEndDate(null); }
        else { if (clicked < startDate) { setEndDate(startDate); setStartDate(clicked); } else setEndDate(clicked); }
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const formatLabel = (d) => d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    return (
        <div className="absolute right-0 top-12 z-50 bg-white border border-stone-200 rounded-2xl shadow-2xl p-5 w-80">
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500 transition-colors"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-zinc-800">{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500 transition-colors"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-zinc-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(viewYear, viewMonth, day);
                    const isStart = isSameDay(date, startDate);
                    const isEnd = isSameDay(date, endDate);
                    const inRange = isInRange(date, startDate, endDate || hoverDate);
                    const isToday = isSameDay(date, today);
                    const isFuture = date > today;
                    return (
                        <button key={day} disabled={isFuture} onClick={() => handleDayClick(day)}
                            onMouseEnter={() => setHoverDate(date)} onMouseLeave={() => setHoverDate(null)}
                            className={`text-xs font-medium py-2 rounded-lg transition-all
                                ${isFuture ? 'text-zinc-300 cursor-not-allowed' : 'cursor-pointer'}
                                ${isStart || isEnd ? 'bg-zinc-950 text-white font-bold' : ''}
                                ${inRange && !isStart && !isEnd ? 'bg-zinc-100 text-zinc-700 rounded-none' : ''}
                                ${!isStart && !isEnd && !inRange && !isFuture ? 'hover:bg-stone-100 text-zinc-700' : ''}
                                ${isToday && !isStart && !isEnd ? 'ring-1 ring-zinc-300' : ''}`}>
                            {day}
                        </button>
                    );
                })}
            </div>
            <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex justify-between text-xs text-zinc-500 mb-3">
                    <div><span className="block font-bold text-zinc-400 mb-0.5">FROM</span><span className="text-zinc-700 font-semibold">{formatLabel(startDate)}</span></div>
                    <div className="text-right"><span className="block font-bold text-zinc-400 mb-0.5">TO</span><span className="text-zinc-700 font-semibold">{formatLabel(endDate)}</span></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-bold rounded-lg border border-stone-200 text-zinc-500 hover:bg-stone-50 transition-all">Cancel</button>
                    <button onClick={() => startDate && endDate && onApply(startDate, endDate)} disabled={!startDate || !endDate}
                        className="flex-1 py-2 text-xs font-bold rounded-lg bg-zinc-950 text-white disabled:opacity-30 hover:bg-zinc-800 transition-all">Apply Range</button>
                </div>
            </div>
        </div>
    );
};

// ── Payment Method Dropdown ──────────────────────────────────────────────────
const PaymentFilter = ({ transactions, paymentLogs, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const paymentMethods = useMemo(() => {
        const set = new Set(transactions.map(t => t.paymentMethod).filter(Boolean));
        paymentLogs.forEach(pl => {
            if (pl.paymentMethod) set.add(pl.paymentMethod);
        });
        ['Cash', 'GCash', 'Maya', 'GoTyme', 'BDO', 'BPI', 'MBOS', 'Credit Card', 'QRPH'].forEach(m => set.add(m));
        return Array.from(set).sort();
    }, [transactions, paymentLogs]);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const isFiltered = value !== 'All';

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border shadow-sm text-xs font-bold"
                style={{
                    backgroundColor: isFiltered ? '#09090b' : '#ffffff',
                    color: isFiltered ? '#ffffff' : '#71717a',
                    borderColor: isFiltered ? '#09090b' : '#d6d3d1',
                    transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
                }}
            >
                <CreditCard size={14} />
                <span>{isFiltered ? value : 'Payment'}</span>
                <ChevronDown size={12} style={{ transition: 'transform 200ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                {isFiltered && (
                    <span onClick={(e) => { e.stopPropagation(); onChange('All'); }} className="ml-0.5 hover:text-red-300 transition-colors">
                        <X size={11} />
                    </span>
                )}
            </button>

            <div
                className="absolute right-0 top-10 z-50 bg-white border border-stone-200 rounded-xl shadow-2xl py-1.5 min-w-[170px]"
                style={{
                    opacity: open ? 1 : 0,
                    transform: open ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                    transition: 'opacity 160ms ease, transform 160ms ease',
                    pointerEvents: open ? 'all' : 'none',
                }}
            >
                <button
                    onClick={() => { onChange('All'); setOpen(false); }}
                    className="w-full text-left px-4 py-2 text-xs flex items-center gap-2 border-b border-stone-100"
                    style={{
                        backgroundColor: value === 'All' ? '#f5f5f4' : 'transparent',
                        color: value === 'All' ? '#09090b' : '#52525b',
                        fontWeight: value === 'All' ? '700' : '500',
                    }}
                >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === 'All' ? 'bg-zinc-800' : 'bg-transparent'}`} />
                    All Payment Methods
                </button>
                {paymentMethods.map(method => (
                    <button
                        key={method}
                        onClick={() => { onChange(method); setOpen(false); }}
                        className="w-full text-left px-4 py-2 text-xs flex items-center gap-2"
                        style={{
                            backgroundColor: value === method ? '#f5f5f4' : 'transparent',
                            color: value === method ? '#09090b' : '#52525b',
                            fontWeight: value === method ? '700' : '500',
                            transition: 'background-color 120ms ease',
                        }}
                        onMouseEnter={e => { if (value !== method) e.currentTarget.style.backgroundColor = '#fafaf9'; }}
                        onMouseLeave={e => { if (value !== method) e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === method ? 'bg-zinc-800' : 'bg-transparent'}`} />
                        {method}
                    </button>
                ))}
            </div>
        </div>
    );
};

const Analytics = () => {
    const { currentBranchId, selectedBranchId, setSelectedBranchId, user, isAdmin, isBranch } = useAuth();
    const [branches, setBranches] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [timeRange, setTimeRange] = useState(TIME_RANGES[0]);
    const [topFilter, setTopFilter] = useState('units');
    const [mainTab, setMainTab] = useState('trends');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All'); // 'All', 'REGULAR', 'CONSIGNMENT'
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showCalendar, setShowCalendar] = useState(false);
    const [customRange, setCustomRange] = useState(null);
    const calendarRef = useRef(null);

    // Effective branch: branch user locked to their branch; admin can select a branch or null for Consolidated All Branches
    const effectiveBranch = isBranch ? user?.branchId : selectedBranchId;

    // Fetch branches for admin filter dropdown
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => setBranches(Array.isArray(res.data) ? res.data.filter(b => b.active) : []))
                .catch(err => console.error('Failed to load branches for analytics:', err));
        }
    }, [isAdmin]);

    useEffect(() => {
        const handler = (e) => { if (calendarRef.current && !calendarRef.current.contains(e.target)) setShowCalendar(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleCalendarApply = (start, end) => {
        const label = `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        setCustomRange({ start, end, label });
        setTimeRange(null);
        setShowCalendar(false);
    };

    const handlePresetSelect = (range) => { setTimeRange(range); setCustomRange(null); };

    const [paymentLogs, setPaymentLogs] = useState([]);

    // Helper: format date as LocalDateTime string for the API
    const fmtDt = (d) => {
        const p = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    const getDateBounds = () => {
        const now = new Date();
        if (customRange) {
            const start = new Date(customRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customRange.end);
            end.setHours(23, 59, 59, 999);
            return { from: fmtDt(start), to: fmtDt(end) };
        }
        if (!timeRange) return null;
        if (timeRange.id === '1D') {
            return { from: fmtDt(getStartOfDay(now)), to: fmtDt(now) };
        }
        const from = new Date(now);
        from.setDate(now.getDate() - timeRange.days);
        from.setHours(0, 0, 0, 0);
        return { from: fmtDt(from), to: fmtDt(now) };
    };

    const fetchData = () => {
        setLoading(true);
        setError('');
        const bounds = getDateBounds();

        const branchParam = effectiveBranch ? `&branchId=${effectiveBranch}` : '';
        const txUrl = bounds
            ? `/api/transactions?from=${bounds.from}&to=${bounds.to}&limit=10000${branchParam}`
            : `/api/transactions?limit=10000${branchParam}`;
        const plUrl = bounds
            ? `/api/payment-logs?from=${bounds.from}&to=${bounds.to}${effectiveBranch ? `&branchId=${effectiveBranch}` : ''}`
            : `/api/payment-logs${effectiveBranch ? `?branchId=${effectiveBranch}` : ''}`;
        const expUrl = bounds
            ? `/api/expenses?from=${bounds.from}&to=${bounds.to}${effectiveBranch ? `&branchId=${effectiveBranch}` : ''}`
            : `/api/expenses${effectiveBranch ? `?branchId=${effectiveBranch}` : ''}`;

        Promise.all([
            axios.get(txUrl).catch(() => ({ data: [] })),
            axios.get(plUrl).catch(() => ({ data: [] })),
            axios.get(expUrl).catch(() => ({ data: [] }))
        ])
            .then(([txRes, plRes, expRes]) => {
                setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
                setPaymentLogs(Array.isArray(plRes.data) ? plRes.data : []);
                setExpenses(Array.isArray(expRes.data) ? expRes.data : []);
            })
            .catch(() => setError('Could not load analytics data.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [timeRange, customRange, effectiveBranch]);

    const processedData = useMemo(() => {
        const now = new Date();
        let cutoffDate, toDate;

        if (customRange) {
            cutoffDate = new Date(customRange.start);
            cutoffDate.setHours(0, 0, 0, 0);
            toDate = new Date(customRange.end);
            toDate.setHours(23, 59, 59, 999);
        } else if (timeRange) {
            if (timeRange.id === '1D') {
                cutoffDate = getStartOfDay(now);
                toDate = now;
            } else {
                cutoffDate = new Date(now);
                cutoffDate.setDate(now.getDate() - timeRange.days);
                cutoffDate.setHours(0, 0, 0, 0);
                toDate = now;
            }
        } else {
            return {
                chartData: [],
                topProducts: [],
                allCategories: ['All'],
                categoryCounts: {},
                categoryBreakdown: { categories: [], totalRevenue: 0, totalUnitsSold: 0, totalCost: 0, totalProfit: 0, overallProfitMargin: 0 },
                operatingExpenses: 0,
                expensesByCategory: {},
                periodExpensesList: [],
                summary: {
                    revenue: 0,
                    grossProfit: 0,
                    grossMargin: 0,
                    cost: 0,
                    profit: 0,
                    margin: 0,
                    expenses: 0,
                    units: 0
                }
            };
        }

        let groupBy = timeRange?.groupBy || 'day';
        if (customRange) {
            const diffDays = Math.round((toDate - cutoffDate) / (1000 * 60 * 60 * 24));
            groupBy = diffDays > 60 ? 'month' : 'day';
        }

        // Build a lookup: orderId → transactionType so we can filter payment logs by type.
        const txTypeMap = {};
        transactions.forEach(t => {
            const type = (t.transactionType || 'REGULAR').toUpperCase();
            if (t.transactionId) txTypeMap[t.transactionId] = type;
            if (t.id) {
                txTypeMap[`LEGACY-${t.id}`] = type;
                txTypeMap[String(t.id)] = type;
            }
        });

        // ── Revenue & Profit: from PAYMENT LOGS (by actual payment date) ──────
        const validLogs = paymentLogs.filter(pl => {
            const pDate = new Date(pl.paymentDate);
            const inDate = pDate >= cutoffDate && pDate <= toDate;
            const inPayment = paymentFilter === 'All'
                || (pl.paymentMethod && pl.paymentMethod.toLowerCase() === paymentFilter.toLowerCase());
            const txType = (txTypeMap[pl.orderId] || 'REGULAR').toUpperCase();
            const inType = typeFilter === 'All'
                ? true
                : typeFilter === 'REGULAR'
                    ? txType !== 'CONSIGNMENT'
                    : txType === 'CONSIGNMENT';
            return inDate && inPayment && inType;
        }).map(pl => {
            const revenue = Number(pl.amount || 0);
            const cost = Number(pl.costPortion || 0);
            return { ...pl, date: new Date(pl.paymentDate), revenue, cost, profit: revenue - cost };
        });

        // Group payment logs by date for the Revenue Trends chart
        const grouped = validLogs.reduce((acc, pl) => {
            let groupKey;
            if (groupBy === 'month') groupKey = pl.date.toLocaleString('en-PH', { month: 'short', year: 'numeric' });
            else if (groupBy === 'week') { const ws = getStartOfWeek(pl.date); groupKey = ws.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }); }
            else if (groupBy === 'hour') groupKey = pl.date.toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true });
            else groupKey = pl.date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

            if (!acc[groupKey]) acc[groupKey] = { name: groupKey, xDate: pl.date.getTime(), revenue: 0, profit: 0, cost: 0 };
            acc[groupKey].revenue += pl.revenue;
            acc[groupKey].profit += pl.profit;
            acc[groupKey].cost += pl.cost;
            return acc;
        }, {});

        const chartData = Object.values(grouped).sort((a, b) => a.xDate - b.xDate);

        const paidOrderIds = new Set(validLogs.map(pl => pl.orderId).filter(Boolean));

        // ── Units & Product Rankings: from TRANSACTIONS ───────────────────────
        const validTxs = transactions.filter(t => {
            // Strict branch match if effectiveBranch is set
            if (effectiveBranch && t.branch?.id && String(t.branch.id) !== String(effectiveBranch)) {
                return false;
            }

            const tDate = new Date(t.transactionDate);
            const inDateByTx = tDate >= cutoffDate && tDate <= toDate;
            const orderId = t.transactionId || `LEGACY-${t.id}`;
            const hasPaidLogInRange = paidOrderIds.has(orderId) || paidOrderIds.has(t.transactionId) || (t.id && paidOrderIds.has(String(t.id)));
            const inDate = inDateByTx || hasPaidLogInRange;

            const inPayment = paymentFilter === 'All'
                || (t.paymentMethod && t.paymentMethod.toLowerCase() === paymentFilter.toLowerCase())
                || hasPaidLogInRange;
            const isPaid = t.status !== 'UNPAID';
            const tType = (t.transactionType || 'REGULAR').toUpperCase();
            const inType = typeFilter === 'All'
                ? true
                : typeFilter === 'REGULAR'
                    ? tType !== 'CONSIGNMENT'
                    : tType === 'CONSIGNMENT';
            return inDate && inPayment && isPaid && inType;
        });

        // ── Dynamic Category Breakdown from validTxs (ensures all filters apply to category view) ──
        const catMap = {};
        let totalCatRevenue = 0;
        let totalCatUnits = 0;
        let totalCatCost = 0;

        validTxs.forEach(t => {
            const catName = t.variant?.product?.category || 'Uncategorized';
            const selling = t.status === 'PARTIAL' ? Number(t.downpayment || 0) : Number(t.finalPrice || 0);
            const cost = Number(t.costPrice || t.variant?.acquisitionPrice || 0);
            const profit = selling - cost;

            if (!catMap[catName]) {
                catMap[catName] = {
                    category: catName,
                    revenue: 0,
                    unitsSold: 0,
                    cost: 0,
                    profit: 0
                };
            }
            catMap[catName].revenue += selling;
            catMap[catName].unitsSold += 1;
            catMap[catName].cost += cost;
            catMap[catName].profit += profit;

            totalCatRevenue += selling;
            totalCatUnits += 1;
            totalCatCost += cost;
        });

        const totalCatProfit = totalCatRevenue - totalCatCost;
        const overallProfitMargin = totalCatRevenue > 0 ? (totalCatProfit / totalCatRevenue) * 100 : 0;

        const categories = Object.values(catMap).map(c => {
            const revenuePercentage = totalCatRevenue > 0 ? (c.revenue / totalCatRevenue) * 100 : 0;
            const unitsPercentage = totalCatUnits > 0 ? (c.unitsSold / totalCatUnits) * 100 : 0;
            const avgSellingPrice = c.unitsSold > 0 ? c.revenue / c.unitsSold : 0;
            const profitMargin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0;
            return {
                ...c,
                revenuePercentage,
                unitsPercentage,
                avgSellingPrice,
                profitMargin
            };
        }).sort((a, b) => b.revenue - a.revenue);

        const categoryBreakdown = {
            totalRevenue: totalCatRevenue,
            totalUnitsSold: totalCatUnits,
            totalCost: totalCatCost,
            totalProfit: totalCatProfit,
            overallProfitMargin,
            categories
        };

        // ── Product Rankings ──
        const productMap = validTxs.reduce((acc, t) => {
            if (!t.variant?.product) return acc;
            const p = t.variant.product;
            const name = `${p.brandName} ${p.modelName} ${t.variant.color ? `(${t.variant.color})` : ''}`.trim();
            const key = t.variant.sku;
            const selling = t.status === 'PARTIAL' ? Number(t.downpayment || 0) : Number(t.finalPrice || 0);
            const cost = Number(t.costPrice || t.variant?.acquisitionPrice || 0);
            if (!acc[key]) acc[key] = { name, sku: t.variant.sku, category: p.category || 'Uncategorized', units: 0, revenue: 0, profit: 0 };
            acc[key].units += 1;
            acc[key].revenue += selling;
            acc[key].profit += selling - cost;
            return acc;
        }, {});

        const categoryCounts = {};
        Object.values(productMap).forEach(p => {
            if (p.category) {
                categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
            }
        });

        const filteredByCategory = categoryFilter === 'All'
            ? Object.values(productMap)
            : Object.values(productMap).filter(p => p.category === categoryFilter);

        const sortedProducts = filteredByCategory.sort((a, b) =>
            topFilter === 'profit' ? b.profit - a.profit || b.units - a.units : b.units - a.units || b.revenue - a.revenue
        );
        const topProducts = sortedProducts.slice(0, 50).map((p, idx) => ({
            ...p,
            name: `#${idx + 1} ${p.name}`
        }));

        // ── Operating Expenses in selected period ──
        let totalOperatingExpenses = 0;
        const expensesByCategory = {};
        const periodExpensesList = [];

        expenses.forEach(e => {
            const isExp = !e.type || e.type.toUpperCase() === 'EXPENSE';
            if (!isExp) return;
            const cost = Number(e.cost || 0);
            const eDate = e.expenseDate ? new Date(e.expenseDate) : null;
            if (eDate && (eDate < cutoffDate || eDate > toDate)) return;

            // Strict branch filter match if effectiveBranch is set
            if (effectiveBranch && e.branch?.id && String(e.branch.id) !== String(effectiveBranch)) {
                return;
            }

            totalOperatingExpenses += cost;
            const cat = e.category || 'General';
            expensesByCategory[cat] = (expensesByCategory[cat] || 0) + cost;
            periodExpensesList.push(e);
        });

        const allCategories = ['All', ...Array.from(new Set(Object.values(productMap).map(p => p.category).filter(Boolean))).sort()];

        // Summary: revenue & profit from payment logs, units from transactions
        const totalRevenue = validLogs.reduce((s, pl) => s + pl.revenue, 0);
        const totalCost = validLogs.reduce((s, pl) => s + pl.cost, 0);
        const grossProfit = totalRevenue - totalCost;
        const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
        const netOperatingProfit = grossProfit - totalOperatingExpenses;
        const operatingMargin = totalRevenue > 0 ? (netOperatingProfit / totalRevenue) * 100 : 0;
        const totalUnits = validTxs.length;

        return {
            chartData,
            topProducts,
            allCategories,
            categoryCounts,
            categoryBreakdown,
            operatingExpenses: totalOperatingExpenses,
            expensesByCategory,
            periodExpensesList,
            summary: {
                revenue: totalRevenue,
                grossProfit,
                grossMargin,
                cost: totalCost,
                profit: netOperatingProfit,
                margin: operatingMargin,
                expenses: totalOperatingExpenses,
                units: totalUnits
            }
        };
    }, [transactions, paymentLogs, expenses, timeRange, topFilter, customRange, paymentFilter, typeFilter, categoryFilter, effectiveBranch]);

    const {
        chartData,
        topProducts,
        allCategories = ['All'],
        categoryCounts = {},
        categoryBreakdown = { categories: [], totalRevenue: 0, totalUnitsSold: 0, totalCost: 0, totalProfit: 0, overallProfitMargin: 0 },
        summary,
        operatingExpenses = 0,
        expensesByCategory = {},
        periodExpensesList = []
    } = processedData;
    const paddleChartHeight = Math.max(400, topProducts.length * 40 + 50);

    return (
        <div className="flex flex-col h-full space-y-6 w-full">

            {/* Header & Controls */}
            <div className="flex flex-wrap justify-between items-center gap-4 shrink-0">
                <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                    <BarChart3 className="text-zinc-500" /> Performance Analytics & P&L
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Branch Filter Selector (for Admin) */}
                    {isAdmin && (
                        <div className="relative">
                            <select
                                value={effectiveBranch ? String(effectiveBranch) : 'ALL'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const nextId = (val === 'ALL' || !val) ? null : Number(val);
                                    if (setSelectedBranchId) {
                                        setSelectedBranchId(nextId);
                                    }
                                }}
                                className="appearance-none pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-zinc-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                            >
                                <option value="ALL">🏢 All Branches (Consolidated)</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>📍 {b.name}</option>
                                ))}
                            </select>
                            <Store size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Transaction Type Filter */}
                    <div className="flex bg-white border border-stone-200 rounded-lg p-1 shadow-sm">
                        {['All', 'REGULAR', 'CONSIGNMENT'].map(tType => (
                            <button
                                key={tType}
                                onClick={() => setTypeFilter(tType)}
                                className="px-3 py-1.5 text-xs font-bold rounded-md transition-all"
                                style={{
                                    backgroundColor: typeFilter === tType ? '#09090b' : 'transparent',
                                    color: typeFilter === tType ? '#ffffff' : '#71717a',
                                }}
                            >
                                {tType === 'All' ? 'All Types' : tType === 'REGULAR' ? 'Regular' : 'Consignment'}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-5 bg-stone-200 mx-1" />

                    {/* Payment Method Filter */}
                    <PaymentFilter transactions={transactions} paymentLogs={paymentLogs} value={paymentFilter} onChange={setPaymentFilter} />

                    <div className="w-px h-5 bg-stone-200 mx-1" />

                    {/* Time Range Presets */}
                    <div className="flex bg-white border border-stone-200 rounded-lg p-1 shadow-sm">
                        {TIME_RANGES.map(range => (
                            <button
                                key={range.id}
                                onClick={() => handlePresetSelect(range)}
                                className="px-4 py-1.5 text-xs font-bold rounded-md"
                                style={{
                                    backgroundColor: timeRange?.id === range.id ? '#09090b' : 'transparent',
                                    color: timeRange?.id === range.id ? '#ffffff' : '#71717a',
                                    transition: 'background-color 200ms ease, color 200ms ease',
                                }}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>

                    {/* Calendar */}
                    <div className="relative" ref={calendarRef}>
                        <button
                            onClick={() => setShowCalendar(v => !v)}
                            title="Select custom date range"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border shadow-sm text-xs font-bold"
                            style={{
                                backgroundColor: customRange ? '#09090b' : '#ffffff',
                                color: customRange ? '#ffffff' : '#71717a',
                                borderColor: customRange ? '#09090b' : '#d6d3d1',
                                transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
                            }}
                        >
                            <Calendar size={15} />
                            {customRange && <span className="max-w-[160px] truncate">{customRange.label}</span>}
                        </button>
                        {customRange && (
                            <button
                                onClick={(e) => { e.stopPropagation(); setCustomRange(null); setTimeRange(TIME_RANGES[0]); }}
                                className="absolute -top-1.5 -right-1.5 text-white rounded-full w-4 h-4 flex items-center justify-center"
                                style={{ backgroundColor: '#3f3f46', transition: 'background-color 150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3f3f46'}
                            >
                                <X size={10} />
                            </button>
                        )}
                        {showCalendar && <CalendarPicker onApply={handleCalendarApply} onClose={() => setShowCalendar(false)} />}
                    </div>

                    <button onClick={fetchData} disabled={loading}
                        className="p-2 ml-1 rounded-lg border border-stone-300 bg-white text-zinc-500 hover:bg-stone-50 disabled:opacity-40 shadow-sm transition-all">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Active filters indicators bar */}
            {(effectiveBranch || typeFilter !== 'All' || paymentFilter !== 'All' || customRange || categoryFilter !== 'All') && (
                <div className="flex flex-wrap items-center gap-2 shrink-0 p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl" style={{ animation: 'fadeSlideIn 200ms ease' }}>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Active Filters:</span>
                    
                    {effectiveBranch && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <Store size={11} className="text-emerald-600" />
                            {branches.find(b => String(b.id) === String(effectiveBranch))?.name || `Branch #${effectiveBranch}`}
                            {isAdmin && (
                                <button onClick={() => setSelectedBranchId(null)} title="Clear branch filter" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                    <X size={11} />
                                </button>
                            )}
                        </span>
                    )}

                    {typeFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-purple-700 text-xs font-bold rounded-lg shadow-xs">
                            <Layers size={11} className="text-purple-600" />
                            {typeFilter === 'REGULAR' ? 'Regular Sales' : 'Consignment'}
                            <button onClick={() => setTypeFilter('All')} title="Show all types" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {paymentFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <CreditCard size={11} className="text-blue-600" />
                            {paymentFilter}
                            <button onClick={() => setPaymentFilter('All')} title="Clear payment filter" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {customRange && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <Calendar size={11} className="text-amber-600" />
                            {customRange.label}
                            <button onClick={() => { setCustomRange(null); setTimeRange(TIME_RANGES[0]); }} title="Clear custom range" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {categoryFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <PieIcon size={11} className="text-indigo-600" />
                            {categoryFilter}
                            <button onClick={() => setCategoryFilter('All')} title="Show all categories" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    <button
                        onClick={() => {
                            if (isAdmin) setSelectedBranchId(null);
                            setTypeFilter('All');
                            setPaymentFilter('All');
                            setCategoryFilter('All');
                            setCustomRange(null);
                            setTimeRange(TIME_RANGES[0]);
                        }}
                        className="text-xs font-bold text-zinc-400 hover:text-rose-600 ml-auto transition-colors underline cursor-pointer"
                    >
                        Reset All Filters
                    </button>
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm font-medium">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* Top Stat Cards (Executive 5-Card Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 shrink-0">
                <StatCard
                    title="Total Revenue"
                    value={loading ? '...' : <CurrencyDisplay value={summary.revenue} />}
                    icon={<DollarSign size={18} className="text-emerald-600" />}
                    bg="bg-emerald-50"
                />
                <StatCard
                    title="Cost of Goods (COGS)"
                    value={loading ? '...' : <CurrencyDisplay value={summary.cost} />}
                    icon={<Layers size={18} className="text-amber-600" />}
                    bg="bg-amber-50"
                />
                <StatCard
                    title="Operating Expenses"
                    value={loading ? '...' : <CurrencyDisplay value={summary.expenses} />}
                    icon={<Receipt size={18} className="text-rose-600" />}
                    bg="bg-rose-50"
                    subtitle="Store rent, bills, supplies"
                />
                <StatCard
                    title="Net Operating Profit"
                    value={loading ? '...' : <CurrencyDisplay value={summary.profit} />}
                    icon={<TrendingUp size={18} className={summary.profit >= 0 ? "text-blue-600" : "text-rose-600"} />}
                    subtitle={summary.margin ? `${summary.margin.toFixed(1)}% net margin` : null}
                    bg={summary.profit >= 0 ? "bg-blue-50" : "bg-rose-50"}
                />
                <StatCard
                    title="Units Sold"
                    value={loading ? '...' : summary.units?.toLocaleString()}
                    icon={<Package size={18} className="text-purple-600" />}
                    bg="bg-purple-50"
                />
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-stone-100 p-1 rounded-xl w-fit shrink-0 border border-stone-200/80">
                <button onClick={() => setMainTab('trends')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'trends' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Revenue Trends</button>
                <button onClick={() => setMainTab('paddles')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'paddles' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Product Rankings</button>
                <button onClick={() => setMainTab('categories')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'categories' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Category Breakdown</button>
                <button onClick={() => setMainTab('pnl')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'pnl' ? 'bg-white shadow-xs text-emerald-800 font-black' : 'text-zinc-500 hover:text-zinc-700'}`}>
                    📊 Branch P&L Statement
                </button>
            </div>

            {/* Charts Area */}
            <div className="flex-1 min-h-[500px] flex flex-col pb-6">

                {mainTab === 'trends' && (
                    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 flex flex-col flex-1 h-full min-h-[400px]">
                        <h3 className="text-base font-bold text-zinc-800 mb-6 flex items-center gap-2 flex-wrap">
                            <TrendingUp size={18} className="text-blue-500" /> Revenue & Profit Trends
                            {customRange && <span className="text-xs font-normal text-zinc-400 bg-stone-100 px-2 py-0.5 rounded-full">{customRange.label}</span>}
                            {paymentFilter !== 'All' && <span className="text-xs font-normal text-zinc-400 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CreditCard size={10} /> {paymentFilter}</span>}
                        </h3>
                        {loading ? (
                            <div className="flex-1 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                        ) : chartData.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                                <BarChart3 size={32} className="opacity-20 mb-3" />
                                <p>No sales data found{paymentFilter !== 'All' ? ` for ${paymentFilter}` : ''} in this period.</p>
                            </div>
                        ) : (
                            <div className="flex-1 w-full min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#71717a' }} tickLine={false} axisLine={false} dy={10} />
                                        <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#71717a' }} tickLine={false} axisLine={false} />
                                        <RechartsTooltip cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value) => [formatCurrency(value)]} />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }} iconType="circle" />
                                        <Bar dataKey="revenue" name="Total Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                        <Bar dataKey="profit" name="Net Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                )}

                {mainTab === 'paddles' && (
                    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-6 flex flex-col flex-1 h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-3 shrink-0">
                            <h3 className="text-base font-bold text-zinc-800 flex items-center gap-2 flex-wrap">
                                <Trophy size={18} className="text-amber-500" /> Product Rankings
                                {customRange && <span className="text-xs font-normal text-zinc-400 bg-stone-100 px-2 py-0.5 rounded-full">{customRange.label}</span>}
                                {paymentFilter !== 'All' && <span className="text-xs font-normal text-zinc-400 bg-stone-100 px-2 py-0.5 rounded-full flex items-center gap-1"><CreditCard size={10} /> {paymentFilter}</span>}
                            </h3>
                            <div className="flex bg-stone-100 p-1 rounded-lg">
                                <button onClick={() => setTopFilter('units')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${topFilter === 'units' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>By Sales Vol.</button>
                                <button onClick={() => setTopFilter('profit')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${topFilter === 'profit' ? 'bg-white shadow text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>By Net Profit</button>
                            </div>
                        </div>

                        {/* Category tabs */}
                        <div className="flex items-center gap-2 mb-4 shrink-0 flex-wrap">
                            {allCategories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCategoryFilter(cat)}
                                    className="px-3 py-1 rounded-full text-xs font-bold border"
                                    style={{
                                        backgroundColor: categoryFilter === cat ? '#09090b' : '#ffffff',
                                        color: categoryFilter === cat ? '#ffffff' : '#52525b',
                                        borderColor: categoryFilter === cat ? '#09090b' : '#d6d3d1',
                                        transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
                                    }}
                                >
                                    {cat}
                                    {cat !== 'All' && (
                                        <span
                                            className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                                            style={{
                                                backgroundColor: categoryFilter === cat ? 'rgba(255,255,255,0.2)' : '#f5f5f4',
                                                color: categoryFilter === cat ? '#ffffff' : '#71717a',
                                                transition: 'background-color 200ms ease, color 200ms ease',
                                            }}
                                        >
                                            {categoryCounts[cat] || ''}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        <p className="text-xs text-zinc-500 mb-4 shrink-0">
                            Showing {topProducts.length} {categoryFilter !== 'All' ? `${categoryFilter} ` : ''}products sold during this period
                        </p>

                        {loading ? (
                            <div className="flex-1 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                        ) : topProducts.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
                                <Package size={32} className="opacity-20 mb-3" />
                                <p className="text-sm">No products sold{paymentFilter !== 'All' ? ` via ${paymentFilter}` : ''} in this period.</p>
                            </div>
                        ) : (
                            <div className="flex-1 w-full overflow-y-auto min-h-0 pt-2 pr-4">
                                <div style={{ height: paddleChartHeight }} className="w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e5e7eb" />
                                            <XAxis type="number" hide />
                                            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={false} />
                                            <RechartsTooltip cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value) => topFilter === 'profit' ? [formatCurrency(value)] : [value]} />
                                            <Bar dataKey={topFilter === 'profit' ? 'profit' : 'units'} name={topFilter === 'profit' ? 'Net Profit' : 'Units Sold'} fill={topFilter === 'profit' ? '#3b82f6' : '#f59e0b'} radius={[0, 4, 4, 0]} barSize={24}>
                                                <LabelList dataKey={topFilter === 'profit' ? 'profit' : 'units'} position="right" fill={topFilter === 'profit' ? '#3b82f6' : '#f59e0b'} fontSize={12} fontWeight="bold" formatter={(val) => topFilter === 'profit' ? formatCurrency(val) : `${val} units`} />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {mainTab === 'categories' && (
                    <div className="flex flex-col gap-6 flex-1 min-h-[400px]">
                        {/* Top visual charts row: Revenue Share Donut & Unit Volume Donut */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
                            {/* Revenue Distribution Chart */}
                            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <PieIcon size={18} className="text-indigo-600" />
                                        <h4 className="text-sm font-black text-zinc-900 tracking-tight">Sales Revenue Share by Category</h4>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                        {categoryBreakdown ? formatCurrency(categoryBreakdown.totalRevenue) : '...'}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 mb-4">Percentage of total gross sales generated</p>

                                {loading ? (
                                    <div className="h-64 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                                ) : !categoryBreakdown?.categories?.length ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-zinc-400">
                                        <Package size={32} className="opacity-20 mb-2" />
                                        <p className="text-sm">No category sales recorded in this period.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="w-full sm:w-1/2 h-60">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={categoryBreakdown.categories}
                                                        dataKey="revenue"
                                                        nameKey="category"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={85}
                                                        paddingAngle={3}
                                                    >
                                                        {categoryBreakdown.categories.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        formatter={(val, name, item) => [
                                                            `${formatCurrency(val)} (${item.payload.revenuePercentage.toFixed(1)}%)`,
                                                            name
                                                        ]}
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="w-full sm:w-1/2 flex flex-col gap-2">
                                            {categoryBreakdown.categories.map((cat, idx) => (
                                                <div key={cat.category} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: CATEGORY_COLORS[cat.category] || PIE_COLORS[idx % PIE_COLORS.length] }}
                                                        />
                                                        <span className="font-bold text-zinc-700 truncate">{cat.category}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-right">
                                                        <span className="font-semibold text-zinc-500 font-mono">{formatCurrency(cat.revenue)}</span>
                                                        <span className="font-black text-zinc-900 w-12 text-right">{cat.revenuePercentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Units Volume Distribution Chart */}
                            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Layers size={18} className="text-blue-600" />
                                        <h4 className="text-sm font-black text-zinc-900 tracking-tight">Units Volume Share by Category</h4>
                                    </div>
                                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                        {categoryBreakdown ? `${categoryBreakdown.totalUnitsSold.toLocaleString()} units` : '...'}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 mb-4">Percentage of total items sold</p>

                                {loading ? (
                                    <div className="h-64 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                                ) : !categoryBreakdown?.categories?.length ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-zinc-400">
                                        <Package size={32} className="opacity-20 mb-2" />
                                        <p className="text-sm">No category sales recorded in this period.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center gap-4">
                                        <div className="w-full sm:w-1/2 h-60">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={categoryBreakdown.categories}
                                                        dataKey="unitsSold"
                                                        nameKey="category"
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={50}
                                                        outerRadius={85}
                                                        paddingAngle={3}
                                                    >
                                                        {categoryBreakdown.categories.map((entry, index) => (
                                                            <Cell key={`cell-u-${index}`} fill={CATEGORY_COLORS[entry.category] || PIE_COLORS[index % PIE_COLORS.length]} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip
                                                        formatter={(val, name, item) => [
                                                            `${val.toLocaleString()} units (${item.payload.unitsPercentage.toFixed(1)}%)`,
                                                            name
                                                        ]}
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <div className="w-full sm:w-1/2 flex flex-col gap-2">
                                            {categoryBreakdown.categories.map((cat, idx) => (
                                                <div key={cat.category} className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span
                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                            style={{ backgroundColor: CATEGORY_COLORS[cat.category] || PIE_COLORS[idx % PIE_COLORS.length] }}
                                                        />
                                                        <span className="font-bold text-zinc-700 truncate">{cat.category}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-right">
                                                        <span className="font-semibold text-zinc-500">{cat.unitsSold.toLocaleString()} units</span>
                                                        <span className="font-black text-zinc-900 w-12 text-right">{cat.unitsPercentage.toFixed(1)}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Detailed Category Breakdown Table */}
                        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 flex flex-col">
                            <h4 className="text-sm font-black text-zinc-900 mb-4 tracking-tight">Complete Category Performance Matrix</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-zinc-400 font-bold">
                                            <th className="pb-3">Category</th>
                                            <th className="pb-3 text-right">Sales Revenue</th>
                                            <th className="pb-3 text-right">% of Sales</th>
                                            <th className="pb-3 text-right">Units Sold</th>
                                            <th className="pb-3 text-right">% of Volume</th>
                                            <th className="pb-3 text-right">Avg Item Price</th>
                                            <th className="pb-3 text-right">Gross Profit</th>
                                            <th className="pb-3 text-right">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {categoryBreakdown?.categories?.map((cat, idx) => (
                                            <tr key={cat.category} className="hover:bg-stone-50/80 transition-colors">
                                                <td className="py-3 font-bold text-zinc-900 flex items-center gap-2">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full"
                                                        style={{ backgroundColor: CATEGORY_COLORS[cat.category] || PIE_COLORS[idx % PIE_COLORS.length] }}
                                                    />
                                                    {cat.category}
                                                </td>
                                                <td className="py-3 text-right font-black text-emerald-600 font-mono">
                                                    {formatCurrency(cat.revenue)}
                                                </td>
                                                <td className="py-3 text-right font-bold text-zinc-700">
                                                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs">
                                                        {cat.revenuePercentage.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right font-black text-zinc-900">
                                                    {cat.unitsSold.toLocaleString()}
                                                </td>
                                                <td className="py-3 text-right font-bold text-zinc-700">
                                                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-black text-xs">
                                                        {cat.unitsPercentage.toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="py-3 text-right text-zinc-600 font-mono text-xs">
                                                    {formatCurrency(cat.avgSellingPrice)}
                                                </td>
                                                <td className="py-3 text-right font-bold text-purple-600 font-mono">
                                                    {formatCurrency(cat.profit)}
                                                </td>
                                                <td className="py-3 text-right font-black text-zinc-800 text-xs">
                                                    {cat.profitMargin.toFixed(1)}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {categoryBreakdown && (
                                        <tfoot>
                                            <tr className="border-t-2 border-stone-200 font-black text-sm bg-stone-50/50">
                                                <td className="py-3 font-black text-zinc-900">Total Across All Categories</td>
                                                <td className="py-3 text-right text-emerald-600 font-mono">{formatCurrency(categoryBreakdown.totalRevenue)}</td>
                                                <td className="py-3 text-right text-emerald-700">100.0%</td>
                                                <td className="py-3 text-right text-zinc-900">{categoryBreakdown.totalUnitsSold.toLocaleString()}</td>
                                                <td className="py-3 text-right text-blue-700">100.0%</td>
                                                <td className="py-3 text-right text-zinc-600 font-mono text-xs">—</td>
                                                <td className="py-3 text-right text-purple-600 font-mono">{formatCurrency(categoryBreakdown.totalProfit)}</td>
                                                <td className="py-3 text-right text-zinc-900">{categoryBreakdown.overallProfitMargin?.toFixed(1)}%</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {mainTab === 'pnl' && (
                    <div className="space-y-6">
                        {/* P&L Statement Card */}
                        <div className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6 lg:p-8">
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-stone-200/80">
                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                                        <Sparkles size={12} />
                                        Profit & Loss Statement
                                    </div>
                                    <h3 className="text-xl font-black text-stone-900 tracking-tight">
                                        {effectiveBranch
                                            ? `${branches.find(b => String(b.id) === String(effectiveBranch))?.name || 'Branch'} P&L Statement`
                                            : 'Consolidated P&L Statement (All Locations)'}
                                    </h3>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        Income from sales collections minus inventory cost and branch operating overhead
                                    </p>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Net Operating Profit</span>
                                    <span className={`text-2xl font-black font-mono ${
                                        summary.profit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                                    }`}>
                                        {formatCurrency(summary.profit)}
                                    </span>
                                    <span className="text-xs text-stone-400 font-bold block mt-0.5">
                                        {summary.margin ? `${summary.margin.toFixed(1)}% net margin` : '—'}
                                    </span>
                                </div>
                            </div>

                            {/* P&L Line Items Table */}
                            <div className="mt-6 overflow-x-auto">
                                <table className="w-full text-left text-xs font-medium">
                                    <thead>
                                        <tr className="border-b border-stone-200 text-stone-400 uppercase text-[10px] font-black tracking-wider">
                                            <th className="py-3 px-4">Financial Line Item</th>
                                            <th className="py-3 px-4 text-right">Amount</th>
                                            <th className="py-3 px-4 text-right">% of Revenue</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {/* REVENUE */}
                                        <tr className="bg-emerald-50/30">
                                            <td className="py-3.5 px-4 font-black text-stone-900 flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                1. Gross Sales Revenue
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-emerald-700 font-mono text-sm">
                                                {formatCurrency(summary.revenue)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-black text-stone-700">
                                                100.0%
                                            </td>
                                        </tr>

                                        {/* COGS */}
                                        <tr>
                                            <td className="py-3.5 px-4 font-bold text-stone-700 pl-8">
                                                Less: Cost of Goods Sold (COGS / Inventory Cost)
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-700">
                                                ({formatCurrency(summary.cost)})
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-stone-500">
                                                {summary.revenue > 0 ? ((summary.cost / summary.revenue) * 100).toFixed(1) : 0}%
                                            </td>
                                        </tr>

                                        {/* GROSS PROFIT */}
                                        <tr className="bg-stone-50 font-black">
                                            <td className="py-3.5 px-4 text-stone-900 pl-6">
                                                2. Gross Profit
                                            </td>
                                            <td className="py-3.5 px-4 text-right font-mono text-stone-900 text-sm">
                                                {formatCurrency(summary.grossProfit)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right text-emerald-700">
                                                {summary.grossMargin ? `${summary.grossMargin.toFixed(1)}%` : '—'}
                                            </td>
                                        </tr>

                                        {/* OPERATING EXPENSES HEADER */}
                                        <tr className="bg-rose-50/20">
                                            <td colSpan={3} className="py-2.5 px-4 font-black text-rose-800 uppercase tracking-wider text-[10px]">
                                                3. Operating Expenses & Store Overhead
                                            </td>
                                        </tr>

                                        {/* EXPENSE CATEGORIES */}
                                        {Object.entries(expensesByCategory).length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="py-3 px-8 text-stone-400 italic">
                                                    No local operating expenses recorded for this period
                                                </td>
                                            </tr>
                                        ) : (
                                            Object.entries(expensesByCategory).map(([cat, amt]) => (
                                                <tr key={cat} className="hover:bg-stone-50 transition-colors">
                                                    <td className="py-2.5 px-4 pl-8 text-stone-600">
                                                        • {cat}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                                                        ({formatCurrency(amt)})
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right text-stone-400">
                                                        {summary.revenue > 0 ? ((amt / summary.revenue) * 100).toFixed(1) : 0}%
                                                    </td>
                                                </tr>
                                            ))
                                        )}

                                        {/* TOTAL EXPENSES */}
                                        <tr className="bg-stone-50/80 font-bold">
                                            <td className="py-3 px-4 pl-6 text-stone-800">
                                                Total Operating Expenses
                                            </td>
                                            <td className="py-3 px-4 text-right font-mono text-rose-600">
                                                ({formatCurrency(summary.expenses)})
                                            </td>
                                            <td className="py-3 px-4 text-right text-rose-600 font-bold">
                                                {summary.revenue > 0 ? ((summary.expenses / summary.revenue) * 100).toFixed(1) : 0}%
                                            </td>
                                        </tr>

                                        {/* NET OPERATING PROFIT */}
                                        <tr className="bg-stone-900 text-white font-black text-sm">
                                            <td className="py-4 px-4 rounded-l-xl">
                                                4. Net Operating Profit (EBIT)
                                            </td>
                                            <td className="py-4 px-4 text-right font-mono text-base">
                                                <span className={summary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                                    {formatCurrency(summary.profit)}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-right text-emerald-400 rounded-r-xl">
                                                {summary.margin ? `${summary.margin.toFixed(1)}%` : '—'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Recent Period Expenses Audit Ledger */}
                        <div className="bg-white border border-stone-200 rounded-3xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h4 className="text-sm font-black text-stone-900">
                                        Expense Disbursals During Period
                                    </h4>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        Line items contributing to total operating costs above
                                    </p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-stone-100 text-stone-700">
                                    {periodExpensesList.length} expenses
                                </span>
                            </div>

                            {periodExpensesList.length === 0 ? (
                                <div className="p-8 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                                    No expense records found for this period and branch selection.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-stone-50 text-stone-400 font-bold uppercase text-[10px] tracking-wider border-b border-stone-200">
                                            <tr>
                                                <th className="py-2.5 px-4">Date</th>
                                                <th className="py-2.5 px-4">Expense Title</th>
                                                <th className="py-2.5 px-4">Category</th>
                                                <th className="py-2.5 px-4">Payment Source</th>
                                                <th className="py-2.5 px-4">Branch</th>
                                                <th className="py-2.5 px-4 text-right">Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {periodExpensesList.map(exp => (
                                                <tr key={exp.id} className="hover:bg-stone-50 transition-colors">
                                                    <td className="py-2.5 px-4 font-mono text-stone-500">
                                                        {exp.expenseDate ? new Date(exp.expenseDate).toLocaleDateString('en-PH') : '—'}
                                                    </td>
                                                    <td className="py-2.5 px-4 font-bold text-stone-800">
                                                        {exp.name}
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700">
                                                            {exp.category || 'General'}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-stone-600 font-medium">
                                                        {exp.paymentSource || 'Cash Drawer'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-stone-600 font-medium">
                                                        {exp.branch?.name || 'Central Admin'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-right font-black font-mono text-rose-600">
                                                        {formatCurrency(exp.cost)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

const StatCard = ({ title, value, icon, subtitle, bg }) => (
    <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 flex items-start gap-4">
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        <div>
            <p className="text-sm font-bold text-zinc-500 mb-1">{title}</p>
            <h4 className="text-2xl font-normal text-zinc-900 tracking-tight">{value}</h4>
            {subtitle && <p className="text-xs font-bold text-zinc-400 mt-1">{subtitle}</p>}
        </div>
    </div>
);

export default Analytics;