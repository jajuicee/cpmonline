import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Building2, Plus, Pencil, Trash2, X, Save, CheckCircle, AlertCircle, Phone, Mail, MapPin,
    FileText, Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown,
    Users, Coins, HandCoins, Crown, Package, BarChart3
} from 'lucide-react';
import SupplierDetail from './SupplierDetail';

const API = `/api/suppliers`;

const getStartOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const getEndOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

const formatRelativeDate = (s) => {
    if (!s) return 'Never';
    const d = new Date(s);
    const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Suppliers = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    // Date Range
    const [startDate, setStartDate] = useState(getStartOfMonth(new Date()));
    const [endDate, setEndDate] = useState(getEndOfMonth(new Date()));
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Modals + detail panel
    const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', id? }
    const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', notes: '' });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [selected, setSelected] = useState(null); // supplier row currently shown in slide-over

    const fetchAll = async () => {
        try {
            const fmt = (d) => {
                const pad = (n) => n.toString().padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            };
            const s = fmt(startDate);
            const e = fmt(endDate);
            const [listRes, statsRes] = await Promise.all([
                axios.get(`${API}/with-stats?start=${s}&end=${e}`),
                axios.get(`${API}/stats?start=${s}&end=${e}`),
            ]);
            setSuppliers(listRes.data);
            setStats(statsRes.data);
            // Keep selected in sync with refreshed row
            if (selected) {
                const fresh = listRes.data.find(x => x.id === selected.id);
                if (fresh) setSelected(fresh);
            }
        } catch (err) {
            console.error('Failed to load suppliers', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchAll();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startDate, endDate]);

    // Calendar helpers
    const isSameDay = (a, b) => a && b && a.toDateString() === b.toDateString();
    const isInRange = (date, start, end) => {
        if (!start || !end) return false;
        const t = date.getTime();
        const s = Math.min(start.getTime(), end.getTime());
        const e = Math.max(start.getTime(), end.getTime());
        return t >= s && t <= e;
    };

    const CalendarPicker = ({ onApply, onClose }) => {
        const [viewYear, setViewYear] = useState(startDate.getFullYear());
        const [viewMonth, setViewMonth] = useState(startDate.getMonth());
        const [localStart, setLocalStart] = useState(startDate);
        const [localEnd, setLocalEnd] = useState(endDate);
        const [hoverDate, setHoverDate] = useState(null);

        const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

        const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
        const getFirstDayOfMonth = (y, m) => new Date(y, m, 1).getDay();

        const handleDayClick = (day) => {
            const clicked = new Date(viewYear, viewMonth, day);
            if (!localStart || (localStart && localEnd)) {
                setLocalStart(clicked); setLocalEnd(null);
            } else if (clicked < localStart) {
                setLocalEnd(localStart); setLocalStart(clicked);
            } else {
                setLocalEnd(clicked);
            }
        };

        const days = Array.from({ length: getDaysInMonth(viewYear, viewMonth) }, (_, i) => i + 1);
        const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

        return (
            <div className="absolute right-0 top-12 z-50 bg-white border border-stone-200 rounded-2xl shadow-2xl p-5 w-80 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => { if (viewMonth === 0) { setViewYear(v => v - 1); setViewMonth(11); } else setViewMonth(v => v - 1); }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500"><ChevronLeft size={16} /></button>
                    <span className="text-sm font-bold text-zinc-800">{MONTHS[viewMonth]} {viewYear}</span>
                    <button onClick={() => { if (viewMonth === 11) { setViewYear(v => v + 1); setViewMonth(0); } else setViewMonth(v => v + 1); }}
                        className="p-1.5 rounded-lg hover:bg-stone-100 text-zinc-500"><ChevronRight size={16} /></button>
                </div>
                <div className="grid grid-cols-7 mb-1 text-center text-xs font-bold text-zinc-400">
                    {DAYS.map(d => <div key={d} className="py-1">{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                    {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                    {days.map(d => {
                        const date = new Date(viewYear, viewMonth, d);
                        const isStart = isSameDay(date, localStart);
                        const isEnd = isSameDay(date, localEnd);
                        const inRange = isInRange(date, localStart, localEnd || hoverDate);
                        return (
                            <button key={d} onClick={() => handleDayClick(d)}
                                onMouseEnter={() => setHoverDate(date)} onMouseLeave={() => setHoverDate(null)}
                                className={`text-xs font-medium py-2 rounded-lg transition-all
                                    ${isStart || isEnd ? 'bg-zinc-950 text-white font-bold' : ''}
                                    ${inRange && !isStart && !isEnd ? 'bg-zinc-100 text-zinc-700 rounded-none' : ''}
                                    ${!isStart && !isEnd && !inRange ? 'hover:bg-stone-100 text-zinc-700' : ''}`}>
                                {d}
                            </button>
                        );
                    })}
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-stone-100">
                    <button onClick={onClose} className="flex-1 px-3 py-2 text-xs font-bold text-zinc-500 hover:bg-stone-50 rounded-xl">Cancel</button>
                    <button onClick={() => onApply(localStart, localEnd)} disabled={!localStart || !localEnd}
                        className="flex-1 px-3 py-2 text-xs font-bold bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50">Apply</button>
                </div>
            </div>
        );
    };

    const openAdd = () => {
        setForm({ name: '', phone: '', email: '', address: '', notes: '' });
        setStatus({ type: '', message: '' });
        setModal({ mode: 'add' });
    };

    const openEdit = (s) => {
        setForm({
            name: s.name || '',
            phone: s.phone || s.contactInfo || '',
            email: s.email || '',
            address: s.address || '',
            notes: s.notes || '',
        });
        setStatus({ type: '', message: '' });
        setModal({ mode: 'edit', id: s.id });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });
        try {
            const payload = { ...form };
            if (modal.mode === 'add') {
                await axios.post(API, payload);
                setStatus({ type: 'success', message: 'Supplier added!' });
            } else {
                await axios.put(`${API}/${modal.id}`, payload);
                setStatus({ type: 'success', message: 'Supplier updated!' });
            }
            await fetchAll();
            setTimeout(() => setModal(null), 1000);
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to save.' });
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API}/${id}`);
            setDeleteConfirm(null);
            if (selected?.id === id) setSelected(null);
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete supplier.');
        }
    };

    return (
        <div className="flex flex-col h-full bg-stone-50/50 p-6 lg:p-8 overflow-auto">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm border border-stone-200">
                            <Building2 className="text-zinc-600" size={24} />
                        </div>
                        Suppliers
                    </h2>
                    <p className="text-sm text-zinc-500 mt-1 font-medium ml-12">
                        Manage suppliers, contacts, purchase history, and consignment.
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative">
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 text-zinc-700 rounded-xl text-sm font-bold hover:border-zinc-300 hover:bg-stone-50 transition-all shadow-sm group"
                        >
                            <CalendarIcon size={16} className="text-zinc-400 group-hover:text-zinc-600" />
                            <span className="min-w-[140px] text-left">
                                {startDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} – {endDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                            </span>
                            <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${showDatePicker ? 'rotate-180' : ''}`} />
                        </button>
                        {showDatePicker && (
                            <CalendarPicker
                                onClose={() => setShowDatePicker(false)}
                                onApply={(s, e) => { setStartDate(s); setEndDate(e); setShowDatePicker(false); }}
                            />
                        )}
                    </div>
                    <button onClick={openAdd}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10 active:scale-95">
                        <Plus size={18} /> Add Supplier
                    </button>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
                <StatCard
                    Icon={Users}
                    label="Total Suppliers"
                    primary={stats?.totalSuppliers ?? '—'}
                    secondary={`${stats?.activeSuppliers ?? 0} active in range`}
                    loading={loading}
                />
                <StatCard
                    Icon={Coins}
                    label="Spend (Owned)"
                    primary={loading ? '—' : formatPHP(stats?.ownedSpend)}
                    secondary="paid upfront"
                    accent="emerald"
                    loading={loading}
                />
                <StatCard
                    Icon={HandCoins}
                    label="Consigned Owed"
                    primary={loading ? '—' : formatPHP(stats?.consignedOwed)}
                    secondary="payable on sale"
                    accent="indigo"
                    loading={loading}
                />
                <StatCard
                    Icon={Crown}
                    label="Top Supplier"
                    primary={stats?.topSupplierName || '—'}
                    secondary={stats?.topSupplierName ? formatPHP(stats.topSupplierTotal) : 'no purchases in range'}
                    accent="amber"
                    loading={loading}
                    truncate
                />
            </div>

            {/* TABLE */}
            <div className="flex-1 overflow-auto bg-white border border-stone-200/60 rounded-2xl shadow-xl shadow-stone-200/50 min-h-[400px]">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-50/80 backdrop-blur-md z-10 text-[10px] uppercase tracking-[0.15em] text-zinc-400 font-black border-b border-stone-200">
                        <tr>
                            <th className="px-6 py-5 whitespace-nowrap">Supplier</th>
                            <th className="px-4 py-5 whitespace-nowrap">Contact</th>
                            <th className="px-4 py-5 whitespace-nowrap text-center">Purchases</th>
                            <th className="px-4 py-5 whitespace-nowrap text-right">Spend in Range</th>
                            <th className="px-4 py-5 whitespace-nowrap text-center bg-indigo-50/30 text-indigo-600">Consigned Sold</th>
                            <th className="px-4 py-5 whitespace-nowrap">Last Purchase</th>
                            <th className="px-4 py-5 text-right whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100/80 text-sm">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {[0, 1, 2, 3, 4, 5, 6].map(j => (
                                        <td key={j} className="px-4 py-6">
                                            <div className="h-4 bg-stone-100 rounded-full w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : suppliers.length > 0 ? suppliers.map(s => {
                            const totalSpend = (Number(s.ownedSpend) || 0) + (Number(s.consignedOwed) || 0);
                            return (
                                <tr key={s.id}
                                    onClick={() => setSelected(s)}
                                    className="hover:bg-stone-50/70 cursor-pointer transition-colors group">
                                    <td className="px-6 py-5 font-bold text-zinc-900">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-100 to-stone-100 text-zinc-600 flex items-center justify-center font-black text-sm border border-stone-200/50 shadow-sm transition-transform group-hover:scale-110">
                                                {s.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-zinc-900 leading-none mb-1">{s.name}</span>
                                                <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Registered Supplier</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-zinc-600 max-w-[180px]">
                                        <div className="flex flex-col gap-1">
                                            <span className="flex items-center gap-1.5 text-xs">
                                                <Phone size={11} className="text-zinc-300 shrink-0" />
                                                <span className={s.phone || s.contactInfo ? 'font-semibold truncate' : 'text-zinc-300 italic'}>
                                                    {s.phone || s.contactInfo || 'No phone'}
                                                </span>
                                            </span>
                                            {s.email && (
                                                <span className="flex items-center gap-1.5 text-xs">
                                                    <Mail size={11} className="text-zinc-300 shrink-0" />
                                                    <span className="font-semibold truncate">{s.email}</span>
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-center">
                                        <div className="inline-flex flex-col items-center">
                                            <span className="text-lg font-black text-zinc-800">{s.totalBatches || 0}</span>
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase">
                                                {s.totalUnits || 0} units
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-emerald-600 whitespace-nowrap text-sm">
                                                {formatPHP(totalSpend)}
                                            </span>
                                            {Number(s.consignedOwed) > 0 && (
                                                <span className="text-[10px] font-bold text-indigo-400">
                                                    incl. {formatPHP(s.consignedOwed)} consigned
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 text-center bg-indigo-50/10">
                                        <span className={`text-lg font-black ${s.consignedSold > 0 ? 'text-indigo-600' : 'text-zinc-300'}`}>
                                            {s.consignedSold || 0}
                                        </span>
                                    </td>
                                    <td className="px-4 py-5">
                                        <span className={`text-xs font-bold ${s.lastPurchaseAt ? 'text-zinc-600' : 'text-zinc-300 italic'}`}>
                                            {formatRelativeDate(s.lastPurchaseAt)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-5 text-right">
                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/analytics?tab=supplier&supplierId=${s.id}`);
                                            }}
                                                className="p-2 rounded-xl hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 transition-colors" title="View Supplier Performance Analytics">
                                                <BarChart3 size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                                className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 transition-colors" title="Edit">
                                                <Pencil size={16} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id); }}
                                                className="p-2 rounded-xl hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="7" className="px-6 py-16 text-center text-zinc-400">
                                    <Building2 size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">No suppliers yet</p>
                                    <p className="text-sm mt-1">Add your first supplier to start tracking stock origin.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* SLIDE-OVER DETAIL */}
            {selected && (
                <SupplierDetail
                    supplier={selected}
                    startDate={startDate}
                    endDate={endDate}
                    onClose={() => setSelected(null)}
                    onEdit={(s) => openEdit(s)}
                />
            )}

            {/* ADD / EDIT MODAL */}
            {modal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                                <Building2 size={18} />
                                {modal.mode === 'add' ? 'Add Supplier' : 'Edit Supplier'}
                            </h3>
                            <button onClick={() => setModal(null)} className="text-zinc-400 hover:text-red-500"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {status.message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${status.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                    {status.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    <span className="font-medium">{status.message}</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-bold text-zinc-700 mb-1">Supplier Name *</label>
                                <input required type="text" value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
                                    placeholder="e.g., JOOLA Philippines" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className=" text-sm font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                                        <Phone size={12} /> Phone
                                    </label>
                                    <input type="text" value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
                                        placeholder="0917 123 4567" />
                                </div>
                                <div>
                                    <label className=" text-sm font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                                        <Mail size={12} /> Email
                                    </label>
                                    <input type="email" value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
                                        placeholder="contact@supplier.com" />
                                </div>
                            </div>
                            <div>
                                <label className=" text-sm font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                                    <MapPin size={12} /> Address
                                </label>
                                <input type="text" value={form.address}
                                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none"
                                    placeholder="Street, City, Country" />
                            </div>
                            <div>
                                <label className=" text-sm font-bold text-zinc-700 mb-1 flex items-center gap-1.5">
                                    <FileText size={12} /> Notes
                                </label>
                                <textarea value={form.notes}
                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-zinc-900 outline-none resize-none"
                                    placeholder="Payment terms, delivery schedule, etc." />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setModal(null)}
                                    className="flex-1 px-4 py-2 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50">Cancel</button>
                                <button type="submit"
                                    className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-700">
                                    <Save size={16} /> Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRM */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-600" />
                        </div>
                        <h3 className="font-bold text-zinc-900 text-lg mb-1">Delete Supplier?</h3>
                        <p className="text-sm text-zinc-500 mb-5">Suppliers referenced by stock batches or transactions cannot be deleted.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50">Cancel</button>
                            <button onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* -------- Stat card subcomponent -------- */
const StatCard = (props) => {
    const { label, primary, secondary, accent = 'zinc', loading, truncate } = props;
    const Icon = props.Icon;
    const accentMap = {
        zinc:    { ring: 'border-stone-200',  text: 'text-zinc-900',   ic: 'text-zinc-400',   bg: 'bg-stone-100' },
        emerald: { ring: 'border-emerald-100', text: 'text-emerald-700', ic: 'text-emerald-500', bg: 'bg-emerald-50' },
        indigo:  { ring: 'border-indigo-100',  text: 'text-indigo-700',  ic: 'text-indigo-500',  bg: 'bg-indigo-50' },
        amber:   { ring: 'border-amber-100',   text: 'text-amber-700',   ic: 'text-amber-500',   bg: 'bg-amber-50' },
    };
    const c = accentMap[accent] || accentMap.zinc;
    return (
        <div className={`bg-white border ${c.ring} rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400">{label}</span>
                <div className={`p-2 rounded-lg ${c.bg}`}>
                    <Icon size={14} className={c.ic} />
                </div>
            </div>
            {loading ? (
                <div className="h-7 bg-stone-100 rounded animate-pulse w-2/3" />
            ) : (
                <div className={`text-2xl font-black tracking-tight ${c.text} ${truncate ? 'truncate' : ''}`}>{primary}</div>
            )}
            <p className="text-[11px] font-bold text-zinc-400 mt-1">{secondary}</p>
        </div>
    );
};

export default Suppliers;
