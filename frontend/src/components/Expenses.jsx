import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Receipt, Plus, Trash2, Calendar, X, ChevronLeft, ChevronRight,
    AlertCircle, RefreshCw, Search, ChevronDown, DollarSign, TrendingUp, TrendingDown,
    Wallet, Store, Building2, CreditCard, Landmark, Smartphone
} from 'lucide-react';

const CATEGORIES = ['Miscellaneous', 'Bills', 'Supplies', 'Salary', 'Rent', 'Maintenance'];

const CATEGORY_COLORS = {
    'Miscellaneous': { bg: '#f5f5f4', text: '#57534e', dot: '#a8a29e' },
    'Bills':         { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
    'Supplies':      { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
    'Salary':        { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
    'Rent':          { bg: '#fdf2f8', text: '#9d174d', dot: '#ec4899' },
    'Maintenance':   { bg: '#ecfeff', text: '#155e75', dot: '#06b6d4' },
};

const PAYMENT_SOURCES = [
    { id: 'Cash Drawer', label: 'Cash Drawer', icon: Wallet },
    { id: 'GCash',       label: 'GCash',       icon: Smartphone },
    { id: 'Maya',        label: 'Maya',        icon: Smartphone },
    { id: 'GoTyme',      label: 'GoTyme',      icon: Smartphone },
    { id: 'BDO',         label: 'BDO Bank',    icon: Landmark },
    { id: 'BPI',         label: 'BPI Bank',    icon: Landmark },
    { id: 'MBOS',        label: 'MBOS Bank',   icon: Landmark },
    { id: 'Other',       label: 'Other Account', icon: CreditCard },
];

const formatCurrency = (val) =>
    `₱${Number(val ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// ── Date helpers ─────────────────────────────────────────────────────────────
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const isSameDay  = (a, b) => a && b && a.toDateString() === b.toDateString();
const isInRange  = (date, start, end) => {
    if (!start || !end) return false;
    const t = date.getTime();
    return t > Math.min(start.getTime(), end.getTime()) && t < Math.max(start.getTime(), end.getTime());
};

const TIME_RANGES = [
    { id: 'TODAY', label: 'Today' },
    { id: '1W',  label: 'This Week' },
    { id: '1M',  label: 'This Month' },
    { id: '1Y',  label: 'This Year' },
];

const getRangeForPreset = (id) => {
    const now = new Date();
    switch (id) {
        case 'TODAY': return { start: startOfDay(now), end: endOfDay(now) };
        case '1W': {
            const ws = new Date(now);
            ws.setDate(now.getDate() - now.getDay());
            return { start: startOfDay(ws), end: endOfDay(now) };
        }
        case '1M': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
        case '1Y': return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
        default:   return { start: startOfDay(now), end: endOfDay(now) };
    }
};

// ── Calendar Picker ───────────────────────────────────────────────────────────
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEK_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const CalendarPicker = ({ onApply, onClose, visible }) => {
    const today = new Date();
    const [viewYear,  setViewYear]  = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [startDate, setStartDate] = useState(null);
    const [endDate,   setEndDate]   = useState(null);
    const [hoverDate, setHoverDate] = useState(null);

    const getDays  = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirst = (y, m) => new Date(y, m, 1).getDay();
    const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); } else setViewMonth(m => m-1); };
    const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); } else setViewMonth(m => m+1); };

    const handleDay = (day) => {
        const c = new Date(viewYear, viewMonth, day);
        if (!startDate || (startDate && endDate)) { setStartDate(c); setEndDate(null); }
        else { if (c < startDate) { setEndDate(startDate); setStartDate(c); } else setEndDate(c); }
    };

    const daysInMonth = getDays(viewYear, viewMonth);
    const firstDay    = getFirst(viewYear, viewMonth);
    const label = (d) => d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    return (
        <div
            className="absolute right-0 top-12 z-50 bg-white border border-stone-200 rounded-2xl shadow-2xl p-5 w-80"
            style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)', transition: 'opacity 180ms ease, transform 180ms ease', pointerEvents: visible ? 'all' : 'none' }}
        >
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500"><ChevronLeft size={16} /></button>
                <span className="text-sm font-bold text-zinc-800">{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500"><ChevronRight size={16} /></button>
            </div>
            <div className="grid grid-cols-7 mb-1">
                {WEEK_DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-zinc-400 py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const date = new Date(viewYear, viewMonth, day);
                    const isStart = isSameDay(date, startDate);
                    const isEnd   = isSameDay(date, endDate);
                    const inRange = isInRange(date, startDate, endDate || hoverDate);
                    const isToday = isSameDay(date, today);
                    const isFuture = date > today;
                    return (
                        <button key={day} disabled={isFuture} onClick={() => handleDay(day)}
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
                    <div><span className="block font-bold text-zinc-400 mb-0.5">FROM</span><span className="text-zinc-700 font-semibold">{label(startDate)}</span></div>
                    <div className="text-right"><span className="block font-bold text-zinc-400 mb-0.5">TO</span><span className="text-zinc-700 font-semibold">{label(endDate)}</span></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-bold rounded-lg border border-stone-200 text-zinc-500 hover:bg-stone-50">Cancel</button>
                    <button onClick={() => startDate && endDate && onApply(startDate, endDate)} disabled={!startDate || !endDate} className="flex-1 py-2 text-xs font-bold rounded-lg bg-zinc-950 text-white disabled:opacity-30 hover:bg-zinc-800">Apply Range</button>
                </div>
            </div>
        </div>
    );
};

// ── Add Expense Modal ─────────────────────────────────────────────────────────
const AddExpenseModal = ({ onSave, onClose, batches = [], branches = [], defaultBranchId = null, isAdmin = true, user = null }) => {
    const [form, setForm] = useState({
        name: '',
        category: 'Miscellaneous',
        cost: '',
        note: '',
        batchId: '',
        type: 'EXPENSE',
        paymentSource: 'Cash Drawer',
        branchId: defaultBranchId || (isAdmin ? '' : user?.branchId || '')
    });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async () => {
        if (!form.name.trim()) return setErr(`${form.type === 'INCOME' ? 'Income' : 'Expense'} name is required.`);
        if (!form.cost || isNaN(Number(form.cost)) || Number(form.cost) <= 0) return setErr(`Enter a valid ${form.type === 'INCOME' ? 'amount' : 'cost'}.`);
        setSaving(true); setErr('');
        try {
            const dataToSave = {
                name: form.name.trim(),
                category: form.type === 'INCOME' ? 'Income' : form.category,
                cost: Number(form.cost),
                note: form.note.trim(),
                type: form.type,
                paymentSource: form.paymentSource,
                batchId: form.batchId || null,
                branch: form.branchId && Number(form.branchId) > 0 ? { id: Number(form.branchId) } : null
            };

            await onSave(dataToSave);
            onClose();
        } catch {
            setErr(`Failed to save ${form.type.toLowerCase()}. Please try again.`);
        } finally {
            setSaving(false);
        }
    };

    const isExp = form.type === 'EXPENSE';

    return (
        <div className="fixed inset-0 bg-zinc-950/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}
            style={{ animation: 'fadeSlideIn 180ms ease' }}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md border border-stone-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-2xl ${isExp ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {isExp ? <Receipt size={18} /> : <TrendingUp size={18} />}
                        </div>
                        <div>
                            <h3 className="text-base font-black text-stone-900">{isExp ? 'Record Operating Expense' : 'Record Direct Income'}</h3>
                            <p className="text-[11px] text-stone-400 font-medium">Record outgoing costs or store cash adjustments</p>
                        </div>
                    </div>
                    {/* Toggle */}
                    <div className="flex bg-stone-100 p-1 rounded-xl">
                        <button onClick={() => set('type', 'EXPENSE')} className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${isExp ? 'bg-white shadow text-stone-900' : 'text-stone-400 hover:text-stone-600'}`}>Expense</button>
                        <button onClick={() => set('type', 'INCOME')} className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${!isExp ? 'bg-emerald-600 shadow text-white' : 'text-stone-400 hover:text-stone-600'}`}>Income</button>
                    </div>
                </div>

                {err && (
                    <div className="flex items-center gap-2 p-3 mb-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                        <AlertCircle size={14} /> {err}
                    </div>
                )}

                <div className="space-y-3.5 text-xs">
                    {/* Location / Branch Tagging */}
                    <div>
                        <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">Location / Branch Scope *</label>
                        {isAdmin ? (
                            <div className="relative">
                                <select
                                    value={form.branchId} onChange={e => set('branchId', e.target.value)}
                                    className="w-full appearance-none px-3 py-2 border border-stone-300 rounded-xl font-bold text-stone-800 bg-white pr-9 text-xs"
                                >
                                    <option value="">🏢 Central Admin (Headquarters)</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            🏬 {b.name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-700 font-bold">
                                <Store size={14} className="text-emerald-700" />
                                <span>{user?.branchName || 'Assigned Branch'}</span>
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">{isExp ? 'Expense Name' : 'Income Source'} *</label>
                        <input
                            type="text" autoFocus value={form.name} onChange={e => set('name', e.target.value)}
                            placeholder={isExp ? "e.g. Internet Bill, Store Rent, Coffee for staff, Paddle Grip repair…" : "e.g. Initial Capital, Refund, Sponsorship…"}
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-800 text-xs"
                        />
                    </div>

                    {/* Paid From / Payment Source */}
                    <div>
                        <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">{isExp ? 'Paid From (Payment Account)' : 'Deposited To (Payment Account)'} *</label>
                        <div className="relative">
                            <select
                                value={form.paymentSource} onChange={e => set('paymentSource', e.target.value)}
                                className="w-full appearance-none px-3 py-2 border border-stone-300 rounded-xl font-bold text-stone-800 bg-white pr-9 text-xs"
                            >
                                {PAYMENT_SOURCES.map(p => (
                                    <option key={p.id} value={p.id}>{p.label}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Category */}
                    {isExp && (
                        <div>
                            <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">Category *</label>
                            <div className="relative">
                                <select
                                    value={form.category} onChange={e => set('category', e.target.value)}
                                    className="w-full appearance-none px-3 py-2 border border-stone-300 rounded-xl font-bold text-stone-800 bg-white pr-9 text-xs"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Cost */}
                    <div>
                        <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">{isExp ? 'Cost' : 'Amount'} (₱) *</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₱</span>
                            <input
                                type="number" min="0" step="0.01" value={form.cost} onChange={e => set('cost', e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-7 pr-3 py-2 border border-stone-300 rounded-xl font-black focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-900 text-xs"
                            />
                        </div>
                    </div>

                    {/* Batch Link */}
                    {isExp && batches.length > 0 && (
                        <div>
                            <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">Link to Restock Batch <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                            <div className="relative">
                                <select
                                    value={form.batchId} onChange={e => set('batchId', e.target.value)}
                                    className="w-full appearance-none px-3 py-2 border border-stone-300 rounded-xl font-medium text-stone-800 bg-white pr-9 text-xs truncate"
                                >
                                    <option value="">None (Standalone Expense)</option>
                                    {batches.map(b => (
                                        <option key={b.batchId} value={b.batchId}>
                                            {new Date(b.date).toLocaleDateString()} - {b.supplier} ({b.totalQuantity} items) - ₱{b.totalExpense?.toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-[10px] font-black text-stone-500 uppercase tracking-wider mb-1">Note <span className="font-normal normal-case text-stone-400">(optional)</span></label>
                        <textarea
                            value={form.note} onChange={e => set('note', e.target.value)}
                            placeholder="Any receipts, voucher numbers, or details…" rows={2}
                            className="w-full px-3 py-2 border border-stone-300 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-stone-900 text-stone-800 resize-none text-xs"
                        />
                    </div>
                </div>

                <div className="flex gap-2.5 mt-5 pt-3 border-t border-stone-100">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-bold rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer">Cancel</button>
                    <button onClick={handleSubmit} disabled={saving} className={`flex-1 py-2 text-xs font-black rounded-xl text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md active:scale-95 ${saving ? 'bg-stone-700' : isExp ? 'bg-stone-900 hover:bg-stone-800' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                        {saving ? <RefreshCw size={13} className="animate-spin" /> : isExp ? <Plus size={13} /> : <TrendingUp size={13} />}
                        {saving ? 'Saving…' : isExp ? 'Record Expense' : 'Record Income'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Expenses = ({ initialBranchId = null, branchName = null }) => {
    const { user, isAdmin, isBranch, currentBranchId } = useAuth();
    const [expenses, setExpenses]       = useState([]);
    const [branches, setBranches]       = useState([]);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState(initialBranchId !== null ? String(initialBranchId) : '');
    const [incomeSummary, setIncomeSummary] = useState({ totalIncome: 0, paymentBreakdown: {} });
    const [batches, setBatches]         = useState([]);
    const [loading, setLoading]         = useState(true);
    const [error,   setError]           = useState('');
    const [catFilter, setCatFilter]     = useState('All');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [searchQuery, setSearch]      = useState('');
    const [showAdd,   setShowAdd]       = useState(false);
    const [deletingId, setDeleting]     = useState(null);
    const [editingId, setEditing]       = useState(null);
    const [editNote,   setEditNote]     = useState('');

    const [activePreset, setActivePreset] = useState('1M');
    const [customRange,  setCustomRange]  = useState(null);
    const [showCal,      setShowCal]      = useState(false);
    const calRef = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Load branch list for admin dropdown
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => setBranches(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Failed to load branches:', err));
        }
    }, [isAdmin]);

    const fetchData = () => {
        setLoading(true); setError('');

        let bParam = '';
        if (isBranch && currentBranchId) {
            bParam = `&branchId=${currentBranchId}`;
        } else if (selectedBranchFilter === 'admin') {
            bParam = `&branchId=0`;
        } else if (selectedBranchFilter) {
            bParam = `&branchId=${selectedBranchFilter}`;
        }

        const expUrl = `/api/expenses?${bParam ? bParam.substring(1) : ''}`;
        const incUrl = `/api/reporting/income-summary?${bParam ? bParam.substring(1) : ''}`;

        Promise.all([
            axios.get(expUrl),
            axios.get(incUrl),
            axios.get(`/api/batch-actions/history`)
        ]).then(([resExp, resIncome, resBatches]) => {
            setExpenses(Array.isArray(resExp.data) ? resExp.data : []);
            setIncomeSummary(resIncome.data || { totalIncome: 0, paymentBreakdown: {} });
            setBatches(Array.isArray(resBatches.data) ? resBatches.data : []);
        }).catch(() => {
            setError('Could not load data. Is the backend running?');
        }).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
    }, [selectedBranchFilter, currentBranchId]);

    const handleAdd = async (data) => {
        const res = await axios.post(`/api/expenses`, data);
        setExpenses(prev => [res.data, ...prev]);
    };

    const handleUpdateNote = async (id) => {
        try {
            const res = await axios.put(`/api/expenses/${id}`, { note: editNote });
            setExpenses(prev => prev.map(e => e.id === id ? res.data : e));
            setEditing(null);
        } catch {
            setError('Failed to update note.');
        }
    };

    const handleDelete = async (exp) => {
        const hasBatch = !!exp.batchId;
        const msg = hasBatch
            ? 'This expense is linked to a supply batch.\nDeleting it will also revert the batch and remove its stock entries.\n\nContinue?'
            : 'Delete this record?';
        if (!window.confirm(msg)) return;
        setDeleting(exp.id);
        try {
            if (hasBatch) {
                await axios.delete(`/api/batch-actions/revert/${exp.batchId}`);
                setExpenses(prev => prev.filter(e => e.batchId !== exp.batchId));
                setBatches(prev => prev.filter(b => b.batchId !== exp.batchId));
            } else {
                await axios.delete(`/api/expenses/${exp.id}`);
                setExpenses(prev => prev.filter(e => e.id !== exp.id));
            }
        } catch {
            setError('Failed to delete record.');
        } finally {
            setDeleting(null);
        }
    };

    const handlePresetSelect = (id) => { setActivePreset(id); setCustomRange(null); setShowCal(false); };
    const handleCalApply = (start, end) => {
        const label = `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        setCustomRange({ start, end, label });
        setActivePreset(null);
        setShowCal(false);
    };

    const dateWindow = useMemo(() => {
        if (customRange) return { start: customRange.start, end: endOfDay(customRange.end) };
        if (activePreset) return getRangeForPreset(activePreset);
        return null;
    }, [activePreset, customRange]);

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return expenses.filter(e => {
            const d = new Date(e.expenseDate);
            const inDate = !dateWindow || (d >= dateWindow.start && d <= dateWindow.end);
            const inCat  = catFilter === 'All' || e.category === catFilter || (e.type === 'INCOME' && catFilter === 'All');
            const inSource = sourceFilter === 'All' || (e.paymentSource || 'Cash Drawer') === sourceFilter;
            const inQ    = !q || (e.name || '').toLowerCase().includes(q) || (e.note || '').toLowerCase().includes(q) || (e.paymentSource || '').toLowerCase().includes(q);
            return inDate && inCat && inSource && inQ;
        });
    }, [expenses, dateWindow, catFilter, sourceFilter, searchQuery]);

    const totals = useMemo(() => {
        const byCategory = {};
        CATEGORIES.forEach(c => { byCategory[c] = 0; });
        let expenseTotal = 0;
        let manualIncomeTotal = 0;
        filtered.forEach(e => {
            const val = Number(e.cost ?? 0);
            if (e.type === 'INCOME') {
                manualIncomeTotal += val;
            } else {
                expenseTotal += val;
                if (byCategory[e.category] !== undefined) byCategory[e.category] += val;
            }
        });
        return { total: expenseTotal, manualIncome: manualIncomeTotal, byCategory };
    }, [filtered]);

    const txTotals = useMemo(() => {
        return { income: Number(incomeSummary.totalIncome || 0) };
    }, [incomeSummary]);

    const netOperatingMoney = txTotals.income - totals.total + totals.manualIncome;

    const periodLabel = customRange ? customRange.label
        : activePreset === 'TODAY' ? "Today" : activePreset === '1W' ? 'This Week'
        : activePreset === '1M' ? 'This Month' : 'This Year';

    return (
        <div className="flex flex-col lg:h-full space-y-4">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-stone-900 text-white rounded-2xl shadow-sm">
                        <Receipt size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-black text-stone-900 tracking-tight">
                                {isBranch ? `${user?.branchName || 'Branch'} Expenses` : 'Store & Operational Expenses'}
                            </h2>
                            {isBranch && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Branch Scope
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-stone-500 font-medium">
                            Track store bills, rent, supplies, salaries, and cash outflows across vaults
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Branch Filter for Admin */}
                    {isAdmin && (
                        <div className="relative">
                            <Store size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            <select
                                value={selectedBranchFilter}
                                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                                className="pl-8 pr-8 py-2 bg-white border border-stone-300 rounded-xl text-xs font-black text-stone-900 shadow-xs focus:outline-none cursor-pointer"
                            >
                                <option value="">🏢 Consolidated (All Expenses)</option>
                                <option value="admin">🏛️ Central Admin Only</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>
                                        🏬 {b.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        </div>
                    )}

                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-stone-900 hover:bg-stone-800 transition-all shadow-sm active:scale-95 cursor-pointer"
                    >
                        <Plus size={14} /> Add Record
                    </button>
                </div>
            </div>

            {/* ── Period & Filter Controls ── */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* Search */}
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search expenses, notes, sources…"
                        className="pl-8 pr-8 py-1.5 text-xs font-medium rounded-xl border border-stone-300 bg-white shadow-2xs text-stone-800 placeholder-stone-400 focus:outline-none w-52"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700">
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Presets */}
                {TIME_RANGES.map(p => (
                    <button
                        key={p.id}
                        onClick={() => handlePresetSelect(p.id)}
                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            !customRange && activePreset === p.id
                                ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}

                {/* Custom Calendar */}
                <div className="relative" ref={calRef}>
                    <button
                        onClick={() => setShowCal(s => !s)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                            customRange
                                ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                        }`}
                    >
                        <Calendar size={12} />
                        <span>{customRange ? customRange.label : 'Custom Range'}</span>
                    </button>
                    <CalendarPicker onApply={handleCalApply} onClose={() => setShowCal(false)} visible={showCal} />
                </div>

                {/* Account Source Filter */}
                <div className="relative ml-auto">
                    <select
                        value={sourceFilter}
                        onChange={e => setSourceFilter(e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1 text-xs font-bold bg-white border border-stone-200 rounded-lg text-stone-600 cursor-pointer shadow-2xs"
                    >
                        <option value="All">All Paid Sources</option>
                        {PAYMENT_SOURCES.map(s => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold shrink-0">
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {/* ── Summary KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">Total Expenses</span>
                    <div className="text-2xl font-black text-rose-600 mt-1">{formatCurrency(totals.total)}</div>
                    <span className="text-[11px] text-stone-400 font-medium">in {periodLabel.toLowerCase()}</span>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">Store Revenue Inflow</span>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(txTotals.income)}</div>
                    <span className="text-[11px] text-stone-400 font-medium">gross sales collections</span>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">Net Store Money Flow</span>
                    <div className={`text-2xl font-black mt-1 ${netOperatingMoney >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
                        {formatCurrency(netOperatingMoney)}
                    </div>
                    <span className="text-[11px] text-stone-400 font-medium">Sales minus operating expenses</span>
                </div>

                <div className="bg-stone-900 text-white rounded-2xl p-4 shadow-xs flex flex-col justify-between">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Active Scope</span>
                        <div className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                            <Store size={14} className="text-emerald-400" />
                            <span>{selectedBranchFilter ? (branches.find(b => b.id.toString() === selectedBranchFilter)?.name || 'Central Admin') : 'All Branches'}</span>
                        </div>
                    </div>
                    <span className="text-[10px] text-stone-400">{filtered.length} recorded line items</span>
                </div>
            </div>

            {/* ── Table ── */}
            <div className="flex-1 min-h-[350px] overflow-auto bg-white border border-stone-200 rounded-2xl shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-stone-50 z-10 text-[10px] uppercase tracking-wider text-stone-500 font-black border-b border-stone-200">
                        <tr>
                            <th className="px-4 py-3">Expense Name</th>
                            <th className="px-4 py-3">Location / Scope</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3">Paid From</th>
                            <th className="px-4 py-3 text-right">Cost</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Notes</th>
                            <th className="px-4 py-3 text-center"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 8 }).map((_, j) => (
                                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-stone-100 rounded w-3/4" /></td>
                                    ))}
                                </tr>
                            ))
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="px-4 py-16 text-center text-stone-400">
                                    <Receipt size={32} className="mx-auto mb-2 opacity-20" />
                                    <p className="font-bold text-stone-700">No expenses found for this scope or period.</p>
                                    <p className="text-[11px] text-stone-400 mt-0.5">Click "Add Record" to log an operating expense or income.</p>
                                </td>
                            </tr>
                        ) : filtered.map(exp => {
                            const isInc = exp.type === 'INCOME';
                            const c = isInc
                                ? { bg: '#dcfce7', text: '#166534', dot: '#22c55e' }
                                : (CATEGORY_COLORS[exp.category] || CATEGORY_COLORS['Miscellaneous']);
                            const branchLabel = exp.branch?.name ? `🏬 ${exp.branch.name}` : '🏢 Central Admin';
                            const sourceLabel = exp.paymentSource || 'Cash Drawer';

                            return (
                                <tr key={exp.id} className="hover:bg-stone-50/70 transition-colors">
                                    <td className="px-4 py-3 font-bold text-stone-900">
                                        <div className="flex items-center gap-2">
                                            {isInc ? (
                                                <TrendingUp size={14} className="text-emerald-600 shrink-0" />
                                            ) : (
                                                <Receipt size={14} className="text-stone-400 shrink-0" />
                                            )}
                                            <span>{exp.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                            exp.branch?.name
                                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                : 'bg-stone-100 text-stone-700'
                                        }`}>
                                            {branchLabel}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                            style={{ backgroundColor: c.bg, color: c.text }}>
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                                            {isInc ? 'Income' : exp.category}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-stone-700">
                                        <div className="flex items-center gap-1 text-[11px]">
                                            <Wallet size={12} className="text-stone-400" />
                                            <span>{sourceLabel}</span>
                                        </div>
                                    </td>
                                    <td className={`px-4 py-3 text-right font-black ${isInc ? 'text-emerald-600' : 'text-stone-900'}`}>
                                        {formatCurrency(exp.cost)}
                                    </td>
                                    <td className="px-4 py-3 text-stone-500 font-medium whitespace-nowrap">
                                        {formatDate(exp.expenseDate)}
                                    </td>
                                    <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate" title={exp.note || ''}>
                                        {editingId === exp.id ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="text"
                                                    value={editNote}
                                                    onChange={e => setEditNote(e.target.value)}
                                                    className="px-2 py-1 border border-stone-300 rounded text-xs w-full"
                                                />
                                                <button onClick={() => handleUpdateNote(exp.id)} className="text-emerald-600 font-bold text-xs">Save</button>
                                                <button onClick={() => setEditing(null)} className="text-stone-400 text-xs">X</button>
                                            </div>
                                        ) : (
                                            <span onClick={() => { setEditing(exp.id); setEditNote(exp.note || ''); }} className="cursor-pointer hover:underline">
                                                {exp.note || <span className="text-stone-300 italic text-[11px]">Add note…</span>}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleDelete(exp)}
                                            disabled={deletingId === exp.id}
                                            className="p-1 text-stone-400 hover:text-rose-600 transition-colors cursor-pointer rounded"
                                            title="Delete record"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showAdd && (
                <AddExpenseModal
                    onSave={handleAdd}
                    onClose={() => setShowAdd(false)}
                    batches={batches}
                    branches={branches}
                    defaultBranchId={selectedBranchFilter !== 'admin' ? selectedBranchFilter : null}
                    isAdmin={isAdmin}
                    user={user}
                />
            )}
        </div>
    );
};

export default Expenses;
