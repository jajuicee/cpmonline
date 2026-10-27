import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Wallet,
    Building2,
    DollarSign,
    CreditCard,
    ArrowDownRight,
    ArrowUpRight,
    RefreshCw,
    TrendingUp,
    Store,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Clock,
    Search,
    ChevronDown,
    Layers,
    Receipt,
    Sparkles,
    ShieldCheck,
    Banknote,
    Smartphone,
    Landmark
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIME_RANGES = [
    { id: 'today', label: 'Today', days: 0 },
    { id: '7d', label: 'Last 7 Days', days: 7 },
    { id: '30d', label: 'Last 30 Days', days: 30 },
    { id: 'all', label: 'All Time', days: null }
];

const MoneyTracker = () => {
    const { isAdmin, user, currentBranchId } = useAuth();

    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    // Filters
    const [timeRange, setTimeRange] = useState('all');
    const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL'); // 'ALL' or branchId string
    const [branches, setBranches] = useState([]);
    const [movementFilter, setMovementFilter] = useState('ALL'); // 'ALL', 'IN', 'OUT'
    const [movementSearch, setMovementSearch] = useState('');

    // Fetch branches for admin filter dropdown
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data.filter(b => b.active) : [];
                    setBranches(list);
                })
                .catch(err => console.error('Failed to load branches for money tracker:', err));
        }
    }, [isAdmin]);

    // Build query params
    const getQueryParams = () => {
        const params = new URLSearchParams();
        if (selectedBranchFilter !== 'ALL' && selectedBranchFilter) {
            params.append('branchId', selectedBranchFilter);
        } else if (!isAdmin && currentBranchId) {
            params.append('branchId', currentBranchId);
        }

        if (timeRange !== 'all') {
            const range = TIME_RANGES.find(r => r.id === timeRange);
            if (range && range.days !== null) {
                const now = new Date();
                const from = new Date(now);
                if (range.days === 0) {
                    from.setHours(0, 0, 0, 0);
                } else {
                    from.setDate(now.getDate() - range.days);
                    from.setHours(0, 0, 0, 0);
                }
                const pad = (n) => String(n).padStart(2, '0');
                const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                params.append('from', fmt(from));
                params.append('to', fmt(now));
            }
        }
        return params.toString();
    };

    const fetchSummary = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            const q = getQueryParams();
            const url = q ? `/api/money-tracker/summary?${q}` : '/api/money-tracker/summary';
            const res = await axios.get(url);
            setSummaryData(res.data || null);
        } catch (err) {
            console.error('Failed to fetch money tracker summary:', err);
            setError('Could not load money tracker data. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchSummary();
    }, [timeRange, selectedBranchFilter]);

    // Filtered Movements
    const filteredMovements = useMemo(() => {
        if (!summaryData?.recentMovements) return [];
        return summaryData.recentMovements.filter(m => {
            if (movementFilter === 'IN' && m.direction !== 'IN') return false;
            if (movementFilter === 'OUT' && m.direction !== 'OUT') return false;
            if (movementSearch.trim()) {
                const q = movementSearch.toLowerCase();
                const desc = (m.description || '').toLowerCase();
                const branch = (m.branchName || '').toLowerCase();
                const method = (m.paymentMethod || '').toLowerCase();
                if (!desc.includes(q) && !branch.includes(q) && !method.includes(q)) return false;
            }
            return true;
        });
    }, [summaryData, movementFilter, movementSearch]);

    const getMethodIcon = (method) => {
        const m = (method || '').toLowerCase();
        if (m.includes('cash')) return Banknote;
        if (m.includes('gcash') || m.includes('maya')) return Smartphone;
        if (m.includes('bdo') || m.includes('bpi') || m.includes('gotyme') || m.includes('mbos')) return Landmark;
        return CreditCard;
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-12">
            {/* ── HEADER ── */}
            <div className="bg-white rounded-3xl p-6 border border-stone-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md">
                        <Wallet size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                Treasury & Vaults
                            </span>
                            <span className="text-xs text-stone-400">•</span>
                            <span className="text-xs text-stone-500 font-bold">
                                Where the Money Is
                            </span>
                        </div>
                        <h2 className="text-2xl font-black text-stone-900 tracking-tight mt-0.5">
                            Money Tracker System
                        </h2>
                    </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Branch Filter (for Admin) */}
                    {isAdmin && (
                        <div className="relative">
                            <select
                                value={selectedBranchFilter}
                                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                                className="appearance-none pl-9 pr-8 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-black text-stone-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                            >
                                <option value="ALL">🏢 All Locations (Consolidated)</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        📍 {b.name}
                                    </option>
                                ))}
                            </select>
                            <Store size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 pointer-events-none" />
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        </div>
                    )}

                    {/* Time Range Pills */}
                    <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200/80">
                        {TIME_RANGES.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setTimeRange(r.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    timeRange === r.id
                                        ? 'bg-white text-stone-900 shadow-xs'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Refresh */}
                    <button
                        onClick={() => fetchSummary(true)}
                        disabled={refreshing}
                        className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Refresh Money Tracker"
                    >
                        <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {/* ── EXECUTIVE LIQUIDITY OVERVIEW ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Liquid Funds */}
                <div className="bg-gradient-to-br from-stone-950 via-stone-900 to-stone-950 text-white rounded-3xl p-5 shadow-lg border border-stone-800 relative overflow-hidden">
                    <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                            Total Liquid Funds
                        </span>
                        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                            <Sparkles size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-white mt-2 font-mono">
                        {loading ? '...' : formatCurrency(summaryData?.totalLiquidFunds)}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-1 flex items-center gap-1.5 font-medium">
                        <span>All physical drawers + bank & e-wallets</span>
                    </div>
                </div>

                {/* Cash in Drawers */}
                <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                            Cash in Physical Drawers
                        </span>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                            <Banknote size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2 font-mono">
                        {loading ? '...' : formatCurrency(summaryData?.totalCashInDrawers)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1 font-medium flex items-center gap-1.5">
                        <span className="font-bold text-amber-700">
                            {summaryData?.cashDrawers?.length || 0} active drawer(s)
                        </span>
                        <span>across stores</span>
                    </div>
                </div>

                {/* Digital Wallets & Banks */}
                <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                            Digital & Bank Balances
                        </span>
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                            <Smartphone size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2 font-mono">
                        {loading ? '...' : formatCurrency(summaryData?.totalDigitalAndBankFunds)}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1 font-medium">
                        GCash, Maya, GoTyme, BDO, BPI, MBOS
                    </div>
                </div>

                {/* Accounts Receivable Radar */}
                <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                            Accounts Receivable
                        </span>
                        <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                            <CreditCard size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2 font-mono">
                        {loading
                            ? '...'
                            : formatCurrency(
                                  (Number(summaryData?.totalBranchDuesReceivable) || 0) +
                                      (Number(summaryData?.totalCustomerUnpaidReceivable) || 0)
                              )}
                    </div>
                    <div className="text-[11px] text-stone-500 mt-1 font-medium flex items-center justify-between">
                        <span>Branch Dues: <strong className="text-amber-700">{formatCurrency(summaryData?.totalBranchDuesReceivable)}</strong></span>
                    </div>
                </div>
            </div>

            {/* ── SECTION 1: PHYSICAL CASH DRAWERS ── */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Banknote size={18} className="text-amber-600" />
                            <h3 className="text-base font-black text-stone-900">
                                Cash Drawers & Physical Registers
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800">
                                Physical Vaults
                            </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Real-time liquid cash held at store counters (Cash sales collected minus cash expenses disbursed)
                        </p>
                    </div>

                    <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Drawer Cash</span>
                        <span className="text-lg font-black text-stone-900 font-mono">
                            {formatCurrency(summaryData?.totalCashInDrawers)}
                        </span>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summaryData?.cashDrawers?.map(drawer => {
                        const bal = Number(drawer.currentBalance || 0);
                        const isPositive = bal >= 0;

                        return (
                            <div
                                key={drawer.id}
                                className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 hover:border-stone-300 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                                            💵
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-stone-900 truncate max-w-[160px]">
                                                {drawer.name}
                                            </h4>
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                                                {drawer.locationType === 'ADMIN' ? 'Central HQ' : 'Branch Register'}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}>
                                        {isPositive ? 'Healthy' : 'Deficit'}
                                    </span>
                                </div>

                                <div className="mt-4 pt-3 border-t border-stone-200/80 flex items-baseline justify-between">
                                    <span className="text-xs text-stone-500 font-bold">Current In-Drawer</span>
                                    <span className={`text-xl font-black font-mono ${isPositive ? 'text-stone-900' : 'text-rose-600'}`}>
                                        {formatCurrency(bal)}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-white rounded-xl p-2 border border-stone-200/60">
                                        <span className="text-[10px] font-bold text-stone-400 block uppercase">Cash Inflow</span>
                                        <span className="font-bold text-emerald-700 font-mono">
                                            +{formatCurrency(drawer.cashSales)}
                                        </span>
                                    </div>
                                    <div className="bg-white rounded-xl p-2 border border-stone-200/60">
                                        <span className="text-[10px] font-bold text-stone-400 block uppercase">Cash Outflow</span>
                                        <span className="font-bold text-rose-600 font-mono">
                                            -{formatCurrency(drawer.cashExpenses)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SECTION 2: DIGITAL WALLETS & BANK ACCOUNTS ── */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Landmark size={18} className="text-indigo-600" />
                            <h3 className="text-base font-black text-stone-900">
                                Digital Wallets & Bank Accounts
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800">
                                Electronic Funds
                            </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Customer cashless collections minus operating costs paid directly through digital accounts
                        </p>
                    </div>

                    <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Electronic Funds</span>
                        <span className="text-lg font-black text-stone-900 font-mono">
                            {formatCurrency(summaryData?.totalDigitalAndBankFunds)}
                        </span>
                    </div>
                </div>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {summaryData?.digitalAccounts?.map(acc => {
                        const bal = Number(acc.currentBalance || 0);
                        const isPositive = bal >= 0;
                        const Icon = getMethodIcon(acc.methodName);

                        let badgeColor = 'bg-stone-100 text-stone-700';
                        if (acc.methodName === 'GCash') badgeColor = 'bg-blue-100 text-blue-800';
                        else if (acc.methodName === 'Maya') badgeColor = 'bg-emerald-100 text-emerald-800';
                        else if (acc.methodName === 'GoTyme') badgeColor = 'bg-teal-100 text-teal-800';
                        else if (acc.methodName === 'BDO' || acc.methodName === 'BPI') badgeColor = 'bg-amber-100 text-amber-800';

                        return (
                            <div
                                key={acc.methodName}
                                className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 hover:border-stone-300 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-white border border-stone-200 text-stone-700">
                                            <Icon size={16} />
                                        </div>
                                        <h4 className="text-xs font-black text-stone-900">
                                            {acc.methodName}
                                        </h4>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                                        {acc.accountType}
                                    </span>
                                </div>

                                <div className="mt-4 pt-3 border-t border-stone-200/80 flex items-baseline justify-between">
                                    <span className="text-[11px] text-stone-500 font-bold">Net Balance</span>
                                    <span className={`text-lg font-black font-mono ${isPositive ? 'text-stone-900' : 'text-rose-600'}`}>
                                        {formatCurrency(bal)}
                                    </span>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="bg-white rounded-xl p-2 border border-stone-200/60">
                                        <span className="text-[9px] font-bold text-stone-400 block uppercase">Inflow</span>
                                        <span className="font-bold text-emerald-700 font-mono">
                                            +{formatCurrency(acc.inflow)}
                                        </span>
                                    </div>
                                    <div className="bg-white rounded-xl p-2 border border-stone-200/60">
                                        <span className="text-[9px] font-bold text-stone-400 block uppercase">Outflow</span>
                                        <span className="font-bold text-rose-600 font-mono">
                                            -{formatCurrency(acc.outflow)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── SECTION 3: BRANCH DUES RECEIVABLES (ADMIN RADAR) ── */}
            {isAdmin && (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Store size={18} className="text-emerald-700" />
                                <h3 className="text-base font-black text-stone-900">
                                    Branch Accounts Receivable & Stock Dues
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-stone-200 text-stone-800">
                                    Wholesale Settlement Radar
                                </span>
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">
                                Funds pending remittance from branches for allocated stock transfers
                            </p>
                        </div>

                        <div className="text-right">
                            <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Dues Pending</span>
                            <span className="text-lg font-black text-amber-600 font-mono">
                                {formatCurrency(summaryData?.totalBranchDuesReceivable)}
                            </span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-stone-50 text-stone-400 font-black uppercase text-[10px] tracking-wider border-b border-stone-200">
                                <tr>
                                    <th className="py-3 px-5">Branch Name</th>
                                    <th className="py-3 px-4">Total Dispatched</th>
                                    <th className="py-3 px-4">Total Remitted</th>
                                    <th className="py-3 px-4">Balance Due</th>
                                    <th className="py-3 px-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {summaryData?.branchDuesBreakdown?.map(b => {
                                    const due = Number(b.balanceDue || 0);
                                    const isSettled = due <= 0;
                                    const hasOverdue = (b.overdueBatches || 0) > 0;

                                    return (
                                        <tr key={b.branchId} className="hover:bg-stone-50 transition-colors">
                                            <td className="py-3.5 px-5 font-black text-stone-900">
                                                <div className="flex items-center gap-2">
                                                    <Store size={14} className="text-stone-400" />
                                                    <span>{b.branchName}</span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                                                {formatCurrency(b.totalDispatched)}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                                                {formatCurrency(b.totalRemitted)}
                                            </td>
                                            <td className="py-3.5 px-4 font-mono font-black text-stone-900">
                                                <span className={due > 0 ? 'text-amber-600' : 'text-stone-400'}>
                                                    {formatCurrency(due)}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4 text-center">
                                                {isSettled ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800">
                                                        Settled
                                                    </span>
                                                ) : hasOverdue ? (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 flex items-center justify-center gap-1">
                                                        <AlertCircle size={11} /> {b.overdueBatches} Overdue
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                                        Pending
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── SECTION 4: UNIFIED LIVE MONEY MOVEMENTS STREAM ── */}
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <TrendingUp size={18} className="text-stone-700" />
                            <h3 className="text-base font-black text-stone-900">
                                Live Money Movements Feed
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-stone-200/80 text-stone-700">
                                {filteredMovements.length} events
                            </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                            Combined cash and digital inflows (sales collections) and outflows (operating expenses)
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search transaction..."
                                value={movementSearch}
                                onChange={(e) => setMovementSearch(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44"
                            />
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        </div>

                        {/* Direction Filters */}
                        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
                            {[
                                { id: 'ALL', label: 'All' },
                                { id: 'IN', label: 'Inflows (+)' },
                                { id: 'OUT', label: 'Outflows (-)' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setMovementFilter(btn.id)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                        movementFilter === btn.id
                                            ? 'bg-white text-stone-900 shadow-xs'
                                            : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-stone-100 max-h-[460px] overflow-y-auto custom-scrollbar">
                    {filteredMovements.length === 0 ? (
                        <div className="p-12 text-center text-stone-400">
                            <Receipt size={28} className="mx-auto mb-2 opacity-30 text-stone-400" />
                            <p className="text-xs font-bold text-stone-600">No money movements found</p>
                            <p className="text-[11px] text-stone-400 mt-0.5">Try adjusting your filters or date range</p>
                        </div>
                    ) : (
                        filteredMovements.map(m => {
                            const isInflow = m.direction === 'IN';
                            const Icon = getMethodIcon(m.paymentMethod);
                            const dateStr = m.timestamp ? new Date(m.timestamp).toLocaleString('en-PH', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            }) : '—';

                            return (
                                <div key={m.id} className="p-4 hover:bg-stone-50/80 transition-colors flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`p-2.5 rounded-xl shrink-0 ${
                                            isInflow
                                                ? 'bg-emerald-50 text-emerald-700'
                                                : 'bg-rose-50 text-rose-700'
                                        }`}>
                                            {isInflow ? <ArrowDownRight size={17} /> : <ArrowUpRight size={17} />}
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-stone-900 truncate">
                                                    {m.description}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-700 flex items-center gap-1">
                                                    <Icon size={11} /> {m.paymentMethod}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2">
                                                <span className="font-semibold text-stone-600">{m.branchName}</span>
                                                <span>•</span>
                                                <span>{dateStr}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className={`text-sm font-black font-mono ${
                                            isInflow ? 'text-emerald-700' : 'text-rose-600'
                                        }`}>
                                            {isInflow ? '+' : '-'}{formatCurrency(m.amount)}
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                                            {isInflow ? 'Collection' : 'Disbursement'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default MoneyTracker;
