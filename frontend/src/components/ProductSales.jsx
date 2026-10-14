import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Search,
    Filter,
    BarChart2,
    Package,
    TrendingUp,
    Calendar,
    ChevronLeft,
    ChevronRight,
    X,
    Loader2,
    DollarSign,
    PieChart,
    Layers,
    Award,
    Tag,
    ChevronDown,
    ArrowUpRight
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const pad   = (n) => n.toString().padStart(2, '0');
const fmtDt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const getStartOfDay  = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const getStartOfWeek = (d) => { const c = new Date(d); c.setDate(c.getDate() - c.getDay()); return getStartOfDay(c); };
const getStartOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const isInRange = (date, start, end) => {
    if (!start || !end) return false;
    const t = date.getTime();
    return t > Math.min(start.getTime(), end.getTime()) && t < Math.max(start.getTime(), end.getTime());
};

const fmtPeso = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PRESETS = [
    { id: 'ALL',        label: 'All Time' },
    { id: 'TODAY',      label: 'Today' },
    { id: 'WEEK',       label: 'This Week' },
    { id: 'MONTH',      label: 'This Month' },
    { id: 'LAST_MONTH', label: 'Last Month' },
];

const CATEGORY_STYLES = {
    Paddles: {
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200',
        hex: '#4f46e5'
    },
    Accessories: {
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        hex: '#059669'
    },
    Balls: {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        hex: '#d97706'
    },
    Shoes: {
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200',
        hex: '#9333ea'
    },
    Bags: {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        hex: '#e11d48'
    },
    Apparel: {
        bg: 'bg-cyan-50',
        text: 'text-cyan-700',
        border: 'border-cyan-200',
        hex: '#0891b2'
    },
    Default: {
        bg: 'bg-stone-50',
        text: 'text-stone-700',
        border: 'border-stone-200',
        hex: '#52525b'
    }
};

