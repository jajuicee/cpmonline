import React, { useState, useMemo } from 'react';
import axios from 'axios';
import {
    Search,
    PackagePlus,
    CheckCircle2,
    AlertCircle,
    Plus,
    Minus,
    Trash2,
    Loader2,
    RefreshCw,
    Store,
    Layers,
    ArrowRight,
    X,
    Check,
    ClipboardCheck,
    Boxes
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AddBranchStock = ({ products = [], refetchProducts }) => {
    const { user } = useAuth();

    // Search and Category Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    // Multi-Item Intake Manifest (Batch)
    const [batchItems, setBatchItems] = useState([]);

    // Review Modal State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Flatten all variants from products list for quick search
    const allVariants = useMemo(() => {
        const list = [];
        products.forEach(p => {
            if (p.variants && Array.isArray(p.variants)) {
                p.variants.forEach(v => {
                    const specs = [v.color, v.thicknessMm ? `${v.thicknessMm}mm` : '', v.shape].filter(Boolean).join(' • ') || 'Standard';
                    list.push({
                        variantId: v.id,
                        sku: v.sku,
                        productBrand: p.brandName,
                        productModel: p.modelName,
                        productCategory: p.category || 'General',
                        variantSpecs: specs,
                        sellingPrice: v.sellingPrice || 0,
                        fullName: `${p.brandName} ${p.modelName} ${specs}`.trim(),
                        defaultConsigned: Boolean(v.consigned)
                    });
                });
            }
        });
        return list;
    }, [products]);

    // Unique Categories
    const categories = useMemo(() => {
        const cats = new Set(['All']);
        allVariants.forEach(v => {
            if (v.productCategory) cats.add(v.productCategory);
        });
        return Array.from(cats);
    }, [allVariants]);

    // Filtered variants based on search & category
    const filteredVariants = useMemo(() => {
        let list = allVariants;
        if (selectedCategory !== 'All') {
            list = list.filter(v => v.productCategory === selectedCategory);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(v =>
                v.fullName.toLowerCase().includes(q) ||
                (v.sku && v.sku.toLowerCase().includes(q)) ||
                (v.productBrand && v.productBrand.toLowerCase().includes(q)) ||
                (v.productModel && v.productModel.toLowerCase().includes(q))
            );
        }
        return list.slice(0, 30); // show top matches for speed
    }, [allVariants, searchTerm, selectedCategory]);

    // Quick lookup of quantities already in batch
    const batchMap = useMemo(() => {
        const map = new Map();
        batchItems.forEach(item => {
            map.set(item.variantId, item.quantity);
        });
        return map;
    }, [batchItems]);

    // Totals
    const totalUnits = useMemo(() => {
        return batchItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }, [batchItems]);

    const totalItems = batchItems.length;

    // Add item to batch
    const handleAddToBatch = (variant) => {
        setSuccessMessage('');
        setErrorMessage('');
        setBatchItems(prev => {
            const existingIndex = prev.findIndex(item => item.variantId === variant.variantId);
            if (existingIndex > -1) {
                const updated = [...prev];
                updated[existingIndex] = {
                    ...updated[existingIndex],
                    quantity: updated[existingIndex].quantity + 1
                };
                return updated;
            } else {
                return [
                    ...prev,
                    {
                        variantId: variant.variantId,
                        sku: variant.sku,
                        fullName: variant.fullName,
                        productBrand: variant.productBrand,
                        productModel: variant.productModel,
                        productCategory: variant.productCategory,
                        variantSpecs: variant.variantSpecs,
                        sellingPrice: variant.sellingPrice,
                        quantity: 1,
                        consigned: variant.defaultConsigned
                    }
                ];
            }
        });
    };

    // Update quantity in batch
    const handleUpdateQuantity = (variantId, newQty) => {
        if (newQty <= 0) {
            handleRemoveItem(variantId);
            return;
        }
        setBatchItems(prev => prev.map(item =>
            item.variantId === variantId ? { ...item, quantity: newQty } : item
        ));
    };

    // Toggle consigned per item
    const handleToggleConsigned = (variantId) => {
        setBatchItems(prev => prev.map(item =>
            item.variantId === variantId ? { ...item, consigned: !item.consigned } : item
        ));
    };

    // Remove item from batch
    const handleRemoveItem = (variantId) => {
        setBatchItems(prev => prev.filter(item => item.variantId !== variantId));
    };

    // Clear entire batch
    const handleClearBatch = () => {
        if (batchItems.length === 0) return;
        if (window.confirm('Clear all items from current intake manifest?')) {
            setBatchItems([]);
            setErrorMessage('');
        }
    };

    // Submit batch stock intake
    const handleConfirmSubmit = async () => {
        if (batchItems.length === 0) return;

        setSubmitting(true);
        setErrorMessage('');

        try {
            const payload = {
                branchId: user?.branchId,
                status: 'RECEIVED',
                items: batchItems.map(item => ({
                    variantId: item.variantId,
                    quantity: item.quantity,
                    consigned: item.consigned
                }))
            };

            await axios.post('/api/batch-actions/receive', payload);

            setSuccessMessage(`✓ Successfully added ${totalUnits} total units across ${totalItems} product${totalItems > 1 ? 's' : ''} to ${user?.branchName || 'Branch'} inventory!`);
            setShowReviewModal(false);
            setBatchItems([]);

            if (refetchProducts) {
                refetchProducts();
            }
        } catch (err) {
            console.error('Failed to submit batch stock:', err);
            const msg = err.response?.data?.error || 'Failed to add batch inventory. Please check your items and try again.';
            setErrorMessage(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto w-full space-y-5">
            {/* Header / Branch Info Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Store size={16} />
                        <span>{user?.branchName || (user?.role === 'ROLE_ADMIN' ? 'Admin Central Intake (Unallocated Holding)' : 'Branch Inventory')}</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        Add Inventory (Multi-Item Intake)
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        Click items from the catalog on the left to add them to your shipment manifest, then review and confirm all items at once.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => refetchProducts && refetchProducts()}
                        className="flex items-center gap-2 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh catalog items"
                    >
                        <RefreshCw size={14} />
                        <span>Refresh Catalog</span>
                    </button>
                </div>
            </div>

            {/* Notification messages */}
            {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm font-semibold flex items-center justify-between gap-3 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                    <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900">
                        <X size={16} />
                    </button>
                </div>
            )}
            {errorMessage && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm font-semibold flex items-center justify-between gap-3 animate-fade-in shadow-sm">
                    <div className="flex items-center gap-3">
                        <AlertCircle size={20} className="text-red-600 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                    <button onClick={() => setErrorMessage('')} className="text-red-700 hover:text-red-900">
                        <X size={16} />
                    </button>
                </div>
            )}

            {/* MAIN TWO-COLUMN WORKSPACE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* ─── LEFT PANEL: CATALOG SEARCH & QUICK-PICK (7 cols) ─── */}
                <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-[700px]">
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                                1. Catalog Products
                            </label>
                            <span className="text-[11px] font-bold text-stone-400">
                                Click any item to add to manifest
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by brand, model, SKU, or color..."
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        selectedCategory === cat
                                            ? 'bg-stone-900 text-white shadow-sm'
                                            : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Catalog Items List */}
                    <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
                        {filteredVariants.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400">
                                <Search size={36} className="text-stone-300 mb-2 stroke-[1.5]" />
                                <p className="text-sm font-bold text-stone-600">No matching items found</p>
                                <p className="text-xs text-stone-400 mt-0.5">Try searching with a different keyword or category.</p>
                            </div>
                        ) : (
                            filteredVariants.map((v) => {
                                const inBatchQty = batchMap.get(v.variantId) || 0;
                                const isAdded = inBatchQty > 0;

                                return (
                                    <div
                                        key={v.variantId}
                                        className={`p-3.5 rounded-xl border transition-all duration-150 flex items-center justify-between gap-3 ${
                                            isAdded
                                                ? 'bg-emerald-50/70 border-emerald-300/80 shadow-sm'
                                                : 'bg-stone-50/60 hover:bg-stone-100/70 border-stone-200/80'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-stone-200 text-stone-700">
                                                    {v.productCategory}
                                                </span>
                                                <span className="text-xs font-mono font-bold text-stone-500">
                                                    {v.sku}
                                                </span>
                                                {isAdded && (
                                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white flex items-center gap-1">
                                                        <Check size={10} /> In Manifest: {inBatchQty}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="font-bold text-sm text-stone-900 mt-1 truncate">
                                                {v.productBrand} {v.productModel}
                                            </h4>
                                            <p className="text-xs text-stone-500 mt-0.5 truncate">
                                                {v.variantSpecs}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <div className="text-right mr-1">
                                                <div className="text-xs font-bold text-emerald-700">
                                                    ₱{Number(v.sellingPrice).toLocaleString()}
                                                </div>
                                            </div>

                                            {isAdded ? (
                                                <div className="flex items-center gap-1 bg-white border border-emerald-300 rounded-lg p-0.5 shadow-sm">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateQuantity(v.variantId, inBatchQty - 1)}
                                                        className="w-7 h-7 rounded-md bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 font-bold transition-colors cursor-pointer active:scale-95"
                                                        title="Decrease"
                                                    >
                                                        <Minus size={13} />
                                                    </button>
                                                    <span className="w-8 text-center text-xs font-black text-emerald-800">
                                                        {inBatchQty}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAddToBatch(v)}
                                                        className="w-7 h-7 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center font-bold transition-colors cursor-pointer active:scale-95"
                                                        title="Add more"
                                                    >
                                                        <Plus size={13} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddToBatch(v)}
                                                    className="px-3 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                                >
                                                    <Plus size={14} />
                                                    <span>Add</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ─── RIGHT PANEL: INTAKE MANIFEST (5 cols) ─── */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-[700px] justify-between">
                    <div>
                        {/* Manifest Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-4">
                            <div>
                                <h3 className="text-sm font-black uppercase tracking-wider text-stone-900 flex items-center gap-2">
                                    <PackagePlus size={18} className="text-emerald-600" />
                                    <span>2. Intake Manifest</span>
                                </h3>
                                <p className="text-[11px] text-stone-500 mt-0.5">
                                    Review quantities before confirming receipt
                                </p>
                            </div>

                            {totalItems > 0 && (
                                <button
                                    onClick={handleClearBatch}
                                    className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer flex items-center gap-1"
                                >
                                    <Trash2 size={13} />
                                    <span>Clear All</span>
                                </button>
                            )}
                        </div>

                        {/* Summary Pill */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100/80 border border-stone-200 mb-4 text-xs font-bold text-stone-700">
                            <span>Selected Items:</span>
                            <span className="px-2.5 py-0.5 rounded-full bg-stone-900 text-white font-mono font-black">
                                {totalItems} item{totalItems !== 1 ? 's' : ''} • {totalUnits} unit{totalUnits !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Manifest Scrollable Items List */}
                        <div className="overflow-y-auto space-y-3 max-h-[440px] pr-1 custom-scrollbar">
                            {batchItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center text-stone-400">
                                    <Layers size={48} className="text-stone-300 mb-3 stroke-[1.2]" />
                                    <h4 className="font-bold text-stone-700 text-sm">Manifest is Empty</h4>
                                    <p className="text-xs text-stone-400 mt-1 max-w-xs leading-relaxed">
                                        Click "+ Add" on any catalog item on the left to add it to this intake batch.
                                    </p>
                                </div>
                            ) : (
                                batchItems.map((item) => (
                                    <div
                                        key={item.variantId}
                                        className="p-3.5 rounded-xl border border-stone-200 bg-white shadow-sm space-y-2.5"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                                        {item.productCategory}
                                                    </span>
                                                    <span className="text-[11px] font-mono text-stone-500">
                                                        {item.sku}
                                                    </span>
                                                </div>
                                                <h4 className="font-bold text-sm text-stone-900 mt-1 leading-snug">
                                                    {item.productBrand} {item.productModel}
                                                </h4>
                                                <p className="text-xs text-stone-500">
                                                    {item.variantSpecs}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item.variantId)}
                                                className="text-stone-400 hover:text-red-500 p-1 rounded-lg transition-colors cursor-pointer"
                                                title="Remove item"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-stone-100 gap-2">
                                            {/* Consigned Toggle */}
                                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-stone-600 select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={item.consigned}
                                                    onChange={() => handleToggleConsigned(item.variantId)}
                                                    className="w-3.5 h-3.5 rounded text-stone-900 focus:ring-stone-900"
                                                />
                                                <span className="text-[11px]">Consigned</span>
                                            </label>

                                            {/* Quantity Controls */}
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(item.variantId, item.quantity - 1)}
                                                    className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 font-bold transition-colors cursor-pointer active:scale-95"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateQuantity(item.variantId, parseInt(e.target.value) || 1)}
                                                    className="w-14 h-8 text-center text-sm font-black bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateQuantity(item.variantId, item.quantity + 1)}
                                                    className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-700 font-bold transition-colors cursor-pointer active:scale-95"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Bottom Review Action */}
                    <div className="pt-4 border-t border-stone-100 mt-2">
                        <button
                            type="button"
                            onClick={() => setShowReviewModal(true)}
                            disabled={batchItems.length === 0}
                            className="w-full py-3.5 px-6 bg-stone-900 hover:bg-black text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-stone-900/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                        >
                            <span>Review & Receive ({totalUnits} Units)</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* REVIEW & CONFIRMATION POPUP MODAL                                  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {showReviewModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <ClipboardCheck size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black tracking-tight">
                                        Review Stock Intake Manifest
                                    </h3>
                                    <p className="text-xs text-stone-300">
                                        Receiving at <span className="font-bold text-white">{user?.branchName || 'Branch'}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => !submitting && setShowReviewModal(false)}
                                disabled={submitting}
                                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Summary Badges */}
                        <div className="grid grid-cols-2 gap-4 p-5 bg-stone-50 border-b border-stone-200 text-center">
                            <div className="bg-white p-3 rounded-xl border border-stone-200">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Products Included</div>
                                <div className="text-2xl font-black text-stone-900 mt-0.5">{totalItems}</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-stone-200">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Units to Receive</div>
                                <div className="text-2xl font-black text-emerald-600 mt-0.5">{totalUnits} units</div>
                            </div>
                        </div>

                        {/* Modal Items List */}
                        <div className="p-6 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-stone-200 text-[11px] uppercase tracking-wider text-stone-400 font-black">
                                        <th className="pb-2.5">Item & Description</th>
                                        <th className="pb-2.5 text-center">SKU</th>
                                        <th className="pb-2.5 text-center">Type</th>
                                        <th className="pb-2.5 text-right">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {batchItems.map((item, idx) => (
                                        <tr key={item.variantId} className="hover:bg-stone-50">
                                            <td className="py-3 pr-2">
                                                <div className="font-bold text-stone-900 text-sm">
                                                    {item.productBrand} {item.productModel}
                                                </div>
                                                <div className="text-[11px] text-stone-500">
                                                    {item.variantSpecs}
                                                </div>
                                            </td>
                                            <td className="py-3 text-center font-mono text-stone-600">
                                                {item.sku}
                                            </td>
                                            <td className="py-3 text-center">
                                                {item.consigned ? (
                                                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                                                        Consigned
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 font-bold text-[10px]">
                                                        Owned
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 text-right">
                                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-black text-sm">
                                                    +{item.quantity}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs mt-4 flex items-center gap-2">
                                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                                <span>These <strong>{totalUnits} units</strong> will immediately be available for sale at <strong>{user?.branchName || 'your branch'}</strong>.</span>
                            </div>
                        </div>

                        {/* Modal Footer Controls */}
                        <div className="p-5 bg-white border-t border-stone-200 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowReviewModal(false)}
                                disabled={submitting}
                                className="px-5 py-3 border border-stone-300 hover:bg-stone-100 rounded-xl text-xs font-black uppercase tracking-wider text-stone-700 transition-colors cursor-pointer"
                            >
                                ← Back to Edit
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSubmit}
                                disabled={submitting}
                                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin text-white" />
                                        <span>Adding to Inventory…</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={16} />
                                        <span>Confirm & Add to Inventory</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AddBranchStock;
