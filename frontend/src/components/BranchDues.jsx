import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    CreditCard,
    AlertTriangle,
    Calendar,
    Clock,
    CheckCircle2,
    Boxes,
    Search,
    Filter,
    ArrowUpRight,
    Loader2,
    DollarSign,
    FileText,
    ShieldAlert
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BranchDues = () => {
    const { currentBranchId, user } = useAuth();
    const [data, setData] = useState({
        totalOutstanding: 0,
        overdueCount: 0,
        upcomingCount: 0,
        allocations: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterTab, setFilterTab] = useState('ALL'); // ALL, OVERDUE, UPCOMING, PENDING, PAID

    const fetchDues = async () => {
        setLoading(true);
        setError('');
        try {
            const url = currentBranchId ? `/api/allocations/branch-dues?branchId=${currentBranchId}` : '/api/allocations/branch-dues';
            const res = await axios.get(url);
            setData(res.data || { totalOutstanding: 0, overdueCount: 0, upcomingCount: 0, allocations: [] });
        } catch (err) {
            console.error('Failed to load branch dues:', err);
            setError('Could not retrieve branch dues. Please check your network connection.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDues();
    }, [currentBranchId]);

    // Calculate dynamic dues statistics
    const stats = useMemo(() => {
        const list = data.allocations || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let totalOwed = 0;
        let totalPaid = 0;
        let overdueCount = 0;
        let upcomingCount = 0;

        list.forEach(a => {
            const cost = parseFloat(a.totalCost || 0);
            const paid = parseFloat(a.amountPaid || 0);
            const rem = cost - paid;
            totalOwed += rem > 0 ? rem : 0;
            totalPaid += paid;

            if (rem > 0 && a.deadline) {
                const dl = new Date(a.deadline);
                dl.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                    overdueCount++;
                } else if (diffDays <= 7) {
                    upcomingCount++;
                }
            }
        });

        return {
            totalOwed,
            totalPaid,
            overdueCount,
            upcomingCount,
            totalAllocations: list.length
        };
    }, [data.allocations]);

    const filteredAllocations = useMemo(() => {
        const list = data.allocations || [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return list.filter(item => {
            const cost = parseFloat(item.totalCost || 0);
            const paid = parseFloat(item.amountPaid || 0);
            const isSettled = paid >= cost && cost > 0;
            const dl = item.deadline ? new Date(item.deadline) : null;
            if (dl) dl.setHours(0, 0, 0, 0);
            const isOverdue = !isSettled && dl && dl < today;
            const diffDays = dl ? Math.ceil((dl - today) / (1000 * 60 * 60 * 24)) : null;
            const isUpcoming = !isSettled && diffDays !== null && diffDays >= 0 && diffDays <= 7;

            // Tab filtering
            if (filterTab === 'OVERDUE' && !isOverdue) return false;
            if (filterTab === 'UPCOMING' && !isUpcoming) return false;
            if (filterTab === 'PENDING' && (isSettled || isOverdue)) return false;
            if (filterTab === 'PAID' && !isSettled) return false;

            // Search filtering
            const q = search.toLowerCase();
            if (!q) return true;
            return (
                (item.brandName && item.brandName.toLowerCase().includes(q)) ||
                (item.modelName && item.modelName.toLowerCase().includes(q)) ||
                (item.sku && item.sku.toLowerCase().includes(q)) ||
                (item.notes && item.notes.toLowerCase().includes(q)) ||
                (item.adminBatchId && item.adminBatchId.toLowerCase().includes(q))
            );
        });
    }, [data.allocations, filterTab, search]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden border border-stone-800">
                <div className="absolute right-0 top-0 w-96 h-full bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-2">
                            <Clock size={13} />
                            Settlement & Dues Tracker
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Branch Dues & Deadlines
                        </h2>
                        <p className="text-stone-300 text-sm mt-1 max-w-2xl">
                            Track paddle and stock allocations received from the main inventory, the unit costs charged by admin, and upcoming payment deadlines.
                        </p>
                    </div>

                    <button
                        onClick={fetchDues}
                        className="px-4 py-2 bg-stone-800/80 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer"
                    >
                        <Clock size={14} />
                        Refresh Status
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">Total Outstanding</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                            ₱
                        </div>
                    </div>
                    <div className="text-2xl font-black text-stone-900 mt-2">
                        {formatCurrency(stats.totalOwed)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1 font-medium">
                        Due to Admin inventory
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-rose-200 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-rose-50/30">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-rose-600">Past Due / Overdue</span>
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
                            <ShieldAlert size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-rose-600 mt-2">
                        {stats.overdueCount} {stats.overdueCount === 1 ? 'Batch' : 'Batches'}
                    </div>
                    <div className="text-xs text-rose-500 mt-1 font-semibold">
                        Deadline has elapsed
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm relative overflow-hidden bg-gradient-to-br from-white to-amber-50/30">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-600">Due This Week</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                            <Calendar size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-amber-600 mt-2">
                        {stats.upcomingCount} {stats.upcomingCount === 1 ? 'Batch' : 'Batches'}
                    </div>
                    <div className="text-xs text-amber-600 mt-1 font-medium">
                        Within next 7 days
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-stone-400">Total Settled</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-2">
                        {formatCurrency(stats.totalPaid)}
                    </div>
                    <div className="text-xs text-stone-500 mt-1 font-medium">
                        Successfully remitted
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search product, SKU, batch, notes..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 focus:bg-white transition-all font-medium text-stone-900"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 custom-scrollbar">
                    {[
                        { id: 'ALL', label: 'All Allocations' },
                        { id: 'OVERDUE', label: `Overdue (${stats.overdueCount})`, isAlert: stats.overdueCount > 0 },
                        { id: 'UPCOMING', label: `Due Soon (${stats.upcomingCount})`, isWarning: stats.upcomingCount > 0 },
                        { id: 'PENDING', label: 'Active / Pending' },
                        { id: 'PAID', label: 'Settled' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterTab(tab.id)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                filterTab === tab.id
                                    ? tab.isAlert
                                        ? 'bg-rose-600 text-white shadow-sm'
                                        : 'bg-stone-900 text-white shadow-sm'
                                    : tab.isAlert
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Error banner */}
            {error && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5">
                    <AlertTriangle size={18} className="text-rose-600 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Dues List Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-3 text-stone-400">
                        <Loader2 className="w-8 h-8 animate-spin text-stone-600" />
                        <span className="text-sm font-semibold">Loading dues & payment records...</span>
                    </div>
                ) : filteredAllocations.length === 0 ? (
                    <div className="p-16 text-center text-stone-400">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-stone-400" />
                        <h4 className="font-bold text-stone-700 text-base">No Dues in this Category</h4>
                        <p className="text-xs text-stone-500 mt-1">There are no matching allocation records for the selected filter.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100 select-none">
                                <tr>
                                    <th className="py-4 px-6">Product / Allocation</th>
                                    <th className="py-4 px-4">Allocated Units</th>
                                    <th className="py-4 px-4">Cost / Unit</th>
                                    <th className="py-4 px-4">Total Cost</th>
                                    <th className="py-4 px-4">Paid / Balance</th>
                                    <th className="py-4 px-4">Deadline</th>
                                    <th className="py-4 px-6 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredAllocations.map(a => {
                                    const totalCost = parseFloat(a.totalCost || 0);
                                    const amountPaid = parseFloat(a.amountPaid || 0);
                                    const remaining = Math.max(0, totalCost - amountPaid);
                                    const isPaid = amountPaid >= totalCost && totalCost > 0;

                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const dl = a.deadline ? new Date(a.deadline) : null;
                                    if (dl) dl.setHours(0, 0, 0, 0);
                                    const diffDays = dl ? Math.ceil((dl - today) / (1000 * 60 * 60 * 24)) : null;
                                    const isOverdue = !isPaid && diffDays !== null && diffDays < 0;
                                    const isDueSoon = !isPaid && diffDays !== null && diffDays >= 0 && diffDays <= 7;

                                    return (
                                        <tr key={a.id} className="hover:bg-stone-50/70 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-black text-stone-900 text-sm">{a.modelName || 'Product'}</div>
                                                <div className="text-xs text-stone-400 font-semibold">{a.brandName}</div>
                                                <div className="text-[11px] font-mono text-stone-500 mt-0.5">
                                                    SKU: {a.sku}
                                                </div>
                                                {a.notes && (
                                                    <div className="text-[11px] text-stone-400 italic mt-1 bg-stone-50 px-2 py-0.5 rounded border border-stone-100 inline-block">
                                                        "{a.notes}"
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-stone-100 text-stone-700">
                                                    <Boxes size={12} />
                                                    {a.quantity} units
                                                </span>
                                                {a.soldQuantity != null && (
                                                    <div className="text-[10px] text-stone-500 mt-1 flex items-center gap-1 font-semibold">
                                                        <span className="text-emerald-700 font-bold">{a.soldQuantity || 0} sold</span>
                                                        <span className="text-stone-300">•</span>
                                                        <span className="text-indigo-700 font-bold">{a.remainingQuantity != null ? a.remainingQuantity : a.quantity} in branch</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-4 font-semibold text-stone-700">
                                                {formatCurrency(a.costPerUnit)}
                                            </td>

                                            <td className="py-4 px-4 font-black text-stone-900">
                                                {formatCurrency(totalCost)}
                                            </td>

                                            <td className="py-4 px-4">
                                                <div className="font-black text-stone-900 text-xs">
                                                    Bal: <span className={remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(remaining)}</span>
                                                </div>
                                                <div className="text-[11px] text-stone-400 font-medium">
                                                    Paid: {formatCurrency(amountPaid)}
                                                </div>
                                                {/* Mini progress bar */}
                                                <div className="w-28 h-1.5 bg-stone-100 rounded-full mt-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                        style={{ width: `${Math.min(100, totalCost > 0 ? (amountPaid / totalCost) * 100 : 0)}%` }}
                                                    />
                                                </div>
                                            </td>

                                            <td className="py-4 px-4">
                                                <div className="font-bold text-stone-900 text-xs flex items-center gap-1.5">
                                                    <Calendar size={13} className="text-stone-400" />
                                                    {a.deadline || 'No date set'}
                                                </div>
                                                {diffDays !== null && !isPaid && (
                                                    <div className="mt-1">
                                                        {isOverdue ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700">
                                                                Overdue by {Math.abs(diffDays)}d
                                                            </span>
                                                        ) : isDueSoon ? (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                                                                Due in {diffDays}d
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-stone-400">
                                                                {diffDays} days left
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-6 text-right">
                                                {isPaid ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 size={12} />
                                                        Settled
                                                    </span>
                                                ) : isOverdue ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                                        <AlertTriangle size={12} />
                                                        Overdue
                                                    </span>
                                                ) : a.status === 'PARTIAL' ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                                                        Partial
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
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
                )}
            </div>
        </div>
    );
};

export default BranchDues;
