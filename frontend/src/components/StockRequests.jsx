import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    Boxes,
    Store,
    Plus,
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    Ban,
    ChevronDown,
    ChevronRight,
    Loader2,
    Calendar,
    Send,
    AlertCircle,
    PackagePlus,
    Tag,
    Trash2,
    Sparkles,
    Check,
    X,
    Filter,
    ShieldCheck
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StockRequests = () => {
    const { user, isAdmin, isBranch } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [branchFilter, setBranchFilter] = useState('ALL');
    const [requestSearch, setRequestSearch] = useState('');
    const [branches, setBranches] = useState([]);

    // Branch New Request Modal
    const [requestModalOpen, setRequestModalOpen] = useState(() => searchParams.get('action') === 'new');
    const [catalog, setCatalog] = useState([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState('All');
    const [selectedItems, setSelectedItems] = useState({}); // { [variantId]: { quantity: number, variant: obj } }
    const [requestNotes, setRequestNotes] = useState('');
    const [submittingRequest, setSubmittingRequest] = useState(false);
    const [requestError, setRequestError] = useState('');

    // Admin Review & Approval Modal
    const [reviewingRequest, setReviewingRequest] = useState(null);
    const [approvals, setApprovals] = useState({}); // { [itemId]: { approvedQty, costPerUnit, sellingPrice } }
    const [approvalDeadline, setApprovalDeadline] = useState('');
    const [approvalAdminNotes, setApprovalAdminNotes] = useState('');
    const [approving, setApproving] = useState(false);
    const [rejecting, setRejecting] = useState(false);
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [reviewError, setReviewError] = useState('');

    const [expandedRequestId, setExpandedRequestId] = useState(null);

    // Fetch requests list
    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/api/stock-requests');
            setRequests(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load stock requests:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch branches for filter
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/branches')
                .then(res => setBranches(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Failed to load branches:', err));
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    // Open new request modal if URL query says so
    useEffect(() => {
        if (searchParams.get('action') === 'new') {
            handleOpenRequestModal();
        }
    }, [searchParams]);

    // Fetch Master Catalog for Branch (Cost Prices are NOT included by backend!)
    const handleOpenRequestModal = async () => {
        setRequestModalOpen(true);
        setLoadingCatalog(true);
        setRequestError('');
        try {
            const res = await axios.get('/api/stock-requests/catalog');
            setCatalog(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load master catalog:', err);
            setRequestError('Failed to load master inventory catalog.');
        } finally {
            setLoadingCatalog(false);
        }
    };

    const handleCloseRequestModal = () => {
        setRequestModalOpen(false);
        setSelectedItems({});
        setRequestNotes('');
        setRequestError('');
        if (searchParams.get('action') === 'new') {
            searchParams.delete('action');
            setSearchParams(searchParams);
        }
    };

    // Catalog filtering
    const categories = useMemo(() => {
        const set = new Set(catalog.map(c => c.category || 'General'));
        return ['All', ...Array.from(set)];
    }, [catalog]);

    const filteredCatalog = useMemo(() => {
        return catalog.filter(item => {
            const matchesCat = catalogCategory === 'All' || (item.category || 'General') === catalogCategory;
            const q = catalogSearch.toLowerCase().trim();
            const matchesSearch = !q ||
                item.brandName?.toLowerCase().includes(q) ||
                item.modelName?.toLowerCase().includes(q) ||
                item.sku?.toLowerCase().includes(q) ||
                item.color?.toLowerCase().includes(q);
            return matchesCat && matchesSearch;
        });
    }, [catalog, catalogCategory, catalogSearch]);

    // Cart / Manifest actions for requesting stock
    const setItemQty = (variant, qty) => {
        const num = parseInt(qty, 10);
        if (isNaN(num) || num <= 0) {
            const next = { ...selectedItems };
            delete next[variant.variantId];
            setSelectedItems(next);
            return;
        }
        const max = variant.masterStock || 0;
        const clamped = Math.min(max, num);
        setSelectedItems(prev => ({
            ...prev,
            [variant.variantId]: { quantity: clamped, variant }
        }));
    };

    const submitStockRequest = async (e) => {
        e.preventDefault();
        const items = Object.values(selectedItems).map(i => ({
            variantId: i.variant.variantId,
            quantity: i.quantity
        }));

        if (items.length === 0) {
            setRequestError('Please select at least one item to request.');
            return;
        }

        setSubmittingRequest(true);
        setRequestError('');

        try {
            await axios.post('/api/stock-requests', {
                items,
                notes: requestNotes.trim()
            });
            handleCloseRequestModal();
            fetchRequests();
        } catch (err) {
            console.error('Failed to submit stock request:', err);
            setRequestError(err.response?.data?.error || 'Failed to submit stock request.');
        } finally {
            setSubmittingRequest(false);
        }
    };

    // Cancel Pending Request
    const handleCancelRequest = async (requestId) => {
        if (!window.confirm('Are you sure you want to cancel this pending stock request?')) return;
        try {
            await axios.delete(`/api/stock-requests/${requestId}/cancel`);
            fetchRequests();
        } catch (err) {
            console.error('Failed to cancel request:', err);
            alert(err.response?.data?.error || 'Failed to cancel request.');
        }
    };

    // Open Admin Review Modal
    const handleOpenReview = (req) => {
        setReviewingRequest(req);
        setReviewError('');
        setApprovalAdminNotes('');

        // Default deadline: 14 days from now
        const defaultDeadline = new Date();
        defaultDeadline.setDate(defaultDeadline.getDate() + 14);
        setApprovalDeadline(defaultDeadline.toISOString().split('T')[0]);

        // Initialize approvals map
        const initialApprovals = {};
        (req.items || []).forEach(it => {
            const acq = it.acquisitionPrice || 0;
            initialApprovals[it.id] = {
                itemId: it.id,
                variantId: it.variantId,
                approvedQuantity: it.requestedQuantity,
                costPerUnit: acq > 0 ? acq : 0,
                sellingPrice: it.sellingPrice || 0,
                acquisitionPrice: acq
            };
        });
        setApprovals(initialApprovals);
    };

    // Admin pricing markup presets
    const applyAdminPricingPreset = (type) => {
        setApprovals(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(key => {
                const acq = next[key].acquisitionPrice || 0;
                if (type === 'cost') {
                    next[key].costPerUnit = acq;
                } else if (type === 'markup15') {
                    next[key].costPerUnit = Math.round(acq * 1.15);
                } else if (type === 'markup25') {
                    next[key].costPerUnit = Math.round(acq * 1.25);
                }
            });
            return next;
        });
    };

    // Admin Approves and Dispatches
    const handleApproveAndDispatch = async () => {
        if (!approvalDeadline) {
            setReviewError('Please set a payment deadline for this branch allocation.');
            return;
        }

        setApproving(true);
        setReviewError('');

        const payload = {
            deadline: approvalDeadline,
            adminNotes: approvalAdminNotes.trim(),
            items: Object.values(approvals).map(a => ({
                itemId: a.itemId,
                variantId: a.variantId,
                approvedQuantity: a.approvedQuantity,
                costPerUnit: a.costPerUnit,
                sellingPrice: a.sellingPrice
            }))
        };

        try {
            await axios.post(`/api/stock-requests/admin/${reviewingRequest.id}/approve`, payload);
            setReviewingRequest(null);
            fetchRequests();
        } catch (err) {
            console.error('Failed to approve stock request:', err);
            setReviewError(err.response?.data?.error || 'Failed to approve and dispatch request.');
        } finally {
            setApproving(false);
        }
    };

    // Admin Rejects Request
    const handleRejectRequest = async () => {
        setRejecting(true);
        setReviewError('');
        try {
            await axios.post(`/api/stock-requests/admin/${reviewingRequest.id}/reject`, {
                reason: rejectReason.trim() || 'Declined by Admin'
            });
            setRejectModalOpen(false);
            setReviewingRequest(null);
            setRejectReason('');
            fetchRequests();
        } catch (err) {
            console.error('Failed to reject request:', err);
            setReviewError(err.response?.data?.error || 'Failed to reject request.');
        } finally {
            setRejecting(false);
        }
    };

    // Filtered requests list
    const filteredRequests = useMemo(() => {
        return requests.filter(r => {
            const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
            const matchesBranch = branchFilter === 'ALL' || String(r.branchId) === String(branchFilter);
            const q = requestSearch.toLowerCase().trim();
            const matchesSearch = !q ||
                (r.requestCode && r.requestCode.toLowerCase().includes(q)) ||
                (r.branchName && r.branchName.toLowerCase().includes(q)) ||
                (r.reason && r.reason.toLowerCase().includes(q)) ||
                (r.adminNotes && r.adminNotes.toLowerCase().includes(q)) ||
                (r.items && r.items.some(item =>
                    (item.modelName && item.modelName.toLowerCase().includes(q)) ||
                    (item.brandName && item.brandName.toLowerCase().includes(q)) ||
                    (item.sku && item.sku.toLowerCase().includes(q))
                ));

            return matchesStatus && matchesBranch && matchesSearch;
        });
    }, [requests, statusFilter, branchFilter, requestSearch]);

    const pendingCount = useMemo(() => {
        return requests.filter(r => r.status === 'PENDING').length;
    }, [requests]);

    return (
        <div className="max-w-6xl mx-auto w-full min-w-0 space-y-6">
            {/* Top Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Send size={15} />
                        <span>Master Storage Stock Transfer</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        Stock Requests & Fulfillment
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        {isAdmin
                            ? 'Review branch stock requests, approve dispatched quantities with pricing terms, or decline.'
                            : 'Request inventory stock directly from Master Storage (Admin Holding Pool).'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Branch button: Request Stock */}
                    {isBranch && (
                        <button
                            onClick={handleOpenRequestModal}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            <PackagePlus size={16} />
                            <span>Request Stock from Master</span>
                        </button>
                    )}

                    {/* Admin button: Allocate directly */}
                    {isAdmin && (
                        <button
                            onClick={() => navigate('/branches')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            <Store size={16} />
                            <span>Manage Branches</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Status Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-1.5 overflow-x-auto">
                    {[
                        { id: 'ALL', label: 'All Requests', count: requests.length },
                        { id: 'PENDING', label: 'Pending Review', count: pendingCount, highlight: pendingCount > 0 },
                        { id: 'APPROVED', label: 'Approved & Dispatched', count: requests.filter(r => r.status === 'APPROVED').length },
                        { id: 'REJECTED', label: 'Declined', count: requests.filter(r => r.status === 'REJECTED').length },
                        { id: 'CANCELLED', label: 'Cancelled', count: requests.filter(r => r.status === 'CANCELLED').length },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setStatusFilter(f.id)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                statusFilter === f.id
                                    ? 'bg-stone-900 text-white shadow-xs'
                                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                            }`}
                        >
                            <span>{f.label}</span>
                            <span className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                                f.highlight
                                    ? 'bg-amber-400 text-stone-950 font-black animate-pulse'
                                    : statusFilter === f.id
                                        ? 'bg-stone-700 text-stone-200'
                                        : 'bg-stone-200/80 text-stone-600'
                            }`}>
                                {f.count}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    {/* Search Bar */}
                    <div className="relative flex-1 md:w-64">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                        <input
                            type="text"
                            value={requestSearch}
                            onChange={(e) => setRequestSearch(e.target.value)}
                            placeholder="Search request #, branch, SKU..."
                            className="w-full pl-8.5 pr-7 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-900 placeholder:text-stone-400 focus:outline-none focus:bg-white focus:border-stone-900 transition-all"
                        />
                        {requestSearch && (
                            <button
                                type="button"
                                onClick={() => setRequestSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 p-0.5 rounded cursor-pointer"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Admin Branch Filter */}
                    {isAdmin && branches.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <Filter size={13} className="text-stone-400" />
                            <select
                                value={branchFilter}
                                onChange={(e) => setBranchFilter(e.target.value)}
                                className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-stone-800 focus:outline-none cursor-pointer"
                            >
                                <option value="ALL">All Branches</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Requests List */}
            {loading ? (
                <div className="flex justify-center items-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                </div>
            ) : filteredRequests.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-stone-200 p-8">
                    <Boxes size={38} className="mx-auto text-stone-300 mb-2" />
                    <h3 className="font-bold text-stone-800">No Stock Requests Found</h3>
                    <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                        {statusFilter === 'ALL'
                            ? (isBranch ? 'You have not submitted any stock requests yet.' : 'No branches have submitted stock requests.')
                            : `There are currently no ${statusFilter.toLowerCase()} requests.`}
                    </p>
                    {isBranch && (
                        <button
                            onClick={handleOpenRequestModal}
                            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                            + Request Stock from Master
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredRequests.map(req => {
                        const isExpanded = expandedRequestId === req.id;
                        const isPending = req.status === 'PENDING';
                        const isApproved = req.status === 'APPROVED';
                        const isRejected = req.status === 'REJECTED';
                        const isCancelled = req.status === 'CANCELLED';

                        return (
                            <div
                                key={req.id}
                                className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden transition-all hover:border-stone-300"
                            >
                                <div
                                    className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none hover:bg-stone-50/60 transition-colors"
                                    onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`p-2 rounded-xl transition-transform duration-200 ${
                                            isPending ? 'bg-amber-50 text-amber-600' :
                                            isApproved ? 'bg-emerald-50 text-emerald-600' :
                                            'bg-stone-100 text-stone-400'
                                        }`}>
                                            <Send size={18} />
                                        </div>

                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono font-black text-xs text-stone-900">
                                                    #{req.requestNumber}
                                                </span>

                                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-stone-100 text-stone-700 border border-stone-200">
                                                    <Store size={11} /> {req.branchName}
                                                </span>

                                                {/* Status Badge */}
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isPending ? 'bg-amber-100 text-amber-800 animate-pulse' :
                                                    isApproved ? 'bg-emerald-100 text-emerald-800' :
                                                    isRejected ? 'bg-rose-100 text-rose-800' :
                                                    'bg-stone-100 text-stone-500'
                                                }`}>
                                                    {isPending && '● Pending Review'}
                                                    {isApproved && '✓ Approved & Dispatched'}
                                                    {isRejected && '✕ Declined'}
                                                    {isCancelled && 'Cancelled'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-xs text-stone-400 mt-1">
                                                <span>{req.createdAt ? new Date(req.createdAt).toLocaleString() : ''}</span>
                                                <span>•</span>
                                                <span className="font-medium text-stone-600">
                                                    {req.totalRequestedUnits} {req.totalRequestedUnits === 1 ? 'unit' : 'units'} requested
                                                </span>
                                                {isApproved && req.totalApprovedUnits != null && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-black text-emerald-700">
                                                            {req.totalApprovedUnits} units dispatched
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-2.5 ml-auto" onClick={e => e.stopPropagation()}>
                                        {/* Admin Action: Review & Dispatch */}
                                        {isAdmin && isPending && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenReview(req)}
                                                className="px-3.5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <CheckCircle2 size={14} className="text-emerald-400" />
                                                <span>Review & Dispatch</span>
                                            </button>
                                        )}

                                        {/* Branch Action: Cancel Pending */}
                                        {isBranch && isPending && (
                                            <button
                                                type="button"
                                                onClick={() => handleCancelRequest(req.id)}
                                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-all border border-rose-200 flex items-center gap-1 cursor-pointer"
                                            >
                                                <X size={13} />
                                                <span>Cancel</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                                            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
                                        >
                                            <ChevronDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Items Table */}
                                {isExpanded && (
                                    <div className="border-t border-stone-100 bg-stone-50/50 p-4 sm:p-5 space-y-3">
                                        {req.notes && (
                                            <div className="p-3 rounded-xl bg-white border border-stone-200 text-xs text-stone-600">
                                                <span className="font-bold text-stone-800 mr-2">Branch Note:</span>
                                                <span>{req.notes}</span>
                                            </div>
                                        )}

                                        {req.adminNotes && (
                                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                                                <span className="font-bold text-amber-950 mr-2">Admin Feedback:</span>
                                                <span>{req.adminNotes}</span>
                                            </div>
                                        )}

                                        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-stone-100/70 text-[10px] font-black uppercase tracking-wider text-stone-500 border-b border-stone-200">
                                                    <tr>
                                                        <th className="py-2.5 px-4">Item & Specifications</th>
                                                        <th className="py-2.5 px-3 text-center">SKU</th>
                                                        <th className="py-2.5 px-3 text-center">Requested Qty</th>
                                                        <th className="py-2.5 px-3 text-center">Approved Qty</th>
                                                        <th className="py-2.5 px-4 text-right">Retail Price</th>
                                                        {isAdmin && <th className="py-2.5 px-4 text-right">Master Holding Stock</th>}
                                                        <th className="py-2.5 px-3 text-center">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-100">
                                                    {(req.items || []).map(it => (
                                                        <tr key={it.id} className="hover:bg-stone-50/50">
                                                            <td className="py-2.5 px-4">
                                                                <span className="font-bold text-stone-900 block">
                                                                    {it.brandName} {it.modelName}
                                                                </span>
                                                                <span className="text-[11px] text-stone-400">
                                                                    {[it.color, it.shape, it.thicknessMm ? `${it.thicknessMm}mm` : ''].filter(Boolean).join(' • ')}
                                                                </span>
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-mono text-[11px] text-stone-500">
                                                                {it.sku}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-bold text-stone-800">
                                                                {it.requestedQuantity}
                                                            </td>
                                                            <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                                                                {it.approvedQuantity || (isApproved ? it.requestedQuantity : '—')}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-right font-medium text-stone-600 font-mono">
                                                                {formatCurrency(it.sellingPrice)}
                                                            </td>
                                                            {isAdmin && (
                                                                <td className="py-2.5 px-4 text-right font-bold text-stone-500">
                                                                    {it.masterStockAvailable ?? '—'}
                                                                </td>
                                                            )}
                                                            <td className="py-2.5 px-3 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                                                    it.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                                                                    it.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' :
                                                                    'bg-amber-100 text-amber-800'
                                                                }`}>
                                                                    {it.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ─── BRANCH: REQUEST STOCK MODAL (NO COST PRICES) ─── */}
            {requestModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase">
                                    <PackagePlus size={14} />
                                    <span>Branch Stock Pull</span>
                                </div>
                                <h3 className="font-black text-lg text-stone-900 mt-0.5">
                                    Request Stocks from Master Storage
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Select items from central warehouse inventory. Once submitted, Admin will confirm and dispatch.
                                </p>
                            </div>
                            <button
                                onClick={handleCloseRequestModal}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Search & Category Filter */}
                        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row items-center gap-3 bg-white">
                            <div className="relative flex-1 w-full">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search Master Storage paddles, balls, accessories..."
                                    value={catalogSearch}
                                    onChange={(e) => setCatalogSearch(e.target.value)}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:border-stone-900"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCatalogCategory(cat)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                            catalogCategory === cat
                                                ? 'bg-stone-900 text-white'
                                                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {requestError && (
                            <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={15} />
                                <span>{requestError}</span>
                            </div>
                        )}

                        {/* Catalog Items Grid */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                            {loadingCatalog ? (
                                <div className="py-20 text-center">
                                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-stone-400 mb-2" />
                                    <p className="text-xs text-stone-500">Loading Master Storage stock...</p>
                                </div>
                            ) : filteredCatalog.length === 0 ? (
                                <div className="py-16 text-center text-stone-400">
                                    <Boxes size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold text-stone-600">No items match your search</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {filteredCatalog.map(item => {
                                        const selected = selectedItems[item.variantId];
                                        const qty = selected ? selected.quantity : 0;
                                        const isOutOfStock = (item.masterStock || 0) <= 0;

                                        return (
                                            <div
                                                key={item.variantId}
                                                className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                                    qty > 0
                                                        ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                                                        : isOutOfStock
                                                            ? 'bg-stone-50/50 border-stone-200 opacity-60'
                                                            : 'bg-white border-stone-200 hover:border-stone-300'
                                                }`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-black text-xs text-stone-900 truncate">
                                                            {item.brandName} {item.modelName}
                                                        </span>
                                                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-stone-100 text-stone-500">
                                                            {item.sku}
                                                        </span>
                                                    </div>

                                                    <div className="text-[11px] text-stone-400 mt-0.5">
                                                        {[item.color, item.shape, item.thicknessMm ? `${item.thicknessMm}mm` : ''].filter(Boolean).join(' • ')}
                                                    </div>

                                                    <div className="flex items-center gap-3 mt-2 text-xs">
                                                        {/* Master storage stock badge (Cost is 100% hidden!) */}
                                                        <span className={`font-black text-[11px] px-2 py-0.5 rounded-md ${
                                                            isOutOfStock
                                                                ? 'bg-stone-100 text-stone-400'
                                                                : 'bg-emerald-100 text-emerald-800'
                                                        }`}>
                                                            📦 {item.masterStock || 0} in Master
                                                        </span>

                                                        <span className="font-bold text-stone-700">
                                                            Retail: {formatCurrency(item.sellingPrice)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Stepper */}
                                                {!isOutOfStock && (
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemQty(item, qty - 1)}
                                                            className="w-7 h-7 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold flex items-center justify-center transition-colors cursor-pointer"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.masterStock || 0}
                                                            value={qty || ''}
                                                            placeholder="0"
                                                            onChange={(e) => setItemQty(item, e.target.value)}
                                                            className="w-12 text-center bg-stone-50 border border-stone-200 rounded-lg py-1 text-xs font-black text-stone-900 focus:outline-none focus:bg-white"
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => setItemQty(item, qty + 1)}
                                                            className="w-7 h-7 rounded-lg bg-stone-900 hover:bg-black text-white font-bold flex items-center justify-center transition-colors cursor-pointer"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer / Manifest Drawer */}
                        <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="w-full sm:w-auto">
                                <input
                                    type="text"
                                    placeholder="Optional note for admin (e.g. Tournament order, restock paddles)..."
                                    value={requestNotes}
                                    onChange={(e) => setRequestNotes(e.target.value)}
                                    className="w-full sm:w-96 bg-white border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:border-stone-900"
                                />
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                                <span className="text-xs font-bold text-stone-600">
                                    {Object.keys(selectedItems).length} item(s) selected
                                </span>
                                <button
                                    type="button"
                                    disabled={submittingRequest || Object.keys(selectedItems).length === 0}
                                    onClick={submitStockRequest}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {submittingRequest ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    <span>Submit Request</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── ADMIN: REVIEW & APPROVE MODAL (WITH COST & PRICING PRESETS) ─── */}
            {reviewingRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                            <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 uppercase">
                                    <ShieldCheck size={14} className="text-emerald-600" />
                                    <span>Admin Request Approval & Dispatch</span>
                                </div>
                                <h3 className="font-black text-lg text-stone-900 mt-0.5">
                                    Review #{reviewingRequest.requestNumber} — {reviewingRequest.branchName}
                                </h3>
                                <p className="text-xs text-stone-500">
                                    Confirm approved quantities, configure transfer cost and payment deadline, then dispatch.
                                </p>
                            </div>
                            <button
                                onClick={() => setReviewingRequest(null)}
                                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {reviewError && (
                            <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={15} />
                                <span>{reviewError}</span>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {reviewingRequest.notes && (
                                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700">
                                    <span className="font-bold mr-1">Branch Request Note:</span>
                                    <span>{reviewingRequest.notes}</span>
                                </div>
                            )}

                            {/* 1-Click Pricing Presets */}
                            <div className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-200">
                                <span className="text-xs font-bold text-stone-700">
                                    Transfer Cost Pricing Presets:
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => applyAdminPricingPreset('cost')}
                                        className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold border border-stone-200 transition-colors cursor-pointer"
                                    >
                                        At Cost
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyAdminPricingPreset('markup15')}
                                        className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold border border-stone-200 transition-colors cursor-pointer"
                                    >
                                        +15% Markup
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => applyAdminPricingPreset('markup25')}
                                        className="px-2.5 py-1 bg-white hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold border border-stone-200 transition-colors cursor-pointer"
                                    >
                                        +25% Markup
                                    </button>
                                </div>
                            </div>

                            {/* Itemized Approval Table */}
                            <div className="rounded-xl border border-stone-200 overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-stone-100/70 text-[10px] font-black uppercase tracking-wider text-stone-500 border-b border-stone-200">
                                        <tr>
                                            <th className="py-2.5 px-4">Item & SKU</th>
                                            <th className="py-2.5 px-3 text-center">Req / Available</th>
                                            <th className="py-2.5 px-3 text-center">Approved Qty</th>
                                            <th className="py-2.5 px-3 text-right">Transfer Cost / Unit</th>
                                            <th className="py-2.5 px-3 text-right">Retail Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 bg-white">
                                        {(reviewingRequest.items || []).map(it => {
                                            const app = approvals[it.id] || {};

                                            return (
                                                <tr key={it.id}>
                                                    <td className="py-2.5 px-4">
                                                        <span className="font-bold text-stone-900 block">
                                                            {it.brandName} {it.modelName}
                                                        </span>
                                                        <span className="font-mono text-[10px] text-stone-400">
                                                            {it.sku}
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <span className="font-black text-stone-800">{it.requestedQuantity}</span>
                                                        <span className="text-[10px] text-stone-400 block">
                                                            ({it.masterStockAvailable} in holding)
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={it.masterStockAvailable}
                                                            value={app.approvedQuantity ?? ''}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value, 10);
                                                                setApprovals(prev => ({
                                                                    ...prev,
                                                                    [it.id]: { ...prev[it.id], approvedQuantity: isNaN(val) ? 0 : val }
                                                                }));
                                                            }}
                                                            className="w-16 text-center bg-stone-50 border border-stone-200 rounded-lg py-1 font-black text-emerald-700 focus:outline-none focus:bg-white"
                                                        />
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <span className="text-stone-400">₱</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={app.costPerUnit ?? ''}
                                                                onChange={(e) => {
                                                                    const val = parseFloat(e.target.value);
                                                                    setApprovals(prev => ({
                                                                        ...prev,
                                                                        [it.id]: { ...prev[it.id], costPerUnit: isNaN(val) ? 0 : val }
                                                                    }));
                                                                }}
                                                                className="w-20 text-right bg-stone-50 border border-stone-200 rounded-lg py-1 font-mono text-xs font-bold text-stone-800 focus:outline-none focus:bg-white"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right">
                                                        <span className="font-mono text-stone-600">
                                                            {formatCurrency(it.sellingPrice)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment Deadline Picker */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Payment Deadline Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={approvalDeadline}
                                        onChange={(e) => setApprovalDeadline(e.target.value)}
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-900 focus:outline-none focus:border-stone-900"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                                        Admin Notes for Branch
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Optional feedback or invoice reference..."
                                        value={approvalAdminNotes}
                                        onChange={(e) => setApprovalAdminNotes(e.target.value)}
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-900 focus:outline-none focus:border-stone-900"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setRejectModalOpen(true)}
                                className="px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Decline Request
                            </button>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setReviewingRequest(null)}
                                    className="px-4 py-2 text-stone-600 hover:text-stone-900 text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={approving}
                                    onClick={handleApproveAndDispatch}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                >
                                    {approving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                                    <span>Approve & Dispatch Stock</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Confirmation Prompt */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200">
                        <h3 className="font-black text-lg text-stone-900">
                            Decline Stock Request?
                        </h3>
                        <p className="text-xs text-stone-500 mt-1">
                            Provide a reason for declining this request so the branch is informed.
                        </p>
                        <textarea
                            rows={3}
                            placeholder="e.g. Low holding stock, awaiting new shipment next week..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full mt-3 p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:border-stone-900"
                        />
                        <div className="flex items-center justify-end gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setRejectModalOpen(false)}
                                className="px-3.5 py-2 text-stone-600 text-xs font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={rejecting}
                                onClick={handleRejectRequest}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {rejecting ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
                                <span>Confirm Decline</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockRequests;
