import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AdminBatchProfitAnalytics from './AdminBatchProfitAnalytics';
import AdminHqDirectAnalytics from './AdminHqDirectAnalytics';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Legend, LabelList, PieChart, Pie, Cell
} from 'recharts';
import {
    BarChart3, TrendingUp, DollarSign, Package, AlertCircle, RefreshCw, Trophy, Calendar,
    X, ChevronLeft, ChevronRight, CreditCard, ChevronDown, Store, PieChart as PieIcon, Layers,
    Receipt, Sparkles, ShoppingCart, Users, ArrowRight, Building2, Boxes, Check, Truck
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

const Analytics = ({ branchId: propBranchId, branchName: propBranchName } = {}) => {
    const { currentBranchId, selectedBranchId, setSelectedBranchId, user, isAdmin, isBranch, isCashier } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();

    // Strict branch scope: when propBranchId is explicitly passed or logged in as a branch account
    const isExplicitBranchScope = propBranchId !== undefined || isBranch;

    const isHqProp = propBranchId === 'HQ' || propBranchId === 0 || propBranchId === -1;
    const isHqQuery = isAdmin && !isExplicitBranchScope && searchParams.get('mode') === 'hq';

    const isSupplierTab = isAdmin && !isExplicitBranchScope && (searchParams.get('tab') === 'supplier' || searchParams.get('tab') === 'suppliers');

    const mode = isSupplierTab
        ? 'supplier'
        : (isAdmin && !isExplicitBranchScope && searchParams.get('tab') === 'batch-profit')
        ? 'batch-profit'
        : (isHqQuery || isHqProp ? 'hq' : 'retail');

    const effectiveBranch = propBranchId !== undefined
        ? propBranchId
        : (isBranch
            ? user?.branchId
            : (mode === 'hq' || selectedBranchId === 'HQ' || selectedBranchId === 0 ? 'HQ' : selectedBranchId));

    const isHqScope = effectiveBranch === 'HQ' || effectiveBranch === 0 || effectiveBranch === -1;
    const isBranchScope = isBranch || isCashier || (!isAdmin) || (effectiveBranch != null && !isHqScope);

    const [branches, setBranches] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [timeRange, setTimeRange] = useState(TIME_RANGES[0]);
    const [topFilter, setTopFilter] = useState('units');
    const [mainTab, setMainTab] = useState('trends');
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [typeFilter, setTypeFilter] = useState('All'); // 'All', 'REGULAR', 'CONSIGNMENT'
    const [sourceTypeFilter, setSourceTypeFilter] = useState('All'); // 'All', 'ALLOCATED', 'BRANCH_DIRECT'
    const [supplierFilter, setSupplierFilter] = useState(() => searchParams.get('supplierId') || 'All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [showCalendar, setShowCalendar] = useState(false);
    const [customRange, setCustomRange] = useState(null);
    const calendarRef = useRef(null);

    // Sync supplier filter with URL if provided
    useEffect(() => {
        const sId = searchParams.get('supplierId');
        if (sId) {
            setSupplierFilter(sId);
        }
    }, [searchParams]);

    // Fetch branches for admin filter dropdown / name resolution
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => setBranches(Array.isArray(res.data) ? res.data.filter(b => b.active) : []))
                .catch(err => console.error('Failed to load branches for analytics:', err));
        }
    }, [isAdmin]);

    // Fetch suppliers for analytics filter
    useEffect(() => {
        axios.get('/api/suppliers')
            .then(res => setSuppliers(Array.isArray(res.data) ? res.data : []))
            .catch(err => console.error('Failed to load suppliers for analytics:', err));
    }, []);

    // Resolved display branch name
    const currentBranchName = useMemo(() => {
        if (propBranchName) return propBranchName;
        if (isHqScope) return 'Main Admin (Central HQ & Consignees)';
        if (effectiveBranch) {
            const found = branches.find(b => String(b.id) === String(effectiveBranch));
            if (found?.name) return found.name;
        }
        if (isBranch && user?.branchName) return user.branchName;
        return effectiveBranch ? `Branch #${effectiveBranch}` : null;
    }, [propBranchName, isHqScope, effectiveBranch, branches, isBranch, user]);

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

        const branchParam = isHqScope
            ? '&onlyHq=true&branchId=0'
            : (effectiveBranch ? `&branchId=${effectiveBranch}` : '');
        const txUrl = bounds
            ? `/api/transactions?from=${bounds.from}&to=${bounds.to}&limit=10000${branchParam}`
            : `/api/transactions?limit=10000${branchParam}`;
        const plUrl = bounds
            ? `/api/payment-logs?from=${bounds.from}&to=${bounds.to}${isHqScope ? '&onlyHq=true' : (effectiveBranch ? `&branchId=${effectiveBranch}` : '')}`
            : `/api/payment-logs${isHqScope ? '?onlyHq=true' : (effectiveBranch ? `?branchId=${effectiveBranch}` : '')}`;
        const expUrl = bounds
            ? `/api/expenses?from=${bounds.from}&to=${bounds.to}${isHqScope ? '&onlyHq=true' : (effectiveBranch ? `&branchId=${effectiveBranch}` : '')}`
            : `/api/expenses${isHqScope ? '?onlyHq=true' : (effectiveBranch ? `?branchId=${effectiveBranch}` : '')}`;

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
    }, [timeRange, customRange, effectiveBranch, mode]);

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

        // Build lookups and helpers for filtering by type, sourceType, and supplier
        const txTypeMap = {};
        const txsByOrderId = {};
        transactions.forEach(t => {
            const type = (t.transactionType || 'REGULAR').toUpperCase();
            const orderId = t.transactionId || `LEGACY-${t.id}`;
            if (t.transactionId) txTypeMap[t.transactionId] = type;
            if (t.id) {
                txTypeMap[`LEGACY-${t.id}`] = type;
                txTypeMap[String(t.id)] = type;
            }
            if (!txsByOrderId[orderId]) txsByOrderId[orderId] = [];
            txsByOrderId[orderId].push(t);
            if (t.transactionId && !txsByOrderId[t.transactionId]) {
                txsByOrderId[t.transactionId] = txsByOrderId[orderId];
            }
            if (t.id && !txsByOrderId[String(t.id)]) {
                txsByOrderId[String(t.id)] = txsByOrderId[orderId];
            }
        });

        const getTxSourceType = (t) => {
            const st = (t.sourceType || t.stockBatch?.sourceType || (t.branchDirect ? 'BRANCH_DIRECT' : 'ALLOCATED')).toUpperCase();
            return st === 'BRANCH_DIRECT' ? 'BRANCH_DIRECT' : 'ALLOCATED';
        };

        const getTxSupplierId = (t) => {
            return t.supplier?.id || t.stockBatch?.supplier?.id || null;
        };

        const getTxSupplierName = (t) => {
            return t.supplier?.name || t.stockBatch?.supplier?.name || 'Direct / Unassigned';
        };

        const matchesTxFilters = (t) => {
            if (sourceTypeFilter !== 'All') {
                if (getTxSourceType(t) !== sourceTypeFilter.toUpperCase()) return false;
            }
            if (supplierFilter !== 'All') {
                const sId = getTxSupplierId(t);
                if (String(sId) !== String(supplierFilter)) return false;
            }
            return true;
        };

        // ── Revenue & Profit: from PAYMENT LOGS (by actual payment date) ──────
        const validLogs = paymentLogs.filter(pl => {
            const pDate = new Date(pl.paymentDate);
            const inDate = pDate >= cutoffDate && pDate <= toDate;
            const inPayment = paymentFilter === 'All'
                || (pl.paymentMethod && pl.paymentMethod.toLowerCase() === paymentFilter.toLowerCase());
            const txType = (txTypeMap[pl.orderId] || 'REGULAR').toUpperCase();
            if (isBranchScope && txType === 'CONSIGNMENT') {
                return false;
            }
            const inType = typeFilter === 'All'
                ? true
                : typeFilter === 'REGULAR'
                    ? txType !== 'CONSIGNMENT'
                    : txType === 'CONSIGNMENT';
            if (!inDate || !inPayment || !inType) return false;

            // Source type & supplier filters
            if (sourceTypeFilter !== 'All' || supplierFilter !== 'All') {
                const orderItems = txsByOrderId[pl.orderId] || (pl.transaction?.id ? txsByOrderId[String(pl.transaction.id)] : null);
                if (!orderItems || orderItems.length === 0) return false;
                const hasMatchingItem = orderItems.some(matchesTxFilters);
                if (!hasMatchingItem) return false;
            }
            return true;
        }).map(pl => {
            let revenue = Number(pl.amount || 0);
            let cost = Number(pl.costPortion || 0);

            // If an order had multiple items and only some matched the filters, scale proportionally
            if (sourceTypeFilter !== 'All' || supplierFilter !== 'All') {
                const orderItems = txsByOrderId[pl.orderId] || (pl.transaction?.id ? txsByOrderId[String(pl.transaction.id)] : null);
                if (orderItems && orderItems.length > 0) {
                    const totalOrderVal = orderItems.reduce((s, it) => s + Number(it.finalPrice || 0), 0) || 1;
                    const matchingOrderVal = orderItems.filter(matchesTxFilters).reduce((s, it) => s + Number(it.finalPrice || 0), 0);
                    const ratio = matchingOrderVal / totalOrderVal;
                    revenue = Math.round(revenue * ratio * 100) / 100;
                    cost = Math.round(cost * ratio * 100) / 100;
                }
            }

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
            if (isHqScope) {
                if (t.branch?.id) return false;
            } else if (effectiveBranch) {
                if (!t.branch || String(t.branch.id) !== String(effectiveBranch)) return false;
            }

            // Exclude consignees / consignment completely from branch accounts & branch analytics
            if (isBranchScope && ((t.transactionType || '').toUpperCase() === 'CONSIGNMENT' || t.consignee != null)) {
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

            if (!inDate || !inPayment || !isPaid || !inType) return false;

            // Apply source type & supplier filters
            return matchesTxFilters(t);
        });

        // ── Dynamic Category Breakdown & Product Rankings from validTxs ──
        // Ensure revenue and profit from payments made in this period are accurately attributed
        const paidAmountByOrderId = {};
        const paidCostByOrderId = {};
        const paidAmountByTxId = {};
        const paidCostByTxId = {};

        validLogs.forEach(pl => {
            if (pl.orderId) {
                paidAmountByOrderId[pl.orderId] = (paidAmountByOrderId[pl.orderId] || 0) + pl.revenue;
                paidCostByOrderId[pl.orderId] = (paidCostByOrderId[pl.orderId] || 0) + pl.cost;
            }
            if (pl.transaction?.id) {
                paidAmountByTxId[pl.transaction.id] = (paidAmountByTxId[pl.transaction.id] || 0) + pl.revenue;
                paidCostByTxId[pl.transaction.id] = (paidCostByTxId[pl.transaction.id] || 0) + pl.cost;
            }
        });

        const getTxRevenueAndCost = (t) => {
            const orderId = t.transactionId || `LEGACY-${t.id}`;
            const hasTxLog = paidAmountByTxId[t.id] !== undefined;
            const hasOrderLog = paidAmountByOrderId[orderId] !== undefined;
            
            let selling;
            let cost;
            if (hasTxLog) {
                selling = paidAmountByTxId[t.id];
                cost = paidCostByTxId[t.id] || 0;
            } else if (hasOrderLog) {
                const orderItems = transactions.filter(tx => (tx.transactionId || `LEGACY-${tx.id}`) === orderId);
                if (orderItems.length <= 1) {
                    selling = paidAmountByOrderId[orderId];
                    cost = paidCostByOrderId[orderId] || Number(t.costPrice || t.variant?.acquisitionPrice || 0);
                } else {
                    const totalOrderPrice = orderItems.reduce((s, it) => s + Number(it.finalPrice || 0), 0) || 1;
                    const ratio = Number(t.finalPrice || 0) / totalOrderPrice;
                    selling = Math.round((paidAmountByOrderId[orderId] * ratio) * 100) / 100;
                    cost = Math.round(((paidCostByOrderId[orderId] || 0) * ratio) * 100) / 100;
                }
            } else {
                selling = t.status === 'PARTIAL' ? Number(t.downpayment || 0) : Number(t.finalPrice || 0);
                cost = Number(t.costPrice || t.variant?.acquisitionPrice || 0);
            }
            return { selling, cost, profit: selling - cost };
        };

        const catMap = {};
        let totalCatRevenue = 0;
        let totalCatUnits = 0;
        let totalCatCost = 0;

        validTxs.forEach(t => {
            const catName = t.variant?.product?.category || 'Uncategorized';
            const { selling, cost, profit } = getTxRevenueAndCost(t);

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
            const { selling, cost, profit } = getTxRevenueAndCost(t);
            if (!acc[key]) acc[key] = { name, sku: t.variant.sku, category: p.category || 'Uncategorized', units: 0, revenue: 0, profit: 0 };
            acc[key].units += 1;
            acc[key].revenue += selling;
            acc[key].profit += profit;
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
            if (isHqScope) {
                if (e.branch?.id) return;
            } else if (effectiveBranch && e.branch?.id && String(e.branch.id) !== String(effectiveBranch)) {
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

        // ── Consignees Network Breakdown (for HQ / Main Admin scope) ──
        const consigneesMap = {};
        let consigneeTotalValue = 0;
        let consigneeTotalCollected = 0;
        let consigneeTotalPending = 0;
        let consigneeTotalProfit = 0;

        validTxs.forEach(t => {
            const isConsignment = (t.transactionType || '').toUpperCase() === 'CONSIGNMENT' || t.consignee != null;
            if (!isConsignment) return;
            const finalPrice = Number(t.finalPrice || 0);
            const downpayment = Number(t.downpayment || 0);
            const collected = t.status === 'FULL' ? finalPrice : downpayment;
            const balance = Math.max(0, finalPrice - collected);
            const cost = Number(t.costPrice || t.variant?.acquisitionPrice || 0);
            const realizedProfit = finalPrice > 0 ? Math.max(0, (finalPrice - cost) * (collected / finalPrice)) : 0;

            consigneeTotalValue += finalPrice;
            consigneeTotalCollected += collected;
            consigneeTotalPending += balance;
            consigneeTotalProfit += realizedProfit;

            const cName = t.consignee?.name || t.customerName || 'Consignee';
            const cId = t.consignee?.id || cName;
            if (!consigneesMap[cId]) {
                consigneesMap[cId] = {
                    id: cId,
                    name: cName,
                    contactInfo: t.consignee?.contactInfo || '—',
                    totalUnits: 0,
                    unitsPaid: 0,
                    unitsPending: 0,
                    totalValue: 0,
                    amountPaid: 0,
                    balanceDue: 0,
                    realizedProfit: 0
                };
            }
            consigneesMap[cId].totalUnits += 1;
            if (t.status === 'FULL') {
                consigneesMap[cId].unitsPaid += 1;
            } else {
                consigneesMap[cId].unitsPending += 1;
            }
            consigneesMap[cId].totalValue += finalPrice;
            consigneesMap[cId].amountPaid += collected;
            consigneesMap[cId].balanceDue += balance;
            consigneesMap[cId].realizedProfit += realizedProfit;
        });

        const consigneesList = Object.values(consigneesMap).map(c => ({
            ...c,
            settlementRatePct: c.totalValue > 0 ? (c.amountPaid / c.totalValue) * 100 : 0
        })).sort((a, b) => b.balanceDue - a.balanceDue);

        const consigneeSummary = {
            totalValue: consigneeTotalValue,
            amountPaid: consigneeTotalCollected,
            balanceDue: consigneeTotalPending,
            realizedProfit: consigneeTotalProfit,
            count: consigneesList.length
        };

        // ── Supplier Performance Breakdown ──
        const supplierMap = {};
        const txsForSupplierAnalysis = transactions.filter(t => {
            if (isHqScope) {
                if (t.branch?.id) return false;
            } else if (effectiveBranch) {
                if (!t.branch || String(t.branch.id) !== String(effectiveBranch)) return false;
            }
            if (isBranchScope && ((t.transactionType || '').toUpperCase() === 'CONSIGNMENT' || t.consignee != null)) {
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

            if (!inDate || !inPayment || !isPaid || !inType) return false;
            if (sourceTypeFilter !== 'All') {
                if (getTxSourceType(t) !== sourceTypeFilter.toUpperCase()) return false;
            }
            return true;
        });

        txsForSupplierAnalysis.forEach(t => {
            const sId = getTxSupplierId(t) || 'unassigned';
            const sName = getTxSupplierName(t);
            const { selling, cost, profit } = getTxRevenueAndCost(t);
            const st = getTxSourceType(t);

            if (!supplierMap[sId]) {
                supplierMap[sId] = {
                    id: sId,
                    name: sName,
                    unitsSold: 0,
                    allocatedUnits: 0,
                    directUnits: 0,
                    revenue: 0,
                    cost: 0,
                    profit: 0
                };
            }
            supplierMap[sId].unitsSold += 1;
            if (st === 'BRANCH_DIRECT') {
                supplierMap[sId].directUnits += 1;
            } else {
                supplierMap[sId].allocatedUnits += 1;
            }
            supplierMap[sId].revenue += selling;
            supplierMap[sId].cost += cost;
            supplierMap[sId].profit += profit;
        });

        const suppliersList = Object.values(supplierMap).map(s => ({
            ...s,
            marginPct: s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0
        })).sort((a, b) => b.revenue - a.revenue);

        const supplierSummary = {
            totalSuppliers: suppliersList.length,
            totalRevenue: suppliersList.reduce((acc, s) => acc + s.revenue, 0),
            totalCost: suppliersList.reduce((acc, s) => acc + s.cost, 0),
            totalProfit: suppliersList.reduce((acc, s) => acc + s.profit, 0),
            totalUnits: suppliersList.reduce((acc, s) => acc + s.unitsSold, 0),
        };

        // Detailed dossier if a specific supplier is selected
        let selectedSupplierDossier = null;
        if (supplierFilter !== 'All') {
            const foundSupplier = suppliers.find(s => String(s.id) === String(supplierFilter));
            const supplierName = foundSupplier?.name || `Supplier #${supplierFilter}`;

            let allocUnits = 0;
            let allocRev = 0;
            let allocCost = 0;
            let directUnits = 0;
            let directRev = 0;
            let directCost = 0;

            const branchDistribution = {};

            validTxs.forEach(t => {
                const st = getTxSourceType(t);
                const { selling, cost, profit } = getTxRevenueAndCost(t);
                if (st === 'BRANCH_DIRECT') {
                    directUnits += 1;
                    directRev += selling;
                    directCost += cost;
                } else {
                    allocUnits += 1;
                    allocRev += selling;
                    allocCost += cost;
                }

                const bName = t.branch?.name || 'Central HQ';
                if (!branchDistribution[bName]) {
                    branchDistribution[bName] = { branchName: bName, units: 0, revenue: 0, profit: 0 };
                }
                branchDistribution[bName].units += 1;
                branchDistribution[bName].revenue += selling;
                branchDistribution[bName].profit += profit;
            });

            selectedSupplierDossier = {
                id: supplierFilter,
                name: supplierName,
                contactInfo: foundSupplier?.contactInfo || foundSupplier?.phone || foundSupplier?.email || null,
                totalUnits: validTxs.length,
                totalRevenue: validLogs.reduce((s, pl) => s + pl.revenue, 0),
                totalCost: validLogs.reduce((s, pl) => s + pl.cost, 0),
                totalProfit: validLogs.reduce((s, pl) => s + pl.profit, 0),
                allocated: {
                    units: allocUnits,
                    revenue: allocRev,
                    cost: allocCost,
                    profit: allocRev - allocCost,
                    marginPct: allocRev > 0 ? ((allocRev - allocCost) / allocRev) * 100 : 0
                },
                branchDirect: {
                    units: directUnits,
                    revenue: directRev,
                    cost: directCost,
                    profit: directRev - directCost,
                    marginPct: directRev > 0 ? ((directRev - directCost) / directRev) * 100 : 0
                },
                branchList: Object.values(branchDistribution).sort((a, b) => b.revenue - a.revenue)
            };
        }

        return {
            chartData,
            topProducts,
            allCategories,
            categoryCounts,
            categoryBreakdown,
            operatingExpenses: totalOperatingExpenses,
            expensesByCategory,
            periodExpensesList,
            consigneesList,
            consigneeSummary,
            suppliersList,
            supplierSummary,
            selectedSupplierDossier,
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
    }, [transactions, paymentLogs, expenses, timeRange, topFilter, customRange, paymentFilter, typeFilter, categoryFilter, effectiveBranch, sourceTypeFilter, supplierFilter, suppliers]);

    const {
        chartData,
        topProducts,
        allCategories = ['All'],
        categoryCounts = {},
        categoryBreakdown = { categories: [], totalRevenue: 0, totalUnitsSold: 0, totalCost: 0, totalProfit: 0, overallProfitMargin: 0 },
        summary,
        operatingExpenses = 0,
        expensesByCategory = {},
        periodExpensesList = [],
        consigneesList = [],
        consigneeSummary = { totalValue: 0, amountPaid: 0, balanceDue: 0, realizedProfit: 0, count: 0 },
        suppliersList = [],
        supplierSummary = { totalSuppliers: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalUnits: 0 },
        selectedSupplierDossier = null
    } = processedData;
    const paddleChartHeight = Math.max(400, topProducts.length * 40 + 50);

    return (
        <div className="flex flex-col h-full space-y-6 w-full">

            {/* ─── Admin Master Operational Mode Switcher (Wholesale B2B vs Store Retail vs Central HQ) ─── */}
            {isAdmin && !isExplicitBranchScope && (
                <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/90 rounded-2xl border border-stone-200/90 w-fit shrink-0 shadow-2xs">
                    <button
                        onClick={() => setSearchParams({ tab: 'supplier' })}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            mode === 'supplier'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-500 hover:text-stone-900'
                        }`}
                    >
                        <Building2 size={14} className={mode === 'supplier' ? "text-indigo-400" : ""} />
                        <span>Supplier Performance Analytics</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold uppercase tracking-wider">Suppliers & Sourcing</span>
                    </button>

                    <button
                        onClick={() => setSearchParams({ tab: 'batch-profit' })}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            mode === 'batch-profit'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-500 hover:text-stone-900'
                        }`}
                    >
                        <DollarSign size={14} className={mode === 'batch-profit' ? "text-emerald-400" : ""} />
                        <span>Wholesale Batch Profit & P&L</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-bold uppercase tracking-wider">Spread P&L</span>
                    </button>

                    <button
                        onClick={() => setSearchParams({})}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            mode === 'retail'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-500 hover:text-stone-900'
                        }`}
                    >
                        <Store size={14} className={mode === 'retail' ? "text-indigo-400" : ""} />
                        <span>Consolidated Branch Retail Sales</span>
                    </button>

                    <button
                        onClick={() => setSearchParams({ mode: 'hq' })}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            mode === 'hq'
                                ? 'bg-stone-900 text-white shadow-sm'
                                : 'text-stone-500 hover:text-stone-900'
                        }`}
                    >
                        <ShoppingCart size={14} className={mode === 'hq' ? "text-amber-400" : ""} />
                        <span>Main Admin Analytics</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold uppercase tracking-wider">Central HQ</span>
                    </button>
                </div>
            )}

            {mode === 'supplier' && (
                <div className="flex flex-col space-y-6 w-full animate-fadeIn">
                    {/* Header & Controls */}
                    <div className="flex flex-wrap justify-between items-center gap-4 bg-white p-6 rounded-2xl border border-stone-200/90 shadow-sm shrink-0">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                                <Building2 size={12} />
                                Multi-Channel Sourcing & Supplier Intelligence
                            </div>
                            <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5">
                                <Building2 className="text-indigo-600" size={26} />
                                Supplier Performance Analytics
                            </h2>
                            <p className="text-xs text-stone-500 font-medium mt-1 max-w-3xl leading-relaxed">
                                Filter and inspect revenue, margins, and sales volume by supplier. Compare Master Admin Allocated stock vs Branch Direct Procurements.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Supplier Selector Dropdown */}
                            <div className="relative">
                                <select
                                    value={supplierFilter}
                                    onChange={(e) => setSupplierFilter(e.target.value)}
                                    className="appearance-none pl-8 pr-7 py-2 bg-indigo-50/70 border border-indigo-300 rounded-xl text-xs font-black text-indigo-950 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                                >
                                    <option value="All">🏢 All Suppliers (Consolidated)</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>🏢 {s.name}</option>
                                    ))}
                                </select>
                                <Building2 size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-600 pointer-events-none" />
                                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 pointer-events-none" />
                            </div>

                            {/* Stock Source Filter (All / Master Allocated / Branch Direct) */}
                            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
                                {[
                                    { id: 'All', label: 'All Sources' },
                                    { id: 'ALLOCATED', label: '👑 Master Allocated' },
                                    { id: 'BRANCH_DIRECT', label: '📦 Branch Direct' },
                                ].map(st => (
                                    <button
                                        key={st.id}
                                        onClick={() => setSourceTypeFilter(st.id)}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all"
                                        style={{
                                            backgroundColor: sourceTypeFilter === st.id ? '#09090b' : 'transparent',
                                            color: sourceTypeFilter === st.id ? '#ffffff' : '#71717a',
                                        }}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>

                            {/* Branch Filter Selector */}
                            <div className="relative">
                                <select
                                    value={isHqScope ? 'HQ' : (effectiveBranch ? String(effectiveBranch) : 'ALL')}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        const nextId = (val === 'ALL' || !val) ? null : val === 'HQ' ? 'HQ' : Number(val);
                                        if (setSelectedBranchId) setSelectedBranchId(nextId);
                                    }}
                                    className="appearance-none pl-8 pr-7 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-zinc-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                                >
                                    <option value="ALL">All Store Locations</option>
                                    <option value="HQ">👑 Main Admin HQ</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>📍 {b.name}</option>
                                    ))}
                                </select>
                                <Store size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            </div>

                            {/* Time Range Presets */}
                            <div className="flex bg-stone-100 p-1 rounded-xl border border-stone-200">
                                {TIME_RANGES.map(range => (
                                    <button
                                        key={range.id}
                                        onClick={() => handlePresetSelect(range)}
                                        className="px-3 py-1.5 text-xs font-bold rounded-lg"
                                        style={{
                                            backgroundColor: timeRange?.id === range.id ? '#09090b' : 'transparent',
                                            color: timeRange?.id === range.id ? '#ffffff' : '#71717a',
                                        }}
                                    >
                                        {range.label}
                                    </button>
                                ))}
                            </div>

                            {/* Refresh */}
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="p-2 rounded-xl border border-stone-200 bg-white text-zinc-500 hover:bg-stone-50 shadow-2xs cursor-pointer"
                                title="Refresh data"
                            >
                                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Content View: Single Supplier Dossier vs All Suppliers Matrix */}
                    {selectedSupplierDossier ? (
                        /* Single Supplier Dossier View */
                        <div className="space-y-6">
                            {/* Supplier Dossier Header & Clear Filter */}
                            <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-indigo-50/70 border border-indigo-200 rounded-2xl shadow-xs">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                                        {selectedSupplierDossier.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-indigo-950 flex items-center gap-2">
                                            {selectedSupplierDossier.name}
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200">
                                                ID: {selectedSupplierDossier.id}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-indigo-700 font-medium">
                                            {selectedSupplierDossier.contactInfo || 'Registered Supplier'} • Showing isolated sales & procurement metrics
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSupplierFilter('All')}
                                    className="px-3.5 py-1.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                    <X size={13} />
                                    <span>View All Suppliers Matrix</span>
                                </button>
                            </div>

                            {/* 4 KPI Cards for this Supplier */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between text-stone-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Gross Sales</span>
                                        <DollarSign size={16} className="text-emerald-500" />
                                    </div>
                                    <div className="text-2xl font-black text-emerald-600 font-mono">
                                        {formatCurrency(summary.revenue)}
                                    </div>
                                    <div className="text-[11px] text-stone-400 mt-1">{summary.units.toLocaleString()} total units sold</div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between text-stone-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Cost of Goods (COGS)</span>
                                        <Boxes size={16} className="text-amber-500" />
                                    </div>
                                    <div className="text-2xl font-black text-stone-800 font-mono">
                                        {formatCurrency(summary.cost)}
                                    </div>
                                    <div className="text-[11px] text-stone-400 mt-1">Acquisition cost paid for sold units</div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between text-stone-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Gross Profit</span>
                                        <TrendingUp size={16} className="text-purple-500" />
                                    </div>
                                    <div className="text-2xl font-black text-purple-700 font-mono">
                                        {formatCurrency(summary.grossProfit)}
                                    </div>
                                    <div className="text-[11px] font-bold text-emerald-600 mt-1">
                                        {summary.grossMargin ? summary.grossMargin.toFixed(1) : 0}% profit margin
                                    </div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between text-stone-400 mb-2">
                                        <span className="text-xs font-bold uppercase tracking-wider">Units Sold</span>
                                        <Package size={16} className="text-indigo-500" />
                                    </div>
                                    <div className="text-2xl font-black text-stone-900">
                                        {summary.units.toLocaleString()}
                                    </div>
                                    <div className="text-[11px] text-stone-400 mt-1">From {topProducts.length} product variants</div>
                                </div>
                            </div>

                            {/* Sourcing Channel Split: Master Allocated vs Branch Direct for this Supplier */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white border border-amber-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                                            👑 Master Admin Allocated Stock
                                        </span>
                                        <span className="text-xs font-bold text-stone-400">HQ Procurement</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Units</span>
                                            <span className="text-lg font-black text-stone-900">{selectedSupplierDossier.allocated.units}</span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Revenue</span>
                                            <span className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(selectedSupplierDossier.allocated.revenue)}</span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Profit</span>
                                            <span className="text-sm font-black text-purple-600 font-mono">{formatCurrency(selectedSupplierDossier.allocated.profit)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            📦 Branch Direct Procurements
                                        </span>
                                        <span className="text-xs font-bold text-stone-400">Direct Store Inflow</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center pt-2">
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Units</span>
                                            <span className="text-lg font-black text-stone-900">{selectedSupplierDossier.branchDirect.units}</span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Revenue</span>
                                            <span className="text-sm font-black text-emerald-600 font-mono">{formatCurrency(selectedSupplierDossier.branchDirect.revenue)}</span>
                                        </div>
                                        <div className="p-3 bg-stone-50 rounded-xl">
                                            <span className="text-[10px] text-stone-400 uppercase font-black block">Profit</span>
                                            <span className="text-sm font-black text-purple-600 font-mono">{formatCurrency(selectedSupplierDossier.branchDirect.profit)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Revenue & Profit Trends for this Supplier */}
                            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-4">
                                    <TrendingUp size={16} className="text-blue-500" />
                                    <span>Revenue & Profit Timeline for {selectedSupplierDossier.name}</span>
                                </h3>
                                {chartData.length === 0 ? (
                                    <div className="h-64 flex flex-col items-center justify-center text-stone-400">
                                        <BarChart3 size={32} className="opacity-20 mb-2" />
                                        <p className="text-xs">No sales recorded for this supplier during this time period.</p>
                                    </div>
                                ) : (
                                    <div className="h-72 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={false} />
                                                <YAxis tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#71717a' }} tickLine={false} axisLine={false} />
                                                <RechartsTooltip cursor={{ fill: '#f4f4f5' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} formatter={(value) => [formatCurrency(value)]} />
                                                <Legend wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} iconType="circle" />
                                                <Bar dataKey="revenue" name="Sales Revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                                                <Bar dataKey="profit" name="Gross Profit" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={45} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* Top Selling Products from this Supplier & Store Breakdown */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Products Table */}
                                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                                    <h4 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-4">
                                        <Trophy size={16} className="text-amber-500" />
                                        <span>Top Selling Products ({selectedSupplierDossier.name})</span>
                                    </h4>
                                    {topProducts.length === 0 ? (
                                        <p className="text-xs text-stone-400 py-6 text-center">No products found sold in this period.</p>
                                    ) : (
                                        <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1 custom-scrollbar">
                                            {topProducts.slice(0, 15).map(p => (
                                                <div key={p.sku} className="flex items-center justify-between p-2.5 rounded-xl border border-stone-100 bg-stone-50/70 hover:bg-stone-50 transition-colors">
                                                    <div className="min-w-0 pr-2">
                                                        <div className="text-xs font-bold text-stone-900 truncate">{p.name}</div>
                                                        <div className="text-[10px] text-stone-400 font-mono">{p.sku} • {p.category}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-xs font-black text-emerald-600 font-mono">{formatCurrency(p.revenue)}</div>
                                                        <div className="text-[10px] text-stone-400 font-bold">{p.units} units sold</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Store Distribution */}
                                <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm">
                                    <h4 className="text-sm font-black text-stone-900 tracking-tight flex items-center gap-2 mb-4">
                                        <Store size={16} className="text-emerald-600" />
                                        <span>Branch Sales Distribution</span>
                                    </h4>
                                    {selectedSupplierDossier.branchList.length === 0 ? (
                                        <p className="text-xs text-stone-400 py-6 text-center">No branch distribution data available.</p>
                                    ) : (
                                        <div className="space-y-3 overflow-y-auto max-h-80 pr-1 custom-scrollbar">
                                            {selectedSupplierDossier.branchList.map(b => (
                                                <div key={b.branchName} className="p-3 rounded-xl border border-stone-100 bg-stone-50/70">
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="font-bold text-stone-900">{b.branchName}</span>
                                                        <span className="font-black text-emerald-600 font-mono">{formatCurrency(b.revenue)}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] text-stone-400">
                                                        <span>{b.units} units sold</span>
                                                        <span className="font-bold text-purple-600 font-mono">+{formatCurrency(b.profit)} profit</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* All Suppliers Consolidated View */
                        <div className="space-y-6">
                            {/* KPI Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Active Suppliers</span>
                                        <Building2 size={16} className="text-indigo-500" />
                                    </div>
                                    <div className="text-2xl font-black text-stone-900">{supplierSummary.totalSuppliers}</div>
                                    <div className="text-[11px] text-stone-400 mt-1">Suppliers with active sales</div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Total Supplier Sales</span>
                                        <DollarSign size={16} className="text-emerald-500" />
                                    </div>
                                    <div className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(supplierSummary.totalRevenue)}</div>
                                    <div className="text-[11px] text-stone-400 mt-1">{supplierSummary.totalUnits.toLocaleString()} total units sold</div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Inventory Cost (COGS)</span>
                                        <Boxes size={16} className="text-amber-500" />
                                    </div>
                                    <div className="text-2xl font-black text-stone-700 font-mono">{formatCurrency(supplierSummary.totalCost)}</div>
                                    <div className="text-[11px] text-stone-400 mt-1">Total wholesale procurement expense</div>
                                </div>

                                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Gross Profit Realized</span>
                                        <TrendingUp size={16} className="text-purple-500" />
                                    </div>
                                    <div className="text-2xl font-black text-purple-700 font-mono">{formatCurrency(supplierSummary.totalProfit)}</div>
                                    <div className="text-[11px] font-bold text-emerald-600 mt-1">
                                        {supplierSummary.totalRevenue > 0 ? ((supplierSummary.totalProfit / supplierSummary.totalRevenue) * 100).toFixed(1) : 0}% average margin
                                    </div>
                                </div>
                            </div>

                            {/* Full Supplier Performance Table */}
                            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 flex flex-col">
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                    <h4 className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                        <span>Complete Supplier Performance & Channel Matrix</span>
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                                            {suppliersList.length} suppliers
                                        </span>
                                    </h4>
                                    {sourceTypeFilter !== 'All' && (
                                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            Filtered by {sourceTypeFilter === 'BRANCH_DIRECT' ? '📦 Branch Direct' : '👑 Master Allocated'}
                                        </span>
                                    )}
                                </div>

                                {loading ? (
                                    <div className="h-48 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                                ) : suppliersList.length === 0 ? (
                                    <div className="p-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 flex flex-col items-center">
                                        <Building2 size={36} className="opacity-20 mb-2 text-stone-600" />
                                        <p className="text-sm font-bold text-stone-600">No supplier sales recorded for this period & filters.</p>
                                        <p className="text-xs text-stone-400 mt-1">Try selecting a wider date range or resetting active filters.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse text-sm">
                                            <thead>
                                                <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-zinc-400 font-bold">
                                                    <th className="pb-3">Supplier</th>
                                                    <th className="pb-3 text-center">Procurement Channels</th>
                                                    <th className="pb-3 text-right">Units Sold</th>
                                                    <th className="pb-3 text-right">Sales Revenue</th>
                                                    <th className="pb-3 text-right">Cost (COGS)</th>
                                                    <th className="pb-3 text-right">Gross Profit</th>
                                                    <th className="pb-3 text-right">Margin %</th>
                                                    <th className="pb-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {suppliersList.map(s => (
                                                    <tr key={s.id} className="hover:bg-stone-50/80 transition-colors">
                                                        <td className="py-3 font-bold text-zinc-900">
                                                            <div className="flex items-center gap-2">
                                                                <Building2 size={16} className="text-indigo-600" />
                                                                <div>
                                                                    <div className="font-bold text-zinc-900">{s.name}</div>
                                                                    <div className="text-[10px] text-zinc-400 font-mono">ID: {s.id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-center">
                                                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                                                                {s.allocatedUnits > 0 && (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                                                        👑 {s.allocatedUnits} Alloc
                                                                    </span>
                                                                )}
                                                                {s.directUnits > 0 && (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                                                                        📦 {s.directUnits} Direct
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-right font-bold text-zinc-800">
                                                            {s.unitsSold.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-right font-mono font-bold text-emerald-600">
                                                            {formatCurrency(s.revenue)}
                                                        </td>
                                                        <td className="py-3 text-right font-mono text-zinc-600">
                                                            {formatCurrency(s.cost)}
                                                        </td>
                                                        <td className="py-3 text-right font-mono font-bold text-purple-600">
                                                            {formatCurrency(s.profit)}
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
                                                                s.marginPct >= 30 ? 'bg-emerald-50 text-emerald-700' : s.marginPct >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                                            }`}>
                                                                {s.marginPct.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <button
                                                                onClick={() => setSupplierFilter(s.id)}
                                                                className="px-2.5 py-1 text-xs font-bold bg-stone-100 hover:bg-indigo-50 text-stone-700 hover:text-indigo-700 border border-stone-200 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                Inspect Supplier
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="border-t-2 border-stone-200 font-black text-sm bg-stone-50/50">
                                                    <td className="py-3 font-black text-zinc-900" colSpan={2}>Total Across All Suppliers</td>
                                                    <td className="py-3 text-right text-zinc-900">{supplierSummary.totalUnits.toLocaleString()}</td>
                                                    <td className="py-3 text-right text-emerald-600 font-mono">{formatCurrency(supplierSummary.totalRevenue)}</td>
                                                    <td className="py-3 text-right text-zinc-700 font-mono">{formatCurrency(supplierSummary.totalCost)}</td>
                                                    <td className="py-3 text-right text-purple-600 font-mono">{formatCurrency(supplierSummary.totalProfit)}</td>
                                                    <td className="py-3 text-right text-zinc-900">
                                                        {supplierSummary.totalRevenue > 0 ? ((supplierSummary.totalProfit / supplierSummary.totalRevenue) * 100).toFixed(1) : 0}%
                                                    </td>
                                                    <td className="py-3 text-right text-zinc-400 text-xs font-normal">—</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {mode === 'batch-profit' && (
                <AdminBatchProfitAnalytics branches={branches} />
            )}

            {(mode === 'retail' || mode === 'hq') && (
                <>
            {/* Header & Controls */}
            <div className="flex flex-wrap justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                        <BarChart3 className="text-zinc-500" />
                        <span>
                            {isExplicitBranchScope
                                ? `${currentBranchName || 'Branch'} Performance Analytics & P&L`
                                : isHqScope
                                    ? 'Main Admin Performance Analytics & P&L'
                                    : 'Performance Analytics & P&L'}
                        </span>
                    </h2>
                    {(isExplicitBranchScope || isHqScope) && (
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs flex items-center gap-1.5 ${
                            isHqScope
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                            {isHqScope ? (
                                <>
                                    <ShoppingCart size={12} className="text-amber-600" />
                                    <span>Central HQ Shop & Consignees</span>
                                </>
                            ) : (
                                <>
                                    <Store size={12} className="text-emerald-600" />
                                    <span>{currentBranchName || 'Assigned Branch Scope'}</span>
                                </>
                            )}
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Branch Filter Selector (for Admin in consolidated mode only) */}
                    {isAdmin && !isExplicitBranchScope && mode !== 'hq' && (
                        <div className="relative">
                            <select
                                value={isHqScope ? 'HQ' : (effectiveBranch ? String(effectiveBranch) : 'ALL')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === 'HQ') {
                                        setSearchParams({ mode: 'hq' });
                                        if (setSelectedBranchId) setSelectedBranchId('HQ');
                                    } else {
                                        if (mode === 'hq') setSearchParams({});
                                        const nextId = (val === 'ALL' || !val) ? null : Number(val);
                                        if (setSelectedBranchId) setSelectedBranchId(nextId);
                                    }
                                }}
                                className="appearance-none pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-zinc-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                            >
                                <option value="ALL">🏢 All Branches (Consolidated Retail)</option>
                                <option value="HQ">👑 Main Admin (Central HQ & Consignees)</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>📍 {b.name}</option>
                                ))}
                            </select>
                            <Store size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Transaction Type Filter - strictly for Admin side */}
                    {!isBranchScope && (
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
                    )}

                    <div className="w-px h-5 bg-stone-200 mx-1" />

                    {/* Stock Source Filter (Master Allocated vs Branch Direct) */}
                    <div className="flex bg-white border border-stone-200 rounded-lg p-1 shadow-sm">
                        {[
                            { id: 'All', label: 'All Sources' },
                            { id: 'ALLOCATED', label: '👑 Master Allocated' },
                            { id: 'BRANCH_DIRECT', label: '📦 Branch Direct' },
                        ].map(st => (
                            <button
                                key={st.id}
                                onClick={() => setSourceTypeFilter(st.id)}
                                className="px-2.5 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap"
                                style={{
                                    backgroundColor: sourceTypeFilter === st.id ? '#09090b' : 'transparent',
                                    color: sourceTypeFilter === st.id ? '#ffffff' : '#71717a',
                                }}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>

                    {/* Supplier Filter Dropdown */}
                    <div className="relative">
                        <select
                            value={supplierFilter}
                            onChange={(e) => setSupplierFilter(e.target.value)}
                            className="appearance-none pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-bold text-zinc-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                            style={{
                                borderColor: supplierFilter !== 'All' ? '#6366f1' : '#e7e5e4',
                                backgroundColor: supplierFilter !== 'All' ? '#eef2ff' : '#ffffff'
                            }}
                        >
                            <option value="All">🏢 All Suppliers</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>
                                    🏢 {s.name}
                                </option>
                            ))}
                        </select>
                        <Building2 size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${supplierFilter !== 'All' ? 'text-indigo-600' : 'text-zinc-400'}`} />
                        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
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
            {(effectiveBranch || typeFilter !== 'All' || paymentFilter !== 'All' || customRange || categoryFilter !== 'All' || sourceTypeFilter !== 'All' || supplierFilter !== 'All') && (
                <div className="flex flex-wrap items-center gap-2 shrink-0 p-2.5 bg-stone-50 border border-stone-200/80 rounded-xl" style={{ animation: 'fadeSlideIn 200ms ease' }}>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider text-[10px]">Active Filters:</span>
                    
                    {effectiveBranch && !isHqScope && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <Store size={11} className="text-emerald-600" />
                            {currentBranchName || `Branch #${effectiveBranch}`}
                            {isAdmin && !isExplicitBranchScope && (
                                <button onClick={() => setSelectedBranchId(null)} title="Clear branch filter" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                    <X size={11} />
                                </button>
                            )}
                        </span>
                    )}

                    {!isBranchScope && typeFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-purple-700 text-xs font-bold rounded-lg shadow-xs">
                            <Layers size={11} className="text-purple-600" />
                            {typeFilter === 'REGULAR' ? 'Regular Sales' : 'Consignment'}
                            <button onClick={() => setTypeFilter('All')} title="Show all types" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {sourceTypeFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-zinc-800 text-xs font-bold rounded-lg shadow-xs">
                            <Boxes size={11} className="text-emerald-600" />
                            {sourceTypeFilter === 'BRANCH_DIRECT' ? '📦 Branch Direct' : '👑 Master Allocated'}
                            <button onClick={() => setSourceTypeFilter('All')} title="Show all stock sources" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
                                <X size={11} />
                            </button>
                        </span>
                    )}

                    {supplierFilter !== 'All' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 text-indigo-700 text-xs font-bold rounded-lg shadow-xs">
                            <Building2 size={11} className="text-indigo-600" />
                            {suppliers.find(s => String(s.id) === String(supplierFilter))?.name || `Supplier #${supplierFilter}`}
                            <button onClick={() => setSupplierFilter('All')} title="Show all suppliers" className="ml-0.5 text-zinc-400 hover:text-red-500 transition-colors">
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
                            if (isAdmin && !isExplicitBranchScope) {
                                setSelectedBranchId(null);
                                if (mode === 'hq') setSearchParams({});
                            }
                            setTypeFilter('All');
                            setSourceTypeFilter('All');
                            setSupplierFilter('All');
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
                    subtitle={isHqScope ? "HQ rent, bills, supplies" : "Store rent, bills, supplies"}
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
            <div className="flex flex-wrap bg-stone-100 p-1 rounded-xl w-fit shrink-0 border border-stone-200/80 gap-1">
                <button onClick={() => setMainTab('trends')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'trends' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Revenue Trends</button>
                <button onClick={() => setMainTab('paddles')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'paddles' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Product Rankings</button>
                <button onClick={() => setMainTab('categories')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'categories' ? 'bg-white shadow-xs text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}>Category Breakdown</button>
                <button onClick={() => setMainTab('suppliers')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'suppliers' ? 'bg-white shadow-xs text-indigo-700 font-black' : 'text-zinc-500 hover:text-zinc-700'}`}>🏢 Supplier Performance</button>
                <button onClick={() => setMainTab('pnl')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${mainTab === 'pnl' ? 'bg-white shadow-xs text-emerald-800 font-black' : 'text-zinc-500 hover:text-zinc-700'}`}>
                    📊 {isHqScope ? 'Main Admin P&L Statement' : (effectiveBranch ? 'Branch P&L Statement' : 'Consolidated P&L Statement')}
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

                {mainTab === 'suppliers' && (
                    <div className="flex flex-col gap-6 flex-1 min-h-[400px]">
                        {/* Top Supplier Overview Summary Card */}
                        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 mb-2">
                                    <Building2 size={12} />
                                    Supplier & Channel Intelligence
                                </div>
                                <h3 className="text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
                                    Supplier Performance & Procurement Matrix
                                </h3>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Track revenue, profit, and stock volume by supplier, with clear distinction between Master Admin Allocated stock vs Branch Direct Procurements.
                                </p>
                            </div>

                            {supplierFilter !== 'All' && (
                                <button
                                    onClick={() => setSupplierFilter('All')}
                                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                    <X size={13} className="text-stone-500" />
                                    Show All Suppliers
                                </button>
                            )}
                        </div>

                        {/* Supplier KPI Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Active Suppliers</span>
                                    <Building2 size={16} className="text-indigo-500" />
                                </div>
                                <div className="text-2xl font-black text-stone-900">{supplierSummary.totalSuppliers}</div>
                                <div className="text-[11px] text-stone-400 mt-1">Suppliers with sales in this period</div>
                            </div>

                            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Supplier Gross Sales</span>
                                    <DollarSign size={16} className="text-emerald-500" />
                                </div>
                                <div className="text-2xl font-black text-emerald-600 font-mono">{formatCurrency(supplierSummary.totalRevenue)}</div>
                                <div className="text-[11px] text-stone-400 mt-1">{supplierSummary.totalUnits.toLocaleString()} total units sold</div>
                            </div>

                            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Inventory Cost (COGS)</span>
                                    <Boxes size={16} className="text-amber-500" />
                                </div>
                                <div className="text-2xl font-black text-stone-700 font-mono">{formatCurrency(supplierSummary.totalCost)}</div>
                                <div className="text-[11px] text-stone-400 mt-1">Acquisition cost paid for sold units</div>
                            </div>

                            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Supplier Gross Profit</span>
                                    <TrendingUp size={16} className="text-purple-500" />
                                </div>
                                <div className="text-2xl font-black text-purple-700 font-mono">{formatCurrency(supplierSummary.totalProfit)}</div>
                                <div className="text-[11px] font-bold text-emerald-600 mt-1">
                                    {supplierSummary.totalRevenue > 0 ? ((supplierSummary.totalProfit / supplierSummary.totalRevenue) * 100).toFixed(1) : 0}% average margin
                                </div>
                            </div>
                        </div>

                        {/* Detailed Supplier Performance Table */}
                        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-6 flex flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                <h4 className="text-sm font-black text-zinc-900 tracking-tight flex items-center gap-2">
                                    <span>Complete Supplier Performance & Channel Matrix</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
                                        {suppliersList.length} suppliers
                                    </span>
                                </h4>
                                {sourceTypeFilter !== 'All' && (
                                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        Filtered by {sourceTypeFilter === 'BRANCH_DIRECT' ? '📦 Branch Direct' : '👑 Master Allocated'}
                                    </span>
                                )}
                            </div>

                            {loading ? (
                                <div className="h-48 flex items-center justify-center text-zinc-400"><RefreshCw size={24} className="animate-spin" /></div>
                            ) : suppliersList.length === 0 ? (
                                <div className="p-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 flex flex-col items-center">
                                    <Building2 size={36} className="opacity-20 mb-2 text-stone-600" />
                                    <p className="text-sm font-bold text-stone-600">No supplier sales recorded for this period & filters.</p>
                                    <p className="text-xs text-stone-400 mt-1">Try selecting a wider date range or resetting active filters.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-200 text-xs uppercase tracking-wider text-zinc-400 font-bold">
                                                <th className="pb-3">Supplier</th>
                                                <th className="pb-3 text-center">Procurement Channels</th>
                                                <th className="pb-3 text-right">Units Sold</th>
                                                <th className="pb-3 text-right">Sales Revenue</th>
                                                <th className="pb-3 text-right">Cost (COGS)</th>
                                                <th className="pb-3 text-right">Gross Profit</th>
                                                <th className="pb-3 text-right">Margin %</th>
                                                <th className="pb-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {suppliersList.map(s => {
                                                const isFiltered = String(supplierFilter) === String(s.id);
                                                return (
                                                    <tr key={s.id} className={`hover:bg-stone-50/80 transition-colors ${isFiltered ? 'bg-indigo-50/50' : ''}`}>
                                                        <td className="py-3 font-bold text-zinc-900">
                                                            <div className="flex items-center gap-2">
                                                                <Building2 size={16} className={isFiltered ? 'text-indigo-600' : 'text-stone-400'} />
                                                                <div>
                                                                    <div className="font-bold text-zinc-900">{s.name}</div>
                                                                    <div className="text-[10px] text-zinc-400 font-mono">ID: {s.id}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-center">
                                                            <div className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                                                                {s.allocatedUnits > 0 && (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80" title={`${s.allocatedUnits} units allocated from HQ`}>
                                                                        👑 {s.allocatedUnits} Alloc
                                                                    </span>
                                                                )}
                                                                {s.directUnits > 0 && (
                                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80" title={`${s.directUnits} units direct to branch`}>
                                                                        📦 {s.directUnits} Direct
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 text-right font-bold text-zinc-800">
                                                            {s.unitsSold.toLocaleString()}
                                                        </td>
                                                        <td className="py-3 text-right font-mono font-bold text-emerald-600">
                                                            {formatCurrency(s.revenue)}
                                                        </td>
                                                        <td className="py-3 text-right font-mono text-zinc-600">
                                                            {formatCurrency(s.cost)}
                                                        </td>
                                                        <td className="py-3 text-right font-mono font-bold text-purple-600">
                                                            {formatCurrency(s.profit)}
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            <span className={`px-2 py-0.5 rounded-md text-xs font-black ${
                                                                s.marginPct >= 30 ? 'bg-emerald-50 text-emerald-700' : s.marginPct >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                                                            }`}>
                                                                {s.marginPct.toFixed(1)}%
                                                            </span>
                                                        </td>
                                                        <td className="py-3 text-right">
                                                            {isFiltered ? (
                                                                <button
                                                                    onClick={() => setSupplierFilter('All')}
                                                                    className="px-2.5 py-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg inline-flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                                                    title="Clear filter for this supplier"
                                                                >
                                                                    <Check size={12} />
                                                                    Active
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setSupplierFilter(s.id);
                                                                    }}
                                                                    className="px-2.5 py-1 text-xs font-bold bg-stone-100 hover:bg-indigo-50 text-stone-700 hover:text-indigo-700 border border-stone-200 rounded-lg transition-colors cursor-pointer"
                                                                    title="Filter all charts and stats by this supplier"
                                                                >
                                                                    Filter by Supplier
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-stone-200 font-black text-sm bg-stone-50/50">
                                                <td className="py-3 font-black text-zinc-900" colSpan={2}>Total Across All Suppliers</td>
                                                <td className="py-3 text-right text-zinc-900">{supplierSummary.totalUnits.toLocaleString()}</td>
                                                <td className="py-3 text-right text-emerald-600 font-mono">{formatCurrency(supplierSummary.totalRevenue)}</td>
                                                <td className="py-3 text-right text-zinc-700 font-mono">{formatCurrency(supplierSummary.totalCost)}</td>
                                                <td className="py-3 text-right text-purple-600 font-mono">{formatCurrency(supplierSummary.totalProfit)}</td>
                                                <td className="py-3 text-right text-zinc-900">
                                                    {supplierSummary.totalRevenue > 0 ? ((supplierSummary.totalProfit / supplierSummary.totalRevenue) * 100).toFixed(1) : 0}%
                                                </td>
                                                <td className="py-3 text-right text-zinc-400 text-xs font-normal">
                                                    {supplierFilter !== 'All' ? (
                                                        <button onClick={() => setSupplierFilter('All')} className="text-indigo-600 font-bold hover:underline cursor-pointer">
                                                            Reset Filter
                                                        </button>
                                                    ) : '—'}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
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
                                        {isHqScope
                                            ? 'Main Admin P&L Statement'
                                            : effectiveBranch
                                                ? `${currentBranchName || 'Branch'} P&L Statement`
                                                : 'Consolidated P&L Statement (All Locations)'}
                                    </h3>
                                    <p className="text-xs text-stone-500 mt-0.5">
                                        {isHqScope
                                            ? 'Comprehensive financial breakdown for Central HQ operations and consignee collections'
                                            : effectiveBranch
                                                ? `Comprehensive financial breakdown strictly for ${currentBranchName || 'this store branch'}`
                                                : 'Income from sales collections minus inventory cost and branch operating overhead'}
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
            </>
            )}

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