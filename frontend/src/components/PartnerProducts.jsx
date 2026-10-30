import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
    Handshake, Plus, Search, RefreshCw, Boxes, DollarSign,
    Building2, CheckCircle2, AlertCircle, Tag, Layers, X,
    Percent, ArrowRight, ShieldCheck, Store, Calendar, Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const formatPHP = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PARTNER_PRESETS = ['Uly', 'Pickle Gear', 'Arronax PH', 'Cebu Partner'];

const PartnerProducts = ({ products = [], refetchProducts }) => {
    const { user, isAdmin, isBranch, currentBranchId } = useAuth();

    const [partnerBatches, setPartnerBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);
    const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState('catalog'); // 'catalog' | 'quick-create'
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

    // Intake Form State - Catalog Mode
    const [catalogPartnerName, setCatalogPartnerName] = useState('Uly');
    const [catalogCustomPartner, setCatalogCustomPartner] = useState('');
    const [catalogSplitPct, setCatalogSplitPct] = useState('50.00');
    const [catalogTargetBranchId, setCatalogTargetBranchId] = useState(currentBranchId || '');
    const [catalogNotes, setCatalogNotes] = useState('');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState([]); // array of { variant, quantity, acqPrice, sellingPrice }

    // Quick-Create Form State
    const [qcBrand, setQcBrand] = useState('');
    const [qcModel, setQcModel] = useState('');
    const [qcCategory, setQcCategory] = useState('Paddles');
    const [qcColor, setQcColor] = useState('Standard');
    const [qcThickness, setQcThickness] = useState(16);
    const [qcShape, setQcShape] = useState('Standard');
    const [qcSellingPrice, setQcSellingPrice] = useState('');
    const [qcAcqPrice, setQcAcqPrice] = useState('');
    const [qcQuantity, setQcQuantity] = useState(1);
    const [qcPartnerName, setQcPartnerName] = useState('Uly');
    const [qcCustomPartner, setQcCustomPartner] = useState('');
    const [qcSplitPct, setQcSplitPct] = useState('50.00');
    const [qcTargetBranchId, setQcTargetBranchId] = useState(currentBranchId || '');
    const [qcNotes, setQcNotes] = useState('');

    // Load branches for Admin
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    setBranches(list);
                    if (!catalogTargetBranchId && list.length > 0) {
                        setCatalogTargetBranchId(list[0].id);
                        setQcTargetBranchId(list[0].id);
                    }
                })
                .catch(err => console.error('Failed to load branches:', err));
        } else if (currentBranchId) {
            setCatalogTargetBranchId(currentBranchId);
            setQcTargetBranchId(currentBranchId);
        }
    }, [isAdmin, currentBranchId]);

    // Fetch partner products/batches
    const fetchPartnerBatches = useCallback(async () => {
        setLoading(true);
        try {
            const url = (!isAdmin && currentBranchId)
                ? `/api/partner-products?branchId=${currentBranchId}`
                : `/api/partner-products`;
            const res = await axios.get(url);
            setPartnerBatches(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch partner products:', err);
            setPartnerBatches([]);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, currentBranchId]);

    useEffect(() => {
        fetchPartnerBatches();
    }, [fetchPartnerBatches]);

    // Distinct list of partner names for filtering
    const dynamicPartners = useMemo(() => {
        const set = new Set(PARTNER_PRESETS);
        partnerBatches.forEach(b => {
            if (b.partnerName && b.partnerName.trim()) set.add(b.partnerName.trim());
        });
        return Array.from(set);
    }, [partnerBatches]);

    // Filtered batches
    const filteredBatches = useMemo(() => {
        return partnerBatches.filter(b => {
            if (selectedPartnerFilter !== 'ALL') {
                if (!b.partnerName || b.partnerName.toLowerCase() !== selectedPartnerFilter.toLowerCase()) {
                    return false;
                }
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const matchSku = (b.sku || '').toLowerCase().includes(q);
                const matchBrand = (b.brandName || '').toLowerCase().includes(q);
                const matchModel = (b.modelName || '').toLowerCase().includes(q);
                const matchPartner = (b.partnerName || '').toLowerCase().includes(q);
                const matchBranch = (b.branchName || '').toLowerCase().includes(q);
                return matchSku || matchBrand || matchModel || matchPartner || matchBranch;
            }
            return true;
        });
    }, [partnerBatches, selectedPartnerFilter, searchQuery]);

    // Stats
    const stats = useMemo(() => {
        let totalUnits = 0;
        let totalValue = 0;
        const uniqueVariants = new Set();
        filteredBatches.forEach(b => {
            const qty = Number(b.remainingQuantity || 0);
            totalUnits += qty;
            totalValue += qty * Number(b.sellingPrice || 0);
            if (b.variantId) uniqueVariants.add(b.variantId);
        });
        return {
            totalUnits,
            totalValue,
            uniqueSkus: uniqueVariants.size,
            batchCount: filteredBatches.length
        };
    }, [filteredBatches]);

    // Catalog search options
    const catalogSearchMatches = useMemo(() => {
        if (!catalogSearch.trim()) return [];
        const q = catalogSearch.toLowerCase().trim();
        const matches = [];

        products.forEach(p => {
            (p.variants || []).forEach(v => {
                const fullText = `${p.brandName} ${p.modelName} ${v.sku} ${v.color || ''} ${v.thicknessMm || ''}`.toLowerCase();
                if (fullText.includes(q)) {
                    matches.push({
                        variantId: v.id,
                        sku: v.sku,
                        brandName: p.brandName,
                        modelName: p.modelName,
                        color: v.color || 'Standard',
                        thicknessMm: v.thicknessMm,
                        shape: v.shape,
                        currentPrice: v.sellingPrice || 0,
                        currentAcq: v.acquisitionPrice || 0,
                        variant: v
                    });
                }
            });
        });
        return matches.slice(0, 10);
    }, [catalogSearch, products]);

    const handleSelectCatalogItem = (item) => {
        if (selectedItems.some(i => i.variantId === item.variantId)) return;
        setSelectedItems(prev => [
            ...prev,
            {
                variantId: item.variantId,
                sku: item.sku,
                brandName: item.brandName,
                modelName: item.modelName,
                color: item.color,
                thicknessMm: item.thicknessMm,
                quantity: 1,
                acquisitionPrice: item.currentAcq,
                sellingPrice: item.currentPrice
            }
        ]);
        setCatalogSearch('');
    };

    const handleRemoveSelectedItem = (variantId) => {
        setSelectedItems(prev => prev.filter(i => i.variantId !== variantId));
    };

    const handleUpdateSelectedItem = (variantId, field, val) => {
        setSelectedItems(prev => prev.map(i => {
            if (i.variantId === variantId) {
                return { ...i, [field]: val };
            }
            return i;
        }));
    };

    // Submit Catalog Intake
    const handleSubmitCatalogIntake = async (e) => {
        e.preventDefault();
        if (selectedItems.length === 0) {
            setFeedback({ type: 'error', message: 'Please search and add at least one product.' });
            return;
        }

        const resolvedPartner = (catalogPartnerName === 'Custom' ? catalogCustomPartner : catalogPartnerName).trim();
        if (!resolvedPartner) {
            setFeedback({ type: 'error', message: 'Please enter a valid Partner Name.' });
            return;
        }

        setSubmitting(true);
        setFeedback(null);

        try {
            const payload = {
                partnerName: resolvedPartner,
                partnerSplitPct: Number(catalogSplitPct) || 50.00,
                branchId: catalogTargetBranchId ? Number(catalogTargetBranchId) : null,
                notes: catalogNotes || `Direct partner intake from ${resolvedPartner}`,
                items: selectedItems.map(i => ({
                    variantId: i.variantId,
                    quantity: Number(i.quantity) || 1,
                    acquisitionPrice: Number(i.acquisitionPrice) || 0,
                    sellingPrice: Number(i.sellingPrice) || 0
                }))
            };

            const res = await axios.post('/api/partner-products/intake', payload);
            setFeedback({ type: 'success', message: res.data.message || 'Partner stock intaked successfully!' });
            setSelectedItems([]);
            setCatalogNotes('');
            
            // Refresh tables and product catalogs
            await fetchPartnerBatches();
            if (refetchProducts) refetchProducts();

            setTimeout(() => {
                setIsModalOpen(false);
                setFeedback(null);
            }, 1200);
        } catch (err) {
            console.error('Failed to intake partner stock:', err);
            setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to intake partner stock.' });
        } finally {
            setSubmitting(false);
        }
    };

    // Submit Quick Create
    const handleSubmitQuickCreate = async (e) => {
        e.preventDefault();
        if (!qcBrand.trim() || !qcModel.trim()) {
            setFeedback({ type: 'error', message: 'Brand and Model are required.' });
            return;
        }
        if (Number(qcQuantity) <= 0) {
            setFeedback({ type: 'error', message: 'Quantity must be at least 1.' });
            return;
        }

        const resolvedPartner = (qcPartnerName === 'Custom' ? qcCustomPartner : qcPartnerName).trim();
        if (!resolvedPartner) {
            setFeedback({ type: 'error', message: 'Please provide a partner name (e.g. Uly).' });
            return;
        }

        setSubmitting(true);
        setFeedback(null);

        try {
            const payload = {
                brandName: qcBrand.trim(),
                modelName: qcModel.trim(),
                category: qcCategory,
                color: qcColor,
                thicknessMm: Number(qcThickness) || 16,
                shape: qcShape,
                sellingPrice: Number(qcSellingPrice) || 0,
                acquisitionPrice: Number(qcAcqPrice) || 0,
                quantity: Number(qcQuantity) || 1,
                partnerName: resolvedPartner,
                partnerSplitPct: Number(qcSplitPct) || 50.00,
                branchId: qcTargetBranchId ? Number(qcTargetBranchId) : null,
                notes: qcNotes || `Quick Created Partner Item from ${resolvedPartner}`
            };

            const res = await axios.post('/api/partner-products/quick-create', payload);
            setFeedback({ type: 'success', message: res.data.message || 'Product created and partner stock intaked!' });
            
            // Reset QC fields
            setQcModel('');
            setQcSellingPrice('');
            setQcAcqPrice('');
            setQcQuantity(1);
            setQcNotes('');

            await fetchPartnerBatches();
            if (refetchProducts) refetchProducts();

            setTimeout(() => {
                setIsModalOpen(false);
                setFeedback(null);
            }, 1200);
        } catch (err) {
            console.error('Failed to quick-create partner item:', err);
            setFeedback({ type: 'error', message: err.response?.data?.error || 'Failed to create partner product.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="w-full space-y-3 min-w-0">
            {/* Header Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-700">
                        <Handshake size={15} />
                        <span>Partner Products (50/50 Profit Share)</span>
                    </div>
                    <h1 className="text-xl font-black text-stone-900 tracking-tight mt-0.5">
                        Direct Partner Inventory & Adding System
                    </h1>
                    <p className="text-xs text-stone-500 font-medium">
                        Intake partner stock (e.g. <strong>Uly</strong>, 50/50 profit split) directly into branches without going through Admin Holding Pool allocations.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchPartnerBatches}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh partner stock"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>

                    <button
                        onClick={() => {
                            setFeedback(null);
                            setIsModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        <Plus size={15} />
                        <span>+ Intake Partner Stock</span>
                    </button>
                </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white border border-purple-100 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">Total Units</span>
                        <Boxes size={14} className="text-purple-500" />
                    </div>
                    <div className="text-xl font-black text-purple-950">{stats.totalUnits}</div>
                    <p className="text-[10px] text-stone-400 font-medium">unsold partner inventory</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Partner Valuation</span>
                        <DollarSign size={14} className="text-emerald-500" />
                    </div>
                    <div className="text-xl font-black text-emerald-800">{formatPHP(stats.totalValue)}</div>
                    <p className="text-[10px] text-stone-400 font-medium">at retail selling price</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-500 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Distinct SKUs</span>
                        <Tag size={14} className="text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-stone-900">{stats.uniqueSkus}</div>
                    <p className="text-[10px] text-stone-400 font-medium">partner product variants</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Active Batches</span>
                        <Layers size={14} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-black text-stone-900">{stats.batchCount}</div>
                    <p className="text-[10px] text-stone-400 font-medium">batch lots tracked</p>
                </div>
            </div>

            {/* Controls: Partner Filter Chips & Search */}
            <div className="bg-white p-2.5 px-3 rounded-xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Partner Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 mr-1">Partner:</span>
                    <button
                        onClick={() => setSelectedPartnerFilter('ALL')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            selectedPartnerFilter === 'ALL'
                                ? 'bg-purple-900 text-white shadow-xs font-black'
                                : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                    >
                        All Partners
                    </button>
                    {dynamicPartners.map(p => (
                        <button
                            key={p}
                            onClick={() => setSelectedPartnerFilter(p)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                selectedPartnerFilter.toLowerCase() === p.toLowerCase()
                                    ? 'bg-purple-700 text-white shadow-xs font-black'
                                    : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/60'
                            }`}
                        >
                            <Handshake size={11} />
                            <span>{p}</span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative sm:w-64">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search SKU, brand, model..."
                        className="w-full pl-8 pr-7 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:border-purple-600 focus:bg-white transition-all font-medium"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Partner Batches Table */}
            <div className="overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm min-h-[350px]">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100 shadow-xs z-10 text-[11px] uppercase tracking-wider text-stone-600 font-black border-b border-stone-200">
                        <tr>
                            <th className="px-3 py-2.5">SKU / Code</th>
                            <th className="px-3 py-2.5">Brand & Model</th>
                            <th className="px-3 py-2.5">Partner</th>
                            <th className="px-3 py-2.5">Split</th>
                            <th className="px-3 py-2.5">Location / Branch</th>
                            <th className="px-3 py-2.5 text-right">In-Stock Qty</th>
                            <th className="px-3 py-2.5 text-right">Selling Price</th>
                            <th className="px-3 py-2.5 text-right">Total Value</th>
                            <th className="px-3 py-2.5">Batch ID</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 9 }).map((_, j) => (
                                        <td key={j} className="px-3 py-3">
                                            <div className="h-4 bg-stone-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : filteredBatches.length > 0 ? (
                            filteredBatches.map(row => (
                                <tr key={row.batchId || row.variantId} className="hover:bg-purple-50/30 transition-colors">
                                    <td className="px-3 py-2.5 font-mono font-bold text-stone-700">
                                        {row.sku}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="font-black text-stone-900">{row.brandName} {row.modelName}</div>
                                        <div className="text-[10px] text-stone-400 font-medium">
                                            {row.color} {row.thicknessMm ? `· ${row.thicknessMm}mm` : ''}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full text-[11px] font-black border border-purple-200 shadow-xs">
                                            <Handshake size={11} className="text-purple-700" />
                                            {row.partnerName || 'Uly'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 font-bold text-stone-700">
                                        <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded text-[10px] font-black border border-stone-200">
                                            {row.partnerSplitPct || 50}% / {100 - (Number(row.partnerSplitPct) || 50)}%
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center gap-1 text-stone-700 font-bold">
                                            <Store size={12} className="text-indigo-600" />
                                            <span>{row.branchName}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-right">
                                        <span className="font-black text-purple-950 text-sm">
                                            {row.remainingQuantity}
                                        </span>
                                        <span className="text-[10px] text-stone-400 ml-1">/ {row.quantity}</span>
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                                        {formatPHP(row.sellingPrice)}
                                    </td>
                                    <td className="px-3 py-2.5 text-right font-black text-emerald-800">
                                        {formatPHP(Number(row.sellingPrice || 0) * Number(row.remainingQuantity || 0))}
                                    </td>
                                    <td className="px-3 py-2.5 font-mono text-[10px] text-stone-400">
                                        {row.batchId || '-'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-stone-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Handshake size={28} className="text-purple-400 stroke-1" />
                                        <p className="font-bold text-stone-700">No partner products found.</p>
                                        <p className="text-xs text-stone-400">
                                            Click <strong>"+ Intake Partner Stock"</strong> to intake items from partners like Uly directly into your branch!
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- MODAL: INTAKE PARTNER STOCK --- */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
                        {/* Modal Header */}
                        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-600 rounded-lg">
                                    <Handshake size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-wide uppercase">Intake Partner Stock (50/50)</h3>
                                    <p className="text-[11px] text-stone-300">Direct branch receipt · Bypasses Admin Holding Pool</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-stone-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mode Selector Tabs */}
                        <div className="flex border-b border-stone-200 bg-stone-50 px-5 pt-2.5 gap-2">
                            <button
                                type="button"
                                onClick={() => { setModalMode('catalog'); setFeedback(null); }}
                                className={`pb-2 px-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    modalMode === 'catalog'
                                        ? 'border-purple-600 text-purple-700'
                                        : 'border-transparent text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                <Boxes size={13} />
                                <span>From Catalog</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setModalMode('quick-create'); setFeedback(null); }}
                                className={`pb-2 px-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    modalMode === 'quick-create'
                                        ? 'border-purple-600 text-purple-700'
                                        : 'border-transparent text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                <Sparkles size={13} />
                                <span>Quick Register New</span>
                            </button>
                        </div>

                        {/* Feedback message */}
                        {feedback && (
                            <div className={`mx-5 mt-3 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                                feedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}>
                                {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                                <span>{feedback.message}</span>
                            </div>
                        )}

                        {/* FORM: MODE A (CATALOG) */}
                        {modalMode === 'catalog' && (
                            <form onSubmit={handleSubmitCatalogIntake} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                                {/* Partner Name & Preset Chips */}
                                <div>
                                    <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1.5">
                                        Partner Name
                                    </label>
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        {['Uly', 'Pickle Gear', 'Arronax PH', 'Custom'].map(name => (
                                            <button
                                                key={name}
                                                type="button"
                                                onClick={() => setCatalogPartnerName(name)}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                    catalogPartnerName === name
                                                        ? 'bg-purple-700 text-white shadow-xs font-black'
                                                        : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                                                }`}
                                            >
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                    {catalogPartnerName === 'Custom' && (
                                        <input
                                            type="text"
                                            required
                                            value={catalogCustomPartner}
                                            onChange={e => setCatalogCustomPartner(e.target.value)}
                                            placeholder="Enter partner name (e.g. Uly, John Doe)..."
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        />
                                    )}
                                </div>

                                {/* Destination Branch & Profit Split */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Destination Branch
                                        </label>
                                        {isAdmin ? (
                                            <select
                                                value={catalogTargetBranchId}
                                                onChange={e => setCatalogTargetBranchId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold text-stone-800"
                                            >
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                                <option value="">Central Master Admin</option>
                                            </select>
                                        ) : (
                                            <div className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5">
                                                <Store size={13} className="text-emerald-600" />
                                                <span>{user?.branchName || 'Current Branch'}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Partner Profit Split (%)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="1"
                                                min="1"
                                                max="100"
                                                value={catalogSplitPct}
                                                onChange={e => setCatalogSplitPct(e.target.value)}
                                                className="w-full pl-3 pr-8 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold text-stone-800"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-stone-400">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Search Catalog Items */}
                                <div className="relative">
                                    <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                        Select Products to Intake
                                    </label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            value={catalogSearch}
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            placeholder="Type product name, SKU, or model to add..."
                                            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-medium"
                                        />
                                    </div>

                                    {/* Search Dropdown Results */}
                                    {catalogSearchMatches.length > 0 && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-stone-300 rounded-xl shadow-xl z-20 max-h-52 overflow-y-auto divide-y divide-stone-100">
                                            {catalogSearchMatches.map(item => (
                                                <div
                                                    key={item.variantId}
                                                    onClick={() => handleSelectCatalogItem(item)}
                                                    className="p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between text-xs"
                                                >
                                                    <div>
                                                        <span className="font-mono text-[10px] text-stone-400 font-bold mr-2">{item.sku}</span>
                                                        <strong className="text-stone-900">{item.brandName} {item.modelName}</strong>
                                                        <span className="text-stone-500 text-[11px] ml-1.5">({item.color} {item.thicknessMm ? `· ${item.thicknessMm}mm` : ''})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-emerald-700">{formatPHP(item.currentPrice)}</span>
                                                        <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded">
                                                            + Add
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Items List */}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1">
                                        Items to Intake ({selectedItems.length})
                                    </div>
                                    {selectedItems.length > 0 ? (
                                        <div className="space-y-2 border border-stone-200 rounded-xl p-2 bg-stone-50">
                                            {selectedItems.map(item => (
                                                <div key={item.variantId} className="bg-white p-2.5 rounded-lg border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs">
                                                    <div className="min-w-[160px]">
                                                        <div className="font-black text-stone-900">{item.brandName} {item.modelName}</div>
                                                        <div className="text-[10px] text-stone-400 font-mono">{item.sku} · {item.color}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Qty</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'quantity', e.target.value)}
                                                                className="w-16 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-stone-800"
                                                            />
                                                        </div>

                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Sell (₱)</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.sellingPrice}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'sellingPrice', e.target.value)}
                                                                className="w-24 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-stone-800"
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSelectedItem(item.variantId)}
                                                            className="text-stone-400 hover:text-rose-600 p-1.5 rounded transition-colors"
                                                            title="Remove item"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 border border-dashed border-stone-300 rounded-xl text-xs text-stone-400">
                                            No items selected yet. Use the search box above to add products.
                                        </div>
                                    )}
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
                                        Batch Intake Notes
                                    </label>
                                    <input
                                        type="text"
                                        value={catalogNotes}
                                        onChange={e => setCatalogNotes(e.target.value)}
                                        placeholder="Optional notes (e.g. Delivered personally by Uly)..."
                                        className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50"
                                    />
                                </div>

                                {/* Submit button */}
                                <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || selectedItems.length === 0}
                                        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                    >
                                        {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Handshake size={14} />}
                                        <span>Receive Partner Stock</span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORM: MODE B (QUICK CREATE) */}
                        {modalMode === 'quick-create' && (
                            <form onSubmit={handleSubmitQuickCreate} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Brand Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={qcBrand}
                                            onChange={e => setQcBrand(e.target.value)}
                                            placeholder="e.g. Arronax, Joola"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Model Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={qcModel}
                                            onChange={e => setQcModel(e.target.value)}
                                            placeholder="e.g. Thunder 10, KVL-005"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Category
                                        </label>
                                        <select
                                            value={qcCategory}
                                            onChange={e => setQcCategory(e.target.value)}
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        >
                                            <option value="Paddles">Paddles</option>
                                            <option value="Accessories">Accessories</option>
                                            <option value="Balls">Balls</option>
                                            <option value="Apparel">Apparel</option>
                                            <option value="Shoes">Shoes</option>
                                            <option value="Bags">Bags</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Color / Style
                                        </label>
                                        <input
                                            type="text"
                                            value={qcColor}
                                            onChange={e => setQcColor(e.target.value)}
                                            placeholder="e.g. Black, Blue"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Thickness (mm)
                                        </label>
                                        <input
                                            type="number"
                                            value={qcThickness}
                                            onChange={e => setQcThickness(e.target.value)}
                                            placeholder="16"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Quantity *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={qcQuantity}
                                            onChange={e => setQcQuantity(e.target.value)}
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-black text-stone-900"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Selling Price (₱) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            step="0.01"
                                            value={qcSellingPrice}
                                            onChange={e => setQcSellingPrice(e.target.value)}
                                            placeholder="3500"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold text-emerald-700"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Acq. Price (₱)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={qcAcqPrice}
                                            onChange={e => setQcAcqPrice(e.target.value)}
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Partner & Branch */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Partner Name
                                        </label>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            {['Uly', 'Pickle Gear', 'Custom'].map(name => (
                                                <button
                                                    key={name}
                                                    type="button"
                                                    onClick={() => setQcPartnerName(name)}
                                                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                                                        qcPartnerName === name ? 'bg-purple-700 text-white font-black' : 'bg-stone-100 text-stone-700'
                                                    }`}
                                                >
                                                    {name}
                                                </button>
                                            ))}
                                        </div>
                                        {qcPartnerName === 'Custom' && (
                                            <input
                                                type="text"
                                                required
                                                value={qcCustomPartner}
                                                onChange={e => setQcCustomPartner(e.target.value)}
                                                placeholder="Custom partner name..."
                                                className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-stone-50 font-bold"
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Destination Branch
                                        </label>
                                        {isAdmin ? (
                                            <select
                                                value={qcTargetBranchId}
                                                onChange={e => setQcTargetBranchId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold text-stone-800"
                                            >
                                                {branches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                                <option value="">Central Master Admin</option>
                                            </select>
                                        ) : (
                                            <div className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 flex items-center gap-1.5">
                                                <Store size={13} className="text-emerald-600" />
                                                <span>{user?.branchName || 'Current Branch'}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Submit button */}
                                <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                    >
                                        {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        <span>Create & Intake Partner Stock</span>
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PartnerProducts;
