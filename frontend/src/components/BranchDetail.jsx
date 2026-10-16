import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    Building2,
    ArrowLeft,
    Boxes,
    Calendar,
    CreditCard,
    DollarSign,
    PackagePlus,
    TrendingUp,
    MapPin,
    Phone,
    CheckCircle2,
    Clock,
    AlertTriangle,
    ShieldAlert,
    Search,
    Plus,
    Minus,
    Trash2,
    Check,
    X,
    Loader2,
    Sparkles,
    Tag,
    ChevronRight,
    ArrowUpRight,
    CheckSquare,
    Square,
    Layers,
    ListFilter
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BranchDetail = () => {
    const { branchId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [branch, setBranch] = useState(null);
    const [loadingBranch, setLoadingBranch] = useState(true);
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');

    useEffect(() => {
        const tabFromUrl = searchParams.get('tab');
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams]);

    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSearchParams({ tab: tabId });
    };

    // Admin Master Products (for allocation source)
    const [adminProducts, setAdminProducts] = useState([]);
    const [loadingAdminProducts, setLoadingAdminProducts] = useState(false);

    // Branch Inventory (for inventory tracker tab)
    const [branchProducts, setBranchProducts] = useState([]);
    const [loadingBranchProducts, setLoadingBranchProducts] = useState(false);

    // Allocations & Dues for this branch
    const [allocations, setAllocations] = useState([]);
    const [loadingAllocations, setLoadingAllocations] = useState(false);

    // Stock Allocation Form State
    const [catalogSearch, setCatalogSearch] = useState('');
    const [catalogCategory, setCatalogCategory] = useState('All');
    const [selectedVariantIds, setSelectedVariantIds] = useState(new Set());
    const [bulkDefaultQty, setBulkDefaultQty] = useState(1);

    const [manifest, setManifest] = useState([]); // Array of { variantId, sku, brandName, modelName, maxStock, quantity, costPerUnit }
    const [allocationDeadline, setAllocationDeadline] = useState(() => {
        // Default deadline: 30 days from now
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });
    const [allocationNotes, setAllocationNotes] = useState('');
    const [allocating, setAllocating] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    // Record Payment Modal State
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedAllocation, setSelectedAllocation] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [recordingPayment, setRecordingPayment] = useState(false);

    // Feedback
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    const showFeedback = (type, message) => {
        setFeedback({ type, message });
        setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    };

    // 1. Fetch Branch Details
    const fetchBranch = async () => {
        setLoadingBranch(true);
        try {
            const res = await axios.get(`/api/admin/branches/${branchId}`);
            setBranch(res.data);
        } catch (err) {
            console.error('Failed to load branch details:', err);
            showFeedback('error', 'Failed to load branch information.');
        } finally {
            setLoadingBranch(false);
        }
    };

    // 2. Fetch Admin Products (Master inventory stock)
    const fetchAdminProducts = async () => {
        setLoadingAdminProducts(true);
        try {
            // Admin products have stock from main branch
            const res = await axios.get('/api/products');
            setAdminProducts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load master catalog:', err);
        } finally {
            setLoadingAdminProducts(false);
        }
    };

    // 3. Fetch Branch Products (Branch inventory stock)
    const fetchBranchProducts = async () => {
        setLoadingBranchProducts(true);
        try {
            const res = await axios.get(`/api/products?branchId=${branchId}`);
            setBranchProducts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load branch inventory:', err);
        } finally {
            setLoadingBranchProducts(false);
        }
    };

    // 4. Fetch Allocations for this branch
    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const res = await axios.get(`/api/admin/allocations?branchId=${branchId}`);
            setAllocations(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load allocations:', err);
        } finally {
            setLoadingAllocations(false);
        }
    };

    useEffect(() => {
        if (branchId) {
            fetchBranch();
            fetchAdminProducts();
            fetchBranchProducts();
            fetchAllocations();
        }
    }, [branchId]);

    // Flatten Admin Catalog into selectable variants with available stock
    const availableAdminVariants = useMemo(() => {
        const rows = [];
        adminProducts.forEach(p => {
            (p.variants || []).forEach(v => {
                const stock = v.stockQuantity ?? 0;
                rows.push({
                    productId: p.id,
                    brandName: p.brandName,
                    modelName: p.modelName,
                    category: p.category || 'General',
                    variantId: v.id,
                    sku: v.sku,
                    color: v.color,
                    shape: v.shape,
                    thicknessMm: v.thicknessMm,
                    acquisitionPrice: v.acquisitionPrice ?? 0,
                    sellingPrice: v.sellingPrice ?? 0,
                    adminStock: stock
                });
            });
        });
        return rows;
    }, [adminProducts]);

    const catalogCategories = useMemo(() => {
        const set = new Set(availableAdminVariants.map(v => v.category));
        return ['All', ...Array.from(set)];
    }, [availableAdminVariants]);

    const filteredCatalogVariants = useMemo(() => {
        return availableAdminVariants.filter(v => {
            const matchesCat = catalogCategory === 'All' || v.category === catalogCategory;
            const q = catalogSearch.toLowerCase();
            const matchesSearch = !q ||
                v.brandName.toLowerCase().includes(q) ||
                v.modelName.toLowerCase().includes(q) ||
                (v.sku && v.sku.toLowerCase().includes(q)) ||
                (v.color && v.color.toLowerCase().includes(q));
            return matchesCat && matchesSearch;
        });
    }, [availableAdminVariants, catalogCategory, catalogSearch]);

    // Manifest helpers
    const addToManifest = (v) => {
        const existing = manifest.find(m => m.variantId === v.variantId);
        if (existing) {
            setManifest(manifest.map(m =>
                m.variantId === v.variantId
                    ? { ...m, quantity: Math.min(v.adminStock, m.quantity + 1) }
                    : m
            ));
        } else {
            setManifest([
                ...manifest,
                {
                    variantId: v.variantId,
                    sku: v.sku,
                    brandName: v.brandName,
                    modelName: v.modelName,
                    maxStock: v.adminStock,
                    quantity: 1,
                    // Default cost per unit: acquisition price or default selling price
                    costPerUnit: v.acquisitionPrice > 0 ? v.acquisitionPrice : v.sellingPrice
                }
            ]);
        }
    };

    const updateManifestItem = (variantId, field, val) => {
        setManifest(manifest.map(m => {
            if (m.variantId === variantId) {
                return { ...m, [field]: val };
            }
            return m;
        }));
    };

    const removeFromManifest = (variantId) => {
        setManifest(manifest.filter(m => m.variantId !== variantId));
    };

    // Multi-Select Helpers
    const toggleSelectVariant = (variantId) => {
        setSelectedVariantIds(prev => {
            const next = new Set(prev);
            if (next.has(variantId)) {
                next.delete(variantId);
            } else {
                next.add(variantId);
            }
            return next;
        });
    };

    const toggleSelectAllVisible = () => {
        const stockable = filteredCatalogVariants.filter(v => v.adminStock > 0);
        const allSelected = stockable.length > 0 && stockable.every(v => selectedVariantIds.has(v.variantId));
        if (allSelected) {
            setSelectedVariantIds(prev => {
                const next = new Set(prev);
                stockable.forEach(v => next.delete(v.variantId));
                return next;
            });
        } else {
            setSelectedVariantIds(prev => {
                const next = new Set(prev);
                stockable.forEach(v => next.add(v.variantId));
                return next;
            });
        }
    };

    // Bulk Add Selected Variants to Manifest at Once
    const addSelectedToManifest = (qtyToAdd = bulkDefaultQty) => {
        const qty = Math.max(1, parseInt(qtyToAdd, 10) || 1);
        const variantsToAdd = availableAdminVariants.filter(
            v => selectedVariantIds.has(v.variantId) && v.adminStock > 0
        );

        if (variantsToAdd.length === 0) {
            showFeedback('error', 'Please select at least one in-stock product from the catalog.');
            return;
        }

        setManifest(prev => {
            const next = [...prev];
            variantsToAdd.forEach(v => {
                const existingIdx = next.findIndex(m => m.variantId === v.variantId);
                const targetQty = Math.min(v.adminStock, qty);
                const defaultCost = v.acquisitionPrice > 0 ? v.acquisitionPrice : v.sellingPrice;

                if (existingIdx >= 0) {
                    next[existingIdx] = {
                        ...next[existingIdx],
                        quantity: Math.min(v.adminStock, next[existingIdx].quantity + targetQty)
                    };
                } else {
                    next.push({
                        variantId: v.variantId,
                        sku: v.sku,
                        brandName: v.brandName,
                        modelName: v.modelName,
                        maxStock: v.adminStock,
                        quantity: targetQty,
                        costPerUnit: defaultCost
                    });
                }
            });
            return next;
        });

        showFeedback('success', `Added ${variantsToAdd.length} products to allocation manifest.`);
        setSelectedVariantIds(new Set());
    };

    // Bulk Manifest Actions
    const applyBulkQtyToManifest = (val) => {
        setManifest(prev => prev.map(m => {
            if (val === 'max') {
                return { ...m, quantity: m.maxStock };
            }
            const num = Math.min(m.maxStock, Math.max(1, parseInt(val, 10) || 1));
            return { ...m, quantity: num };
        }));
    };

    const applyBulkPricingToManifest = (type) => {
        setManifest(prev => prev.map(m => {
            const v = availableAdminVariants.find(x => x.variantId === m.variantId);
            if (!v) return m;
            if (type === 'acquisition') {
                return { ...m, costPerUnit: v.acquisitionPrice > 0 ? v.acquisitionPrice : m.costPerUnit };
            } else if (type === 'retail') {
                return { ...m, costPerUnit: v.sellingPrice > 0 ? v.sellingPrice : m.costPerUnit };
            }
            return m;
        }));
    };

    const clearManifest = () => {
        if (manifest.length === 0) return;
        if (window.confirm('Clear all items from allocation manifest?')) {
            setManifest([]);
        }
    };

    // Deadline Presets
    const setDeadlinePreset = (daysFromNow) => {
        const d = new Date();
        d.setDate(d.getDate() + daysFromNow);
        setAllocationDeadline(d.toISOString().split('T')[0]);
    };

    const setDeadlineEndOfMonth = () => {
        const d = new Date();
        const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        setAllocationDeadline(endOfMonth.toISOString().split('T')[0]);
    };

    const manifestTotalUnits = useMemo(() => {
        return manifest.reduce((acc, m) => acc + (parseInt(m.quantity, 10) || 0), 0);
    }, [manifest]);

    const manifestTotalCost = useMemo(() => {
        return manifest.reduce((acc, m) => {
            const q = parseInt(m.quantity, 10) || 0;
            const c = parseFloat(m.costPerUnit) || 0;
            return acc + (q * c);
        }, 0);
    }, [manifest]);

    // Handle Stock Allocation submission
    const handleAllocateSubmit = async () => {
        if (manifest.length === 0) {
            showFeedback('error', 'Allocation manifest is empty.');
            return;
        }
        if (!allocationDeadline) {
            showFeedback('error', 'Please choose a payment deadline.');
            return;
        }

        // Validate items
        for (const item of manifest) {
            const qty = parseInt(item.quantity, 10);
            if (isNaN(qty) || qty <= 0) {
                showFeedback('error', `Invalid quantity for SKU: ${item.sku}`);
                return;
            }
            if (qty > item.maxStock) {
                showFeedback('error', `Requested ${qty} for ${item.sku} exceeds admin inventory (${item.maxStock})`);
                return;
            }
            const cost = parseFloat(item.costPerUnit);
            if (isNaN(cost) || cost < 0) {
                showFeedback('error', `Invalid cost per unit for SKU: ${item.sku}`);
                return;
            }
        }

        setAllocating(true);
        try {
            const payload = {
                branchId: parseInt(branchId, 10),
                deadline: allocationDeadline,
                notes: allocationNotes.trim(),
                items: manifest.map(m => ({
                    variantId: m.variantId,
                    quantity: parseInt(m.quantity, 10),
                    costPerUnit: parseFloat(m.costPerUnit)
                }))
            };

            await axios.post('/api/admin/allocations', payload);
            showFeedback('success', `Successfully allocated ${manifestTotalUnits} units to ${branch?.name}!`);
            setManifest([]);
            setAllocationNotes('');
            setConfirmModalOpen(false);
            // Refresh data
            fetchBranch();
            fetchAdminProducts();
            fetchBranchProducts();
            fetchAllocations();
            setActiveTab('dues');
        } catch (err) {
            console.error('Allocation failed:', err);
            showFeedback('error', err.response?.data?.error || 'Failed to allocate stock to branch.');
        } finally {
            setAllocating(false);
        }
    };

    // Open Payment Record Modal
    const openPaymentModal = (alloc) => {
        setSelectedAllocation(alloc);
        const rem = parseFloat(alloc.totalCost || 0) - parseFloat(alloc.amountPaid || 0);
        setPaymentAmount(rem > 0 ? rem.toString() : '');
        setPaymentModalOpen(true);
    };

    // Submit Payment Record
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedAllocation) return;

        const amt = parseFloat(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            showFeedback('error', 'Please enter a valid positive payment amount.');
            return;
        }

        setRecordingPayment(true);
        try {
            await axios.put(`/api/admin/allocations/${selectedAllocation.id}/payment`, {
                amount: amt
            });
            showFeedback('success', `Payment of ${formatCurrency(amt)} recorded.`);
            setPaymentModalOpen(false);
            fetchAllocations();
            fetchBranch();
        } catch (err) {
            console.error('Failed to record payment:', err);
            showFeedback('error', err.response?.data?.error || 'Failed to record payment.');
        } finally {
            setRecordingPayment(false);
        }
    };

    // Dues statistics for this branch
    const duesStats = useMemo(() => {
        let totalCost = 0;
        let totalPaid = 0;
        let overdueCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allocations.forEach(a => {
            const cost = parseFloat(a.totalCost || 0);
            const paid = parseFloat(a.amountPaid || 0);
            totalCost += cost;
            totalPaid += paid;

            const rem = cost - paid;
            if (rem > 0 && a.deadline) {
                const dl = new Date(a.deadline);
                dl.setHours(0, 0, 0, 0);
                if (dl < today) overdueCount++;
            }
        });

        return {
            totalCost,
            totalPaid,
            outstanding: Math.max(0, totalCost - totalPaid),
            overdueCount
        };
    }, [allocations]);

    if (loadingBranch) {
        return (
            <div className="h-96 flex flex-col items-center justify-center gap-3 text-stone-400">
                <Loader2 className="w-8 h-8 animate-spin text-stone-600" />
                <span className="text-sm font-semibold">Loading branch details...</span>
            </div>
        );
    }

    if (!branch) {
        return (
            <div className="p-12 text-center text-stone-500">
                <Building2 className="w-12 h-12 mx-auto mb-3 text-stone-400" />
                <h3 className="text-lg font-bold text-stone-800">Branch Not Found</h3>
                <button
                    onClick={() => navigate('/branches')}
                    className="mt-4 px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold"
                >
                    Back to Branches
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            {/* Top Navigation & Branch Title */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/branches')}
                    className="p-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-all shadow-sm cursor-pointer"
                >
                    <ArrowLeft size={16} />
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Branch Management</span>
                        <ChevronRight size={12} className="text-stone-300" />
                        <span className="text-xs font-bold text-stone-600">{branch.name}</span>
                    </div>
                    <h2 className="text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2.5 mt-0.5">
                        <Building2 size={24} className="text-stone-700" />
                        {branch.name}
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                            branch.active
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-stone-200 text-stone-600'
                        }`}>
                            {branch.active ? 'Active' : 'Inactive'}
                        </span>
                    </h2>
                </div>
            </div>

            {/* Notification alert */}
            {feedback.message && (
                <div className={`p-4 rounded-2xl text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shadow-sm ${
                    feedback.type === 'error'
                        ? 'bg-rose-50 border border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                }`}>
                    {feedback.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{feedback.message}</span>
                </div>
            )}

            {/* Branch Header Overview Banner */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden border border-stone-800">
                <div className="absolute right-0 top-0 w-96 h-full bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2 space-y-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Branch Profile</span>
                        <h3 className="text-2xl font-black text-white">{branch.name}</h3>
                        <div className="space-y-1 text-xs text-stone-300">
                            {branch.address && (
                                <div className="flex items-center gap-2">
                                    <MapPin size={13} className="text-stone-400 shrink-0" />
                                    <span>{branch.address}</span>
                                </div>
                            )}
                            {branch.contactInfo && (
                                <div className="flex items-center gap-2">
                                    <Phone size={13} className="text-stone-400 shrink-0" />
                                    <span>{branch.contactInfo}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-700/80 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Current Stock Units</span>
                        <div className="text-2xl font-black text-white mt-1">
                            {branch.totalStockUnits ?? 0}
                        </div>
                        <span className="text-[11px] text-stone-400 font-medium">Available on site</span>
                    </div>

                    <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-700/80 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Total Dues to Admin</span>
                        <div className="text-2xl font-black text-amber-300 mt-1">
                            {formatCurrency(duesStats.outstanding)}
                        </div>
                        <span className="text-[11px] text-stone-400 font-medium">
                            {duesStats.overdueCount > 0 ? (
                                <span className="text-rose-400 font-bold">{duesStats.overdueCount} overdue batch(es)</span>
                            ) : (
                                'No overdue invoices'
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
                {[
                    { id: 'overview', label: 'Overview', icon: Building2 },
                    { id: 'allocate', label: 'Allocate Stock', icon: PackagePlus, highlight: true },
                    { id: 'dues', label: `Dues & Payments (${allocations.length})`, icon: CreditCard },
                    { id: 'inventory', label: 'Inventory Tracker', icon: Boxes },
                ].map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                isActive
                                    ? 'bg-stone-900 text-white shadow-sm'
                                    : tab.highlight
                                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                                    : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                            }`}
                        >
                            <Icon size={14} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">In-Stock Units</span>
                            <div className="text-2xl font-black text-stone-900 mt-1">
                                {branch.totalStockUnits ?? 0}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Paddles & Accessories</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">Today's Sales</span>
                            <div className="text-2xl font-black text-emerald-600 mt-1">
                                {formatCurrency(branch.todayRevenue)}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Recorded at POS</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">All-Time Revenue</span>
                            <div className="text-2xl font-black text-stone-900 mt-1">
                                {formatCurrency(branch.totalRevenue)}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Gross branch sales</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">Outstanding Dues</span>
                            <div className="text-2xl font-black text-amber-600 mt-1">
                                {formatCurrency(duesStats.outstanding)}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Owed for stock transfers</span>
                        </div>
                    </div>

                    {/* Quick Action Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div
                            onClick={() => handleTabChange('allocate')}
                            className="bg-white rounded-2xl p-6 border border-emerald-200 hover:border-emerald-400 shadow-sm transition-all cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                <PackagePlus size={20} />
                            </div>
                            <h4 className="font-black text-stone-900 text-lg">Allocate Stock to this Branch</h4>
                            <p className="text-xs text-stone-500 mt-1">
                                Select multiple paddles & items from master inventory at once, assign unit costs, and set a payment deadline.
                            </p>
                            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                                Open Allocation Manifest <ArrowUpRight size={14} />
                            </div>
                        </div>

                        <div
                            onClick={() => handleTabChange('dues')}
                            className="bg-white rounded-2xl p-6 border border-amber-200 hover:border-amber-400 shadow-sm transition-all cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                <CreditCard size={20} />
                            </div>
                            <h4 className="font-black text-stone-900 text-lg">Manage Dues & Record Payments</h4>
                            <p className="text-xs text-stone-500 mt-1">
                                View past allocations, track overdue deadlines, and record remittance from this branch.
                            </p>
                            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-amber-700">
                                View Payment Records <ArrowUpRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ALLOCATE STOCK (MULTI-PRODUCT SUPPORT) */}
            {activeTab === 'allocate' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left: Master Catalog Selection (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        {/* Search & Categories */}
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
                            <div className="relative w-full md:w-80">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    value={catalogSearch}
                                    onChange={(e) => setCatalogSearch(e.target.value)}
                                    placeholder="Search admin products or SKUs..."
                                    className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 custom-scrollbar">
                                {catalogCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCatalogCategory(cat)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                            catalogCategory === cat
                                                ? 'bg-stone-900 text-white'
                                                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sticky Batch Multi-Select Action Bar */}
                        {selectedVariantIds.size > 0 && (
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-3.5 shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center font-black text-xs">
                                        {selectedVariantIds.size}
                                    </div>
                                    <div>
                                        <div className="font-black text-xs">
                                            {selectedVariantIds.size} {selectedVariantIds.size === 1 ? 'Product' : 'Products'} Selected
                                        </div>
                                        <div className="text-[10px] text-emerald-100">
                                            Ready to allocate simultaneously
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-2.5 py-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Qty each:</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={bulkDefaultQty}
                                            onChange={(e) => setBulkDefaultQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                            className="w-12 text-center text-xs font-black text-white bg-white/20 rounded py-0.5 focus:outline-none focus:bg-white focus:text-stone-900"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => addSelectedToManifest(bulkDefaultQty)}
                                        className="px-3.5 py-1.5 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                    >
                                        <Plus size={14} />
                                        <span>Add Selected ({selectedVariantIds.size})</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedVariantIds(new Set())}
                                        className="px-2.5 py-1.5 text-emerald-100 hover:text-white text-xs font-bold transition-all cursor-pointer"
                                    >
                                        Deselect
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Master Catalog List with Checkboxes */}
                        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-stone-100 bg-stone-50/70 flex items-center justify-between">
                                <label className="flex items-center gap-2.5 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            filteredCatalogVariants.filter(v => v.adminStock > 0).length > 0 &&
                                            filteredCatalogVariants.filter(v => v.adminStock > 0).every(v => selectedVariantIds.has(v.variantId))
                                        }
                                        onChange={toggleSelectAllVisible}
                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-black uppercase tracking-wider text-stone-700">
                                        Master Catalog ({filteredCatalogVariants.length})
                                    </span>
                                </label>
                                <span className="text-[11px] text-stone-400 font-medium">
                                    Check boxes for multi-product allocation or click (+)
                                </span>
                            </div>

                            <div className="divide-y divide-stone-100 max-h-[550px] overflow-y-auto custom-scrollbar">
                                {filteredCatalogVariants.length === 0 ? (
                                    <div className="p-12 text-center text-xs text-stone-400">
                                        No matching variants in master catalog.
                                    </div>
                                ) : (
                                    filteredCatalogVariants.map(v => {
                                        const isInManifest = manifest.some(m => m.variantId === v.variantId);
                                        const isSelected = selectedVariantIds.has(v.variantId);
                                        const hasStock = v.adminStock > 0;

                                        return (
                                            <div
                                                key={v.variantId}
                                                className={`p-3.5 flex items-center justify-between transition-colors ${
                                                    !hasStock
                                                        ? 'opacity-40 bg-stone-50/50'
                                                        : isSelected
                                                        ? 'bg-emerald-50/60'
                                                        : 'hover:bg-stone-50/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        disabled={!hasStock}
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectVariant(v.variantId)}
                                                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                                                    />

                                                    <div className="space-y-0.5">
                                                        <div className="font-black text-stone-900 text-xs">{v.modelName}</div>
                                                        <div className="text-[11px] text-stone-500 font-semibold">{v.brandName} • {v.category}</div>
                                                        <div className="flex items-center gap-2 text-[10px] text-stone-400 font-mono">
                                                            <span>{v.sku}</span>
                                                            {v.color && <span>• {v.color}</span>}
                                                            {v.thicknessMm && <span>• {v.thicknessMm}mm</span>}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="text-xs font-black text-stone-900">
                                                            {v.adminStock} in stock
                                                        </div>
                                                        <div className="text-[10px] text-stone-400 font-semibold">
                                                            Cost: {formatCurrency(v.acquisitionPrice || v.sellingPrice)}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => addToManifest(v)}
                                                        disabled={!hasStock}
                                                        title={isInManifest ? 'Already in manifest (click to add 1 more)' : 'Add 1 to manifest'}
                                                        className={`p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                            !hasStock
                                                                ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                                                : isInManifest
                                                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                                : 'bg-stone-900 text-white hover:bg-stone-800'
                                                        }`}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Allocation Manifest (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                                <div>
                                    <h4 className="font-black text-stone-900 text-sm">Allocation Manifest</h4>
                                    <p className="text-[11px] text-stone-400">Multiple items dispatched together to {branch.name}</p>
                                </div>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-100">
                                    {manifest.length} {manifest.length === 1 ? 'item' : 'items'}
                                </span>
                            </div>

                            {/* Batch Actions Toolbar for Manifest */}
                            {manifest.length > 0 && (
                                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1">
                                            <Layers size={11} className="text-emerald-600" />
                                            Batch Manifest Tools
                                        </span>
                                        <button
                                            type="button"
                                            onClick={clearManifest}
                                            className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer"
                                        >
                                            <Trash2 size={11} /> Clear All
                                        </button>
                                    </div>

                                    {/* Set All Quantities */}
                                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="text-[10px] font-bold text-stone-400">Qty for all:</span>
                                        {[1, 2, 5, 10].map(q => (
                                            <button
                                                key={q}
                                                type="button"
                                                onClick={() => applyBulkQtyToManifest(q)}
                                                className="px-2 py-0.5 bg-white border border-stone-200 hover:border-stone-400 rounded-md text-[11px] font-black text-stone-700 shadow-xs cursor-pointer"
                                            >
                                                {q}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => applyBulkQtyToManifest('max')}
                                            className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md text-[10px] font-black text-emerald-800 shadow-xs cursor-pointer"
                                        >
                                            Max Available
                                        </button>
                                    </div>

                                    {/* Set All Cost */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-stone-200/60 text-xs">
                                        <span className="text-[10px] font-bold text-stone-400">Apply unit cost:</span>
                                        <button
                                            type="button"
                                            onClick={() => applyBulkPricingToManifest('acquisition')}
                                            className="px-2 py-0.5 bg-white border border-stone-200 hover:border-stone-400 rounded-md text-[10px] font-bold text-stone-700 shadow-xs cursor-pointer"
                                        >
                                            Acquisition Cost
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyBulkPricingToManifest('retail')}
                                            className="px-2 py-0.5 bg-white border border-stone-200 hover:border-stone-400 rounded-md text-[10px] font-bold text-stone-700 shadow-xs cursor-pointer"
                                        >
                                            Retail Price
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Manifest Items List */}
                            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                                {manifest.length === 0 ? (
                                    <div className="p-8 text-center text-stone-400 border border-dashed border-stone-200 rounded-xl">
                                        <PackagePlus size={24} className="mx-auto mb-2 opacity-30" />
                                        <p className="text-xs font-bold text-stone-600">Manifest is empty</p>
                                        <p className="text-[11px] text-stone-400 mt-0.5">Select multiple products from the master catalog to allocate at once</p>
                                    </div>
                                ) : (
                                    manifest.map(item => (
                                        <div key={item.variantId} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-black text-stone-900 text-xs">{item.modelName}</div>
                                                    <div className="text-[10px] font-mono text-stone-500">{item.sku}</div>
                                                </div>
                                                <button
                                                    onClick={() => removeFromManifest(item.variantId)}
                                                    className="text-stone-400 hover:text-rose-600 p-1 rounded transition-colors"
                                                    title="Remove item"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-200/60">
                                                {/* Quantity */}
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                                                        Qty (Max: {item.maxStock})
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max={item.maxStock}
                                                        value={item.quantity}
                                                        onChange={(e) => updateManifestItem(item.variantId, 'quantity', e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-stone-300 bg-white"
                                                    />
                                                </div>

                                                {/* Cost Per Unit to Charge Branch */}
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase text-stone-500 block mb-1">
                                                        Cost/Unit (₱)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={item.costPerUnit}
                                                        onChange={(e) => updateManifestItem(item.variantId, 'costPerUnit', e.target.value)}
                                                        className="w-full px-2.5 py-1.5 text-xs font-black rounded-lg border border-stone-300 bg-white"
                                                    />
                                                </div>
                                            </div>

                                            <div className="text-right text-[11px] font-bold text-stone-600">
                                                Subtotal: {formatCurrency((parseInt(item.quantity, 10) || 0) * (parseFloat(item.costPerUnit) || 0))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Terms: Deadline Presets & Notes */}
                            <div className="pt-3 border-t border-stone-100 space-y-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                                            <Calendar size={13} className="text-stone-500" />
                                            Payment Deadline Date *
                                        </label>
                                        <span className="text-[10px] font-bold text-stone-400">Quick Presets:</span>
                                    </div>

                                    {/* Presets */}
                                    <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 custom-scrollbar">
                                        {[
                                            { label: '+7d', days: 7 },
                                            { label: '+14d', days: 14 },
                                            { label: '+30d', days: 30 },
                                            { label: '+60d', days: 60 }
                                        ].map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setDeadlinePreset(preset.days)}
                                                className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-black transition-all cursor-pointer shrink-0"
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={setDeadlineEndOfMonth}
                                            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-black transition-all cursor-pointer shrink-0"
                                        >
                                            End of Month
                                        </button>
                                    </div>

                                    <input
                                        type="date"
                                        value={allocationDeadline}
                                        onChange={(e) => setAllocationDeadline(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-black text-stone-800 block mb-1">
                                        Admin Dispatch Notes (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Batch restock, new season shipment..."
                                        value={allocationNotes}
                                        onChange={(e) => setAllocationNotes(e.target.value)}
                                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none"
                                    />
                                </div>
                            </div>

                            {/* Summary & Submit */}
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1.5">
                                <div className="flex justify-between text-xs text-stone-500 font-semibold">
                                    <span>Total Units to Dispatch:</span>
                                    <span className="font-black text-stone-900">{manifestTotalUnits} units</span>
                                </div>
                                <div className="flex justify-between text-sm font-black text-stone-900 pt-1 border-t border-stone-200">
                                    <span>Total Amount to Charge:</span>
                                    <span className="text-emerald-700">{formatCurrency(manifestTotalCost)}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setConfirmModalOpen(true)}
                                disabled={manifest.length === 0 || allocating}
                                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                                    manifest.length === 0
                                        ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                            >
                                <PackagePlus size={16} />
                                Review & Confirm Stock Transfer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: DUES & PAYMENTS */}
            {activeTab === 'dues' && (
                <div className="space-y-6">
                    {/* Summary Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl p-4 border border-stone-200">
                            <span className="text-[10px] font-black uppercase text-stone-400 block">Total Dispatched</span>
                            <div className="text-xl font-black text-stone-900 mt-1">{formatCurrency(duesStats.totalCost)}</div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-stone-200">
                            <span className="text-[10px] font-black uppercase text-emerald-600 block">Total Remitted</span>
                            <div className="text-xl font-black text-emerald-600 mt-1">{formatCurrency(duesStats.totalPaid)}</div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-stone-200">
                            <span className="text-[10px] font-black uppercase text-amber-600 block">Balance Owed</span>
                            <div className="text-xl font-black text-amber-600 mt-1">{formatCurrency(duesStats.outstanding)}</div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-stone-200">
                            <span className="text-[10px] font-black uppercase text-rose-600 block">Overdue Batches</span>
                            <div className="text-xl font-black text-rose-600 mt-1">{duesStats.overdueCount}</div>
                        </div>
                    </div>

                    {/* Allocations Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                            <h4 className="font-black text-stone-900 text-sm">Stock Allocation & Payment Records</h4>
                            <span className="text-xs text-stone-400">{allocations.length} total records</span>
                        </div>

                        {allocations.length === 0 ? (
                            <div className="p-16 text-center text-stone-400 text-xs">
                                No stock allocations have been made to this branch yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                        <tr>
                                            <th className="py-3 px-4">Allocated Product</th>
                                            <th className="py-3 px-4">Qty</th>
                                            <th className="py-3 px-4">Cost / Unit</th>
                                            <th className="py-3 px-4">Total Billed</th>
                                            <th className="py-3 px-4">Paid / Balance</th>
                                            <th className="py-3 px-4">Deadline</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {allocations.map(a => {
                                            const totalCost = parseFloat(a.totalCost || 0);
                                            const amountPaid = parseFloat(a.amountPaid || 0);
                                            const remaining = Math.max(0, totalCost - amountPaid);
                                            const isPaid = amountPaid >= totalCost && totalCost > 0;

                                            return (
                                                <tr key={a.id} className="hover:bg-stone-50/70 transition-colors">
                                                    <td className="py-3 px-4">
                                                        <div className="font-black text-stone-900 text-xs">{a.modelName}</div>
                                                        <div className="text-[11px] font-mono text-stone-400">{a.sku}</div>
                                                        {a.notes && <div className="text-[10px] text-stone-400 italic">"{a.notes}"</div>}
                                                    </td>

                                                    <td className="py-3 px-4 font-bold text-stone-900 text-xs">
                                                        {a.quantity}
                                                    </td>

                                                    <td className="py-3 px-4 font-semibold text-stone-700 text-xs">
                                                        {formatCurrency(a.costPerUnit)}
                                                    </td>

                                                    <td className="py-3 px-4 font-black text-stone-900 text-xs">
                                                        {formatCurrency(totalCost)}
                                                    </td>

                                                    <td className="py-3 px-4 text-xs">
                                                        <span className="font-black text-stone-900">{formatCurrency(amountPaid)}</span>
                                                        {remaining > 0 && (
                                                            <div className="text-[10px] text-rose-600 font-bold">
                                                                Due: {formatCurrency(remaining)}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-4 text-xs font-semibold text-stone-700">
                                                        {a.deadline || '—'}
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            isPaid
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : a.status === 'PARTIAL'
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-stone-100 text-stone-700'
                                                        }`}>
                                                            {isPaid ? 'Settled' : a.status}
                                                        </span>
                                                    </td>

                                                    <td className="py-3 px-4 text-right">
                                                        {!isPaid && (
                                                            <button
                                                                onClick={() => openPaymentModal(a)}
                                                                className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
                                                            >
                                                                Record Payment
                                                            </button>
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
            )}

            {/* TAB 4: INVENTORY TRACKER */}
            {activeTab === 'inventory' && (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                    <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                        <div>
                            <h4 className="font-black text-stone-900 text-sm">Branch Inventory Tracker</h4>
                            <p className="text-xs text-stone-400 mt-0.5">Live stock currently held at {branch.name}</p>
                        </div>
                        <span className="text-xs font-bold text-stone-600">
                            {branchProducts.reduce((acc, p) => acc + (p.variants || []).reduce((sum, v) => sum + (v.stockQuantity ?? 0), 0), 0)} Total Units
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                <tr>
                                    <th className="py-3.5 px-6">Product & Model</th>
                                    <th className="py-3.5 px-4">SKU / Specs</th>
                                    <th className="py-3.5 px-4">In Stock Units</th>
                                    <th className="py-3.5 px-4">Default Admin Price</th>
                                    <th className="py-3.5 px-6">Branch Selling Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {branchProducts.flatMap(p =>
                                    (p.variants || []).map(v => (
                                        <tr key={v.id} className="hover:bg-stone-50/70 transition-colors">
                                            <td className="py-3.5 px-6">
                                                <div className="font-black text-stone-900 text-xs">{p.modelName}</div>
                                                <div className="text-[11px] text-stone-400 font-semibold">{p.brandName} • {p.category}</div>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <span className="font-mono text-xs font-semibold text-stone-600">{v.sku}</span>
                                                <div className="text-[11px] text-stone-400">
                                                    {v.color || ''} {v.thicknessMm ? `• ${v.thicknessMm}mm` : ''}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                                                    (v.stockQuantity ?? 0) > 5
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : (v.stockQuantity ?? 0) > 0
                                                        ? 'bg-amber-50 text-amber-700'
                                                        : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                    <Boxes size={12} />
                                                    {v.stockQuantity ?? 0} units
                                                </span>
                                            </td>

                                            <td className="py-3.5 px-4 font-semibold text-stone-500 text-xs">
                                                {formatCurrency(v.sellingPrice)}
                                            </td>

                                            <td className="py-3.5 px-6 font-black text-stone-900 text-xs">
                                                {v.hasCustomPrice ? (
                                                    <div className="flex items-center gap-1.5 text-emerald-700">
                                                        <span>{formatCurrency(v.branchSellingPrice)}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase bg-emerald-100 font-black">
                                                            Custom
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-stone-700">{formatCurrency(v.sellingPrice)}</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* CONFIRMATION MODAL FOR STOCK ALLOCATION */}
            {confirmModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                            <div>
                                <h3 className="font-black text-lg text-stone-900">Confirm Stock Allocation</h3>
                                <p className="text-xs text-stone-400 mt-0.5">Deduct from Admin → Transfer to {branch.name}</p>
                            </div>
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-stone-500 font-semibold">Total Transfer Quantity:</span>
                                <span className="font-black text-stone-900">{manifestTotalUnits} units</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-500 font-semibold">Total Amount Charged to Branch:</span>
                                <span className="font-black text-emerald-700 text-sm">{formatCurrency(manifestTotalCost)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-500 font-semibold">Settlement Deadline:</span>
                                <span className="font-black text-stone-900">{allocationDeadline}</span>
                            </div>
                            {allocationNotes && (
                                <div className="pt-2 border-t border-stone-200 text-stone-600 italic">
                                    Notes: "{allocationNotes}"
                                </div>
                            )}
                        </div>

                        <p className="text-[11px] text-stone-500">
                            By proceeding, {manifestTotalUnits} units will immediately be deducted from the main inventory and added to {branch.name}'s inventory. A due record will be created.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-3">
                            <button
                                onClick={() => setConfirmModalOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAllocateSubmit}
                                disabled={allocating}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                {allocating ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>{allocating ? 'Allocating...' : 'Confirm Dispatch'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECORD PAYMENT MODAL */}
            {paymentModalOpen && selectedAllocation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                            <div>
                                <h3 className="font-black text-lg text-stone-900">Record Branch Payment</h3>
                                <p className="text-xs text-stone-400 mt-0.5">{selectedAllocation.modelName} ({selectedAllocation.sku})</p>
                            </div>
                            <button
                                onClick={() => setPaymentModalOpen(false)}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Total Billed:</span>
                                    <span className="font-black text-stone-900">{formatCurrency(selectedAllocation.totalCost)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Already Paid:</span>
                                    <span className="font-bold text-emerald-700">{formatCurrency(selectedAllocation.amountPaid)}</span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-stone-200">
                                    <span className="text-stone-500">Remaining Balance:</span>
                                    <span className="font-black text-rose-600">
                                        {formatCurrency(Math.max(0, parseFloat(selectedAllocation.totalCost || 0) - parseFloat(selectedAllocation.amountPaid || 0)))}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-stone-700 mb-1.5">
                                    Payment Amount to Record (₱) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={Math.max(0, parseFloat(selectedAllocation.totalCost || 0) - parseFloat(selectedAllocation.amountPaid || 0))}
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    placeholder="Enter remittance amount"
                                    className="w-full px-3 py-2.5 text-sm font-black rounded-xl border border-stone-300 focus:outline-none focus:border-stone-500 bg-stone-50"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setPaymentModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={recordingPayment}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                                >
                                    {recordingPayment ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                    <span>{recordingPayment ? 'Saving...' : 'Confirm Payment'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BranchDetail;
