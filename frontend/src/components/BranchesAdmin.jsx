import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Building2,
    Plus,
    Edit2,
    Trash2,
    MapPin,
    Phone,
    TrendingUp,
    Boxes,
    Calendar,
    Loader2,
    Check,
    X,
    AlertCircle,
    Store,
    CreditCard,
    ChevronRight,
    ArrowUpRight,
    PackagePlus
} from 'lucide-react';

const BranchesAdmin = () => {
    const navigate = useNavigate();
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState(null);

    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formContact, setFormContact] = useState('');
    const [formActive, setFormActive] = useState(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [deleteConfirmBranch, setDeleteConfirmBranch] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteBranch = async () => {
        if (!deleteConfirmBranch) return;
        setDeleting(true);
        setError('');
        try {
            await axios.delete(`/api/admin/branches/${deleteConfirmBranch.id}`);
            setDeleteConfirmBranch(null);
            fetchBranches();
        } catch (err) {
            console.error('Failed to delete branch:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete branch.');
        } finally {
            setDeleting(false);
        }
    };

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/admin/branches/overview');
            setBranches(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load branches overview:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const handleOpenModal = (branch = null) => {
        setEditingBranch(branch);
        if (branch) {
            setFormName(branch.name || '');
            setFormAddress(branch.address || '');
            setFormContact(branch.contactInfo || '');
            setFormActive(branch.active !== false);
        } else {
            setFormName('');
            setFormAddress('');
            setFormContact('');
            setFormActive(true);
        }
        setError('');
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formName.trim()) {
            setError('Branch name is required.');
            return;
        }

        setSaving(true);
        setError('');

        const payload = {
            name: formName.trim(),
            address: formAddress.trim(),
            contactInfo: formContact.trim(),
            active: formActive,
        };

        try {
            if (editingBranch) {
                await axios.put(`/api/admin/branches/${editingBranch.id}`, payload);
            } else {
                await axios.post('/api/admin/branches', payload);
            }
            setModalOpen(false);
            fetchBranches();
        } catch (err) {
            console.error('Failed to save branch:', err);
            setError(err.response?.data?.error || 'Failed to save branch.');
        } finally {
            setSaving(false);
        }
    };

    const retailBranches = branches;

    return (
        <div className="max-w-6xl mx-auto w-full min-w-0 space-y-8">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Store size={16} />
                        <span>Retail Branch Network</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        Retail Store Branches
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        Physical retail store branch locations (Cebu Main, Bayabas, etc.). Stock is allocated from Admin; sales and dues are tracked per branch.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                        <Plus size={16} />
                        <span>New Branch Store</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                </div>
            ) : (
                <>
                    {/* ─── RETAIL STORE BRANCHES SECTION ─── */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Store size={18} className="text-emerald-700" />
                                <h2 className="text-lg font-black text-stone-900 tracking-tight">
                                    Retail Store Branches
                                </h2>
                                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-stone-100 text-stone-700 border border-stone-200">
                                    {retailBranches.length} {retailBranches.length === 1 ? 'store' : 'stores'}
                                </span>
                            </div>
                        </div>

                        {retailBranches.length === 0 ? (
                            <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8">
                                <Building2 size={40} className="mx-auto text-stone-300 mb-2" />
                                <h3 className="font-bold text-stone-800">No Retail Store Branches Yet</h3>
                                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                                    Create physical branch store locations to allocate stock from Admin and track branch retail sales and dues.
                                </p>
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
                                >
                                    + Add Branch Store
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {retailBranches.map((b) => (
                                    <div
                                        key={b.id}
                                        onClick={() => navigate(`/branches/${b.id}`)}
                                        className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-xl hover:border-stone-400 transition-all cursor-pointer group"
                                    >
                                        <div className="p-6">
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-stone-100 group-hover:bg-stone-900 group-hover:text-white transition-colors flex items-center justify-center text-stone-800 font-bold shrink-0">
                                                    <Store size={20} />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                        b.active
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-stone-100 text-stone-500'
                                                    }`}>
                                                        {b.active ? 'Active' : 'Inactive'}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenModal(b);
                                                        }}
                                                        className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                                        title="Edit branch details"
                                                    >
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setDeleteConfirmBranch(b);
                                                        }}
                                                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Delete branch"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <h3 className="text-lg font-black text-stone-900 tracking-tight group-hover:text-emerald-700 transition-colors">
                                                    {b.name}
                                                </h3>
                                                <ChevronRight size={18} className="text-stone-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                                            </div>

                                            <div className="space-y-1.5 mt-3 text-xs text-stone-500">
                                                {b.address && (
                                                    <div className="flex items-center gap-2">
                                                        <MapPin size={13} className="text-stone-400 shrink-0" />
                                                        <span className="truncate">{b.address}</span>
                                                    </div>
                                                )}
                                                {b.contactInfo && (
                                                    <div className="flex items-center gap-2">
                                                        <Phone size={13} className="text-stone-400 shrink-0" />
                                                        <span>{b.contactInfo}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* KPI Metrics */}
                                            <div className="grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-stone-100">
                                                <div className="bg-stone-50 p-3 rounded-xl">
                                                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-stone-400">
                                                        <Boxes size={12} />
                                                        <span>In-Stock Units</span>
                                                    </div>
                                                    <div className="text-xl font-black text-stone-900 mt-1">
                                                        {b.totalStockUnits ?? 0}
                                                    </div>
                                                </div>

                                                <div className="bg-stone-50 p-3 rounded-xl">
                                                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-stone-400">
                                                        <Calendar size={12} />
                                                        <span>Today's Sales</span>
                                                    </div>
                                                    <div className="text-xl font-black text-emerald-600 mt-1">
                                                        ₱{Number(b.todayRevenue || 0).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dues & Outstanding Widget */}
                                            <div className="mt-3 p-3 rounded-xl bg-amber-50/60 border border-amber-100 flex items-center justify-between text-xs">
                                                <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                                                    <CreditCard size={13} className="text-amber-600 shrink-0" />
                                                    <span>Dues to Admin:</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-black text-amber-900">
                                                        ₱{Number(b.totalDue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </span>
                                                    {Number(b.overdueCount || 0) > 0 && (
                                                        <span className="block text-[10px] font-black text-rose-600 uppercase tracking-wider">
                                                            {b.overdueCount} Overdue
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="px-6 py-3.5 bg-stone-50/70 border-t border-stone-100 flex items-center justify-between text-xs">
                                            <div>
                                                <span className="text-stone-400 font-medium block text-[10px]">All-time Revenue</span>
                                                <span className="font-black text-stone-900">
                                                    ₱{Number(b.totalRevenue || 0).toLocaleString()}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/branches/${b.id}?tab=allocate`);
                                                }}
                                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                                            >
                                                <PackagePlus size={13} />
                                                <span>Allocate</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200">
                        <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
                            <h3 className="font-black text-lg text-stone-900">
                                {editingBranch ? 'Edit Branch Store' : 'Add New Branch Store'}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Branch Store Name *
                                </label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. Mandaue Branch, IT Park Store"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Physical Address
                                </label>
                                <input
                                    type="text"
                                    value={formAddress}
                                    onChange={(e) => setFormAddress(e.target.value)}
                                    placeholder="e.g. Lahug, Cebu City"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Contact Phone / Email
                                </label>
                                <input
                                    type="text"
                                    value={formContact}
                                    onChange={(e) => setFormContact(e.target.value)}
                                    placeholder="e.g. 0917-123-4567"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formActive}
                                        onChange={(e) => setFormActive(e.target.checked)}
                                        className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
                                    />
                                    <span className="text-xs font-bold text-stone-800">Branch is Active</span>
                                </label>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-4 border-t border-stone-100 mt-6">
                                {editingBranch ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const b = editingBranch;
                                            setModalOpen(false);
                                            setDeleteConfirmBranch(b);
                                        }}
                                        className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Trash2 size={14} />
                                        <span>Delete Branch</span>
                                    </button>
                                ) : <div />}

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setModalOpen(false)}
                                        className="px-4 py-2.5 text-stone-600 hover:text-stone-900 text-xs font-bold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 disabled:opacity-50"
                                    >
                                        {saving && <Loader2 size={14} className="animate-spin" />}
                                        <span>{editingBranch ? 'Update Branch' : 'Create Branch'}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Branch Confirmation Modal */}
            {deleteConfirmBranch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
                            <Trash2 size={24} />
                        </div>

                        <h3 className="font-black text-lg text-stone-900 tracking-tight">
                            Delete Branch Store?
                        </h3>
                        <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                            Are you sure you want to delete <span className="font-black text-stone-900">"{deleteConfirmBranch.name}"</span>?
                        </p>

                        <div className="mt-4 p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 space-y-1.5">
                            <div className="flex items-center gap-2 text-stone-800 font-bold">
                                <AlertCircle size={14} className="text-amber-600 shrink-0" />
                                <span>Safe Deletion Guarantee:</span>
                            </div>
                            <p className="leading-relaxed">
                                • Any remaining in-stock inventory will automatically return to <strong>Master Storage (Admin Holding Pool)</strong>.
                            </p>
                            <p className="leading-relaxed">
                                • Past sales and order history remain completely intact without losing any financial reporting.
                            </p>
                        </div>

                        {error && (
                            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-stone-100">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => {
                                    setDeleteConfirmBranch(null);
                                    setError('');
                                }}
                                className="px-4 py-2.5 text-stone-600 hover:text-stone-900 text-xs font-bold rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleDeleteBranch}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>{deleting ? 'Deleting...' : 'Yes, Delete Branch'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchesAdmin;
