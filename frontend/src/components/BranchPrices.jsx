import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
    DollarSign,
    Search,
    Filter,
    Check,
    RotateCcw,
    AlertCircle,
    Boxes,
    Tag,
    Sparkles,
    Loader2,
    TrendingUp
} from 'lucide-react';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BranchPrices = ({ products = [], refetchProducts }) => {
    const { currentBranchId, user } = useAuth();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [overrides, setOverrides] = useState({}); // variantId -> price input value
    const [savedOverrides, setSavedOverrides] = useState({}); // variantId -> saved price from backend
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Fetch existing overrides for this branch
    const fetchOverrides = async () => {
        setLoading(true);
        try {
            const url = currentBranchId ? `/api/products/branch-prices?branchId=${currentBranchId}` : '/api/products/branch-prices';
            const res = await axios.get(url);
            const map = {};
            if (Array.isArray(res.data)) {
                res.data.forEach(item => {
                    if (item.variantId != null) {
                        map[item.variantId] = item.sellingPrice;
                    }
                });
            }
            setSavedOverrides(map);
            // Initialize working input state with saved overrides
            const inputMap = {};
            Object.keys(map).forEach(vid => {
                inputMap[vid] = map[vid];
            });
            setOverrides(inputMap);
        } catch (err) {
            console.error('Failed to load branch prices:', err);
            setErrorMessage('Unable to load branch price overrides.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverrides();
    }, [currentBranchId]);

    // Flatten products into variant rows
    const allVariants = useMemo(() => {
        const rows = [];
        (products || []).forEach(p => {
            (p.variants || []).forEach(v => {
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
                    defaultPrice: v.sellingPrice, // original selling price from admin
                    stockQuantity: v.stockQuantity ?? 0,
                    customPrice: savedOverrides[v.id] ?? null
                });
            });
        });
        return rows;
    }, [products, savedOverrides]);

    const categories = useMemo(() => {
        const set = new Set(allVariants.map(v => v.category));
        return ['All', ...Array.from(set)];
    }, [allVariants]);

    const filteredVariants = useMemo(() => {
        return allVariants.filter(item => {
            const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
            const q = search.toLowerCase();
            const matchesSearch = !q ||
                item.brandName.toLowerCase().includes(q) ||
                item.modelName.toLowerCase().includes(q) ||
                (item.sku && item.sku.toLowerCase().includes(q)) ||
                (item.color && item.color.toLowerCase().includes(q));
            return matchesCat && matchesSearch;
        });
    }, [allVariants, selectedCategory, search]);

    const handleInputChange = (variantId, val) => {
        setOverrides(prev => ({
            ...prev,
            [variantId]: val
        }));
    };

    const handleSavePrice = async (item) => {
        const inputVal = overrides[item.variantId];
        if (inputVal === '' || inputVal == null) {
            setErrorMessage('Please enter a valid price.');
            return;
        }

        const numVal = parseFloat(inputVal);
        if (isNaN(numVal) || numVal < 0) {
            setErrorMessage('Selling price must be a non-negative number.');
            return;
        }

        setSavingId(item.variantId);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const targetBranch = currentBranchId || user?.branchId || 1;
            await axios.put(`/api/products/variants/${item.variantId}/branch-price`, {
                sellingPrice: numVal,
                branchId: targetBranch
            });
            setSavedOverrides(prev => ({ ...prev, [item.variantId]: numVal }));
            setSuccessMessage(`Custom price for ${item.modelName} (${item.sku}) saved.`);
            setTimeout(() => setSuccessMessage(''), 3500);
            if (refetchProducts) refetchProducts();
        } catch (err) {
            console.error('Failed to update branch price:', err);
            setErrorMessage(err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save selling price.');
        } finally {
            setSavingId(null);
        }
    };

    const handleResetToDefault = async (item) => {
        // Reset local input to default
        setOverrides(prev => ({
            ...prev,
            [item.variantId]: item.defaultPrice
        }));
        // Save the default price as custom override or reset
        handleSavePrice({ ...item, variantId: item.variantId });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-3xl p-7 text-white shadow-xl relative overflow-hidden border border-stone-800">
                <div className="absolute right-0 top-0 w-80 h-full bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                            <Sparkles size={13} />
                            Branch Pricing Control
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                            Custom Selling Prices
                        </h2>
                        <p className="text-stone-300 text-sm mt-1 max-w-2xl">
                            Adjust selling prices specifically for your branch. Prices configured here will be used in your POS system and customer receipts.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-700/80 rounded-2xl px-5 py-3 text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Active Overrides</span>
                            <span className="text-2xl font-black text-emerald-400">
                                {Object.keys(savedOverrides).length}
                            </span>
                        </div>
                        <div className="bg-stone-800/80 backdrop-blur-sm border border-stone-700/80 rounded-2xl px-5 py-3 text-center">
                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">Total Catalog</span>
                            <span className="text-2xl font-black text-white">
                                {allVariants.length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Notification messages */}
            {successMessage && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shadow-sm">
                    <Check size={18} className="text-emerald-600 shrink-0" />
                    <span>{successMessage}</span>
                </div>
            )}
            {errorMessage && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-semibold flex items-center gap-2.5 animate-fadeIn shadow-sm">
                    <AlertCircle size={18} className="text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Filters Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-stone-200 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search product, model, SKU, color..."
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:border-stone-400 focus:bg-white transition-all font-medium text-stone-900"
                    />
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 custom-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                                selectedCategory === cat
                                    ? 'bg-stone-900 text-white shadow-sm'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Pricing Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
                {loading ? (
                    <div className="p-16 flex flex-col items-center justify-center gap-3 text-stone-400">
                        <Loader2 className="w-8 h-8 animate-spin text-stone-600" />
                        <span className="text-sm font-semibold">Loading price catalog...</span>
                    </div>
                ) : filteredVariants.length === 0 ? (
                    <div className="p-16 text-center text-stone-400">
                        <Tag className="w-12 h-12 mx-auto mb-3 opacity-30 text-stone-400" />
                        <h4 className="font-bold text-stone-700 text-base">No Products Found</h4>
                        <p className="text-xs text-stone-500 mt-1">Try adjusting your search or category filter.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100 select-none">
                                <tr>
                                    <th className="py-4 px-6">Product & Model</th>
                                    <th className="py-4 px-4">Variant Details</th>
                                    <th className="py-4 px-4">In Stock</th>
                                    <th className="py-4 px-4">Default Admin Price</th>
                                    <th className="py-4 px-4">Branch Selling Price</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredVariants.map(item => {
                                    const currentInput = overrides[item.variantId] !== undefined
                                        ? overrides[item.variantId]
                                        : (item.customPrice ?? item.defaultPrice ?? '');
                                    const hasCustom = savedOverrides[item.variantId] != null;
                                    const isSaving = savingId === item.variantId;
                                    const isDirty = String(currentInput) !== String(item.customPrice ?? item.defaultPrice);

                                    return (
                                        <tr key={item.variantId} className="hover:bg-stone-50/70 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-black text-stone-900 text-sm">{item.modelName}</div>
                                                <div className="text-xs text-stone-400 font-semibold">{item.brandName} • {item.category}</div>
                                                <div className="text-[11px] font-mono text-stone-500 mt-0.5">{item.sku}</div>
                                            </td>

                                            <td className="py-4 px-4">
                                                <div className="flex flex-wrap gap-1.5 text-xs text-stone-600">
                                                    {item.color && (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-medium">
                                                            {item.color}
                                                        </span>
                                                    )}
                                                    {item.thicknessMm && (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-medium">
                                                            {item.thicknessMm}mm
                                                        </span>
                                                    )}
                                                    {item.shape && (
                                                        <span className="px-2 py-0.5 rounded-md bg-stone-100 font-medium">
                                                            {item.shape}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-4 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                                                    item.stockQuantity > 5
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                        : item.stockQuantity > 0
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                        : 'bg-rose-50 text-rose-700 border border-rose-100'
                                                }`}>
                                                    <Boxes size={12} />
                                                    {item.stockQuantity} units
                                                </span>
                                            </td>

                                            <td className="py-4 px-4">
                                                <span className="text-stone-500 font-semibold line-through text-xs mr-1">
                                                    {formatCurrency(item.defaultPrice)}
                                                </span>
                                                <span className="text-[10px] text-stone-400 uppercase font-bold block">
                                                    Default Master Price
                                                </span>
                                            </td>

                                            <td className="py-4 px-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-36">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-xs">₱</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={currentInput}
                                                            onChange={(e) => handleInputChange(item.variantId, e.target.value)}
                                                            className={`w-full pl-7 pr-3 py-2 text-sm font-black rounded-xl border focus:outline-none transition-all ${
                                                                hasCustom
                                                                    ? 'bg-emerald-50/50 border-emerald-300 text-emerald-900 focus:border-emerald-500'
                                                                    : 'bg-stone-50 border-stone-200 text-stone-900 focus:border-stone-400'
                                                            }`}
                                                        />
                                                    </div>
                                                    {hasCustom && (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider">
                                                            Custom
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleSavePrice(item)}
                                                        disabled={isSaving}
                                                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer ${
                                                            isDirty
                                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                                : 'bg-stone-900 hover:bg-stone-800 text-white'
                                                        }`}
                                                    >
                                                        {isSaving ? (
                                                            <Loader2 size={13} className="animate-spin" />
                                                        ) : (
                                                            <Check size={13} />
                                                        )}
                                                        <span>Save</span>
                                                    </button>

                                                    {hasCustom && (
                                                        <button
                                                            onClick={() => handleResetToDefault(item)}
                                                            title="Reset to default admin price"
                                                            className="p-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors"
                                                        >
                                                            <RotateCcw size={13} />
                                                        </button>
                                                    )}
                                                </div>
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

export default BranchPrices;
