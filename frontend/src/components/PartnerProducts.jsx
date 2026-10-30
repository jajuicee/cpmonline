import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
    Handshake, Plus, Search, RefreshCw, Boxes, DollarSign,
    Building2, CheckCircle2, AlertCircle, Tag, Layers, X,
    Percent, ArrowRight, ShieldCheck, Store, Calendar, Sparkles,
    Users, UserPlus, Check, TrendingUp, Receipt, Edit2, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const formatPHP = (val) =>
    `₱${(Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PartnerProducts = ({ products = [], refetchProducts }) => {
    const { user, isAdmin, isBranch, currentBranchId } = useAuth();

    // Active View Tab: 'inventory' | 'profits' | 'partners'
    const [activeTab, setActiveTab] = useState('inventory');

    // Data States
    const [partnerBatches, setPartnerBatches] = useState([]);
    const [partnersList, setPartnersList] = useState([]);
    const [profitsData, setProfitsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState([]);

    // Filters & Search
    const [selectedPartnerFilter, setSelectedPartnerFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [settlingId, setSettlingId] = useState(null);

    // Modals
    const [isIntakeOpen, setIsIntakeOpen] = useState(false);
    const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
    const [intakeMode, setIntakeMode] = useState('catalog'); // 'catalog' | 'quick-create'
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

    // Add Partner Form State
    const [partnerNameInput, setPartnerNameInput] = useState('');
    const [partnerContactInput, setPartnerContactInput] = useState('');
    const [partnerSplitInput, setPartnerSplitInput] = useState('50.00');
    const [partnerNotesInput, setPartnerNotesInput] = useState('');

    // Intake Form State - Catalog Mode
    const [catalogPartnerName, setCatalogPartnerName] = useState('');
    const [catalogSplitPct, setCatalogSplitPct] = useState('50.00');
    const [catalogTargetBranchId, setCatalogTargetBranchId] = useState(currentBranchId || '');
    const [catalogNotes, setCatalogNotes] = useState('');
    const [catalogSearch, setCatalogSearch] = useState('');
    const [selectedItems, setSelectedItems] = useState([]);

    // Quick-Create Form State
    const [qcBrand, setQcBrand] = useState('');
    const [qcModel, setQcModel] = useState('');
    const [qcCategory, setQcCategory] = useState('Paddles');
    const [qcColor, setQcColor] = useState('Standard');
    const [qcThickness, setQcThickness] = useState(16);
    const [qcShape, setQcShape] = useState('Standard');
    const [qcAcqPrice, setQcAcqPrice] = useState(''); // Cost
    const [qcRecommendedPrice, setQcRecommendedPrice] = useState(''); // Recommended SRP
    const [qcSellingPrice, setQcSellingPrice] = useState(''); // Selling price
    const [qcQuantity, setQcQuantity] = useState(1);
    const [qcPartnerName, setQcPartnerName] = useState('');
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

    // Fetch partners list
    const fetchPartners = useCallback(async () => {
        try {
            const res = await axios.get('/api/partner-products/partners');
            const list = Array.isArray(res.data) ? res.data : [];
            setPartnersList(list);
            if (list.length > 0) {
                if (!catalogPartnerName) setCatalogPartnerName(list[0].name);
                if (!qcPartnerName) setQcPartnerName(list[0].name);
            }
        } catch (err) {
            console.error('Failed to load partners:', err);
        }
    }, [catalogPartnerName, qcPartnerName]);

    // Fetch partner products/batches
    const fetchPartnerBatches = useCallback(async () => {
        try {
            const url = (!isAdmin && currentBranchId)
                ? `/api/partner-products?branchId=${currentBranchId}`
                : `/api/partner-products`;
            const res = await axios.get(url);
            setPartnerBatches(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch partner products:', err);
            setPartnerBatches([]);
        }
    }, [isAdmin, currentBranchId]);

    // Fetch partner profits
    const fetchProfits = useCallback(async () => {
        try {
            const url = (!isAdmin && currentBranchId)
                ? `/api/partner-products/profits?branchId=${currentBranchId}`
                : `/api/partner-products/profits`;
            const res = await axios.get(url);
            setProfitsData(res.data);
        } catch (err) {
            console.error('Failed to fetch partner profits:', err);
        }
    }, [isAdmin, currentBranchId]);

    const refreshAllData = useCallback(async () => {
        setLoading(true);
        await Promise.all([fetchPartners(), fetchPartnerBatches(), fetchProfits()]);
        setLoading(false);
    }, [fetchPartners, fetchPartnerBatches, fetchProfits]);

    useEffect(() => {
        refreshAllData();
    }, [refreshAllData]);

    // Toggle transaction settlement status (Paid/Unpaid)
    const handleToggleSettlement = async (txId, currentStatus) => {
        setSettlingId(txId);
        try {
            const nextStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
            await axios.post(`/api/partner-products/settle/${txId}?status=${nextStatus}`);
            await fetchProfits();
        } catch (err) {
            alert('Failed to update settlement status: ' + (err.response?.data?.error || err.message));
        } finally {
            setSettlingId(null);
        }
    };

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

    // Stats: Exactly 4 Cards
    // 1. Total Units, 2. Partner Valuation, 3. Partner Profit Share, 4. CPM Profit Share
    const stats = useMemo(() => {
        let totalUnits = 0;
        let totalValue = 0;
        filteredBatches.forEach(b => {
            const qty = Number(b.remainingQuantity || 0);
            totalUnits += qty;
            totalValue += qty * Number(b.sellingPrice || 0);
        });

        const profSummary = profitsData?.summary || {};
        return {
            totalUnits,
            totalValue,
            partnerProfit: Number(profSummary.totalPartnerShare || 0),
            cpmProfit: Number(profSummary.totalCpmShare || 0),
            unitsSold: Number(profSummary.unitsSold || 0),
            unsettledShare: Number(profSummary.totalUnsettledPartnerShare || 0)
        };
    }, [filteredBatches, profitsData]);

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
                        currentCost: v.acquisitionPrice || 0,
                        currentRecommended: v.recommendedSellingPrice || v.sellingPrice || 0,
                        currentPrice: v.sellingPrice || 0,
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
                costPrice: item.currentCost,
                recommendedPrice: item.currentRecommended,
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

    // Submit Add Partner
    const handleSavePartner = async (e) => {
        e.preventDefault();
        if (!partnerNameInput.trim()) {
            alert('Partner name is required.');
            return;
        }

        setSubmitting(true);
        try {
            await axios.post('/api/partner-products/partners', {
                name: partnerNameInput.trim(),
                contactInfo: partnerContactInput.trim(),
                defaultSplitPct: Number(partnerSplitInput) || 50.00,
                notes: partnerNotesInput.trim()
            });

            setPartnerNameInput('');
            setPartnerContactInput('');
            setPartnerSplitInput('50.00');
            setPartnerNotesInput('');
            setIsAddPartnerOpen(false);

            await fetchPartners();
        } catch (err) {
            console.error('Failed to add partner:', err);
            alert('Failed to add partner: ' + (err.response?.data?.error || err.message));
        } finally {
            setSubmitting(false);
        }
    };

    // Archive / Delete Partner
    const handleDeletePartner = async (partnerId, partnerName) => {
        if (!window.confirm(`Archive partner "${partnerName}"?`)) return;
        try {
            await axios.delete(`/api/partner-products/partners/${partnerId}`);
            await fetchPartners();
        } catch (err) {
            alert('Failed to delete partner: ' + (err.response?.data?.error || err.message));
        }
    };

    // Submit Catalog Intake
    const handleSubmitCatalogIntake = async (e) => {
        e.preventDefault();
        if (selectedItems.length === 0) {
            setFeedback({ type: 'error', message: 'Please search and add at least one product.' });
            return;
        }

        const resolvedPartner = catalogPartnerName.trim();
        if (!resolvedPartner) {
            setFeedback({ type: 'error', message: 'Please select or enter a partner.' });
            return;
        }

        setSubmitting(true);
        setFeedback(null);

        try {
            const payload = {
                partnerName: resolvedPartner,
                partnerSplitPct: Number(catalogSplitPct) || 50.00,
                branchId: catalogTargetBranchId ? Number(catalogTargetBranchId) : null,
                notes: catalogNotes || `Partner intake from ${resolvedPartner}`,
                items: selectedItems.map(i => ({
                    variantId: i.variantId,
                    quantity: Number(i.quantity) || 1,
                    acquisitionPrice: Number(i.costPrice) || 0,
                    recommendedSellingPrice: Number(i.recommendedPrice) || Number(i.sellingPrice) || 0,
                    sellingPrice: Number(i.sellingPrice) || 0
                }))
            };

            const res = await axios.post('/api/partner-products/intake', payload);
            setFeedback({ type: 'success', message: res.data.message || 'Partner stock intaked successfully!' });
            setSelectedItems([]);
            setCatalogNotes('');
            
            await refreshAllData();
            if (refetchProducts) refetchProducts();

            setTimeout(() => {
                setIsIntakeOpen(false);
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

        const resolvedPartner = qcPartnerName.trim();
        if (!resolvedPartner) {
            setFeedback({ type: 'error', message: 'Please select or specify a partner name.' });
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
                acquisitionPrice: Number(qcAcqPrice) || 0, // Cost
                recommendedSellingPrice: Number(qcRecommendedPrice) || Number(qcSellingPrice) || 0, // SRP
                sellingPrice: Number(qcSellingPrice) || 0, // Retail price
                quantity: Number(qcQuantity) || 1,
                partnerName: resolvedPartner,
                partnerSplitPct: Number(qcSplitPct) || 50.00,
                branchId: qcTargetBranchId ? Number(qcTargetBranchId) : null,
                notes: qcNotes || `Partner Item from ${resolvedPartner}`
            };

            const res = await axios.post('/api/partner-products/quick-create', payload);
            setFeedback({ type: 'success', message: res.data.message || 'Product created and partner stock intaked!' });
            
            setQcModel('');
            setQcAcqPrice('');
            setQcRecommendedPrice('');
            setQcSellingPrice('');
            setQcQuantity(1);
            setQcNotes('');

            await refreshAllData();
            if (refetchProducts) refetchProducts();

            setTimeout(() => {
                setIsIntakeOpen(false);
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
            {/* Header Banner - Cleaned, No info text below title */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-purple-700">
                        <Handshake size={15} />
                        <span>Partner Products (50/50 Profit Share)</span>
                    </div>
                    <h1 className="text-xl font-black text-stone-900 tracking-tight mt-0.5">
                        Partner Products & Profit Management
                    </h1>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={refreshAllData}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh all data"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh</span>
                    </button>

                    <button
                        onClick={() => setIsAddPartnerOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                        <UserPlus size={14} />
                        <span>+ Add Partner</span>
                    </button>

                    <button
                        onClick={() => {
                            setFeedback(null);
                            setIsIntakeOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                        <Plus size={15} />
                        <span>+ Intake Partner Stock</span>
                    </button>
                </div>
            </div>

            {/* Top Stat Cards - Exactly 4 Clean Cards (Distinct SKU & Active Batches removed) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-stone-500 to-stone-700 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">In-Stock Units</span>
                        <Boxes size={14} className="text-stone-500" />
                    </div>
                    <div className="text-xl font-black text-stone-900">{stats.totalUnits}</div>
                    <p className="text-[10px] text-stone-400 font-medium">available for sale</p>
                </div>

                <div className="bg-white border border-stone-200 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Inventory Valuation</span>
                        <DollarSign size={14} className="text-blue-500" />
                    </div>
                    <div className="text-xl font-black text-stone-900">{formatPHP(stats.totalValue)}</div>
                    <p className="text-[10px] text-stone-400 font-medium">at retail selling price</p>
                </div>

                <div className="bg-white border border-purple-100 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-700 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">Partner Profit Share</span>
                        <Handshake size={14} className="text-purple-600" />
                    </div>
                    <div className="text-xl font-black text-purple-950">{formatPHP(stats.partnerProfit)}</div>
                    <p className="text-[10px] text-purple-600 font-medium">
                        {stats.unsettledShare > 0 ? `${formatPHP(stats.unsettledShare)} unsettled` : 'all settled'}
                    </p>
                </div>

                <div className="bg-white border border-emerald-100 rounded-xl p-3 shadow-xs relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-t-xl" />
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">CPM Profit Share</span>
                        <TrendingUp size={14} className="text-emerald-600" />
                    </div>
                    <div className="text-xl font-black text-emerald-900">{formatPHP(stats.cpmProfit)}</div>
                    <p className="text-[10px] text-emerald-600 font-medium">{stats.unitsSold} units sold</p>
                </div>
            </div>

            {/* Simple View Navigation & Filter Bar */}
            <div className="bg-white p-2.5 px-3 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* 3 Main View Tabs */}
                <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('inventory')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'inventory'
                                ? 'bg-white text-stone-900 shadow-xs font-black'
                                : 'text-stone-600 hover:text-stone-900'
                        }`}
                    >
                        <Boxes size={13} />
                        <span>Partner Stock</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('profits')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'profits'
                                ? 'bg-white text-purple-900 shadow-xs font-black'
                                : 'text-stone-600 hover:text-stone-900'
                        }`}
                    >
                        <DollarSign size={13} className="text-purple-600" />
                        <span>Partner Profits</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('partners')}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'partners'
                                ? 'bg-white text-stone-900 shadow-xs font-black'
                                : 'text-stone-600 hover:text-stone-900'
                        }`}
                    >
                        <Users size={13} />
                        <span>Partner List ({partnersList.length})</span>
                    </button>
                </div>

                {/* Partner Filter Pills & Search (for Inventory & Profits) */}
                {activeTab !== 'partners' && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Partner Pills from actual Partner List */}
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[320px]">
                            <button
                                onClick={() => setSelectedPartnerFilter('ALL')}
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                    selectedPartnerFilter === 'ALL'
                                        ? 'bg-purple-900 text-white shadow-xs font-black'
                                        : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                                }`}
                            >
                                All Partners
                            </button>
                            {partnersList.map(p => (
                                <button
                                    key={p.id || p.name}
                                    onClick={() => setSelectedPartnerFilter(p.name)}
                                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                        selectedPartnerFilter.toLowerCase() === p.name.toLowerCase()
                                            ? 'bg-purple-700 text-white shadow-xs font-black'
                                            : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200/50'
                                    }`}
                                >
                                    <Handshake size={10} />
                                    <span>{p.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-52">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search items or partner..."
                                className="w-full pl-8 pr-6 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:border-purple-600 font-medium"
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
                )}
            </div>

            {/* ============================================================= */}
            {/* TAB 1: INVENTORY TABLE */}
            {/* ============================================================= */}
            {activeTab === 'inventory' && (
                <div className="overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm min-h-[350px]">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-stone-100 shadow-xs z-10 text-[11px] uppercase tracking-wider text-stone-600 font-black border-b border-stone-200">
                            <tr>
                                <th className="px-3 py-2.5">SKU / Code</th>
                                <th className="px-3 py-2.5">Brand & Model</th>
                                <th className="px-3 py-2.5">Partner</th>
                                <th className="px-3 py-2.5">Split</th>
                                <th className="px-3 py-2.5">Location</th>
                                <th className="px-3 py-2.5 text-right">Cost Price</th>
                                <th className="px-3 py-2.5 text-right">Recommended SRP</th>
                                <th className="px-3 py-2.5 text-right">Selling Price</th>
                                <th className="px-3 py-2.5 text-right">In-Stock Qty</th>
                                <th className="px-3 py-2.5 text-right">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-xs">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 10 }).map((_, j) => (
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
                                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full text-[11px] font-black border border-purple-200">
                                                <Handshake size={11} className="text-purple-700" />
                                                {row.partnerName}
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
                                        <td className="px-3 py-2.5 text-right font-medium text-stone-600">
                                            {formatPHP(row.acquisitionPrice)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-bold text-stone-800">
                                            {formatPHP(row.recommendedSellingPrice || row.sellingPrice)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                                            {formatPHP(row.sellingPrice)}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <span className="font-black text-purple-950 text-sm">
                                                {row.remainingQuantity}
                                            </span>
                                            <span className="text-[10px] text-stone-400 ml-1">/ {row.quantity}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-black text-emerald-800">
                                            {formatPHP(Number(row.sellingPrice || 0) * Number(row.remainingQuantity || 0))}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-stone-500">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Handshake size={28} className="text-purple-400 stroke-1" />
                                            <p className="font-bold text-stone-700">No partner stock found.</p>
                                            <p className="text-xs text-stone-400">
                                                Click <strong>"+ Intake Partner Stock"</strong> to intake items directly into your branch!
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ============================================================= */}
            {/* TAB 2: PARTNER PROFITS */}
            {/* ============================================================= */}
            {activeTab === 'profits' && (
                <div className="space-y-3">
                    {/* Partner Breakdown Cards */}
                    {profitsData?.partnerBreakdown?.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                            {profitsData.partnerBreakdown.map((pb, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                                        <div className="flex items-center gap-1.5 font-black text-stone-900">
                                            <Handshake size={14} className="text-purple-600" />
                                            <span>{pb.partnerName}</span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
                                            {pb.unitsSold} units sold
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                                        <div>
                                            <span className="block text-[10px] font-bold text-stone-400 uppercase">Partner Profit</span>
                                            <strong className="text-purple-900 font-black">{formatPHP(pb.partnerShare)}</strong>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-stone-400 uppercase">CPM Share</span>
                                            <strong className="text-emerald-700 font-black">{formatPHP(pb.cpmShare)}</strong>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-stone-400 uppercase">Settled</span>
                                            <span className="text-stone-700 font-bold">{formatPHP(pb.settledShare)}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-amber-600 uppercase">Unsettled</span>
                                            <span className="text-amber-700 font-black">{formatPHP(pb.unsettledShare)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sales Ledger Table */}
                    <div className="overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm min-h-[350px]">
                        <div className="p-3 border-b border-stone-100 flex items-center justify-between bg-stone-50">
                            <div className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                                <Receipt size={14} className="text-stone-500" />
                                <span>Partner Sales Ledger & Settlement</span>
                            </div>
                            <span className="text-[11px] text-stone-500 font-medium">
                                Total {profitsData?.salesLedger?.length || 0} sales recorded
                            </span>
                        </div>

                        <table className="w-full text-left border-collapse">
                            <thead className="bg-stone-100 text-[11px] uppercase tracking-wider text-stone-600 font-black border-b border-stone-200">
                                <tr>
                                    <th className="px-3 py-2.5">Date</th>
                                    <th className="px-3 py-2.5">Partner</th>
                                    <th className="px-3 py-2.5">Item & SKU</th>
                                    <th className="px-3 py-2.5">Branch</th>
                                    <th className="px-3 py-2.5 text-right">Sale Price</th>
                                    <th className="px-3 py-2.5 text-right">Cost</th>
                                    <th className="px-3 py-2.5 text-right">Gross Profit</th>
                                    <th className="px-3 py-2.5 text-right">Partner Profit (50%)</th>
                                    <th className="px-3 py-2.5 text-center">Settlement Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-xs">
                                {profitsData?.salesLedger?.length > 0 ? (
                                    profitsData.salesLedger.map(row => (
                                        <tr key={row.id} className="hover:bg-purple-50/20">
                                            <td className="px-3 py-2 text-stone-500 font-mono text-[11px]">
                                                {row.transactionDate ? new Date(row.transactionDate).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-3 py-2 font-black text-stone-900">
                                                {row.partnerName}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-bold text-stone-800">{row.productName}</div>
                                                <div className="text-[10px] text-stone-400 font-mono">{row.sku}</div>
                                            </td>
                                            <td className="px-3 py-2 text-stone-600 font-medium">
                                                {row.branchName}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-stone-900">
                                                {formatPHP(row.sellingPrice)}
                                            </td>
                                            <td className="px-3 py-2 text-right text-stone-500">
                                                {formatPHP(row.costPrice)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-bold text-stone-800">
                                                {formatPHP(row.grossProfit)}
                                            </td>
                                            <td className="px-3 py-2 text-right font-black text-purple-900">
                                                {formatPHP(row.partnerShare)}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <button
                                                    onClick={() => handleToggleSettlement(row.id, row.settlementStatus)}
                                                    disabled={settlingId === row.id}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                        row.settlementStatus === 'PAID'
                                                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                                                    }`}
                                                    title="Click to toggle settlement status"
                                                >
                                                    {settlingId === row.id ? 'Saving...' : row.settlementStatus === 'PAID' ? '✓ Paid' : '⏳ Unpaid'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-10 text-center text-stone-500 text-xs">
                                            No partner sales recorded yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============================================================= */}
            {/* TAB 3: PARTNER LIST */}
            {/* ============================================================= */}
            {activeTab === 'partners' && (
                <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-stone-800">Registered Partners</h3>
                            <p className="text-[11px] text-stone-500">Manage partner profiles and default profit splits</p>
                        </div>
                        <button
                            onClick={() => setIsAddPartnerOpen(true)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-stone-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all"
                        >
                            <Plus size={13} />
                            <span>+ Add Partner</span>
                        </button>
                    </div>

                    <div className="divide-y divide-stone-100">
                        {partnersList.length > 0 ? (
                            partnersList.map(partner => (
                                <div key={partner.id || partner.name} className="p-3.5 hover:bg-stone-50 flex items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 font-black flex items-center justify-center text-sm">
                                            {partner.name ? partner.name.charAt(0).toUpperCase() : 'P'}
                                        </div>
                                        <div>
                                            <div className="font-black text-stone-900 text-sm flex items-center gap-2">
                                                <span>{partner.name}</span>
                                                <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[10px] font-black border border-purple-200">
                                                    {partner.defaultSplitPct || 50}% Profit Split
                                                </span>
                                            </div>
                                            <div className="text-stone-500 text-[11px] mt-0.5">
                                                {partner.contactInfo ? `Contact: ${partner.contactInfo}` : 'No contact specified'}
                                                {partner.notes ? ` · ${partner.notes}` : ''}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedPartnerFilter(partner.name);
                                                setActiveTab('inventory');
                                            }}
                                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                                        >
                                            View Stock
                                        </button>
                                        <button
                                            onClick={() => handleDeletePartner(partner.id, partner.name)}
                                            className="p-1 text-stone-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                            title="Archive partner"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-stone-400 text-xs">
                                No partners registered yet. Click "+ Add Partner" to create your first partner!
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================= */}
            {/* MODAL: ADD PARTNER */}
            {/* ============================================================= */}
            {isAddPartnerOpen && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
                        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-600 rounded-lg">
                                    <UserPlus size={16} className="text-white" />
                                </div>
                                <h3 className="text-sm font-black tracking-wide uppercase">Add New Partner</h3>
                            </div>
                            <button
                                onClick={() => setIsAddPartnerOpen(false)}
                                className="text-stone-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePartner} className="p-5 space-y-3.5">
                            <div>
                                <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                    Partner Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={partnerNameInput}
                                    onChange={e => setPartnerNameInput(e.target.value)}
                                    placeholder="Enter partner name..."
                                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                        Default Split (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="1"
                                            min="1"
                                            max="100"
                                            value={partnerSplitInput}
                                            onChange={e => setPartnerSplitInput(e.target.value)}
                                            className="w-full pl-3 pr-7 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">%</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                        Contact Info
                                    </label>
                                    <input
                                        type="text"
                                        value={partnerContactInput}
                                        onChange={e => setPartnerContactInput(e.target.value)}
                                        placeholder="Phone / Email..."
                                        className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                    Notes
                                </label>
                                <textarea
                                    rows="2"
                                    value={partnerNotesInput}
                                    onChange={e => setPartnerNotesInput(e.target.value)}
                                    placeholder="Optional partner notes..."
                                    className="w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                                <button
                                    type="button"
                                    onClick={() => setIsAddPartnerOpen(false)}
                                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md"
                                >
                                    {submitting ? 'Saving...' : 'Save Partner'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================= */}
            {/* MODAL: INTAKE PARTNER STOCK (Cost & Recommended SRP included) */}
            {/* ============================================================= */}
            {isIntakeOpen && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
                        {/* Modal Header */}
                        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-purple-600 rounded-lg">
                                    <Handshake size={16} className="text-white" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black tracking-wide uppercase">Intake Partner Stock</h3>
                                    <p className="text-[11px] text-stone-300">Set Cost, Recommended SRP & Selling Price</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsIntakeOpen(false)}
                                className="text-stone-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Mode Selector Tabs */}
                        <div className="flex border-b border-stone-200 bg-stone-50 px-5 pt-2.5 gap-2">
                            <button
                                type="button"
                                onClick={() => { setIntakeMode('catalog'); setFeedback(null); }}
                                className={`pb-2 px-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    intakeMode === 'catalog'
                                        ? 'border-purple-600 text-purple-700'
                                        : 'border-transparent text-stone-500 hover:text-stone-900'
                                }`}
                            >
                                <Boxes size={13} />
                                <span>From Catalog</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setIntakeMode('quick-create'); setFeedback(null); }}
                                className={`pb-2 px-3 text-xs font-black tracking-wider uppercase border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                                    intakeMode === 'quick-create'
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
                        {intakeMode === 'catalog' && (
                            <form onSubmit={handleSubmitCatalogIntake} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                                {/* Partner Select & Target Branch */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Partner *
                                        </label>
                                        <select
                                            value={catalogPartnerName}
                                            onChange={e => {
                                                setCatalogPartnerName(e.target.value);
                                                const match = partnersList.find(p => p.name === e.target.value);
                                                if (match?.defaultSplitPct) setCatalogSplitPct(match.defaultSplitPct);
                                            }}
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        >
                                            {partnersList.map(p => (
                                                <option key={p.id || p.name} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Split (%)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="1"
                                                min="1"
                                                max="100"
                                                value={catalogSplitPct}
                                                onChange={e => setCatalogSplitPct(e.target.value)}
                                                className="w-full pl-3 pr-7 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Destination
                                        </label>
                                        {isAdmin ? (
                                            <select
                                                value={catalogTargetBranchId}
                                                onChange={e => setCatalogTargetBranchId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
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

                                {/* Search Catalog Items */}
                                <div className="relative">
                                    <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                        Search Catalog Items to Add
                                    </label>
                                    <div className="relative">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                        <input
                                            type="text"
                                            value={catalogSearch}
                                            onChange={e => setCatalogSearch(e.target.value)}
                                            placeholder="Type product name, model or SKU..."
                                            className="w-full pl-9 pr-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50"
                                        />
                                    </div>

                                    {/* Search Dropdown */}
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
                                                        <span className="text-stone-500 text-[11px] ml-1.5">({item.color})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-emerald-700">{formatPHP(item.currentPrice)}</span>
                                                        <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded">
                                                            + Select
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Items List with Cost & Recommended SRP */}
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-wider text-stone-500 mb-1">
                                        Items to Intake ({selectedItems.length})
                                    </div>
                                    {selectedItems.length > 0 ? (
                                        <div className="space-y-2 border border-stone-200 rounded-xl p-2 bg-stone-50">
                                            {selectedItems.map(item => (
                                                <div key={item.variantId} className="bg-white p-3 rounded-lg border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
                                                    <div className="min-w-[140px]">
                                                        <div className="font-black text-stone-900">{item.brandName} {item.modelName}</div>
                                                        <div className="text-[10px] text-stone-400 font-mono">{item.sku} · {item.color}</div>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Qty</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'quantity', e.target.value)}
                                                                className="w-14 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-stone-800"
                                                            />
                                                        </div>

                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Cost (₱)</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.costPrice}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'costPrice', e.target.value)}
                                                                className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-stone-800"
                                                                title="Cost / Acquisition Price"
                                                            />
                                                        </div>

                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Rec. SRP (₱)</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.recommendedPrice}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'recommendedPrice', e.target.value)}
                                                                className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-blue-700"
                                                                title="Recommended Selling Price"
                                                            />
                                                        </div>

                                                        <div>
                                                            <span className="block text-[9px] uppercase font-bold text-stone-400">Store Sell (₱)</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.sellingPrice}
                                                                onChange={e => handleUpdateSelectedItem(item.variantId, 'sellingPrice', e.target.value)}
                                                                className="w-20 px-2 py-1 text-xs border border-stone-300 rounded font-bold text-emerald-700"
                                                                title="Actual Selling Price"
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSelectedItem(item.variantId)}
                                                            className="text-stone-400 hover:text-rose-600 p-1.5 rounded transition-colors"
                                                        >
                                                            <X size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 border border-dashed border-stone-300 rounded-xl text-xs text-stone-400">
                                            No items selected yet. Use the search box above to add catalog items.
                                        </div>
                                    )}
                                </div>

                                {/* Submit button */}
                                <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsIntakeOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || selectedItems.length === 0}
                                        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                    >
                                        {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Handshake size={14} />}
                                        <span>Receive Partner Stock</span>
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* FORM: MODE B (QUICK CREATE) */}
                        {intakeMode === 'quick-create' && (
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
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50"
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

                                {/* Pricing Options: Cost, Recommended SRP, Actual Selling Price */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200">
                                    <div>
                                        <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Quantity *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={qcQuantity}
                                            onChange={e => setQcQuantity(e.target.value)}
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-white font-black text-stone-900"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Cost Price (₱)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={qcAcqPrice}
                                            onChange={e => setQcAcqPrice(e.target.value)}
                                            placeholder="0"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-white font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Rec. SRP (₱)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={qcRecommendedPrice}
                                            onChange={e => setQcRecommendedPrice(e.target.value)}
                                            placeholder="Recommended"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-white font-bold text-blue-700"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Store Sell (₱) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            step="0.01"
                                            value={qcSellingPrice}
                                            onChange={e => setQcSellingPrice(e.target.value)}
                                            placeholder="3500"
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-white font-black text-emerald-700"
                                        />
                                    </div>
                                </div>

                                {/* Partner & Branch */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Partner *
                                        </label>
                                        <select
                                            value={qcPartnerName}
                                            onChange={e => {
                                                setQcPartnerName(e.target.value);
                                                const match = partnersList.find(p => p.name === e.target.value);
                                                if (match?.defaultSplitPct) setQcSplitPct(match.defaultSplitPct);
                                            }}
                                            className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                        >
                                            {partnersList.map(p => (
                                                <option key={p.id || p.name} value={p.name}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Split (%)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="1"
                                                min="1"
                                                max="100"
                                                value={qcSplitPct}
                                                onChange={e => setQcSplitPct(e.target.value)}
                                                className="w-full pl-3 pr-7 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1">
                                            Destination
                                        </label>
                                        {isAdmin ? (
                                            <select
                                                value={qcTargetBranchId}
                                                onChange={e => setQcTargetBranchId(e.target.value)}
                                                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-purple-600 bg-stone-50 font-bold"
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
                                        onClick={() => setIsIntakeOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-700 hover:bg-purple-800 text-white transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                    >
                                        {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        <span>Create & Intake Stock</span>
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
