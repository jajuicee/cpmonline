import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    History, CheckCircle2, Clock, CreditCard,
    AlertCircle, Loader2, RefreshCw, ChevronDown, Package,
    Calendar, X, ChevronLeft, ChevronRight, Search, MessageSquare, XCircle, Pen,
    Store, MapPin, Building2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PasswordModal from './PasswordModal';

const STATUS_ALL = 'ALL';
const STATUS_FULL = 'FULL';
const STATUS_PARTIAL = 'PARTIAL';
const STATUS_UNPAID = 'UNPAID';

const formatDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
};

const formatDateTwoLines = (iso) => {
    if (!iso) return { date: '—', time: '' };
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
    };
};

const formatCurrency = (val) =>
    val != null ? `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

// ── Date helpers ─────────────────────────────────────────────────────────────
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
const isInRange = (date, start, end) => {
    if (!start || !end) return false;
    const t = date.getTime();
    return t > Math.min(start.getTime(), end.getTime()) && t < Math.max(start.getTime(), end.getTime());
};

const TIME_RANGES = [
    { id: 'TODAY', label: 'Today' },
    { id: '1W', label: 'This Week' },
    { id: '1M', label: 'This Month' },
    { id: '1Y', label: 'This Year' },
    { id: 'ALL', label: 'All Time' },
];

const getRangeForPreset = (id) => {
    const now = new Date();
    switch (id) {
        case 'TODAY': return { start: startOfDay(now), end: endOfDay(now) };
        case '1W': {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            return { start: startOfDay(weekStart), end: endOfDay(now) };
        }
        case '1M': return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
        case '1Y': return { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) };
        case 'ALL': return null;
        default: return { start: startOfDay(now), end: endOfDay(now) };
    }
};

// ── Calendar Date Range Picker ───────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CalendarPicker = ({ onApply, onClose, visible }) => {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [hoverDate, setHoverDate] = useState(null);

    const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const handleDayClick = (day) => {
        const clicked = new Date(viewYear, viewMonth, day);
        if (!startDate || (startDate && endDate)) {
            setStartDate(clicked); setEndDate(null);
        } else {
            if (clicked < startDate) { setEndDate(startDate); setStartDate(clicked); }
            else setEndDate(clicked);
        }
    };

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const formatLabel = (d) => d ? d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

    return (
        <div
            className="absolute right-0 top-12 z-50 bg-white border border-stone-200 rounded-2xl shadow-2xl p-5 w-80"
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
                transition: 'opacity 180ms ease, transform 180ms ease',
                pointerEvents: visible ? 'all' : 'none',
            }}
        >
            <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500 transition-colors duration-150">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-bold text-zinc-800">{MONTHS[viewMonth]} {viewYear}</span>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500 transition-colors duration-150">
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
                {WEEK_DAYS.map(d => (
                    <div key={d} className="text-center text-xs font-bold text-zinc-400 py-1">{d}</div>
                ))}
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
                        <button
                            key={day}
                            disabled={isFuture}
                            onClick={() => handleDayClick(day)}
                            onMouseEnter={() => setHoverDate(date)}
                            onMouseLeave={() => setHoverDate(null)}
                            className={`
                                text-xs font-medium py-2 rounded-lg
                                ${isFuture ? 'text-zinc-300 cursor-not-allowed' : 'cursor-pointer'}
                                ${isStart || isEnd ? 'bg-zinc-950 text-white font-bold' : ''}
                                ${inRange && !isStart && !isEnd ? 'bg-zinc-100 text-zinc-700 rounded-none' : ''}
                                ${!isStart && !isEnd && !inRange && !isFuture ? 'hover:bg-stone-100 text-zinc-700' : ''}
                                ${isToday && !isStart && !isEnd ? 'ring-1 ring-zinc-300' : ''}
                            `}
                            style={{ transition: 'background-color 100ms ease, color 100ms ease' }}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 pt-4 border-t border-stone-100">
                <div className="flex justify-between text-xs text-zinc-500 mb-3">
                    <div>
                        <span className="block font-bold text-zinc-400 mb-0.5">FROM</span>
                        <span className="text-zinc-700 font-semibold">{formatLabel(startDate)}</span>
                    </div>
                    <div className="text-right">
                        <span className="block font-bold text-zinc-400 mb-0.5">TO</span>
                        <span className="text-zinc-700 font-semibold">{formatLabel(endDate)}</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-bold rounded-lg border border-stone-200 text-zinc-500 hover:bg-stone-50 transition-all duration-150">
                        Cancel
                    </button>
                    <button
                        onClick={() => startDate && endDate && onApply(startDate, endDate)}
                        disabled={!startDate || !endDate}
                        className="flex-1 py-2 text-xs font-bold rounded-lg bg-zinc-950 text-white disabled:opacity-30 hover:bg-zinc-800 transition-all duration-150"
                    >
                        Apply Range
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Payment Method Filter Dropdown ──────────────────────────────────────────

const PaymentFilter = ({ transactions, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const methods = useMemo(() => {
        const set = new Set(transactions.map(t => t.paymentMethod).filter(Boolean));
        set.add('BPI');
        return ['All', ...Array.from(set).sort()];
    }, [transactions]);

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
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-sm text-xs font-bold"
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
                className="absolute left-0 top-10 z-50 bg-white border border-stone-200 rounded-xl shadow-2xl py-1.5 min-w-[160px]"
                style={{
                    opacity: open ? 1 : 0,
                    transform: open ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                    transition: 'opacity 160ms ease, transform 160ms ease',
                    pointerEvents: open ? 'all' : 'none',
                }}
            >
                {methods.map(method => (
                    <button
                        key={method}
                        onClick={() => { onChange(method); setOpen(false); }}
                        className="w-full text-left px-4 py-2 text-xs flex items-center gap-2"
                        style={{
                            backgroundColor: value === method ? '#f5f5f4' : 'transparent',
                            color: value === method ? '#09090b' : '#52525b',
                            fontWeight: value === method ? '700' : '500',
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

// ── Edit Payment Modal (fixed, appears above everything) ─────────────────────
const EditPaymentModal = ({ group, methods, onSave, onClose }) => {
    const [value, setValue] = useState(group.paymentMethod || '');
    const [custom, setCustom] = useState(
        methods.includes(group.paymentMethod) ? '' : (group.paymentMethod || '')
    );
    const [isCustom, setIsCustom] = useState(!methods.includes(group.paymentMethod));
    const [updateLogs, setUpdateLogs] = useState(true);

    const handleSubmit = () => {
        const final = isCustom ? custom.trim() : value;
        if (final) onSave(final, updateLogs);
    };

    return (
        <div
            className="fixed inset-0 bg-zinc-950/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
            style={{ animation: 'fadeSlideIn 150ms ease' }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl p-5 w-64 border border-stone-200"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-stone-100">
                    <CreditCard size={16} className="text-zinc-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-700">Change Payment</h3>
                </div>
                <div className="flex flex-col gap-1 mb-3">
                    {methods.map(m => (
                        <button
                            key={m}
                            onClick={() => { setValue(m); setIsCustom(false); }}
                            className="text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2"
                            style={{
                                backgroundColor: value === m && !isCustom ? '#09090b' : '#f5f5f4',
                                color: value === m && !isCustom ? '#fff' : '#3f3f46',
                                transition: 'background-color 120ms ease, color 120ms ease',
                            }}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${value === m && !isCustom ? 'bg-white' : 'bg-transparent'}`} />
                            {m}
                        </button>
                    ))}
                    <button
                        onClick={() => { setIsCustom(true); setValue(''); }}
                        className="text-left px-3 py-2 rounded-lg text-xs font-medium"
                        style={{
                            backgroundColor: isCustom ? '#09090b' : '#f5f5f4',
                            color: isCustom ? '#fff' : '#3f3f46',
                            transition: 'background-color 120ms ease, color 120ms ease',
                        }}
                    >Custom…</button>
                </div>
                {isCustom && (
                    <input
                        autoFocus
                        value={custom}
                        onChange={e => setCustom(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onClose(); }}
                        placeholder="e.g. Maya, Check…"
                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    />
                )}
                <label className="flex items-start gap-2 mt-1 mb-4 cursor-pointer group">
                    <div className="pt-0.5">
                        <input
                            type="checkbox"
                            checked={updateLogs}
                            onChange={(e) => setUpdateLogs(e.target.checked)}
                            className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-stone-300"
                        />
                    </div>
                    <span className="text-[10px] text-zinc-500 font-medium group-hover:text-zinc-700 transition-colors leading-snug">
                        Apply to associated payment logs
                    </span>
                </label>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-xs font-bold rounded-lg border border-stone-200 text-zinc-500 hover:bg-stone-50 transition-colors">Cancel</button>
                    <button onClick={handleSubmit} className="flex-1 py-2 text-xs font-bold rounded-lg bg-zinc-950 text-white hover:bg-zinc-800 transition-colors">Save</button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const OrderHistory = () => {
    const { user, isAdmin, isBranch, currentBranchId, selectedBranchId, setSelectedBranchId } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isHqMode = isAdmin && searchParams.get('mode') === 'hq';
    const [branchList, setBranchList] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [paymentLogs, setPaymentLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState(STATUS_ALL);
    const [completing, setCompleting] = useState(null);
    const [cancelling, setCancelling] = useState(null);
    const [expanded, setExpanded] = useState(new Set());
    // Separate toggle for payment log rows under each order
    const [payLogsExpanded, setPayLogsExpanded] = useState(new Set());
    const [noteModal, setNoteModal] = useState(null);
    const [paymentFilter, setPaymentFilter] = useState('All');
    const [editingPayment, setEditingPayment] = useState(null); // orderId being edited
    // Fix #10: Styled confirmation modal state
    const [confirmModal, setConfirmModal] = useState(null); // { group }
    // Fix #11: Toast notification state
    const [toast, setToast] = useState(null); // { message, type }
    // Partial Group Payment
    const [payingBalanceGroup, setPayingBalanceGroup] = useState(null);
    const [paymentAmountInput, setPaymentAmountInput] = useState('');
    // PASSWORD PROTECTION
    const [pendingAuthAction, setPendingAuthAction] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const isSearching = searchQuery.trim().length > 0;

    const [activePreset, setActivePreset] = useState('TODAY');
    const [customRange, setCustomRange] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const calendarRef = useRef(null);

    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => setBranchList(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Failed to load branches:', err));
        }
    }, [isAdmin]);

    useEffect(() => {
        const handler = (e) => {
            if (calendarRef.current && !calendarRef.current.contains(e.target))
                setShowCalendar(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePresetSelect = (id) => {
        setActivePreset(id);
        setCustomRange(null);
        setShowCalendar(false);
    };

    const handleCalendarApply = (start, end) => {
        const label = `${start.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        const endDay = new Date(end.getTime());
        endDay.setHours(23, 59, 59, 999);
        setCustomRange({ start, end: endDay, label });
        setActivePreset(null);
        setShowCalendar(false);
    };

    const clearCustomRange = () => {
        setCustomRange(null);
        setActivePreset('ALL');
    };

    const toggleExpand = (id) => {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id); else next.add(id);
        setExpanded(next);
    };

    const togglePayLogs = (id) => {
        const next = new Set(payLogsExpanded);
        if (next.has(id)) next.delete(id); else next.add(id);
        setPayLogsExpanded(next);
    };

    // Scroll to an ORDER row by id, switching to All Time first if it isn't in the DOM
    const scrollToOrder = (orderId) => {
        const doScroll = () => {
            const el = document.getElementById(`order-row-${orderId}`);
            if (!el) return;
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.remove('order-highlight-flash');
            // Force reflow so re-adding the class restarts the animation
            void el.offsetWidth;
            el.classList.add('order-highlight-flash');
            setTimeout(() => el.classList.remove('order-highlight-flash'), 1500);
        };

        const el = document.getElementById(`order-row-${orderId}`);
        if (el) {
            doScroll();
        } else {
            // Order row not rendered under current filter — expand to All Time then retry
            setActivePreset('ALL');
            setCustomRange(null);
            setTimeout(doScroll, 400);
        }
    };

    // Build fetch URL from a preset id or custom range
    const buildFetchUrl = (preset, custom) => {
        const base = `/api/transactions`;
        const now = new Date();
        const branchParam = isHqMode
            ? '&onlyHq=true'
            : (currentBranchId ? `&branchId=${currentBranchId}` : '');
        // Convert to local time string matching LocalDateTime (YYYY-MM-DDTHH:mm:ss)
        const fmt = (d) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };

        if (custom) {
            const from = fmt(custom.start);
            const to = fmt(new Date(custom.end.getTime()));
            return `${base}?from=${from}&to=${to}&limit=5000${branchParam}`;
        }
        switch (preset) {
            case 'TODAY': {
                const from = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
                const to = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
                return `${base}?from=${from}&to=${to}&limit=300${branchParam}`;
            }
            case '1W': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0, 0, 0, 0);
                return `${base}?from=${fmt(weekStart)}&to=${fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59))}&limit=1500${branchParam}`;
            }
            case '1M': {
                const from = fmt(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
                const to = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
                return `${base}?from=${from}&to=${to}&limit=5000${branchParam}`;
            }
            case '1Y': {
                const from = fmt(new Date(now.getFullYear(), 0, 1, 0, 0, 0));
                const to = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59));
                return `${base}?from=${from}&to=${to}&limit=10000${branchParam}`;
            }
            default: // ALL
                return `${base}?limit=100000${branchParam}`;
        }
    };

    const fetchTransactions = (preset, custom) => {
        const url = buildFetchUrl(preset ?? activePreset, custom !== undefined ? custom : customRange);
        setLoading(true);
        setError('');

        // Build matching date params for payment-logs from the transaction URL
        const urlObj = new URL(url, 'http://localhost');
        const plFrom = urlObj.searchParams.get('from');
        const plTo   = urlObj.searchParams.get('to');
        const branchParam = isHqMode
            ? '&onlyHq=true'
            : (currentBranchId ? `&branchId=${currentBranchId}` : '');
        const plUrl  = plFrom && plTo
            ? `/api/payment-logs?from=${plFrom}&to=${plTo}${branchParam}`
            : (branchParam ? `/api/payment-logs?${branchParam.substring(1)}` : `/api/payment-logs`);

        Promise.all([
            axios.get(url),
            axios.get(plUrl)
        ])
            .then(([txRes, plRes]) => {
                setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
                setPaymentLogs(Array.isArray(plRes.data) ? plRes.data : []);
            })
            .catch(() => setError('Could not load order history. Is the backend running?'))
            .finally(() => setLoading(false));
    };

    // Re-fetch whenever the active preset, custom range, or branch filter changes
    useEffect(() => { fetchTransactions(activePreset, customRange); }, [activePreset, customRange, currentBranchId, isHqMode]);

    const handleCompleteItem = async (item) => {
        setCompleting(item.id);
        setTransactions(prev => prev.map(t => t.id === item.id ? { ...t, status: 'FULL' } : t));
        try {
            await axios.patch(`/api/transactions/${item.id}/complete`);
            fetchTransactions();
        } catch {
            setTransactions(prev => prev.map(t => t.id === item.id ? { ...t, status: item.status } : t));
            setError('Network error — could not save payment completion.');
        } finally {
            setCompleting(null);
        }
    };

    const handlePayPartialSubmit = async (e) => {
        e.preventDefault();
        const group = payingBalanceGroup;
        const amount = parseFloat(paymentAmountInput);
        if (isNaN(amount) || amount <= 0) {
            setError('Please enter a valid amount greater than zero.');
            return;
        }
        setPayingBalanceGroup(null);
        setCompleting(group.orderId);
        try {
            await axios.patch(`/api/transactions/group/${group.orderId}/pay-partial`, { amount });
            fetchTransactions();
            showToast(`Applied ₱${amount.toFixed(2)} to Order #${group.displayId}.`, 'success');
        } catch {
            fetchTransactions();
            setError('Network error — could not apply payment.');
        } finally {
            setCompleting(null);
        }
    };

    const handleCompleteGroup = async (group) => {
        setCompleting(group.orderId);
        const unfinished = group.items.filter(i => i.status !== 'FULL');
        setTransactions(prev => prev.map(t => unfinished.find(u => u.id === t.id) ? { ...t, status: 'FULL' } : t));
        try {
            await axios.patch(`/api/transactions/group/${group.orderId}/complete`);
            fetchTransactions();
            showToast(`Order #${group.displayId} fully paid.`, 'success');
        } catch {
            fetchTransactions();
            setError('Network error — could not complete all payments.');
        } finally {
            setCompleting(null);
        }
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    const handleCancelOrder = async (group) => {
        setPendingAuthAction({ type: 'DELETE', payload: group });
    };

    const handleAuthConfirm = () => {
        if (!pendingAuthAction) return;
        const group = pendingAuthAction.payload;
        setPendingAuthAction(null);
        setConfirmModal(group);
    };

    const confirmCancel = async (group) => {
        setConfirmModal(null);
        setCancelling(group.orderId);
        try {
            await axios.post(`/api/transactions/cancel/${group.orderId}`);
            fetchTransactions();
            // Fix #11: show success toast
            showToast(`Order #${group.displayId} deleted and stock restored.`, 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to delete order.', 'error');
        } finally {
            setCancelling(null);
        }
    };

    const handleUpdatePayment = async (group, newMethod, updateLogs) => {
        setEditingPayment(null);
        // Fix #7: Optimistic update handles both LEGACY and normal orders
        setTransactions(prev =>
            prev.map(t => {
                const txGroupId = t.transactionId || `LEGACY-${t.id}`;
                return txGroupId === group.orderId ? { ...t, paymentMethod: newMethod } : t;
            })
        );
        try {
            await axios.patch(`/api/transactions/group/${group.orderId}/payment`, { paymentMethod: newMethod, updateLogs });
            fetchTransactions();
        } catch {
            setError('Could not update payment method.');
            fetchTransactions();
        }
    };

    const dateWindow = useMemo(() => {
        if (customRange) return { start: customRange.start, end: endOfDay(customRange.end) };
        if (activePreset) return getRangeForPreset(activePreset);
        return null;
    }, [activePreset, customRange]);

    const timelineItems = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        
        // We use transactions directly since the backend now returns all active orders (created OR paid in range)
        const groups = transactions.reduce((acc, t) => {
            const key = t.transactionId || `LEGACY-${t.id}`;
            if (!acc[key]) {
                acc[key] = {
                    orderId: key,
                    displayId: t.transactionId ? String(t.transactionId).split('-')[1].substring(0, 6) : String(t.id).padStart(4, '0'),
                    customerName: t.customerName,
                    transactionType: t.transactionType,
                    paymentMethod: t.paymentMethod,
                    paymentDetails: t.notes || t.paymentDetails || '',
                    notes: t.notes || t.paymentDetails || '',
                    status: t.status,
                    date: t.transactionDate,
                    branchName: t.branch?.name || (isBranch ? user?.branchName : 'Main Store'),
                    items: [],
                    paymentLogs: [],
                    totalPrice: 0,
                    totalDownpayment: 0
                };
            }
            acc[key].items.push(t);
            acc[key].totalPrice += parseFloat(t.finalPrice || 0);
            acc[key].totalDownpayment += parseFloat(t.downpayment || 0);
            if (t.status === 'PARTIAL') acc[key].status = 'PARTIAL';
            if (t.status === 'UNPAID') acc[key].status = 'UNPAID';
            return acc;
        }, {});

        // Attach payment logs to groups
        paymentLogs.forEach(pl => {
            const gid = pl.orderId;
            if (groups[gid]) {
                groups[gid].paymentLogs.push(pl);
            }
        });

        // Sort payment logs descending inside each group
        Object.values(groups).forEach(g => {
            g.paymentLogs.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
        });

        let items = [];

        Object.values(groups).forEach(g => {
            // Check if order was placed in date window
            const orderDate = new Date(g.date);
            const inWindow = (!dateWindow || (orderDate >= dateWindow.start && orderDate <= dateWindow.end));
            if (inWindow || isSearching) {
                items.push({
                    type: 'ORDER',
                    sortDate: orderDate,
                    data: g
                });
            }

            // Only inject LATE_PAYMENT_REF items (ORDER + LATE_PAYMENT_REF is all we need in the
            // sorted array — PAYMENT rows are rendered inline inside each ORDER's Fragment so they
            // never bloat the sort/filter loop).
            g.paymentLogs.forEach(p => {
                const payDate = new Date(p.paymentDate);
                const orderDateLocal = new Date(g.date);
                const isLate = (payDate.getTime() - orderDateLocal.getTime()) > 30_000;
                const payInWindow = (!dateWindow || (payDate >= dateWindow.start && payDate <= dateWindow.end));

                if (isLate && (payInWindow || isSearching)) {
                    items.push({
                        type: 'LATE_PAYMENT_REF',
                        sortDate: payDate,
                        data: g,
                        paymentLog: p
                    });
                }
            });
        });

        if (isSearching) {
            items = items.filter(item => {
                const g = item.data;
                const productNames = g.items.map(i =>
                    i.variant?.product
                        ? `${i.variant.product.brandName} ${i.variant.product.modelName} ${i.variant?.color || ''}`.toLowerCase()
                        : ''
                ).join(' ');
                const skus = g.items.map(i => (i.variant?.sku || '').toLowerCase()).join(' ');
                return (
                    (g.customerName || '').toLowerCase().includes(q) ||
                    (g.displayId || '').toLowerCase().includes(q) ||
                    (g.paymentMethod || '').toLowerCase().includes(q) ||
                    (g.notes || g.paymentDetails || '').toLowerCase().includes(q) ||
                    productNames.includes(q) ||
                    skus.includes(q)
                );
            });
        }

        if (paymentFilter !== 'All') {
            // Only ORDER items carry paymentMethod at the group level;
            // LATE_PAYMENT_REF items pass through so they stay visible.
            items = items.filter(item => {
                if (item.type === 'ORDER') return item.data.paymentMethod === paymentFilter;
                return true;
            });
        }

        if (filter !== STATUS_ALL) {
            if (filter === STATUS_UNPAID) {
                items = items.filter(item => item.data.status === 'UNPAID' || item.data.status === 'PARTIAL');
            } else {
                items = items.filter(item => item.data.status === filter);
            }
        }

        // Simple descending sort — only ORDER and LATE_PAYMENT_REF items remain,
        // each carrying their own meaningful sortDate, so no anchoring needed.
        return items.sort((a, b) => b.sortDate - a.sortDate);
    }, [filter, transactions, dateWindow, searchQuery, isSearching, paymentFilter, paymentLogs]);

    const counts = useMemo(() => {
        const windowedTxs = dateWindow
            ? transactions.filter(t => {
                const d = new Date(t.transactionDate);
                return d >= dateWindow.start && d <= dateWindow.end;
            })
            : transactions;

        const groups = windowedTxs.reduce((acc, t) => {
            const key = t.transactionId || `LEGACY-${t.id}`;
            if (!acc[key]) acc[key] = t.status;
            if (t.status === 'PARTIAL') acc[key] = 'PARTIAL';
            if (t.status === 'UNPAID') acc[key] = 'UNPAID';
            return acc;
        }, {});
        const arr = Object.values(groups);
        return {
            all: arr.length,
            full: arr.filter(s => s === 'FULL').length,
            partial_unpaid: arr.filter(s => s === 'PARTIAL' || s === 'UNPAID').length,
        };
    }, [transactions, dateWindow]);

    // Unique payment methods in data — mirrors Analytics PaymentFilter options
    const paymentMethods = useMemo(() => {
        const set = new Set(transactions.map(t => t.paymentMethod).filter(Boolean));
        ['Cash', 'GCash', 'Maya', 'GoTyme', 'BDO', 'BPI', 'MBOS', 'Credit Card', 'QRPH'].forEach(m => set.add(m));
        return Array.from(set).sort();
    }, [transactions]);

    const periodLabel = customRange
        ? customRange.label
        : activePreset === 'TODAY' ? "Today's Orders"
            : activePreset === '1W' ? 'This Week'
                : activePreset === '1M' ? 'This Month'
                    : activePreset === '1Y' ? 'This Year'
                        : activePreset === 'ALL' ? 'All Time'
                            : '';

    // Changes whenever the date filter changes — used to retrigger row animations
    const tableKey = customRange ? customRange.label : (activePreset || 'all');

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col min-w-0 lg:h-full">
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(5px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes orderHighlight {
                    0%   { background-color: inherit; }
                    20%  { background-color: #fef08a; }
                    80%  { background-color: #fef08a; }
                    100% { background-color: inherit; }
                }
                .order-highlight-flash {
                    animation: orderHighlight 1.4s ease !important;
                }
                /* Applied once via className — never re-applied by React inline styles */
                .order-row-anim {
                    animation: fadeSlideIn 200ms ease both;
                }
            `}</style>

            {/* Fix #11: Toast notification */}
            {toast && (
                <div
                    className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold text-white`}
                    style={{
                        animation: 'toastIn 250ms ease',
                        backgroundColor: toast.type === 'success' ? '#16a34a' : '#dc2626',
                        minWidth: '280px',
                    }}
                >
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                    <button onClick={() => setToast(null)} className="ml-auto opacity-70 hover:opacity-100"><X size={14} /></button>
                </div>
            )}

            {/* Fix #10: Styled cancel confirmation modal */}
            {confirmModal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ animation: 'toastIn 200ms ease' }}>
                        <div className="bg-red-600 px-6 py-4 flex items-center gap-3 text-white">
                            <XCircle size={20} />
                            <h3 className="font-bold text-base">Delete Order #{confirmModal.displayId}?</h3>
                        </div>
                        <div className="p-6">
                            <p className="text-sm text-zinc-600 mb-1">This will permanently <strong>delete</strong> this order from history and restore stock for all items.</p>
                            <p className="text-xs text-zinc-400 font-medium">Customer: <span className="font-bold text-zinc-700">{confirmModal.customerName}</span></p>
                            <p className="text-xs text-zinc-400 font-medium mt-0.5">{confirmModal.items?.length} item(s) · Total: {formatCurrency(confirmModal.totalPrice)}</p>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-zinc-600 font-bold text-sm hover:bg-stone-50 transition-colors"
                            >Keep Order</button>
                            <button
                                onClick={() => confirmCancel(confirmModal)}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors"
                            >Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ROW 1 — Title + mode switcher + count + period */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2 shrink-0">
                <div className="flex items-baseline gap-2">
                    <h2 className="text-xl font-black text-zinc-900 flex items-center gap-2 shrink-0">
                        <History className="text-zinc-600" size={19} />
                        {isHqMode ? 'Central HQ Direct Order History' : 'Order History'}
                    </h2>
                    {isHqMode && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Master Storage Direct Sales
                        </span>
                    )}
                    <span
                        className="text-xs font-bold text-zinc-500"
                        style={{
                            opacity: loading ? 0 : 1,
                            transition: 'opacity 300ms ease',
                        }}
                    >
                        {isSearching ? (
                            <>
                                <span className="text-zinc-800">{timelineItems.length} items</span>
                                <span className="mx-1.5 text-zinc-300">·</span>
                                <span>Searching all dates for "{searchQuery.trim()}"</span>
                            </>
                        ) : (
                            <>
                                <span className="text-zinc-800">{timelineItems.filter(i => i.type === 'ORDER').length} orders</span>
                                {periodLabel && (
                                    <>
                                        <span className="mx-1.5 text-zinc-300">·</span>
                                        <span className="text-zinc-500">{periodLabel}</span>
                                    </>
                                )}
                            </>
                        )}
                    </span>
                </div>

                {/* HQ Direct vs All Store Orders Mode Switcher (Admin Only) */}
                {isAdmin && (
                    <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200">
                        <button
                            onClick={() => setSearchParams({ mode: 'hq' })}
                            className={`px-3 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                isHqMode
                                    ? 'bg-stone-900 text-white shadow-sm'
                                    : 'text-stone-500 hover:text-stone-800'
                            }`}
                        >
                            <Store size={13} className={isHqMode ? "text-emerald-400" : ""} />
                            <span>HQ Direct Orders</span>
                        </button>
                        <button
                            onClick={() => setSearchParams({})}
                            className={`px-3 py-1 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 ${
                                !isHqMode
                                    ? 'bg-stone-900 text-white shadow-sm'
                                    : 'text-stone-500 hover:text-stone-800'
                            }`}
                        >
                            <Building2 size={13} />
                            <span>All Store Orders</span>
                        </button>
                    </div>
                )}
            </div>

            {/* ROW 2 — Controls bar */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 shrink-0 w-full">

                {/* SEARCH BAR */}
                <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search all orders…"
                        className="pl-7 pr-7 py-1.5 text-xs font-medium rounded-lg border border-stone-300 bg-white shadow-sm text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 w-44"
                        style={{ transition: 'border-color 200ms ease, box-shadow 200ms ease' }}
                    />
                    <span
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        style={{
                            opacity: isSearching ? 1 : 0,
                            transform: `translateY(-50%) scale(${isSearching ? 1 : 0.6})`,
                            transition: 'opacity 150ms ease, transform 150ms ease',
                            pointerEvents: isSearching ? 'all' : 'none',
                        }}
                    >
                        <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-700 transition-colors duration-150">
                            <X size={12} />
                        </button>
                    </span>
                </div>

                {/* STATUS FILTER TABS */}
                {[
                    { key: STATUS_ALL, label: 'All', count: counts.all },
                    { key: STATUS_FULL, label: 'Completed', count: counts.full },
                    { key: STATUS_UNPAID, label: 'Unpaid/Partial', count: counts.partial_unpaid },
                ].map(({ key, label, count }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className="px-3 py-1 rounded-full text-xs font-bold border"
                        style={{
                            backgroundColor: filter === key ? '#09090b' : '#ffffff',
                            color: filter === key ? '#ffffff' : '#52525b',
                            borderColor: filter === key ? '#09090b' : '#d6d3d1',
                            transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
                        }}
                    >
                        {label}
                        <span
                            className="ml-1 text-[11px] px-1.5 py-0.2 rounded-full"
                            style={{
                                backgroundColor: filter === key ? 'rgba(255,255,255,0.2)' : '#f5f5f4',
                                color: filter === key ? '#ffffff' : '#71717a',
                                transition: 'background-color 200ms ease, color 200ms ease',
                            }}
                        >
                            {count}
                        </span>
                    </button>
                ))}

                {/* PAYMENT FILTER */}
                <PaymentFilter transactions={transactions} value={paymentFilter} onChange={setPaymentFilter} />

                {/* BRANCH FILTER */}
                {isAdmin && (
                    <div className="flex items-center gap-1.5 bg-white border border-stone-300 px-2.5 py-1 rounded-lg shadow-sm text-xs">
                        <MapPin size={12} className="text-zinc-500" />
                        <span className="font-bold text-zinc-500 uppercase tracking-wider text-[10px]">Branch:</span>
                        <select
                            value={selectedBranchId || ''}
                            onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                            className="bg-transparent font-black text-xs text-zinc-800 focus:outline-none cursor-pointer"
                        >
                            <option value="">Consolidated (All)</option>
                            {branchList.filter(b => b.active !== false && !b.name?.toLowerCase().includes('warehouse')).map((b) => (
                                <option key={b.id} value={b.id}>
                                    🏬 {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {isBranch && (
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm">
                        <Store size={12} className="text-emerald-600" />
                        <span>{user?.branchName || 'Assigned Branch'}</span>
                    </div>
                )}

                {/* Spacer */}
                <div className="hidden xl:flex flex-1" />

                {/* TIME RANGE PRESETS */}
                <div className="flex bg-white border border-stone-200 rounded-lg p-0.5 shadow-sm">
                    {TIME_RANGES.map(range => (
                        <button
                            key={range.id}
                            onClick={() => handlePresetSelect(range.id)}
                            className="px-2.5 py-1 text-xs font-bold rounded-md"
                            style={{
                                backgroundColor: activePreset === range.id && !customRange ? '#09090b' : 'transparent',
                                color: activePreset === range.id && !customRange ? '#ffffff' : '#71717a',
                                boxShadow: activePreset === range.id && !customRange ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                transition: 'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
                            }}
                        >
                            {range.label}
                        </button>
                    ))}
                </div>

                {/* CALENDAR PICKER */}
                <div className="relative" ref={calendarRef}>
                    <button
                        onClick={() => setShowCalendar(v => !v)}
                        title="Select custom date range"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border shadow-sm text-xs font-bold"
                        style={{
                            backgroundColor: customRange ? '#09090b' : '#ffffff',
                            color: customRange ? '#ffffff' : '#71717a',
                            borderColor: customRange ? '#09090b' : '#d6d3d1',
                            transition: 'background-color 200ms ease, color 200ms ease, border-color 200ms ease',
                        }}
                    >
                        <Calendar size={14} />
                        {customRange && (
                            <span className="max-w-[140px] truncate">{customRange.label}</span>
                        )}
                    </button>

                    {customRange && (
                        <button
                            onClick={(e) => { e.stopPropagation(); clearCustomRange(); }}
                            className="absolute -top-1.5 -right-1.5 text-white rounded-full w-4 h-4 flex items-center justify-center"
                            title="Clear custom range"
                            style={{
                                backgroundColor: '#3f3f46',
                                transition: 'background-color 150ms ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3f3f46'}
                        >
                            <X size={10} />
                        </button>
                    )}

                    {/* Always rendered, animated via opacity/transform */}
                    <CalendarPicker
                        visible={showCalendar}
                        onApply={handleCalendarApply}
                        onClose={() => setShowCalendar(false)}
                    />
                </div>

                {/* REFRESH */}
                <button
                    onClick={fetchTransactions}
                    disabled={loading}
                    className="p-1.5 rounded-lg border border-stone-300 bg-white text-zinc-500 disabled:opacity-40 shadow-sm"
                    title="Refresh"
                    style={{ transition: 'background-color 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f4'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* ERROR BANNER */}
            {error && (
                <div
                    className="flex items-center gap-2 p-2.5 mb-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs shrink-0"
                    style={{ animation: 'fadeSlideIn 250ms ease' }}
                >
                    <AlertCircle size={15} /> {error}
                </div>
            )}

            {/* TABLE */}
            <div className="flex-1 min-h-0 overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm">
                <table className="w-full min-w-[850px] text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100 z-10 text-[11px] uppercase tracking-wider text-zinc-600 font-black border-b border-stone-200 shadow-sm">
                        <tr>
                            <th className="px-2 py-2.5 w-8"></th>
                            <th className="px-3 py-2.5">Order ID</th>
                            <th className="px-3 py-2.5">Customer</th>
                            <th className="px-3 py-2.5">Products</th>
                            <th className="px-3 py-2.5">Payment</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5 text-right">Downpayment</th>
                            <th className="px-3 py-2.5 text-right">Total Balance</th>
                            <th className="px-3 py-2.5">Date</th>
                            <th className="px-3 py-2.5 text-center">Action</th>
                        </tr>
                    </thead>

                    <tbody key={tableKey} className="divide-y divide-stone-100 text-xs">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 10 }).map((_, j) => (
                                        <td key={j} className="px-3 py-2">
                                            <div className="h-3.5 bg-stone-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : timelineItems.length === 0 ? (
                            <tr>
                                <td
                                    colSpan="10"
                                    className="px-5 py-16 text-center text-zinc-400"
                                    style={{ animation: 'fadeSlideIn 250ms ease' }}
                                >
                                    {isSearching
                                        ? <Search size={32} className="mx-auto mb-3 opacity-20" />
                                        : <History size={32} className="mx-auto mb-3 opacity-20" />
                                    }
                                    <p className="font-medium">
                                        {isSearching
                                            ? `No orders found matching "${searchQuery.trim()}".`
                                            : filter === STATUS_ALL
                                                ? `No orders found for ${periodLabel.toLowerCase()}.`
                                                : `No ${filter.toLowerCase()} orders for ${periodLabel.toLowerCase()}.`}
                                    </p>
                                    {!isSearching && activePreset === 'TODAY' && (
                                        <p className="text-xs mt-1 text-zinc-300">
                                            Use the time range tabs or calendar to view past orders.
                                        </p>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            timelineItems.map((item, rowIdx) => {
                                // ── LATE PAYMENT REFERENCE ROW ──────────────────────────────────
                                if (item.type === 'LATE_PAYMENT_REF') {
                                    const log = item.paymentLog;
                                    const group = item.data;
                                    const orderDateLabel = new Date(group.date).toLocaleDateString('en-PH', {
                                        month: 'short', day: 'numeric', year: 'numeric'
                                    });
                                    return (
                                        <tr
                                            key={`late-ref-${log.id}`}
                                            style={{
                                                animation: 'fadeSlideIn 220ms ease both',
                                                animationDelay: `${Math.min(rowIdx * 20, 250)}ms`,
                                                background: 'linear-gradient(90deg, #fffbeb 0%, #fefce8 100%)',
                                                borderLeft: '3px solid #f59e0b',
                                            }}
                                        >
                                            {/* indent + icon */}
                                            <td className="px-2 py-2 text-center">
                                                <span style={{ color: '#d97706', display: 'flex', justifyContent: 'center' }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="15 10 20 15 15 20"/>
                                                        <path d="M4 4v7a4 4 0 0 0 4 4h12"/>
                                                    </svg>
                                                </span>
                                            </td>
                                            {/* order id ref */}
                                            <td className="px-3 py-2">
                                                <span
                                                    className="font-mono text-xs font-black"
                                                    style={{ color: '#92400e' }}
                                                >
                                                    #{group.displayId}
                                                </span>
                                                <span
                                                    className="block text-[10px] font-bold mt-0.5"
                                                    style={{ color: '#b45309' }}
                                                >
                                                    late payment
                                                </span>
                                            </td>
                                            {/* customer */}
                                            <td className="px-3 py-2 text-xs font-medium" style={{ color: '#78350f' }}>
                                                {group.customerName}
                                            </td>
                                            {/* description */}
                                            <td className="px-3 py-2" colSpan={2}>
                                                <span
                                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded"
                                                    style={{ backgroundColor: '#fde68a', color: '#78350f' }}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M5 12h14M12 5l7 7-7 7"/>
                                                    </svg>
                                                    Order from {orderDateLabel}
                                                </span>
                                            </td>
                                            {/* status badge */}
                                            <td className="px-3 py-2">
                                                <span
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold"
                                                    style={{ backgroundColor: '#fde68a', color: '#78350f' }}
                                                >
                                                    <CreditCard size={10} /> {log.paymentMethod || 'Unknown'}
                                                </span>
                                            </td>
                                            {/* empty downpayment */}
                                            <td className="px-3 py-2 text-right font-mono text-xs" style={{ color: '#92400e' }}>—</td>
                                            {/* amount */}
                                            <td className="px-3 py-2 text-right font-mono">
                                                <span className="font-black text-xs" style={{ color: '#16a34a' }}>+{formatCurrency(log.amount)}</span>
                                            </td>
                                            {/* payment date */}
                                            <td className="px-3 py-2 text-xs font-medium" style={{ color: '#92400e' }}>
                                                <div>{formatDateTwoLines(log.paymentDate).date}</div>
                                                <div className="text-[10px] opacity-75">{formatDateTwoLines(log.paymentDate).time}</div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    onClick={() => scrollToOrder(group.orderId)}
                                                    title="Jump to the original order row"
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                                                    style={{
                                                        backgroundColor: '#fde68a',
                                                        color: '#78350f',
                                                        border: '1px solid #f59e0b',
                                                        transition: 'background-color 120ms ease',
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fcd34d'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#fde68a'}
                                                >
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="5" y1="12" x2="19" y2="12"/>
                                                        <polyline points="12 5 19 12 12 19"/>
                                                    </svg>
                                                    Go to Order
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                }

                                // PAYMENT rows are now rendered inline inside the ORDER Fragment below.

                                const group = item.data;
                                const isUnfinished = group.status === 'PARTIAL' || group.status === 'UNPAID';
                                // remaining is computed by taking totalPrice of ALL items in the order,
                                // minus the downpayment (if any), and minus the price of fully paid items.
                                const paidItemsValue = group.items.filter(i => i.status === 'FULL').reduce((sum, i) => sum + parseFloat(i.finalPrice || 0), 0);
                                const remaining = isUnfinished
                                    ? group.totalPrice - group.totalDownpayment - paidItemsValue
                                    : null;
                                const isExpanded = expanded.has(group.orderId);

                                return (
                                    <React.Fragment key={`order-${group.orderId}`}>
                                        <tr
                                            id={`order-row-${group.orderId}`}
                                            className={`order-row-anim ${isUnfinished ? 'bg-amber-50/10' : ''}`}
                                            style={{ transition: 'background-color 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fafaf9'}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = isUnfinished ? 'rgba(251,191,36,0.04)' : ''}
                                        >
                                            {/* Expand toggle */}
                                            <td className="px-2 py-2 text-center w-8">
                                                <button
                                                    onClick={() => toggleExpand(group.orderId)}
                                                    className="p-1 rounded bg-stone-100 text-zinc-500 hover:text-zinc-900 hover:bg-stone-200"
                                                    title="Toggle Item Details"
                                                    style={{ transition: 'background-color 150ms ease, color 150ms ease' }}
                                                >
                                                    <span style={{
                                                        display: 'block',
                                                        transition: 'transform 220ms ease',
                                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                    }}>
                                                        <ChevronDown size={14} />
                                                    </span>
                                                </button>
                                            </td>

                                            {/* Clickable Order ID — toggles payment log rows */}
                                            <td
                                                className="px-3 py-2"
                                                style={{ cursor: group.paymentLogs.length > 0 ? 'pointer' : 'default' }}
                                                onClick={() => group.paymentLogs.length > 0 && togglePayLogs(group.orderId)}
                                                title={group.paymentLogs.length > 0 ? 'Click to show/hide payment logs' : undefined}
                                            >
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-mono text-xs font-black text-zinc-800 bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                                                        #{group.displayId}
                                                    </span>
                                                    {group.paymentLogs.length > 0 && (
                                                        <span
                                                            className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                                            style={{
                                                                backgroundColor: payLogsExpanded.has(group.orderId) ? '#dcfce7' : '#f1f5f9',
                                                                color: payLogsExpanded.has(group.orderId) ? '#15803d' : '#475569',
                                                                border: `1px solid ${payLogsExpanded.has(group.orderId) ? '#86efac' : '#cbd5e1'}`,
                                                                transition: 'background-color 150ms ease, color 150ms ease',
                                                            }}
                                                        >
                                                            <CreditCard size={9} />
                                                            {group.paymentLogs.length}
                                                        </span>
                                                    )}
                                                </div>
                                                {group.branchName && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-600 bg-stone-50 border border-stone-200/80 px-1.5 py-0.5 rounded mt-1 max-w-[150px] truncate" title={group.branchName}>
                                                        🏬 {group.branchName}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-zinc-800">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-xs text-zinc-900">{group.customerName || 'Walk-in Customer'}</span>
                                                        {group.transactionType === 'CONSIGNMENT' && (
                                                            <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
                                                                CONSIGNMENT
                                                            </span>
                                                        )}
                                                    </div>
                                                    {group.paymentDetails && (
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); setNoteModal(group.paymentDetails); }}
                                                            className="text-[10px] text-blue-600 font-semibold flex items-center gap-1 cursor-pointer hover:underline max-w-[170px] truncate mt-0.5"
                                                            title={`Note: ${group.paymentDetails}`}
                                                        >
                                                            <MessageSquare size={10} className="shrink-0" />
                                                            <span className="truncate">{group.paymentDetails}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-zinc-700">
                                                {group.items.length === 1 ? (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-xs text-zinc-900">
                                                            {group.items[0]?.variant?.product
                                                                ? `${group.items[0].variant.product.brandName} ${group.items[0].variant.product.modelName}`
                                                                : '1 Item'}
                                                        </span>
                                                        {group.items[0]?.variant?.color && group.items[0]?.variant?.color !== 'N/A' && (
                                                            <span className="text-[10px] font-semibold text-zinc-600 bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded">
                                                                {group.items[0].variant.color}
                                                            </span>
                                                        )}
                                                        {group.items[0]?.variant?.sku && (
                                                            <span className="text-[10px] font-mono text-zinc-400">
                                                                ({group.items[0].variant.sku})
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-1 max-w-[340px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center gap-1 font-black text-blue-700 bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                                                <Package size={11} /> {group.items.length} items
                                                            </span>
                                                            <span className="font-bold text-xs text-zinc-900 truncate">
                                                                {group.items[0]?.variant?.product
                                                                    ? `${group.items[0].variant.product.brandName} ${group.items[0].variant.product.modelName}${group.items[0].variant?.color && group.items[0].variant?.color !== 'N/A' ? ` (${group.items[0].variant.color})` : ''}`
                                                                    : 'Item 1'}
                                                            </span>
                                                        </div>
                                                        {/* List other items */}
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {group.items.slice(1, 4).map((it, idx) => {
                                                                const itName = it.variant?.product
                                                                    ? `${it.variant.product.modelName || it.variant.product.brandName}${it.variant?.color && it.variant?.color !== 'N/A' ? ` (${it.variant.color})` : ''}`
                                                                    : `Item #${it.id}`;
                                                                return (
                                                                    <span
                                                                        key={idx}
                                                                        className="inline-flex items-center text-[10px] font-medium text-stone-600 bg-stone-100 border border-stone-200/70 px-1.5 py-0.2 rounded truncate max-w-[150px]"
                                                                        title={itName}
                                                                    >
                                                                        + {itName}
                                                                    </span>
                                                                );
                                                            })}
                                                            {group.items.length > 4 && (
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50/80 border border-blue-200/60 px-1.5 py-0.2 rounded">
                                                                    +{group.items.length - 4} more
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex flex-col gap-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="flex items-center gap-1 text-zinc-700 cursor-pointer hover:text-zinc-950 group"
                                                            onClick={(e) => { e.stopPropagation(); setEditingPayment(editingPayment === group.orderId ? null : group.orderId); }}
                                                            title="Click to change payment method"
                                                        >
                                                            <CreditCard size={12} className="text-zinc-500" />
                                                            <span className="font-bold text-xs">{group.paymentMethod}</span>
                                                            <Pen size={10} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                                                        </span>
                                                    </div>
                                                    {group.paymentLogs.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                                                            {group.paymentLogs.slice(0, 2).map((pl, pIdx) => (
                                                                <span key={pIdx} className="text-[10px] font-mono font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                                                                    {pl.paymentMethod || 'Pay'}: {formatCurrency(pl.amount)}
                                                                </span>
                                                            ))}
                                                            {group.paymentLogs.length > 2 && (
                                                                <span className="text-[10px] font-bold text-emerald-700">+{group.paymentLogs.length - 2}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {isUnfinished ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                        <Clock size={10} /> {group.status === 'UNPAID' ? 'Pending' : 'Partial'}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        <CheckCircle2 size={10} /> Completed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-zinc-600">
                                                {group.totalDownpayment > 0 ? (
                                                    <span className="font-semibold text-zinc-700">{formatCurrency(group.totalDownpayment)}</span>
                                                ) : (
                                                    <span className="text-zinc-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-mono text-zinc-800">
                                                <span className="font-black text-xs text-zinc-900">{formatCurrency(group.totalPrice)}</span>
                                                {isUnfinished && remaining > 0 && (
                                                    <span className="block text-[10px] text-amber-600 font-black">
                                                        {formatCurrency(remaining)} due
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                <div className="font-bold text-zinc-700 leading-tight">
                                                    {formatDateTwoLines(group.date).date}
                                                </div>
                                                <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                                                    {formatDateTwoLines(group.date).time}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                                    {isUnfinished && group.items.length === 1 && (
                                                        <button
                                                            onClick={() => handleCompleteItem(group.items[0])}
                                                            disabled={completing === group.items[0].id}
                                                            className="flex items-center gap-1 px-2 py-1 text-white text-[11px] font-bold rounded-lg disabled:opacity-50 shadow-sm"
                                                            style={{ backgroundColor: '#16a34a', transition: 'background-color 150ms ease' }}
                                                            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#15803d'}
                                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                                                            title="Pay Balance"
                                                        >
                                                            {completing === group.items[0].id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                            Pay
                                                        </button>
                                                    )}
                                                    {isUnfinished && group.items.length > 1 && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleCompleteGroup(group)}
                                                                disabled={completing === group.orderId}
                                                                className="flex items-center justify-center gap-1 px-2 py-1 text-white text-[11px] font-bold rounded-lg disabled:opacity-50 shadow-sm"
                                                                style={{ backgroundColor: '#16a34a', transition: 'background-color 150ms ease' }}
                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#15803d'}
                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                                                                title="All Paid"
                                                            >
                                                                {completing === group.orderId
                                                                    ? <Loader2 size={11} className="animate-spin" />
                                                                    : <CheckCircle2 size={11} />}
                                                                All Paid
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setPayingBalanceGroup(group);
                                                                    const remaining = group.items.reduce((sum, item) => sum + (item.finalPrice - (item.downpayment || 0)), 0);
                                                                    setPaymentAmountInput(remaining.toString());
                                                                }}
                                                                disabled={completing === group.orderId}
                                                                className="px-2 py-1 text-blue-600 text-[10px] font-bold rounded-md hover:bg-blue-50 border border-blue-200 transition-colors"
                                                            >
                                                                Pay Amt
                                                            </button>
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleCancelOrder(group)}
                                                        disabled={cancelling === group.orderId}
                                                        className="flex items-center gap-1 px-2 py-1 text-white text-[11px] font-bold rounded-lg disabled:opacity-50 shadow-sm transition-colors"
                                                        style={{
                                                            backgroundColor: '#dc2626',
                                                            transition: 'background-color 150ms ease',
                                                        }}
                                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b91c1c'}
                                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc2626'}
                                                        title="Delete Order"
                                                    >
                                                        {cancelling === group.orderId
                                                            ? <Loader2 size={11} className="animate-spin" />
                                                            : <XCircle size={11} />}
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded sub-rows and Payment Logs */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="10" className="p-0">
                                                    <div
                                                        className="bg-stone-50 border-t border-stone-200"
                                                        style={{
                                                            animation: 'fadeSlideIn 180ms ease',
                                                        }}
                                                    >
                                                        <div className="py-3 px-8 ml-8 border-l-2 border-blue-400 my-2">
                                                            {group.paymentDetails && (
                                                                <div className="mb-3 p-3 bg-blue-50/80 border border-blue-200/70 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
                                                                    <MessageSquare size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                                                    <div className="min-w-0">
                                                                        <span className="font-black uppercase tracking-wider text-[10px] text-blue-700 block mb-0.5">
                                                                            Purchase Note / Remarks
                                                                        </span>
                                                                        <span className="font-medium whitespace-pre-wrap leading-relaxed">{group.paymentDetails}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            <table className="w-full text-xs">
                                                                <tbody>
                                                                    {group.items.map((item, idx) => {
                                                                        const isItemUnfinished = item.status === 'PARTIAL' || item.status === 'UNPAID';
                                                                        return (
                                                                            <tr
                                                                                key={idx}
                                                                                className="border-b border-stone-200/50 last:border-0"
                                                                                style={{ transition: 'background-color 150ms ease' }}
                                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f5f5f4'}
                                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                                                            >
                                                                                <td className="py-2 text-zinc-500 font-mono w-24">{item.variant?.sku}</td>
                                                                                <td className="py-2 font-bold text-zinc-800">
                                                                                    {item.variant?.product
                                                                                        ? `${item.variant.product.brandName} ${item.variant.product.modelName} ${item.variant?.color ? `(${item.variant.color})` : ''}`
                                                                                        : '—'}
                                                                                </td>
                                                                                <td className="py-2 font-mono text-xs text-center w-20">
                                                                                    {item.status === 'FULL' ? (
                                                                                        <span className="text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded">PAID</span>
                                                                                    ) : (
                                                                                        <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">{item.status}</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="py-2 text-right font-mono text-zinc-600 w-24">{formatCurrency(item.finalPrice)}</td>
                                                                                <td className="py-2 text-right w-20 pl-4">
                                                                                    {isItemUnfinished && (
                                                                                        <button
                                                                                            onClick={() => handleCompleteItem(item)}
                                                                                            disabled={completing === item.id}
                                                                                            className="w-full px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-stone-300 text-white text-[10px] uppercase tracking-wider font-bold rounded shadow-sm transition-colors flex justify-center items-center gap-1"
                                                                                        >
                                                                                            {completing === item.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                                                                            Pay
                                                                                        </button>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        )
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>

                                                        {/* Payment Logs */}
                                                        {group.paymentLogs && group.paymentLogs.length > 0 && (
                                                            <div className="py-3 px-8 ml-8 border-l-2 border-green-400 my-2">
                                                                <h4 className="text-[10px] font-bold text-zinc-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                                                                    <CreditCard size={12} /> Payment Track
                                                                </h4>
                                                                <table className="w-full text-xs">
                                                                    <tbody>
                                                                        {group.paymentLogs.map((log, idx) => (
                                                                            <tr
                                                                                key={`log-${idx}`}
                                                                                className="border-b border-stone-200/50 last:border-0"
                                                                                style={{ transition: 'background-color 150ms ease' }}
                                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                                                                            >
                                                                                <td className="py-1.5 text-zinc-500 w-48">{formatDate(log.paymentDate)}</td>
                                                                                <td className="py-1.5 font-bold text-zinc-700">
                                                                                    {log.paymentMethod || 'Unknown'}
                                                                                </td>
                                                                                <td className="py-1.5 text-right font-mono text-green-700 font-bold">
                                                                                    {formatCurrency(log.amount)}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}

                                        {/* ── Inline PAYMENT rows (no sort/filter overhead) ── */}
                                        {payLogsExpanded.has(group.orderId) && group.paymentLogs.map(log => {
                                            const orderDate = new Date(group.date);
                                            const payDate = new Date(log.paymentDate);
                                            const isLatePayment = (payDate.getTime() - orderDate.getTime()) > 30_000;
                                            const orderDateLabel = orderDate.toLocaleDateString('en-PH', {
                                                month: 'short', day: 'numeric', year: 'numeric'
                                            });
                                            return (
                                                <tr
                                                    key={`pay-${log.id}`}
                                                    className="bg-green-50/20"
                                                    style={{ transition: 'background-color 150ms ease', animation: 'fadeSlideIn 180ms ease both' }}
                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'}
                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(240,253,244,0.3)'}
                                                >
                                                    <td className="px-2 py-2" />
                                                    <td className="px-3 py-2 font-mono text-xs font-bold text-zinc-500">
                                                        PAY-#{group.displayId}
                                                    </td>
                                                    <td className="px-3 py-2 font-medium text-zinc-800">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-xs">{group.customerName}</span>
                                                            {group.transactionType === 'CONSIGNMENT' && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">CONSIGNMENT</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-green-700 font-bold text-xs">Payment towards Order</span>
                                                            {isLatePayment && (
                                                                <span
                                                                    className="inline-flex items-center gap-1 self-start px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wide"
                                                                    title={`Original order placed on ${orderDateLabel}`}
                                                                    style={{ backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
                                                                >
                                                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                                                    Order from {orderDateLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="inline-flex items-center gap-1 font-bold text-xs text-zinc-700 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                                                            <CreditCard size={12} className="text-zinc-500" /> {log.paymentMethod || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold bg-green-100 text-green-700 border border-green-200">Payment Recv</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-zinc-400">—</td>
                                                    <td className="px-3 py-2 text-right font-mono">
                                                        <span className="font-black text-xs text-green-600">+{formatCurrency(log.amount)}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-zinc-500">
                                                        <div className="font-bold text-zinc-700 leading-tight">
                                                            {formatDateTwoLines(log.paymentDate).date}
                                                        </div>
                                                        <div className="text-[10px] text-zinc-400 font-semibold mt-0.5">
                                                            {formatDateTwoLines(log.paymentDate).time}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2" />
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Note Modal */}
            {noteModal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setNoteModal(null)}>
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full border border-stone-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-4 border-b border-stone-100 pb-3">
                            <MessageSquare size={18} className="text-blue-500" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-700">Order Note</h3>
                        </div>
                        <p className="text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap font-medium">{noteModal}</p>
                        <button onClick={() => setNoteModal(null)} className="mt-6 w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-zinc-700 font-bold rounded-lg transition-colors text-sm">
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Edit Payment Modal */}
            {editingPayment && (() => {
                const orderItem = timelineItems.find(i => i.type === 'ORDER' && i.data.orderId === editingPayment);
                const group = orderItem ? orderItem.data : null;
                return group ? (
                    <EditPaymentModal
                        group={group}
                        methods={paymentMethods}
                        onSave={(newMethod, updateLogs) => handleUpdatePayment(group, newMethod, updateLogs)}
                        onClose={() => setEditingPayment(null)}
                    />
                ) : null;
            })()}

            {/* ===== PARTIAL PAYMENT MODAL ===== */}
            {payingBalanceGroup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" style={{ animation: 'fadeSlideIn 150ms ease' }}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col">
                        <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <CreditCard size={18} className="text-blue-500" /> Pay Amount
                            </h3>
                            <button onClick={() => setPayingBalanceGroup(null)} className="p-1 hover:bg-stone-200 rounded-full text-stone-400 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handlePayPartialSubmit} className="p-5 flex flex-col gap-4">
                            <div className="text-xs text-stone-500">
                                Order #{payingBalanceGroup.displayId} · Remaining: <span className="font-bold text-stone-800">
                                    {formatCurrency(payingBalanceGroup.items.reduce((s, i) => s + (i.finalPrice - (i.downpayment || 0)), 0))}
                                </span>
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold">₱</span>
                                <input
                                    type="number" step="0.01" min="0.01" required autoFocus
                                    value={paymentAmountInput}
                                    onChange={e => setPaymentAmountInput(e.target.value)}
                                    className="w-full pl-8 pr-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-lg text-stone-800"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
                                <button type="button" onClick={() => setPayingBalanceGroup(null)} className="flex-1 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm">Submit</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== PASSWORD PROMPT MODAL ===== */}
            {pendingAuthAction && (
                <PasswordModal
                    title={`Authenticate to ${pendingAuthAction.type.toLowerCase()}`}
                    onConfirm={handleAuthConfirm}
                    onCancel={() => setPendingAuthAction(null)}
                />
            )}
        </div>
    );
};

export default OrderHistory;