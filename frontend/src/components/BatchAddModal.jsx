import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
    PackagePlus, Search, User, CreditCard, Tag, X,
    AlertCircle, CheckCircle, Loader2, ClipboardList, Trash2, Building2, Calendar
} from 'lucide-react';

const EMPTY_FORM = {
    supplierId: '',
    ownershipType: 'owned',
    partnerName: 'Pickle Gear',
    partnerSplitPct: '50',
    consigned: false,
    partner: false,
    status: 'RECEIVED',
    eta: '',
    totalExpense: ''
};

const fmt = (val) =>
    val != null && val !== '' ? `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

const BatchAddModal = ({ products = [], suppliers = [], onClose, onSuccess }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]); // Array of { variant, qty, baseCost }
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState({ type: '', message: '' });

    const [supplierSearch, setSupplierSearch] = useState('');
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

    // ── Product search ────────────────────────────────────────────────────────
    const inventoryList = useMemo(() =>
        products.flatMap(p => (p.variants || []).map(v => {
            const isShoe = p.category === 'Shoes';
            return {
                ...v,
                brandName: p.brandName,
                modelName: p.modelName,
                displayName: `${p.brandName} ${p.modelName}${v.color && v.color !== 'N/A' ? ` (${v.color})` : ''}${isShoe && v.shape ? ` Size ${v.shape}` : ''}`
            };
        })).sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true })),
    [products]);

    const filteredResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase();
        return inventoryList
            .filter(i =>
                (i.displayName || '').toLowerCase().includes(q) ||
                (i.sku || '').toLowerCase().includes(q) ||
                (i.brandName || '').toLowerCase().includes(q) ||
                (i.modelName || '').toLowerCase().includes(q)
            )
            .slice(0, 15); // Increased limit to help find recently added items
    }, [searchQuery, inventoryList]);

    // ── Supplier search ───────────────────────────────────────────────────────
    const filteredSuppliers = useMemo(() => {
        if (!supplierSearch) return suppliers;
        return suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()));
    }, [suppliers, supplierSearch]);

    const handleAddToCart = (item) => {
        const existing = cart.find(c => c.variant.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.variant.id === item.id ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([...cart, { variant: item, qty: 1, baseCost: item.acquisitionPrice || 0 }]);
        }
        setSearchQuery('');
        setStatus({ type: '', message: '' });
    };

    const updateCartItem = (variantId, field, value) => {
        setCart(cart.map(c => c.variant.id === variantId ? { ...c, [field]: value } : c));
    };

    const removeCartItem = (variantId) => {
        setCart(cart.filter(c => c.variant.id !== variantId));
    };

    // ── Math ──────────────────────────────────────────────────────────────────
    const totalItems = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
    const cartBaseTotal = cart.reduce((sum, item) => sum + ((parseFloat(item.baseCost) || 0) * (parseInt(item.qty) || 0)), 0);

    // Auto-update total expense when cart items/costs change
    useEffect(() => {
        setFormData(f => ({ ...f, totalExpense: cartBaseTotal === 0 ? '' : cartBaseTotal.toString() }));
    }, [cartBaseTotal]);

    const parsedTotalExpense = parseFloat(formData.totalExpense) || 0;

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleConfirm = async () => {
        setSubmitting(true);
        setStatus({ type: '', message: '' });

        const isConsigned = formData.ownershipType === 'consigned';
        const isPartner = formData.ownershipType === 'partner';
        const payload = {
            supplierId: formData.supplierId ? parseInt(formData.supplierId) : null,
            consigned: isConsigned,
            partner: isPartner,
            partnerName: isPartner ? (formData.partnerName || 'Pickle Gear') : null,
            partnerSplitPct: isPartner ? (parseFloat(formData.partnerSplitPct) || 50) : null,
            status: formData.status,
            eta: formData.status === 'INCOMING' ? formData.eta : null,
            totalExpense: parsedTotalExpense,
            items: cart.map(item => ({
                variantId: item.variant.id,
                quantity: parseInt(item.qty) || 1,
                baseCost: parseFloat(item.baseCost) || 0,
                consigned: isConsigned,
                partner: isPartner,
                partnerName: isPartner ? (formData.partnerName || 'Pickle Gear') : null,
                partnerSplitPct: isPartner ? (parseFloat(formData.partnerSplitPct) || 50) : null
            }))
        };

        try {
            await axios.post(`/api/batch-actions/receive`, payload);
            if (onSuccess) onSuccess();
        } catch (err) {
            setStatus({ type: 'error', message: err.response?.data?.error || 'Failed to process batch.' });
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col lg:flex-row overflow-hidden">
                
                {/* LEFT COLUMN: BUILD BATCH */}
                <div className="flex-[3] flex flex-col border-b lg:border-b-0 lg:border-r border-stone-200 overflow-y-auto bg-white p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <PackagePlus className="text-indigo-600" size={24} />
                            <h2 className="text-xl font-black text-zinc-900 uppercase tracking-wide">Batch Incoming Stock</h2>
                        </div>
                        <button onClick={onClose} className="text-zinc-400 hover:text-red-500 lg:hidden"><X size={24} /></button>
                    </div>

                    {status.message && (
                        <div className={`p-4 mb-6 rounded-lg flex items-center gap-3 ${status.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                            {status.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                            <span className="font-medium flex-1">{status.message}</span>
                        </div>
                    )}

                    <div className="relative mb-8">
                        <label className="block text-sm font-bold text-zinc-700 mb-2 flex items-center gap-2">
                            <Tag size={16} /> Search & Add Product
                        </label>
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                            <input
                                type="text" value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                placeholder="Type SKU or Brand name to add to batch..."
                            />
                        </div>
                        {searchQuery && filteredResults.length > 0 && (
                            <div className="absolute w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-50 overflow-hidden">
                                {filteredResults.map(item => (
                                    <div key={item.sku} onClick={() => handleAddToCart(item)}
                                        className="px-4 py-3 hover:bg-indigo-50 cursor-pointer text-sm border-b border-stone-100 last:border-0 border-l-4 border-l-transparent hover:border-l-indigo-500 transition-colors">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <span className="font-bold text-zinc-900">{item.displayName}</span>
                                                <span className="block text-xs font-mono text-zinc-400 mt-0.5">SKU: {item.sku}</span>
                                            </div>
                                            <span className="text-xs font-bold text-zinc-500 bg-stone-100 px-2 py-1 rounded">
                                                In Stock: {item.stockQuantity}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {searchQuery && filteredResults.length === 0 && (
                            <div className="absolute w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-50 p-4 text-center text-zinc-500 text-sm">
                                No items found matching "{searchQuery}".
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-bold text-zinc-700">Batch Items ({cart.length})</label>
                            {totalItems > 0 && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{totalItems} Total Units</span>}
                        </div>
                        
                        {cart.length === 0 ? (
                            <div className="p-10 border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center text-zinc-400 h-48 bg-stone-50/50">
                                <PackagePlus size={40} className="mb-3 opacity-20" />
                                <p className="text-sm font-bold text-zinc-500">No items selected.</p>
                                <p className="text-xs mt-1">Search above to build your incoming batch.</p>
                            </div>
                        ) : (
                            cart.map((item, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-stone-200 rounded-xl bg-white shadow-sm gap-4 hover:border-indigo-200 transition-colors">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-zinc-900 truncate">{item.variant.displayName}</p>
                                        <p className="text-xs font-mono text-zinc-500 mt-0.5">SKU: {item.variant.sku}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 w-full sm:w-auto">
                                        <div className="w-20">
                                            <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Qty</label>
                                            <input type="number" min="1" required value={item.qty}
                                                onChange={e => updateCartItem(item.variant.id, 'qty', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-stone-50" />
                                        </div>
                                        <div className="w-28">
                                            <label className="block text-[10px] uppercase tracking-wider font-bold text-zinc-500 mb-1">Acq. Cost (ea)</label>
                                            <input type="number" step="0.01" min="0" required value={item.baseCost}
                                                onChange={e => updateCartItem(item.variant.id, 'baseCost', e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-emerald-700 bg-emerald-50/30" />
                                        </div>
                                        <button type="button" onClick={() => removeCartItem(item.variant.id)}
                                            className="text-zinc-400 hover:text-red-500 p-2 mt-5 transition-colors bg-stone-50 hover:bg-red-50 rounded-lg">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: BATCH DETAILS */}
                <div className="flex-[2] bg-stone-50 p-6 lg:p-8 flex flex-col overflow-y-auto">
                    <div className="flex justify-end mb-6 hidden lg:flex">
                        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-800 transition-colors p-1 bg-stone-200 hover:bg-stone-300 rounded-full"><X size={18} /></button>
                    </div>

                    <div className="space-y-6 flex-1">
                        <div className="relative">
                            <label className="block text-sm font-bold text-zinc-700 mb-2 flex items-center gap-2">
                                <Building2 size={16} className="text-zinc-400" /> Supplier
                            </label>

                            <div 
                                className="w-full border border-stone-300 rounded-xl bg-white flex items-center justify-between cursor-text shadow-sm relative z-20"
                                onClick={() => setShowSupplierDropdown(true)}
                            >
                                <Search size={16} className="absolute left-4 text-zinc-400" />
                                <input 
                                    value={supplierSearch} 
                                    onChange={e => {
                                        setSupplierSearch(e.target.value);
                                        setFormData(f => ({ ...f, supplierId: '' }));
                                        setShowSupplierDropdown(true);
                                    }}
                                    onFocus={() => setShowSupplierDropdown(true)}
                                    className="w-full pl-10 pr-4 py-3 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl text-sm"
                                    placeholder={formData.supplierId ? suppliers.find(s => s.id === formData.supplierId)?.name : "Search & Select Supplier..."}
                                />
                                {formData.supplierId && !supplierSearch && (
                                   <span className="absolute right-4 text-indigo-600 font-bold text-xs bg-indigo-50 px-2 py-1 rounded">Selected</span>
                                )}
                            </div>
                            
                            {showSupplierDropdown && (
                                <div className="absolute w-full mt-2 bg-white border border-stone-200 rounded-xl shadow-2xl z-[100] max-h-60 overflow-y-auto">
                                    <div className="p-2 border-b border-stone-100 flex justify-between items-center bg-stone-50 sticky top-0">
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">{filteredSuppliers.length} found</span>
                                        <button onClick={() => setShowSupplierDropdown(false)} className="p-1 hover:bg-stone-200 rounded-lg text-zinc-400"><X size={14}/></button>
                                    </div>
                                    {filteredSuppliers.length === 0 ? (
                                        <div className="p-4 text-center text-zinc-500 text-sm">No suppliers matching "{supplierSearch}"</div>
                                    ) : (
                                        filteredSuppliers.map(s => (
                                            <div 
                                                key={s.id} 
                                                className={`px-4 py-3 cursor-pointer text-sm font-bold border-l-4 transition-colors ${formData.supplierId === s.id ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-transparent hover:bg-stone-50 text-zinc-700'}`}
                                                onClick={() => {
                                                    setFormData({ ...formData, supplierId: s.id });
                                                    setSupplierSearch('');
                                                    setShowSupplierDropdown(false);
                                                }}
                                            >
                                                {s.name}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Ownership & Status</label>
                            <div className="space-y-2">
                                <div className="grid grid-cols-3 gap-1.5 bg-stone-200/50 p-1.5 rounded-xl border border-stone-200 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, ownershipType: 'owned', consigned: false, partner: false }))}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.ownershipType === 'owned' ? 'bg-white text-green-700 shadow border border-stone-200' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        ✅ Owned
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, ownershipType: 'partner', consigned: false, partner: true }))}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.ownershipType === 'partner' ? 'bg-purple-100 text-purple-800 shadow border border-purple-200' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        🤝 Partner (50/50)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, ownershipType: 'consigned', consigned: true, partner: false }))}
                                        className={`py-2 rounded-lg text-xs font-bold transition-all ${formData.ownershipType === 'consigned' ? 'bg-amber-100 text-amber-800 shadow border border-amber-200' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        📦 Consigned
                                    </button>
                                </div>

                                {formData.ownershipType === 'partner' && (
                                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                                        <div className="flex justify-between items-center text-xs font-bold text-purple-900">
                                            <span>Partner Attribution</span>
                                            <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 py-0.5 rounded font-black">50% Net Profit Share</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="block text-[11px] font-bold text-purple-800 mb-1">Partner Name</label>
                                                <input type="text" value={formData.partnerName || ''}
                                                    onChange={e => setFormData({ ...formData, partnerName: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 border border-purple-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-purple-600"
                                                    placeholder="e.g. Pickle Gear" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-purple-800 mb-1">Partner Share %</label>
                                                <input type="number" min="1" max="99" value={formData.partnerSplitPct || '50'}
                                                    onChange={e => setFormData({ ...formData, partnerSplitPct: e.target.value })}
                                                    className="w-full px-2.5 py-1.5 border border-purple-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-purple-600"
                                                    placeholder="50" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 bg-stone-200/50 p-1.5 rounded-xl border border-stone-200 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, status: 'RECEIVED' }))}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.status === 'RECEIVED' ? 'bg-indigo-600 text-white shadow border border-indigo-700' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        📍 Received
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(f => ({ ...f, status: 'INCOMING' }))}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.status === 'INCOMING' ? 'bg-blue-100 text-blue-800 shadow border border-blue-200' : 'text-zinc-500 hover:text-zinc-700'}`}
                                    >
                                        🚚 Incoming
                                    </button>
                                </div>
                            </div>
                        </div>

                        {formData.status === 'INCOMING' && (
                            <div style={{ animation: 'fadeSlideIn 150ms ease' }}>
                                <label className="block text-sm font-bold text-zinc-700 mb-2 flex items-center gap-2">
                                    <Calendar size={16} className="text-zinc-400" /> Expected Delivery (ETA)
                                </label>
                                <input type="date" value={formData.eta}
                                    onChange={e => setFormData({ ...formData, eta: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    required={formData.status === 'INCOMING'}
                                    className="w-full px-4 py-3 border border-stone-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm shadow-sm"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 mb-2">Total Batch Expense to Log (₱)</label>
                            <input type="number" step="0.01" min="0" value={formData.totalExpense}
                                onChange={e => setFormData({ ...formData, totalExpense: e.target.value })}
                                className="w-full px-4 py-3 border border-indigo-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-bold text-indigo-900 shadow-sm"
                                placeholder="e.g. 23000" />
                            <p className="text-xs text-zinc-500 mt-2">
                                Enter the EXACT total amount to reflect in the Expenses tab.
                            </p>
                        </div>
                        
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mt-4">
                            <div className="flex items-start gap-3">
                                <ClipboardList className="text-indigo-600 shrink-0 mt-0.5" size={18} />
                                <div className="text-xs text-indigo-900 leading-relaxed font-medium">
                                    When submitted, an expense of <strong className="font-black text-indigo-700">{fmt(parsedTotalExpense)}</strong> will automatically be logged.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-stone-200 shrink-0">
                        <div className="space-y-2 mb-6">
                            <div className="flex justify-between items-center text-sm font-bold text-zinc-500">
                                <span>Items Acq. Value (Info Only)</span>
                                <span>{fmt(cartBaseTotal)}</span>
                            </div>
                            <div className="flex justify-between items-end border-t border-dashed border-stone-300 pt-3 mt-3">
                                <span className="font-black text-zinc-800 uppercase tracking-wide">Expense to Log</span>
                                <span className="text-3xl font-black text-green-700">{fmt(parsedTotalExpense)}</span>
                            </div>
                        </div>
                        
                        <button 
                            onClick={handleConfirm} 
                            disabled={cart.length === 0 || submitting}
                            className="w-full bg-zinc-950 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-800 disabled:bg-stone-300 disabled:cursor-not-allowed transition-all shadow-md text-lg"
                        >
                            {submitting ? (
                                <><Loader2 size={20} className="animate-spin" /> Processing...</>
                            ) : (
                                <><CheckCircle size={20} /> Receive Stock Batch</>
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default BatchAddModal;