// ── Calendar Picker ──────────────────────────────────────────────────────────
const CalendarPicker = ({ onApply, onClose }) => {
    const today = new Date();
    const [viewYear,  setViewYear]  = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [startDate, setStartDate] = useState(null);
    const [endDate,   setEndDate]   = useState(null);
    const [hoverDate, setHoverDate] = useState(null);

    const getDaysInMonth  = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
    const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

    const handleDayClick = (day) => {
        const clicked = new Date(viewYear, viewMonth, day);
        if (!startDate || (startDate && endDate)) { setStartDate(clicked); setEndDate(null); }
        else { if (clicked < startDate) { setEndDate(startDate); setStartDate(clicked); } else setEndDate(clicked); }
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay    = getFirstDayOfMonth(viewYear, viewMonth);
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
                    const day  = i + 1;
                    const date = new Date(viewYear, viewMonth, day);
                    const isStart  = isSameDay(date, startDate);
                    const isEnd    = isSameDay(date, endDate);
                    const inRange  = isInRange(date, startDate, endDate || hoverDate);
                    const isToday  = isSameDay(date, today);
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

// ── Main Component ────────────────────────────────────────────────────────────
const ProductSales = ({ products = [] }) => {
    const { currentBranchId } = useAuth();
    const [searchQuery,        setSearchQuery]        = useState('');
    const [categoryFilter,     setCategoryFilter]     = useState('All');
    const [preset,             setPreset]             = useState(PRESETS[0]); // default: All Time
    const [customRange,        setCustomRange]        = useState(null);
    const [showCalendar,       setShowCalendar]       = useState(false);
    const [categorySummary,    setCategorySummary]    = useState(null);
    const [variantSalesMap,    setVariantSalesMap]    = useState({});
    const [categoryMetricMode, setCategoryMetricMode] = useState('revenue'); // 'revenue' | 'units'
    const [loadingData,        setLoadingData]        = useState(false);
    const calendarRef = useRef(null);

    // Close calendar on outside click
    useEffect(() => {
        const handler = (e) => { if (calendarRef.current && !calendarRef.current.contains(e.target)) setShowCalendar(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Compute API query bounds from preset or custom range
    const getDateBounds = useCallback(() => {
        const now = new Date();
        if (customRange) {
            const end = new Date(customRange.end); end.setHours(23, 59, 59);
            return { from: fmtDt(customRange.start), to: fmtDt(end) };
        }
        if (!preset || preset.id === 'ALL') return null;
        if (preset.id === 'TODAY') return { from: fmtDt(getStartOfDay(now)), to: fmtDt(now) };
        if (preset.id === 'WEEK')  return { from: fmtDt(getStartOfWeek(now)), to: fmtDt(now) };
        if (preset.id === 'MONTH') return { from: fmtDt(getStartOfMonth(now)), to: fmtDt(now) };
        if (preset.id === 'LAST_MONTH') {
            const firstOfThisMonth = getStartOfMonth(now);
            const firstOfLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastOfLast  = new Date(firstOfThisMonth.getTime() - 1);
            return { from: fmtDt(firstOfLast), to: fmtDt(lastOfLast) };
        }
        return null;
    }, [preset, customRange]);

    // Fetch aggregated category & variant sales (ultra-fast 180ms SQL endpoint)
    useEffect(() => {
        setLoadingData(true);
        const bounds = getDateBounds();
        const branchParam = currentBranchId ? `branchId=${currentBranchId}` : '';
        const dateParams = bounds ? `from=${bounds.from}&to=${bounds.to}` : '';
        const queryStr = [dateParams, branchParam].filter(Boolean).join('&');
        const qs = queryStr ? `?${queryStr}` : '';

        Promise.all([
            axios.get(`/api/transactions/category-sales${qs}`),
            axios.get(`/api/transactions/variant-sales${qs}`)
        ])
            .then(([catRes, varRes]) => {
                setCategorySummary(catRes.data);
                setVariantSalesMap(varRes.data || {});
            })
            .catch(err => {
                console.error('Failed to load category or variant sales:', err);
                setCategorySummary(null);
                setVariantSalesMap({});
            })
            .finally(() => setLoadingData(false));
    }, [getDateBounds, currentBranchId]);

    // Unique categories from products catalog
    const categories = useMemo(() => {
        const catSet = new Set(products.map(p => p.category).filter(Boolean));
        if (categorySummary?.categories) {
            categorySummary.categories.forEach(c => {
                if (c.category) catSet.add(c.category);
            });
        }
        return ['All', ...Array.from(catSet).sort()];
    }, [products, categorySummary]);

    // Flatten to variant rows with period-specific sold count & revenue
    const salesData = useMemo(() => {
        const flattened = products.flatMap(product =>
            product.variants?.map(variant => {
                const isPaddle = product.category === 'Paddles';
                const isShoe   = product.category === 'Shoes';
                const colorTag = variant.color && variant.color !== 'N/A' ? ` (${variant.color})` : '';
                const sizeTag  = isShoe   && variant.shape       ? ` Size ${variant.shape}` : '';
                const thickTag = isPaddle && variant.thicknessMm ? ` ${variant.thicknessMm}mm` : '';
                const name     = `${product.brandName} ${product.modelName}${colorTag}${thickTag}${sizeTag}`;

                const varStat = variantSalesMap[variant.id];
                const totalAdded = variant.totalAdded || 0;
                
                // Units sold in this period
                const totalSold = varStat != null
                    ? (varStat.unitsSold || 0)
                    : ((preset?.id === 'ALL' && !customRange) ? (variant.totalSold || 0) : 0);

                // Sales revenue generated in this period
                const revenue = varStat != null
                    ? (varStat.revenue || 0)
                    : (totalSold * (variant.sellingPrice || 0));

                const remaining  = variant.stockQuantity || 0;
                const sellThrough = totalAdded > 0 ? (totalSold / totalAdded) * 100 : 0;

                return {
                    id: variant.id,
                    sku: variant.sku,
                    name: name.trim(),
                    brand: product.brandName,
                    category: product.category || 'Uncategorized',
                    sellingPrice: variant.sellingPrice || 0,
                    totalAdded,
                    totalSold,
                    revenue,
                    remaining,
                    sellThrough,
                };
            }) || []
        );

        return flattened
            .filter(item => categoryFilter === 'All' || item.category === categoryFilter)
            .filter(item =>
                searchQuery === '' ||
                (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.sku  || '').toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => {
                if (b.totalSold !== a.totalSold) return b.totalSold - a.totalSold;
                if (b.revenue !== a.revenue) return b.revenue - a.revenue;
                return a.name.localeCompare(b.name, undefined, { numeric: true });
            });
    }, [products, categoryFilter, searchQuery, preset, customRange, variantSalesMap]);

    // Summary stats
    const grandTotalAdded = salesData.reduce((s, i) => s + i.totalAdded, 0);
    const grandTotalSold  = categorySummary ? categorySummary.totalUnitsSold : salesData.reduce((s, i) => s + i.totalSold, 0);
    const grandTotalRevenue = categorySummary ? categorySummary.totalRevenue : salesData.reduce((s, i) => s + i.revenue, 0);
    const overallSellThrough = grandTotalAdded > 0 ? (grandTotalSold / grandTotalAdded) * 100 : 0;

    // Calendar handlers
    const handleCalendarApply = (start, end) => {
        const label = `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        setCustomRange({ start, end, label });
        setPreset(null);
        setShowCalendar(false);
    };

    const activeDateLabel = customRange?.label ?? preset?.label ?? 'All Time';

    return (
        <div className="flex flex-col h-full space-y-5">

            {/* Header */}
            <div className="flex flex-wrap justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-zinc-900 text-white rounded-2xl shadow-sm">
                        <BarChart2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">Sales & Category Performance</h2>
                        <p className="text-xs text-zinc-500 font-medium">Sales data breakdown and percentage share by category</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by product name or SKU..."
                            className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-zinc-900 shadow-sm w-72"
                        />
                    </div>
                </div>
            </div>

            {/* ── Date Filter Row ───────────────────────────────────────────── */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 mr-1 uppercase tracking-wide">
                    <Calendar size={14} /> Period:
                </span>

                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => { setPreset(p); setCustomRange(null); }}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            !customRange && preset?.id === p.id
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                                : 'bg-white border-stone-200 text-zinc-600 hover:bg-stone-50'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                {/* Custom Range Button */}
                <div className="relative" ref={calendarRef}>
                    <button
                        onClick={() => setShowCalendar(v => !v)}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            customRange
                                ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                                : 'bg-white border-stone-200 text-zinc-600 hover:bg-stone-50'
                        }`}
                    >
                        <Calendar size={12} />
                        {customRange ? customRange.label : 'Custom Range'}
                        {customRange && (
                            <span
                                onClick={(e) => { e.stopPropagation(); setCustomRange(null); setPreset(PRESETS[0]); }}
                                className="ml-1 hover:text-red-400 transition-colors"
                            >
                                <X size={11} />
                            </span>
                        )}
                    </button>
                    {showCalendar && (
                        <CalendarPicker
                            onApply={handleCalendarApply}
                            onClose={() => setShowCalendar(false)}
                        />
                    )}
                </div>

                {/* Loading indicator */}
                {loadingData && (
                    <div className="flex items-center gap-1.5 ml-2 text-xs text-zinc-400">
                        <Loader2 size={13} className="animate-spin text-zinc-500" />
                        <span>Updating data…</span>
                    </div>
                )}
            </div>

            {/* ── Top Summary KPI Cards ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
                {/* Total Sales Revenue */}
                <div className="relative overflow-hidden bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-t-2xl" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Total Sales Revenue</p>
                            <p className="text-2xl font-black text-emerald-600 leading-tight">
                                {loadingData ? '...' : fmtPeso(grandTotalRevenue)}
                            </p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">gross sales in {activeDateLabel.toLowerCase()}</p>
                        </div>
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                            <DollarSign size={22} />
                        </div>
                    </div>
                </div>

                {/* Units Sold */}
                <div className="relative overflow-hidden bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-t-2xl" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Units Sold</p>
                            <p className="text-2xl font-black text-zinc-900 leading-tight">
                                {loadingData ? '...' : grandTotalSold.toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">units across all categories</p>
                        </div>
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                            <TrendingUp size={22} />
                        </div>
                    </div>
                </div>

                {/* Net Profit & Margin */}
                <div className="relative overflow-hidden bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-t-2xl" />
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Net Profit</p>
                            <p className="text-2xl font-black text-purple-600 leading-tight">
                                {loadingData ? '...' : fmtPeso(categorySummary?.totalProfit || 0)}
                            </p>
                            <p className="text-xs text-zinc-400 mt-1 font-medium">
                                {categorySummary?.overallProfitMargin ? `${categorySummary.overallProfitMargin.toFixed(1)}% margin` : 'Gross margin'}
                            </p>
                        </div>
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
                            <Award size={22} />
                        </div>
                    </div>
                </div>

                {/* Lifetime Stock Received */}
                <div className="relative overflow-hidden bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600 rounded-t-2xl" />
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1.5">Sell-Through Rate</p>
                            <p className="text-2xl font-black text-zinc-900 leading-tight">
                                {overallSellThrough.toFixed(1)}%
                            </p>
                            <div className="mt-2.5 w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 bg-amber-500"
                                    style={{ width: `${Math.min(overallSellThrough, 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shrink-0 ml-3">
                            <Package size={22} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Category Sales Share & Breakdown Banner ──────────────────── */}
            <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <PieChart size={18} className="text-indigo-600" />
                            <h3 className="text-base font-black text-zinc-900 tracking-tight">Category Sales Breakdown & Percentage</h3>
                            {categoryFilter !== 'All' && (
                                <span className="text-[11px] font-bold bg-zinc-900 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                    Filtered by: {categoryFilter}
                                    <button onClick={() => setCategoryFilter('All')} className="hover:text-red-300 ml-0.5">
                                        <X size={10} />
                                    </button>
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                            Percentage share of total sales revenue and volume across categories ({activeDateLabel})
                        </p>
                    </div>

                    {/* Metric Toggle: By Revenue vs By Units */}
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                        <button
                            onClick={() => setCategoryMetricMode('revenue')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                categoryMetricMode === 'revenue'
                                    ? 'bg-white text-zinc-900 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                            % of Sales (Revenue)
                        </button>
                        <button
                            onClick={() => setCategoryMetricMode('units')}
                            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                categoryMetricMode === 'units'
                                    ? 'bg-white text-zinc-900 shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-800'
                            }`}
                        >
                            % of Units (Volume)
                        </button>
                    </div>
                </div>

                {/* Proportional Segmented Progress Bar */}
                {categorySummary?.categories?.length > 0 && (
                    <div className="mb-4">
                        <div className="w-full h-3.5 bg-stone-100 rounded-full overflow-hidden flex shadow-inner">
                            {categorySummary.categories.map((cat) => {
                                const pct = categoryMetricMode === 'revenue' ? cat.revenuePercentage : cat.unitsPercentage;
                                if (pct <= 0) return null;
                                const style = CATEGORY_STYLES[cat.category] || CATEGORY_STYLES.Default;
                                return (
                                    <div
                                        key={cat.category}
                                        style={{
                                            width: `${Math.max(pct, 0.6)}%`,
                                            backgroundColor: style.hex
                                        }}
                                        className="h-full transition-all duration-500 cursor-pointer hover:opacity-85"
                                        title={`${cat.category}: ${pct.toFixed(1)}% (${categoryMetricMode === 'revenue' ? fmtPeso(cat.revenue) : `${cat.unitsSold} units`})`}
                                        onClick={() => setCategoryFilter(categoryFilter === cat.category ? 'All' : cat.category)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Category Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {categorySummary?.categories?.map((cat) => {
                        const isSelected = categoryFilter === cat.category;
                        const style = CATEGORY_STYLES[cat.category] || CATEGORY_STYLES.Default;
                        const pct = categoryMetricMode === 'revenue' ? cat.revenuePercentage : cat.unitsPercentage;

                        return (
                            <div
                                key={cat.category}
                                onClick={() => setCategoryFilter(isSelected ? 'All' : cat.category)}
                                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                                    isSelected
                                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900 ring-offset-2'
                                        : 'bg-white hover:bg-stone-50 border-stone-200 text-zinc-800 hover:border-stone-300 shadow-sm'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-1 mb-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                                style={{ backgroundColor: isSelected ? '#ffffff' : style.hex }}
                                            />
                                            <span className={`text-xs font-black truncate ${isSelected ? 'text-white' : 'text-zinc-800'}`}>
                                                {cat.category}
                                            </span>
                                        </div>
                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                            isSelected ? 'bg-white/20 text-white' : `${style.bg} ${style.text}`
                                        }`}>
                                            {pct.toFixed(1)}%
                                        </span>
                                    </div>

                                    {/* Revenue Amount */}
                                    <div className={`text-base font-black tracking-tight leading-tight mb-1 ${
                                        isSelected ? 'text-white' : 'text-zinc-900'
                                    }`}>
                                        {fmtPeso(cat.revenue)}
                                    </div>

                                    {/* Units & Avg */}
                                    <div className={`text-[11px] font-medium leading-tight ${
                                        isSelected ? 'text-white/80' : 'text-zinc-500'
                                    }`}>
                                        <span>{cat.unitsSold.toLocaleString()} units sold</span>
                                        <span className="block text-[10px] opacity-75 mt-0.5">
                                            Avg {fmtPeso(cat.avgSellingPrice)}
                                        </span>
                                    </div>
                                </div>

                                {/* Mini bar at bottom of card */}
                                <div className="mt-3">
                                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${
                                        isSelected ? 'bg-white/20' : 'bg-stone-100'
                                    }`}>
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${Math.min(pct, 100)}%`,
                                                backgroundColor: isSelected ? '#ffffff' : style.hex
                                            }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center mt-1.5 text-[9px] font-bold">
                                        <span className={isSelected ? 'text-emerald-300' : 'text-emerald-600'}>
                                            {cat.profitMargin.toFixed(0)}% margin
                                        </span>
                                        <span className={isSelected ? 'text-white/60' : 'text-zinc-400 group-hover:text-zinc-600'}>
                                            {isSelected ? 'Active ✓' : 'Filter →'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 mr-2 uppercase tracking-wide">
                    <Filter size={14} /> Filter Table:
                </span>
                {categories.map(cat => {
                    const isSelected = categoryFilter === cat;
                    return (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                                isSelected
                                    ? 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                                    : 'bg-white border-stone-200 text-zinc-600 hover:bg-stone-50'
                            }`}
                        >
                            {cat}
                        </button>
                    );
                })}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-white border border-stone-200 rounded-2xl shadow-sm min-h-[350px]">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100/90 backdrop-blur-md shadow-sm z-10 text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-stone-200">
                        <tr>
                            <th className="px-6 py-4">Product Name</th>
                            <th className="px-6 py-4">SKU</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4 text-center"><span className="text-blue-500">Stock Received</span></th>
                            <th className="px-6 py-4 text-center">
                                <span className="text-zinc-800">
                                    Units Sold
                                    {activeDateLabel !== 'All Time' && (
                                        <span className="block text-[10px] font-semibold text-zinc-400 normal-case">{activeDateLabel}</span>
                                    )}
                                </span>
                            </th>
                            <th className="px-6 py-4 text-right">
                                <span className="text-emerald-600">
                                    Sales Revenue
                                    {activeDateLabel !== 'All Time' && (
                                        <span className="block text-[10px] font-semibold text-emerald-400 normal-case">{activeDateLabel}</span>
                                    )}
                                </span>
                            </th>
                            <th className="px-6 py-4 text-center">Remaining</th>
                            <th className="px-6 py-4 text-right">Sell-Through</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-sm">
                        {loadingData ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center text-zinc-400">
                                    <Loader2 className="inline w-6 h-6 animate-spin mb-2 text-zinc-400" />
                                    <div>Loading sales data…</div>
                                </td>
                            </tr>
                        ) : salesData.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-16 text-center text-zinc-400">
                                    No products matching your filters.
                                </td>
                            </tr>
                        ) : (
                            salesData.map((item) => {
                                const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.Default;
                                return (
                                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-zinc-900 group-hover:text-zinc-700 transition-colors">{item.name}</div>
                                            <div className="text-xs text-zinc-400 mt-0.5">{item.brand}</div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-zinc-500">{item.sku}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                                                {item.category}
                                            </span>
                                        </td>

                                        {/* Lifetime Stock */}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-base font-black text-zinc-700">{item.totalAdded}</span>
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">received</span>
                                            </div>
                                        </td>

                                        {/* Sold in Period */}
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-base font-black text-zinc-900">{item.totalSold}</span>
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">units</span>
                                            </div>
                                        </td>

                                        {/* Sales Revenue */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-base font-black text-emerald-600 font-mono">
                                                    {fmtPeso(item.revenue)}
                                                </span>
                                                <span className="text-[10px] text-zinc-400">
                                                    @ {fmtPeso(item.sellingPrice)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Remaining */}
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex items-center justify-center min-w-[2.2rem] font-black text-sm px-2.5 py-1 rounded-xl border ${
                                                item.remaining === 0
                                                    ? 'text-red-600 bg-red-50 border-red-200'
                                                    : item.remaining <= 2
                                                    ? 'text-amber-600 bg-amber-50 border-amber-200'
                                                    : 'text-blue-600 bg-blue-50 border-blue-100'
                                            }`}>
                                                {item.remaining}
                                            </span>
                                        </td>

                                        {/* Sell-Through */}
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="w-24 bg-stone-100 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(item.sellThrough, 100)}%`,
                                                            background: item.sellThrough >= 80 ? '#10b981'
                                                                      : item.sellThrough >= 40 ? '#f59e0b'
                                                                      : '#f87171'
                                                        }}
                                                    />
                                                </div>
                                                <span className={`font-black text-sm w-10 text-right ${
                                                    item.sellThrough >= 80 ? 'text-emerald-600'
                                                  : item.sellThrough >= 40 ? 'text-amber-500'
                                                  : 'text-red-400'
                                                }`}>
                                                    {item.sellThrough.toFixed(0)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ProductSales;
