import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Package, X, Search, Building2, Boxes, Coins, AlertTriangle, PackageX, Tag, Store,
    RefreshCw, Send, PackagePlus, CheckCircle2, Plus, Trash2, Layers, Check, ChevronDown,
    ArrowRight, AlertCircle, ShoppingCart, Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

const Inventory = ({ products = [], loading = false, refetchProducts }) => {
    const { user, isBranch, isAdmin, isCashier, currentBranchId } = useAuth();
    const navigate = useNavigate();

    // ─── ACTIVE TAB: 'stock' | 'direct-add' | 'tagging' ──────────────────────
    const [activeTab, setActiveTab] = useState('stock');

    // ─── COMMON DATA: SUPPLIERS & BRANCHES ───────────────────────────────────
    const [suppliers, setSuppliers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loadingCommon, setLoadingCommon] = useState(false);

    useEffect(() => {
        setLoadingCommon(true);
        Promise.all([
            axios.get('/api/suppliers').catch(() => ({ data: [] })),
            axios.get('/api/branches').catch(() => ({ data: [] }))
        ]).then(([supRes, brRes]) => {
            setSuppliers(Array.isArray(supRes.data) ? supRes.data : []);
            setBranches(Array.isArray(brRes.data) ? brRes.data.filter(b => b.active) : []);
        }).finally(() => setLoadingCommon(false));
    }, []);

    // ─── TAB 1: CURRENT STOCK STATE & LOGIC ──────────────────────────────────
    const [displayedCount, setDisplayedCount] = useState(15);
    const tableContainerRef = useRef(null);

    const [tableFilter, setTableFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('name-asc');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [stockFilter, setStockFilter] = useState('all'); // all | low | out
    const [sourceFilter, setSourceFilter] = useState('all'); // all | allocated | direct

    const flattenedInventory = useMemo(() => {
        return products.flatMap(product =>
            (product.variants || []).map(variant => {
                const isPaddle = product.category === 'Paddles';
                const isShoe = product.category === 'Shoes';
                const qty = variant.stockQuantity ?? 0;
                const threshold = variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
                const mainStock = variant.mainStock != null ? variant.mainStock : qty;
                const branchStock = variant.branchStock || 0;
                const locationBreakdown = variant.locationBreakdown || [];

                return {
                    variantId: variant.id,
                    sku: variant.sku,
                    brand: product.brandName,
                    name: product.modelName,
                    color: (variant.color === 'N/A' || !variant.color) ? '-' : variant.color,
                    variantDetails: isPaddle
                        ? `${variant.thicknessMm || 0}mm ${variant.shape || ''}`
                        : isShoe
                            ? `Size ${variant.shape || '-'}`
                            : '-',
                    quantity: qty,
                    mainStock,
                    branchStock,
                    locationBreakdown,
                    sellingPrice: variant.sellingPrice ?? 0,
                    acquisitionPrice: variant.acquisitionPrice ?? 0,
                    totalAdded: variant.totalAdded || 0,
                    totalSold: variant.totalSold || 0,
                    consigned: variant.consigned,
                    defaultSupplier: variant.defaultSupplier,
                    category: product.category,
                    lowStockThreshold: threshold,
                    isLowStock: qty > 0 && qty <= threshold,
                    isOutOfStock: qty <= 0,
                    dropdownName: isPaddle
                        ? `${product.brandName} ${product.modelName} ${variant.color || ''} ${variant.thicknessMm || 0}mm`
                        : isShoe
                            ? `${product.brandName} ${product.modelName} ${variant.shape || ''}`
                            : `${product.brandName} ${product.modelName}`
                };
            })
        );
    }, [products]);

    const stats = useMemo(() => {
        let totalSkus = flattenedInventory.length;
        let totalUnits = 0;
        let warehouseUnits = 0;
        let branchUnits = 0;
        let value = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let consignedUnits = 0;
        let ownedUnits = 0;

        for (const row of flattenedInventory) {
            totalUnits += row.quantity;
            warehouseUnits += (row.mainStock || 0);
            branchUnits += (row.branchStock || 0);
            value += row.quantity * Number(row.sellingPrice || 0);
            if (row.isOutOfStock) outOfStock++;
            else if (row.isLowStock) lowStock++;
            if (row.consigned) consignedUnits += row.quantity;
            else ownedUnits += row.quantity;
        }
        return { totalSkus, totalUnits, warehouseUnits, branchUnits, value, lowStock, outOfStock, consignedUnits, ownedUnits };
    }, [flattenedInventory]);

    const filteredInventory = useMemo(() => {
        let list = [...flattenedInventory];

        if (categoryFilter !== 'All') {
            list = list.filter(i => i.category === categoryFilter);
        }

        if (sourceFilter === 'allocated') {
            list = list.filter(i => !i.consigned);
        } else if (sourceFilter === 'consigned') {
            list = list.filter(i => i.consigned);
        }

        if (stockFilter === 'low') list = list.filter(i => i.isLowStock);
        else if (stockFilter === 'out') list = list.filter(i => i.isOutOfStock);

        if (tableFilter.trim()) {
            const q = tableFilter.toLowerCase();
            list = list.filter(item =>
                (item.sku || '').toLowerCase().includes(q) ||
                (item.brand || '').toLowerCase().includes(q) ||
                (item.name || '').toLowerCase().includes(q) ||
                (item.dropdownName || '').toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            if (sortOrder === 'stock-asc') return a.quantity - b.quantity;
            if (sortOrder === 'stock-desc') return b.quantity - a.quantity;
            if (sortOrder === 'val-desc') return (b.quantity * b.sellingPrice) - (a.quantity * a.sellingPrice);
            return (a.dropdownName || '').localeCompare(b.dropdownName || '');
        });

        return list;
    }, [flattenedInventory, categoryFilter, sourceFilter, stockFilter, tableFilter, sortOrder]);

    const handleScroll = () => {
        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50 && displayedCount < filteredInventory.length) {
                setDisplayedCount(prev => prev + 15);
            }
        }
    };

    const visibleData = filteredInventory.slice(0, displayedCount);

    // ─── TAB 2: BRANCH DIRECT STOCK FORM STATE ───────────────────────────────
    const effectiveDefaultBranchId = currentBranchId || (branches.length > 0 ? branches[0].id : '');
    const [directBranchId, setDirectBranchId] = useState(effectiveDefaultBranchId);
    const [directSupplierId, setDirectSupplierId] = useState('');
    const [directNotes, setDirectNotes] = useState('');
    const [directSearchQuery, setDirectSearchQuery] = useState('');
    const [directItems, setDirectItems] = useState([]);
    const [submittingDirect, setSubmittingDirect] = useState(false);
    const [directFeedback, setDirectFeedback] = useState(null);

    // Ensure directBranchId updates when branches load
    useEffect(() => {
        if (!directBranchId && (currentBranchId || branches.length > 0)) {
            setDirectBranchId(currentBranchId || branches[0]?.id || '');
        }
    }, [currentBranchId, branches, directBranchId]);

    // Available catalog variants for search & add
    const searchableVariants = useMemo(() => {
        if (!directSearchQuery.trim()) return [];
        const q = directSearchQuery.toLowerCase();
        return flattenedInventory
            .filter(v =>
                (v.dropdownName || '').toLowerCase().includes(q) ||
                (v.sku || '').toLowerCase().includes(q) ||
                (v.brand || '').toLowerCase().includes(q) ||
                (v.name || '').toLowerCase().includes(q)
            )
            .slice(0, 10);
    }, [directSearchQuery, flattenedInventory]);

    const handleAddDirectItem = (variant) => {
        if (directItems.some(i => i.variantId === variant.variantId)) {
            // Increment existing
            setDirectItems(prev => prev.map(i =>
                i.variantId === variant.variantId ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setDirectItems(prev => [
                ...prev,
                {
                    variantId: variant.variantId,
                    displayName: variant.dropdownName,
                    sku: variant.sku,
                    color: variant.color,
                    quantity: 1,
                    acquisitionPrice: variant.acquisitionPrice || 0,
                    sellingPrice: variant.sellingPrice || 0
                }
            ]);
        }
        setDirectSearchQuery('');
    };

    const handleUpdateDirectItem = (variantId, field, val) => {
        setDirectItems(prev => prev.map(item => {
            if (item.variantId !== variantId) return item;
            return { ...item, [field]: val };
        }));
    };

    const handleRemoveDirectItem = (variantId) => {
        setDirectItems(prev => prev.filter(i => i.variantId !== variantId));
    };

    const handleSubmitDirectStock = async (e) => {
        e.preventDefault();
        setDirectFeedback(null);

        // Enforce supplier validation — REQUIRED
        if (!directSupplierId) {
            setDirectFeedback({ type: 'error', message: 'Supplier is required. Please select a supplier for this direct stock batch.' });
            return;
        }

        const targetBr = isAdmin ? directBranchId : (currentBranchId || directBranchId);
        if (!targetBr) {
            setDirectFeedback({ type: 'error', message: 'Please select a target branch.' });
            return;
        }

        if (directItems.length === 0) {
            setDirectFeedback({ type: 'error', message: 'Please add at least one product item to the batch.' });
            return;
        }

        // Validate quantities
        for (const it of directItems) {
            if (!it.quantity || Number(it.quantity) <= 0) {
                setDirectFeedback({ type: 'error', message: `Invalid quantity for ${it.displayName}. Must be greater than 0.` });
                return;
            }
        }

        setSubmittingDirect(true);
        try {
            const payload = {
                branchId: Number(targetBr),
                supplierId: Number(directSupplierId),
                notes: directNotes,
                items: directItems.map(it => ({
                    variantId: it.variantId,
                    quantity: Number(it.quantity),
                    acquisitionPrice: Number(it.acquisitionPrice) || 0,
                    sellingPrice: Number(it.sellingPrice) || 0
                }))
            };

            const res = await axios.post('/api/branch/direct-stock', payload);
            setDirectFeedback({
                type: 'success',
                message: res.data?.message || 'Branch Direct Stock added successfully!'
            });
            setDirectItems([]);
            setDirectNotes('');
            refetchProducts?.();
        } catch (err) {
            setDirectFeedback({
                type: 'error',
                message: err.response?.data?.error || 'Failed to add Branch Direct stock.'
            });
        } finally {
            setSubmittingDirect(false);
        }
    };

    // ─── TAB 3: RETROACTIVE TAGGING STATE & LOGIC ────────────────────────────
    const [tagBranchId, setTagBranchId] = useState(effectiveDefaultBranchId);
    const [tagSourceTypeFilter, setTagSourceTypeFilter] = useState('ALL');
    const [tagSearchQuery, setTagSearchQuery] = useState('');
    const [taggingMode, setTaggingMode] = useState('transactions'); // 'transactions' | 'batches'
    const [taggingList, setTaggingList] = useState([]);
    const [taggingBatches, setTaggingBatches] = useState([]);
    const [loadingTagging, setLoadingTagging] = useState(false);
    const [selectedTxIds, setSelectedTxIds] = useState(new Set());
    const [selectedBatchIds, setSelectedBatchIds] = useState(new Set());
    const [bulkSourceType, setBulkSourceType] = useState('BRANCH_DIRECT');
    const [bulkSupplierId, setBulkSupplierId] = useState('');
    const [bulkBatchUpdateTx, setBulkBatchUpdateTx] = useState(true);
    const [tagFeedback, setTagFeedback] = useState(null);
    const [isTaggingAction, setIsTaggingAction] = useState(false);

    const fetchTaggingData = async () => {
        setLoadingTagging(true);
        setTagFeedback(null);
        try {
            if (taggingMode === 'transactions') {
                const params = new URLSearchParams();
                if (tagBranchId) params.append('branchId', tagBranchId);
                if (tagSourceTypeFilter !== 'ALL') params.append('sourceType', tagSourceTypeFilter);
                if (tagSearchQuery.trim()) params.append('search', tagSearchQuery.trim());
                params.append('limit', '150');
                const res = await axios.get(`/api/branch/direct-stock/transactions-for-tagging?${params.toString()}`);
                setTaggingList(Array.isArray(res.data) ? res.data : []);
                setSelectedTxIds(new Set());
            } else {
                const params = new URLSearchParams();
                if (tagBranchId) params.append('branchId', tagBranchId);
                if (tagSourceTypeFilter !== 'ALL') params.append('sourceType', tagSourceTypeFilter);
                if (tagSearchQuery.trim()) params.append('search', tagSearchQuery.trim());
                params.append('limit', '150');
                const res = await axios.get(`/api/branch/direct-stock/batches?${params.toString()}`);
                setTaggingBatches(Array.isArray(res.data) ? res.data : []);
                setSelectedBatchIds(new Set());
            }
        } catch (err) {
            console.error('Failed to load tagging data:', err);
        } finally {
            setLoadingTagging(false);
        }
    };

    const filteredTaggingList = useMemo(() => {
        if (!tagSearchQuery.trim()) return taggingList;
        const q = tagSearchQuery.toLowerCase().trim();
        return taggingList.filter(t => {
            const orderId = (t.orderId || '').toLowerCase();
            const sku = (t.variant?.sku || '').toLowerCase();
            const name = (t.variant?.name || '').toLowerCase();
            const customer = (t.customerName || '').toLowerCase();
            const supplier = (t.supplier?.name || '').toLowerCase();
            const branch = (t.branch?.name || '').toLowerCase();
            return orderId.includes(q) || sku.includes(q) || name.includes(q) || customer.includes(q) || supplier.includes(q) || branch.includes(q);
        });
    }, [taggingList, tagSearchQuery]);

    const filteredTaggingBatches = useMemo(() => {
        if (!tagSearchQuery.trim()) return taggingBatches;
        const q = tagSearchQuery.toLowerCase().trim();
        return taggingBatches.filter(b => {
            const batchId = (b.batchId || (b.id != null ? String(b.id) : '')).toLowerCase();
            const sku = (b.variant?.sku || '').toLowerCase();
            const name = (b.variant?.name || '').toLowerCase();
            const supplier = (b.supplier?.name || '').toLowerCase();
            const branch = (b.branch?.name || '').toLowerCase();
            return batchId.includes(q) || sku.includes(q) || name.includes(q) || supplier.includes(q) || branch.includes(q);
        });
    }, [taggingBatches, tagSearchQuery]);

    useEffect(() => {
        if (activeTab === 'tagging') {
            fetchTaggingData();
        }
    }, [activeTab, tagBranchId, tagSourceTypeFilter, taggingMode]);

    const handleToggleSelectTx = (id) => {
        setSelectedTxIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllTxs = () => {
        if (selectedTxIds.size === filteredTaggingList.length && filteredTaggingList.length > 0) {
            setSelectedTxIds(new Set());
        } else {
            setSelectedTxIds(new Set(filteredTaggingList.map(t => t.id)));
        }
    };

    const handleApplyBulkTransactionTag = async () => {
        if (selectedTxIds.size === 0) return;
        setIsTaggingAction(true);
        setTagFeedback(null);
        try {
            const res = await axios.post('/api/branch/direct-stock/tag-transactions', {
                transactionIds: Array.from(selectedTxIds),
                sourceType: bulkSourceType,
                supplierId: bulkSupplierId ? Number(bulkSupplierId) : null
            });
            setTagFeedback({ type: 'success', message: res.data?.message || 'Transactions tagged successfully.' });
            fetchTaggingData();
        } catch (err) {
            setTagFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to tag transactions.' });
        } finally {
            setIsTaggingAction(false);
        }
    };

    const handleToggleSelectBatch = (id) => {
        setSelectedBatchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAllBatches = () => {
        if (selectedBatchIds.size === filteredTaggingBatches.length && filteredTaggingBatches.length > 0) {
            setSelectedBatchIds(new Set());
        } else {
            setSelectedBatchIds(new Set(filteredTaggingBatches.map(b => b.id)));
        }
    };

    const handleApplyBulkBatchTag = async () => {
        if (selectedBatchIds.size === 0) return;
        setIsTaggingAction(true);
        setTagFeedback(null);
        try {
            const res = await axios.post('/api/branch/direct-stock/tag-batches', {
                batchIds: Array.from(selectedBatchIds),
                sourceType: bulkSourceType,
                supplierId: bulkSupplierId ? Number(bulkSupplierId) : null,
                updateTransactions: bulkBatchUpdateTx
            });
            setTagFeedback({
                type: 'success',
                message: res.data?.message || `Successfully tagged ${selectedBatchIds.size} batch(es).`
            });
            setSelectedBatchIds(new Set());
            fetchTaggingData();
            refetchProducts?.();
        } catch (err) {
            console.error('Failed to tag batches:', err);
            setTagFeedback({
                type: 'error',
                message: err.response?.data?.error || 'Failed to update batches. Please try again.'
            });
        } finally {
            setIsTaggingAction(false);
        }
    };

    const handleTagSingleBatch = async (batchId, targetSourceType, supId) => {
        setIsTaggingAction(true);
        try {
            await axios.patch(`/api/branch/direct-stock/batches/${batchId}/tag`, {
                sourceType: targetSourceType,
                supplierId: supId ? Number(supId) : null,
                updateTransactions: true
            });
            setTagFeedback({ type: 'success', message: `Batch #${batchId} tagged as ${targetSourceType} and synced.` });
            fetchTaggingData();
            refetchProducts?.();
        } catch (err) {
            setTagFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to tag batch.' });
        } finally {
            setIsTaggingAction(false);
        }
    };

    return (
        <div className="w-full space-y-3 min-w-0">
            {/* Top Navigation Bar: Current Stock vs Branch Direct Stock vs Tagging */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200">
                        <button
                            onClick={() => setActiveTab('stock')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                activeTab === 'stock'
                                    ? 'bg-white text-stone-900 shadow-sm font-black'
                                    : 'text-stone-500 hover:text-stone-800'
                            }`}
                        >
                            <Boxes size={14} className={activeTab === 'stock' ? 'text-indigo-600' : ''} />
                            <span>Stock View</span>
                        </button>

                        {!isCashier && (
                            <button
                                onClick={() => setActiveTab('direct-add')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeTab === 'direct-add'
                                        ? 'bg-emerald-600 text-white shadow-sm font-black'
                                        : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                            >
                                <PackagePlus size={14} />
                                <span>+ Branch Direct Stock</span>
                            </button>
                        )}

                        {!isCashier && (
                            <button
                                onClick={() => setActiveTab('tagging')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    activeTab === 'tagging'
                                        ? 'bg-stone-900 text-white shadow-sm font-black'
                                        : 'text-stone-500 hover:text-stone-800'
                                }`}
                            >
                                <Tag size={14} className={activeTab === 'tagging' ? 'text-amber-400' : ''} />
                                <span>Tag Previous Stock</span>
                            </button>
                        )}
                    </div>

                    <span className="text-xs text-stone-400 font-medium hidden sm:inline">|</span>
                    <span className="text-xs font-bold text-stone-700 hidden sm:inline flex items-center gap-1">
                        <Store size={13} className="text-emerald-600" />
                        {user?.branchName || (isAdmin ? 'Central Admin' : 'Branch Store')}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {isBranch && (
                        <button
                            onClick={() => navigate('/stock-requests?action=new')}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                            title="Request inventory from Master Storage"
                        >
                            <PackagePlus size={13} />
                            <span>Request Stock</span>
                        </button>
                    )}

                    <button
                        onClick={() => refetchProducts && refetchProducts()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh current inventory"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                TAB 1: CURRENT STOCK TABLE VIEW
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'stock' && (
                <div className="space-y-2.5">
                    {/* STATS TILES */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        <StatCard Icon={Boxes} label="Total Units" primary={stats.totalUnits} secondary={`${stats.totalSkus} variant SKUs`} accent="emerald" loading={loading} />
                        <StatCard Icon={Coins} label="Stock Valuation" primary={formatPHP(stats.value)} secondary="at current selling price" accent="zinc" loading={loading} />
                        <StatCard Icon={AlertTriangle} label="Low Stock SKUs" primary={stats.lowStock} secondary="below alert threshold" accent="amber" loading={loading}
                            active={stockFilter === 'low'} onClick={() => { setStockFilter(stockFilter === 'low' ? 'all' : 'low'); setDisplayedCount(15); }} />
                        <StatCard Icon={PackageX} label="Out of Stock" primary={stats.outOfStock} secondary="zero quantity remaining" accent="red" loading={loading}
                            active={stockFilter === 'out'} onClick={() => { setStockFilter(stockFilter === 'out' ? 'all' : 'out'); setDisplayedCount(15); }} />
                        <StatCard Icon={Store} label="Holding Pool" primary={stats.warehouseUnits} secondary="unallocated at Admin" accent="indigo" loading={loading} />
                        <StatCard Icon={Tag} label="Consigned Stock" primary={stats.consignedUnits} secondary="items on consignment" accent="zinc" loading={loading} />
                    </div>

                    {/* CONTROLS BAR: CATEGORIES, SORT, SEARCH */}
                    <div className="bg-white p-2 px-3 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 md:pb-0 no-scrollbar">
                            {/* Source Selector */}
                            <div className="flex items-center p-0.5 bg-stone-100 border border-stone-200 rounded-lg">
                                <button
                                    onClick={() => { setSourceFilter('all'); setDisplayedCount(15); }}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                        sourceFilter === 'all' ? 'bg-white text-stone-900 shadow-xs font-black' : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    All Sources
                                </button>
                                <button
                                    onClick={() => { setSourceFilter('allocated'); setDisplayedCount(15); }}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                        sourceFilter === 'allocated' ? 'bg-emerald-600 text-white shadow-xs font-black' : 'text-emerald-700 hover:bg-emerald-50'
                                    }`}
                                    title="Standard Owned & Master Allocated Items"
                                >
                                    Owned / Master
                                </button>
                                <button
                                    onClick={() => { setSourceFilter('consigned'); setDisplayedCount(15); }}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                        sourceFilter === 'consigned' ? 'bg-amber-600 text-white shadow-xs font-black' : 'text-amber-700 hover:bg-amber-50'
                                    }`}
                                    title="Consigned Stock"
                                >
                                    Consigned
                                </button>
                            </div>

                            <div className="h-4 w-px bg-stone-200 shrink-0" />

                            {/* Category Pills */}
                            <div className="flex items-center gap-1">
                                {['All', 'Paddles', 'Accessories', 'Balls', 'Apparel', 'Shoes', 'Bags'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => { setCategoryFilter(cat); setDisplayedCount(15); }}
                                        className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                            categoryFilter === cat ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <select
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value)}
                                className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-stone-700 focus:outline-none"
                            >
                                <option value="name-asc">Sort: Name (A-Z)</option>
                                <option value="stock-desc">Stock: High to Low</option>
                                <option value="stock-asc">Stock: Low to High</option>
                                <option value="val-desc">Total Value: High to Low</option>
                            </select>

                            <div className="relative w-full md:w-56">
                                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={tableFilter}
                                    onChange={e => { setTableFilter(e.target.value); setDisplayedCount(15); }}
                                    placeholder="Filter by SKU or name..."
                                    className="w-full pl-8 pr-7 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 bg-stone-50"
                                />
                                {tableFilter && (
                                    <button onClick={() => setTableFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* INVENTORY TABLE */}
                    <div
                        ref={tableContainerRef}
                        onScroll={handleScroll}
                        className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-x-auto max-h-[calc(100vh-250px)] relative"
                    >
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-stone-100/80 sticky top-0 z-10 border-b border-stone-200">
                                <tr>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Brand</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Model & SKU</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Color / Spec</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Category</th>
                                    {isAdmin && (
                                        <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Supplier</th>
                                    )}
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px]">Type</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px] text-right">SRP / Retail</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px] text-right">Total Value</th>
                                    <th className="px-3 py-2 font-black text-stone-600 uppercase tracking-wider text-[10px] text-right">Stock Breakdown</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {visibleData.length > 0 ? (
                                    visibleData.map(row => (
                                        <tr key={row.sku} className="hover:bg-stone-50/80 transition-colors">
                                            <td className="px-3 py-2 font-black text-stone-900 whitespace-nowrap">{row.brand}</td>
                                            <td className="px-3 py-2">
                                                <div className="font-bold text-stone-800">{row.name}</div>
                                                <div className="font-mono text-[10px] text-zinc-400">{row.sku}</div>
                                            </td>
                                            <td className="px-3 py-2 text-zinc-600">
                                                <div>{row.color}</div>
                                                {row.variantDetails !== '-' && (
                                                    <div className="text-[10px] text-zinc-400">{row.variantDetails}</div>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">
                                                    {row.category}
                                                </span>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-3 py-2 text-zinc-600 whitespace-nowrap">
                                                    {row.defaultSupplier ? (
                                                        <span className="inline-flex items-center gap-1 font-medium text-[11px] text-zinc-700">
                                                            <Building2 size={10} /> {row.defaultSupplier.name}
                                                        </span>
                                                    ) : <span className="text-zinc-300 text-xs">—</span>}
                                                </td>
                                            )}
                                            <td className="px-3 py-2">
                                                {row.consigned ? (
                                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-200">
                                                        Consigned
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md text-[10px] font-black border border-emerald-200 whitespace-nowrap">
                                                        Owned
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                                                {formatPHP(row.sellingPrice)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-black text-emerald-800 whitespace-nowrap">
                                                {formatPHP((row.sellingPrice || 0) * (row.quantity || 0))}
                                            </td>
                                            <td className="px-3 py-2 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className={`text-xs font-black flex items-center gap-1 ${row.isOutOfStock ? 'text-red-600' : row.isLowStock ? 'text-amber-600' : 'text-zinc-900'}`}>
                                                            {row.isLowStock && !row.isOutOfStock && <AlertTriangle size={12} className="text-amber-500" />}
                                                            {row.isOutOfStock && <PackageX size={12} className="text-red-500" />}
                                                            {row.quantity ?? 0} left
                                                        </span>
                                                        {row.totalSold > 0 && (
                                                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                                                                {row.totalSold} sold
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Location Breakdown */}
                                                    {row.locationBreakdown && row.locationBreakdown.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap justify-end max-w-[280px]">
                                                            {row.locationBreakdown.map((loc, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                                                                        loc.isMain
                                                                            ? 'bg-stone-100 text-stone-700 border border-stone-200'
                                                                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                                    }`}
                                                                    title={`${loc.branchName}: ${loc.quantity} unsold units`}
                                                                >
                                                                    <span>{loc.isMain ? 'Admin' : loc.branchName}:</span>
                                                                    <strong className="font-black">{loc.quantity}</strong>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={isAdmin ? 10 : 9} className="px-6 py-10 text-center text-zinc-500 border-dashed border-t text-xs">
                                            No products match the current filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 2: BRANCH DIRECT STOCK FORM (+ Direct Intake)
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'direct-add' && (
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 md:p-7 space-y-6 max-w-4xl mx-auto">
                    <div>
                        <div className="flex items-center gap-2 text-emerald-700 font-black text-xs uppercase tracking-wider">
                            <PackagePlus size={16} />
                            <span>Direct Branch Procurement</span>
                        </div>
                        <h2 className="text-xl font-black text-stone-900 tracking-tight mt-1">
                            Add Products Directly to Branch
                        </h2>
                        <p className="text-xs text-stone-500 font-medium mt-1">
                            Directly intake inventory from an external supplier into a specific branch without going through Master Admin allocation.
                            Stock becomes available immediately for retail POS at the target branch.
                        </p>
                    </div>

                    {directFeedback && (
                        <div className={`p-4 rounded-xl flex items-center gap-3 ${directFeedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                            {directFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            <span className="text-xs font-bold flex-1">{directFeedback.message}</span>
                            <button onClick={() => setDirectFeedback(null)} className="text-stone-400 hover:text-stone-600"><X size={14} /></button>
                        </div>
                    )}

                    <form onSubmit={handleSubmitDirectStock} className="space-y-6">
                        {/* Target Branch and REQUIRED Supplier Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Branch Selection */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 flex items-center gap-1.5">
                                    <Store size={13} className="text-emerald-600" />
                                    <span>Target Branch <span className="text-red-500">*</span></span>
                                </label>
                                {isAdmin ? (
                                    <select
                                        value={directBranchId}
                                        onChange={e => setDirectBranchId(e.target.value)}
                                        required
                                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                                    >
                                        <option value="">Select Target Branch...</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>📍 {b.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="px-3 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-xs font-black text-stone-800 flex items-center gap-2">
                                        <Store size={13} className="text-emerald-600" />
                                        <span>{user?.branchName || 'Assigned Branch'}</span>
                                    </div>
                                )}
                            </div>

                            {/* Supplier Selection — REQUIRED */}
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Building2 size={13} className="text-indigo-600" />
                                        <span>Product Supplier</span>
                                    </span>
                                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                                        Required *
                                    </span>
                                </label>
                                <select
                                    value={directSupplierId}
                                    onChange={e => setDirectSupplierId(e.target.value)}
                                    required
                                    className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 ${
                                        !directSupplierId
                                            ? 'bg-amber-50/60 border border-amber-300 text-stone-800 focus:ring-amber-500'
                                            : 'bg-stone-50 border border-stone-300 text-stone-800 focus:ring-emerald-500 focus:bg-white'
                                    }`}
                                >
                                    <option value="">Select Supplier (Required) *</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>🏢 {s.name}</option>
                                    ))}
                                </select>
                                {!directSupplierId && (
                                    <p className="text-[11px] text-amber-600 font-semibold mt-1">
                                        ⚠ You must specify the supplier who supplied these direct products for analytics tracking.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Search & Add Products */}
                        <div className="relative">
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5 flex items-center gap-1.5">
                                <Search size={13} className="text-zinc-500" />
                                <span>Search & Add Product to Direct Intake</span>
                            </label>
                            <div className="relative">
                                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                                <input
                                    type="text"
                                    value={directSearchQuery}
                                    onChange={e => setDirectSearchQuery(e.target.value)}
                                    placeholder="Type SKU or Brand Name (e.g. Selkirk, Joola, Paddles)..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white shadow-2xs"
                                />
                            </div>

                            {searchableVariants.length > 0 && (
                                <div className="absolute w-full mt-1.5 bg-white border border-stone-200 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-stone-100 max-h-60 overflow-y-auto">
                                    {searchableVariants.map(v => (
                                        <div
                                            key={v.sku}
                                            onClick={() => handleAddDirectItem(v)}
                                            className="px-4 py-2.5 hover:bg-emerald-50/70 cursor-pointer text-xs flex items-center justify-between transition-colors"
                                        >
                                            <div>
                                                <div className="font-black text-stone-900">{v.dropdownName}</div>
                                                <div className="font-mono text-[10px] text-stone-400">SKU: {v.sku} · Color: {v.color}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                                                    Cost: {formatPHP(v.acquisitionPrice)}
                                                </span>
                                                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-black text-[10px] flex items-center gap-1">
                                                    <Plus size={10} /> Add
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected Items Table */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-stone-700">
                                <span>Items in this Direct Intake ({directItems.length})</span>
                                {directItems.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setDirectItems([])}
                                        className="text-rose-600 hover:text-rose-800 text-[11px] font-bold cursor-pointer"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {directItems.length === 0 ? (
                                <div className="p-8 text-center border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 text-xs">
                                    <PackagePlus size={28} className="mx-auto mb-2 text-stone-300" />
                                    <p className="font-bold">No products added yet.</p>
                                    <p className="text-[11px] text-stone-400 mt-0.5">Use the search box above to add products directly to this branch batch.</p>
                                </div>
                            ) : (
                                <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-stone-100/90 text-stone-600 font-black uppercase text-[10px] tracking-wider border-b border-stone-200">
                                            <tr>
                                                <th className="px-3.5 py-2.5">Product & SKU</th>
                                                <th className="px-3.5 py-2.5 w-24 text-center">Quantity</th>
                                                <th className="px-3.5 py-2.5 w-32 text-right">Cost (₱)</th>
                                                <th className="px-3.5 py-2.5 w-32 text-right">Selling Price (₱)</th>
                                                <th className="px-3.5 py-2.5 w-12 text-center"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {directItems.map(item => (
                                                <tr key={item.variantId} className="hover:bg-stone-50/50">
                                                    <td className="px-3.5 py-2.5">
                                                        <div className="font-black text-stone-900">{item.displayName}</div>
                                                        <div className="font-mono text-[10px] text-stone-400">SKU: {item.sku}</div>
                                                    </td>
                                                    <td className="px-3.5 py-2.5">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={e => handleUpdateDirectItem(item.variantId, 'quantity', parseInt(e.target.value) || 1)}
                                                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-center font-black text-stone-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.acquisitionPrice}
                                                            onChange={e => handleUpdateDirectItem(item.variantId, 'acquisitionPrice', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-right font-bold text-stone-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-right">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={item.sellingPrice}
                                                            onChange={e => handleUpdateDirectItem(item.variantId, 'sellingPrice', parseFloat(e.target.value) || 0)}
                                                            className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-right font-black text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                        />
                                                    </td>
                                                    <td className="px-3.5 py-2.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveDirectItem(item.variantId)}
                                                            className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Optional Notes */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                Optional Intake Notes / Invoice Reference
                            </label>
                            <input
                                type="text"
                                value={directNotes}
                                onChange={e => setDirectNotes(e.target.value)}
                                placeholder="e.g. Direct delivery via local courier, PO# 4921"
                                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                            />
                        </div>

                        {/* Submit Button & Summary */}
                        <div className="pt-3 border-t border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="text-xs text-stone-500 font-medium">
                                Total Units: <strong className="text-stone-900">{directItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0)}</strong> ·
                                Total Cost: <strong className="text-stone-900">{formatPHP(directItems.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.acquisitionPrice) || 0)), 0))}</strong> ·
                                Retail Valuation: <strong className="text-emerald-700">{formatPHP(directItems.reduce((s, i) => s + ((Number(i.quantity) || 0) * (Number(i.sellingPrice) || 0)), 0))}</strong>
                            </div>

                            <button
                                type="submit"
                                disabled={submittingDirect || directItems.length === 0 || !directSupplierId}
                                className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer active:scale-98"
                            >
                                <CheckCircle2 size={16} />
                                <span>{submittingDirect ? 'Receiving Stock...' : 'Confirm & Add to Branch Stock'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════════════════
                TAB 3: RETROACTIVE TAGGING VIEW
            ══════════════════════════════════════════════════════════════════ */}
            {activeTab === 'tagging' && (
                <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 md:p-7 space-y-5">
                    <div>
                        <div className="flex items-center gap-2 text-amber-700 font-black text-xs uppercase tracking-wider">
                            <Tag size={16} />
                            <span>Retroactive Attribution</span>
                        </div>
                        <h2 className="text-xl font-black text-stone-900 tracking-tight mt-1">
                            Tag Previous Stock & Transactions as Branch Direct
                        </h2>
                        <p className="text-xs text-stone-500 font-medium mt-1">
                            Need to classify existing transactions or batches as Branch Direct products? Select transactions or batches below
                            and assign their source type and supplier. Analytics will immediately update.
                        </p>
                    </div>

                    {tagFeedback && (
                        <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs font-bold ${tagFeedback.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
                            {tagFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                            <span className="flex-1">{tagFeedback.message}</span>
                            <button onClick={() => setTagFeedback(null)} className="text-stone-400 hover:text-stone-600"><X size={13} /></button>
                        </div>
                    )}

                    {/* Filter and Mode Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-200 rounded-xl">
                        <div className="flex flex-wrap items-center gap-2 flex-1">
                            {/* Mode toggle */}
                            <div className="flex bg-stone-200/80 p-0.5 rounded-lg border border-stone-300">
                                <button
                                    onClick={() => { setTaggingMode('transactions'); setSelectedBatchIds(new Set()); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${taggingMode === 'transactions' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'}`}
                                >
                                    Transactions
                                </button>
                                <button
                                    onClick={() => { setTaggingMode('batches'); setSelectedTxIds(new Set()); }}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${taggingMode === 'batches' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600'}`}
                                >
                                    Stock Batches
                                </button>
                            </div>

                            {/* Search filter input */}
                            <div className="relative flex-1 min-w-[200px] max-w-xs">
                                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder={taggingMode === 'transactions' ? "Search order, product, SKU, customer..." : "Search batch, product, SKU, supplier..."}
                                    value={tagSearchQuery}
                                    onChange={e => setTagSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchTaggingData()}
                                    className="w-full pl-7 pr-7 py-1 bg-white border border-stone-300 rounded-lg text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 shadow-2xs"
                                />
                                {tagSearchQuery && (
                                    <button
                                        onClick={() => setTagSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                                        title="Clear search"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Branch filter (admin) */}
                            {isAdmin && (
                                <select
                                    value={tagBranchId}
                                    onChange={e => setTagBranchId(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none shadow-2xs cursor-pointer"
                                >
                                    <option value="">All Branches</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>📍 {b.name}</option>
                                    ))}
                                </select>
                            )}

                            {/* Source Type filter */}
                            <select
                                value={tagSourceTypeFilter}
                                onChange={e => setTagSourceTypeFilter(e.target.value)}
                                className="px-2.5 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none shadow-2xs cursor-pointer"
                            >
                                <option value="ALL">All Source Types</option>
                                <option value="ALLOCATED">Allocated (Master)</option>
                                <option value="BRANCH_DIRECT">Branch Direct</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            {tagSearchQuery && (
                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                    {taggingMode === 'transactions'
                                        ? `${filteredTaggingList.length} of ${taggingList.length} shown`
                                        : `${filteredTaggingBatches.length} of ${taggingBatches.length} shown`}
                                </span>
                            )}
                            <button
                                onClick={fetchTaggingData}
                                className="flex items-center gap-1.5 px-3 py-1 bg-white border border-stone-300 hover:bg-stone-100 text-stone-700 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                            >
                                <RefreshCw size={12} className={loadingTagging ? 'animate-spin' : ''} />
                                <span>Reload</span>
                            </button>
                        </div>
                    </div>

                    {/* Mode 1: Transactions Table */}
                    {taggingMode === 'transactions' && (
                        <div className="space-y-3">
                            {/* Bulk Action Toolbar */}
                            {selectedTxIds.size > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs font-bold text-amber-900">
                                        Selected: <strong>{selectedTxIds.size}</strong> transaction(s)
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={bulkSourceType}
                                            onChange={e => setBulkSourceType(e.target.value)}
                                            className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none"
                                        >
                                            <option value="BRANCH_DIRECT">Tag as: Branch Direct</option>
                                            <option value="ALLOCATED">Tag as: Master Allocated</option>
                                        </select>

                                        <select
                                            value={bulkSupplierId}
                                            onChange={e => setBulkSupplierId(e.target.value)}
                                            className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none"
                                        >
                                            <option value="">Keep / Assign Supplier...</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={handleApplyBulkTransactionTag}
                                            disabled={isTaggingAction}
                                            className="px-3 py-1 bg-stone-900 hover:bg-black text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                                        >
                                            {isTaggingAction ? 'Saving...' : 'Apply Tag'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-stone-100/90 text-stone-600 font-black uppercase text-[10px] tracking-wider border-b border-stone-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredTaggingList.length > 0 && selectedTxIds.size === filteredTaggingList.length}
                                                    onChange={handleSelectAllTxs}
                                                    className="rounded cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-3 py-2">Date / Order ID</th>
                                            <th className="px-3 py-2">Product / SKU</th>
                                            <th className="px-3 py-2">Branch</th>
                                            <th className="px-3 py-2">Current Source</th>
                                            <th className="px-3 py-2">Current Supplier</th>
                                            <th className="px-3 py-2 text-right">Selling Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {filteredTaggingList.length > 0 ? (
                                            filteredTaggingList.map(t => (
                                                <tr
                                                    key={t.id}
                                                    onClick={() => handleToggleSelectTx(t.id)}
                                                    className={`cursor-pointer transition-colors ${selectedTxIds.has(t.id) ? 'bg-amber-50/70' : 'hover:bg-stone-50/70'}`}
                                                >
                                                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedTxIds.has(t.id)}
                                                            onChange={() => handleToggleSelectTx(t.id)}
                                                            className="rounded cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-mono text-[10px] text-zinc-400">
                                                            {t.transactionDate ? new Date(t.transactionDate).toLocaleDateString('en-PH') : '—'}
                                                        </div>
                                                        <div className="font-bold text-stone-800">{t.orderId}</div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-bold text-stone-900">{t.variant?.name || '—'}</div>
                                                        <div className="font-mono text-[10px] text-stone-400">SKU: {t.variant?.sku}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-stone-700 whitespace-nowrap">
                                                        {t.branch?.name || 'Admin HQ'}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {t.sourceType === 'BRANCH_DIRECT' ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Branch Direct
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                                                Allocated
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-stone-700 whitespace-nowrap">
                                                        {t.supplier ? (
                                                            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 text-[11px]">
                                                                <Building2 size={11} /> {t.supplier.name}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-300 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-black text-stone-800 whitespace-nowrap">
                                                        {formatPHP(t.finalPrice)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-xs">
                                                    {tagSearchQuery
                                                        ? `No transactions match "${tagSearchQuery}". Try adjusting your search term or clear the filter.`
                                                        : 'No transactions found for the selected criteria.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Mode 2: Batches Table */}
                    {taggingMode === 'batches' && (
                        <div className="space-y-3">
                            {/* Bulk Action Toolbar for Batches */}
                            {selectedBatchIds.size > 0 && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                                        <span>Selected: <strong>{selectedBatchIds.size}</strong> stock batch(es)</span>
                                        <button
                                            onClick={() => setSelectedBatchIds(new Set())}
                                            className="text-[11px] text-amber-700 underline hover:text-amber-900 cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <select
                                            value={bulkSourceType}
                                            onChange={e => setBulkSourceType(e.target.value)}
                                            className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none"
                                        >
                                            <option value="BRANCH_DIRECT">Tag as: Branch Direct</option>
                                            <option value="ALLOCATED">Tag as: Master Allocated</option>
                                        </select>

                                        <select
                                            value={bulkSupplierId}
                                            onChange={e => setBulkSupplierId(e.target.value)}
                                            className="px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none"
                                        >
                                            <option value="">Keep / Assign Supplier...</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>

                                        <label className="flex items-center gap-1.5 text-xs text-amber-950 font-medium cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={bulkBatchUpdateTx}
                                                onChange={e => setBulkBatchUpdateTx(e.target.checked)}
                                                className="rounded text-amber-600 cursor-pointer"
                                            />
                                            <span>Sync past sales</span>
                                        </label>

                                        <button
                                            onClick={handleApplyBulkBatchTag}
                                            disabled={isTaggingAction}
                                            className="px-3 py-1 bg-stone-900 hover:bg-black text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                            {isTaggingAction ? 'Saving...' : 'Apply Tag to Batches'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="border border-stone-200 rounded-xl overflow-hidden shadow-2xs max-h-[500px] overflow-y-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-stone-100/90 text-stone-600 font-black uppercase text-[10px] tracking-wider border-b border-stone-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-3 py-2 text-center w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={filteredTaggingBatches.length > 0 && selectedBatchIds.size === filteredTaggingBatches.length}
                                                    onChange={handleSelectAllBatches}
                                                    className="rounded cursor-pointer"
                                                />
                                            </th>
                                            <th className="px-3 py-2">Batch ID / Date</th>
                                            <th className="px-3 py-2">Product / SKU</th>
                                            <th className="px-3 py-2">Branch</th>
                                            <th className="px-3 py-2 text-center">Remaining / Initial</th>
                                            <th className="px-3 py-2">Current Source</th>
                                            <th className="px-3 py-2">Supplier</th>
                                            <th className="px-3 py-2 text-right">Quick Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {filteredTaggingBatches.length > 0 ? (
                                            filteredTaggingBatches.map(b => (
                                                <tr
                                                    key={b.id}
                                                    onClick={() => handleToggleSelectBatch(b.id)}
                                                    className={`cursor-pointer transition-colors ${selectedBatchIds.has(b.id) ? 'bg-amber-50/70' : 'hover:bg-stone-50/70'}`}
                                                >
                                                    <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedBatchIds.has(b.id)}
                                                            onChange={() => handleToggleSelectBatch(b.id)}
                                                            className="rounded cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-mono text-[10px] text-zinc-400">
                                                            {b.restockedAt ? new Date(b.restockedAt).toLocaleDateString('en-PH') : '—'}
                                                        </div>
                                                        <div className="font-bold text-stone-800">{b.batchId || `#${b.id}`}</div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="font-bold text-stone-900">{b.variant?.name || '—'}</div>
                                                        <div className="font-mono text-[10px] text-stone-400">SKU: {b.variant?.sku}</div>
                                                    </td>
                                                    <td className="px-3 py-2 text-stone-700 whitespace-nowrap">
                                                        {b.branch?.name || 'Admin HQ'}
                                                    </td>
                                                    <td className="px-3 py-2 text-center font-mono font-bold">
                                                        <span className={b.remainingQuantity > 0 ? 'text-emerald-700' : 'text-zinc-400'}>
                                                            {b.remainingQuantity}
                                                        </span> / {b.quantity}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {b.sourceType === 'BRANCH_DIRECT' ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                                Branch Direct
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 border border-stone-200">
                                                                Allocated
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-stone-700 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                        <select
                                                            value={b.supplier?.id || ''}
                                                            onChange={e => handleTagSingleBatch(b.id, b.sourceType || 'BRANCH_DIRECT', e.target.value)}
                                                            className="px-2 py-1 bg-white border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:outline-none shadow-2xs cursor-pointer max-w-[170px]"
                                                        >
                                                            <option value="">— Unassigned —</option>
                                                            {suppliers.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                                                        {b.sourceType !== 'BRANCH_DIRECT' ? (
                                                            <button
                                                                onClick={() => handleTagSingleBatch(b.id, 'BRANCH_DIRECT', b.supplier?.id)}
                                                                className="px-2.5 py-1 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer"
                                                            >
                                                                Tag as Direct
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleTagSingleBatch(b.id, 'ALLOCATED', b.supplier?.id)}
                                                                className="px-2.5 py-1 bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200 rounded-lg text-[10px] font-bold uppercase transition-all cursor-pointer"
                                                            >
                                                                Revert Allocated
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400 text-xs">
                                                    {tagSearchQuery
                                                        ? `No stock batches match "${tagSearchQuery}". Try adjusting your search term or clear the filter.`
                                                        : 'No stock batches found.'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

/* -------- Stat card subcomponent (aesthetic rounded-xl variant) -------- */
const StatCard = (props) => {
    const { label, primary, secondary, accent = 'zinc', loading, active, onClick } = props;
    const Icon = props.Icon;
    const accentMap = {
        zinc:    { border: 'border-stone-200',  text: 'text-zinc-900',   ic: 'text-zinc-500',   bg: 'bg-stone-50',   gradient: 'from-stone-400 to-stone-600', ringA: 'ring-zinc-900' },
        emerald: { border: 'border-emerald-100', text: 'text-emerald-700', ic: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'from-emerald-400 to-emerald-600', ringA: 'ring-emerald-500' },
        indigo:  { border: 'border-indigo-100',  text: 'text-indigo-700',  ic: 'text-indigo-600',  bg: 'bg-indigo-50',  gradient: 'from-indigo-400 to-indigo-600', ringA: 'ring-indigo-500' },
        amber:   { border: 'border-amber-100',   text: 'text-amber-700',   ic: 'text-amber-600',   bg: 'bg-amber-50',   gradient: 'from-amber-400 to-amber-600', ringA: 'ring-amber-500' },
        red:     { border: 'border-red-100',     text: 'text-rose-700',     ic: 'text-rose-600',     bg: 'bg-rose-50',     gradient: 'from-rose-400 to-rose-600', ringA: 'ring-rose-500' },
    };
    const c = accentMap[accent] || accentMap.zinc;
    const isClickable = !!onClick;
    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden bg-white border ${c.border} rounded-xl p-2.5 shadow-sm hover:shadow-md transition-all ${isClickable ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${active ? `ring-2 ${c.ringA}` : ''}`}
        >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${c.gradient} rounded-t-xl`} />
            <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-400">{label}</span>
                <div className={`p-1 rounded-lg ${c.bg}`}>
                    <Icon size={12} className={c.ic} />
                </div>
            </div>
            {loading ? (
                <div className="h-5 bg-stone-100 rounded animate-pulse w-2/3" />
            ) : (
                <div className={`text-lg font-black tracking-tight ${c.text} truncate`}>{primary}</div>
            )}
            <p className="text-[10px] font-medium text-zinc-400 mt-0.5 truncate">{secondary}</p>
        </div>
    );
};

export default Inventory;
