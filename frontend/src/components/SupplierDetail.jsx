import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    X, Phone, Mail, MapPin, FileText, Building2, Package, Coins,
    TrendingUp, CalendarClock, Pencil, Loader2, ShoppingBag, BarChart3
} from 'lucide-react';

const API = `/api/suppliers`;

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

const formatDate = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (s) => {
    if (!s) return '—';
    const d = new Date(s);
    return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const StatusBadge = ({ status }) => {
    const map = {
        RECEIVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        INCOMING: 'bg-amber-50 text-amber-700 border-amber-200',
        PENDING:  'bg-zinc-100 text-zinc-600 border-zinc-200',
    };
    return (
        <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${map[status] || map.PENDING}`}>
            {status || 'PENDING'}
        </span>
    );
};

const StatCard = (props) => {
    const { label, value, accent = 'zinc' } = props;
    const Icon = props.Icon;
    const accentMap = {
        zinc:    'text-zinc-900',
        emerald: 'text-emerald-600',
        amber:   'text-amber-600',
        indigo:  'text-indigo-600',
    };
    return (
        <div className="bg-stone-50/70 border border-stone-200/70 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                <Icon size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
            </div>
            <div className={`text-xl font-black tracking-tight ${accentMap[accent]}`}>{value}</div>
        </div>
    );
};

const SupplierDetail = ({ supplier, startDate, endDate, onClose, onEdit }) => {
    const navigate = useNavigate();
    const [purchases, setPurchases] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!supplier) return;
        setLoading(true);
        const fmt = (d) => {
            const pad = (n) => n.toString().padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
        };
        const s = fmt(startDate);
        const e = fmt(endDate);
        axios.get(`${API}/${supplier.id}/purchases?start=${s}&end=${e}`)
            .then(r => setPurchases(Array.isArray(r.data) ? r.data : []))
            .catch(err => {
                console.error('Failed to load purchases', err);
                setPurchases([]);
            })
            .finally(() => setLoading(false));
    }, [supplier, startDate, endDate]);

    if (!supplier) return null;

    const totalSpend = (Number(supplier.ownedSpend) || 0) + (Number(supplier.consignedOwed) || 0);

    return (
        <div className="fixed inset-0 z-40">
            {/* backdrop */}
            <div
                className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            {/* slide-over panel */}
            <aside className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                {/* Header */}
                <div className="px-8 py-6 border-b border-stone-200 bg-gradient-to-br from-stone-50 to-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-900 to-zinc-700 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-zinc-900/20 shrink-0">
                                {supplier.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-2xl font-black text-zinc-900 tracking-tight truncate">{supplier.name}</h2>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 mt-1">Registered Supplier</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate(`/analytics?tab=supplier&supplierId=${supplier.id}`);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs"
                                title="Open full supplier performance analytics dossier"
                            >
                                <BarChart3 size={14} /> Analytics
                            </button>
                            <button
                                onClick={() => onEdit(supplier)}
                                className="flex items-center gap-2 px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs font-bold text-zinc-700 hover:bg-stone-50 transition-all cursor-pointer"
                            >
                                <Pencil size={14} /> Edit
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Contact row */}
                    <div className="grid grid-cols-3 gap-3 mt-6">
                        <div className="flex items-center gap-2 text-sm">
                            <Phone size={14} className="text-zinc-400 shrink-0" />
                            <span className={supplier.phone ? 'text-zinc-700 font-semibold truncate' : 'text-zinc-300 italic'}>
                                {supplier.phone || supplier.contactInfo || 'No phone'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Mail size={14} className="text-zinc-400 shrink-0" />
                            <span className={supplier.email ? 'text-zinc-700 font-semibold truncate' : 'text-zinc-300 italic'}>
                                {supplier.email || 'No email'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <MapPin size={14} className="text-zinc-400 shrink-0" />
                            <span className={supplier.address ? 'text-zinc-700 font-semibold truncate' : 'text-zinc-300 italic'}>
                                {supplier.address || 'No address'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
                    {/* Stat cards */}
                    <div className="grid grid-cols-4 gap-3">
                        <StatCard Icon={Package} label="Batches" value={supplier.totalBatches ?? 0} />
                        <StatCard Icon={ShoppingBag} label="Units Bought" value={supplier.totalUnits ?? 0} />
                        <StatCard Icon={Coins} label="Total Spend" value={formatPHP(totalSpend)} accent="emerald" />
                        <StatCard Icon={CalendarClock} label="Last Purchase" value={formatDate(supplier.lastPurchaseAt)} accent="indigo" />
                    </div>

                    {/* Consignment + Notes */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-1 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-indigo-400 mb-2">
                                <TrendingUp size={14} />
                                <span className="text-[10px] font-black uppercase tracking-wider">Consigned Sold</span>
                            </div>
                            <div className="text-2xl font-black tracking-tight text-indigo-700">{supplier.consignedSold ?? 0}</div>
                            <p className="text-[11px] text-indigo-500/80 mt-1 font-medium">units sold in range</p>
                        </div>

                        <div className="col-span-2 bg-white border border-stone-200 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-zinc-400 mb-2">
                                <FileText size={14} />
                                <span className="text-[10px] font-black uppercase tracking-wider">Notes</span>
                            </div>
                            <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                {supplier.notes || <span className="text-zinc-300 italic">No notes recorded.</span>}
                            </p>
                        </div>
                    </div>

                    {/* Purchase history */}
                    <div>
                        <div className="flex items-end justify-between mb-3">
                            <h3 className="text-sm font-black text-zinc-800 tracking-wide uppercase flex items-center gap-2">
                                <Package size={16} className="text-zinc-400" />
                                Purchase History
                            </h3>
                            <span className="text-[11px] font-bold text-zinc-400">
                                {purchases.length} batch{purchases.length === 1 ? '' : 'es'} in range
                            </span>
                        </div>

                        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
                            <div className="max-h-[420px] overflow-y-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="sticky top-0 bg-stone-50 text-[10px] uppercase tracking-wider text-zinc-400 font-black border-b border-stone-200">
                                        <tr>
                                            <th className="px-4 py-3">Date</th>
                                            <th className="px-4 py-3">Product</th>
                                            <th className="px-4 py-3 text-right">Qty</th>
                                            <th className="px-4 py-3 text-right">Unit Cost</th>
                                            <th className="px-4 py-3 text-right">Total</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {loading ? (
                                            <tr><td colSpan="6" className="px-4 py-10 text-center text-zinc-400">
                                                <Loader2 size={20} className="animate-spin mx-auto" />
                                            </td></tr>
                                        ) : purchases.length === 0 ? (
                                            <tr><td colSpan="6" className="px-4 py-10 text-center text-zinc-400">
                                                <Package size={28} className="mx-auto mb-2 opacity-30" />
                                                <p className="text-xs font-bold">No purchases in this date range.</p>
                                            </td></tr>
                                        ) : purchases.map(p => (
                                            <tr key={p.batchId} className="hover:bg-stone-50/50">
                                                <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                                                    {formatDateTime(p.restockedAt)}
                                                </td>
                                                <td className="px-4 py-3 min-w-0">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-zinc-800 text-xs leading-tight">
                                                            {p.brandName} {p.modelName}
                                                            {p.consigned && (
                                                                <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-indigo-500">CONSIGNED</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                                            {p.sku}{p.color ? ` · ${p.color}` : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-bold text-zinc-700 text-xs">{p.quantity}</td>
                                                <td className="px-4 py-3 text-right text-zinc-600 text-xs">{formatPHP(p.acquisitionPrice)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-emerald-600 text-xs whitespace-nowrap">
                                                    {formatPHP(p.totalCost)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <StatusBadge status={p.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default SupplierDetail;
