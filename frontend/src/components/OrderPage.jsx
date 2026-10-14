import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
    ShoppingCart, Search, User, CreditCard, Tag, X,
    AlertCircle, CheckCircle, Loader2, ClipboardList, Trash2,
    Printer, Receipt, Store, Layers, Plus, Minus, ArrowRight,
    RefreshCw, CheckCircle2, Check, Banknote, QrCode, Split
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EMPTY_FORM = {
    customerName: '',
    paymentMethod: 'GCash',
    orderNote: '',
    splits: [{ method: 'GCash', amount: '' }, { method: 'Cash', amount: '' }]
};

const fmt = (val) =>
    val != null && val !== '' ? `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';

const CATEGORY_STYLES = {
    Paddles: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    Accessories: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    Balls: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    Shoes: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    Bags: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    Apparel: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
    Default: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' }
};

const PAYMENT_METHODS = [
    { id: 'GCash', label: 'GCash', icon: QrCode },
    { id: 'Cash', label: 'Cash', icon: Banknote },
    { id: 'Maya', label: 'Maya', icon: QrCode },
    { id: 'Credit Card', label: 'Card', icon: CreditCard },
    { id: 'QRPH', label: 'QRPH', icon: QrCode },
    { id: 'Split Payment', label: 'Split', icon: Split }
];

// Ticket number is built once per cart cycle
const newTicketNumber = () =>
    'TRX-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

const OrderPage = ({ products = [], loading = false, refetchProducts }) => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery]         = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart]                       = useState([]); // Array of { variant, qty, finalPrice, paymentStatus, downpayment }
    const [formData, setFormData]               = useState(EMPTY_FORM);
    const [showSummary, setShowSummary]         = useState(false);
    const [submitting, setSubmitting]           = useState(false);
    const [status, setStatus]                   = useState({ type: '', message: '' });
    const [ticketNumber, setTicketNumber]       = useState(newTicketNumber);

    // Consignment additions
    const [orderMode, setOrderMode]             = useState('REGULAR'); // REGULAR or CONSIGNMENT
    const [consignees, setConsignees]           = useState([]);
    const [selectedConsigneeId, setSelectedConsigneeId] = useState('');
    const [showAddConsignee, setShowAddConsignee] = useState(false);
    const [newConsigneeName, setNewConsigneeName] = useState('');

    const handlePrintTicket = () => window.print();

    const fetchConsignees = async () => {
        try {
            const res = await axios.get(`/api/consignees`);
            setConsignees(Array.isArray(res.data) ? res.data : []);
        } catch {
            console.error('Failed to fetch consignees');
        }
    };

    useEffect(() => {
        if (refetchProducts) refetchProducts();
        fetchConsignees();
    }, []);

    const handleAddConsignee = async () => {
        if (!newConsigneeName.trim()) return;
        try {
            const res = await axios.post(`/api/consignees`, { name: newConsigneeName });
            setConsignees([...consignees, res.data]);
            setSelectedConsigneeId(res.data.id.toString());
            setShowAddConsignee(false);
            setNewConsigneeName('');
        } catch {
            alert('Error adding consignee');
        }
    };

    // Flatten all variants with category info
    const inventoryList = useMemo(() => {
        return products.flatMap(p => (p.variants || []).map(v => {
            const isShoe = p.category === 'Shoes';
            const specs = [
                v.color && v.color !== 'N/A' ? v.color : '',
                v.thicknessMm ? `${v.thicknessMm}mm` : '',
                v.shape && v.shape !== 'N/A' ? v.shape : ''
            ].filter(Boolean).join(' • ') || 'Standard';

            return {
                ...v,
                productCategory: p.category || 'General',
                productBrand: p.brandName,
                productModel: p.modelName,
                variantSpecs: specs,
                displayName: `${p.brandName} ${p.modelName}${v.color && v.color !== 'N/A' ? ` (${v.color})` : ''}${isShoe && v.shape ? ` Size ${v.shape}` : ''}`
            };
        })).sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true }));
    }, [products]);

    // Unique Categories
    const categories = useMemo(() => {
        const set = new Set(['All']);
        products.forEach(p => {
            if (p.category) set.add(p.category);
        });
        return Array.from(set);
    }, [products]);

    // Filtered Catalog
    const filteredCatalog = useMemo(() => {
        let list = inventoryList;
        if (selectedCategory !== 'All') {
            list = list.filter(item => item.productCategory === selectedCategory);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(item =>
                (item.displayName || '').toLowerCase().includes(q) ||
                (item.sku || '').toLowerCase().includes(q) ||
                (item.productBrand || '').toLowerCase().includes(q) ||
                (item.productModel || '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [inventoryList, selectedCategory, searchQuery]);

    // Quick lookup map for quantities in cart
    const cartMap = useMemo(() => {
        const map = new Map();
        cart.forEach(item => {
            map.set(item.variant.id, item.qty);
        });
        return map;
    }, [cart]);

    const handleAddToCart = (item) => {
        const existing = cart.find(c => c.variant.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.variant.id === item.id ? { ...c, qty: c.qty + 1 } : c));
        } else {
            setCart([...cart, { variant: item, qty: 1, finalPrice: item.sellingPrice, paymentStatus: 'PAID', downpayment: '' }]);
        }
        setStatus({ type: '', message: '' });
    };

    const updateCartItem = (variantId, field, value) => {
        setCart(cart.map(c => c.variant.id === variantId ? { ...c, [field]: value } : c));
    };

    const handleQtyStep = (variantId, delta) => {
        const item = cart.find(c => c.variant.id === variantId);
        if (!item) return;
        const newQty = item.qty + delta;
        if (newQty <= 0) {
            removeCartItem(variantId);
        } else {
            updateCartItem(variantId, 'qty', Math.min(newQty, item.variant.stockQuantity || 999));
        }
    };

    const removeCartItem = (variantId) => {
        setCart(cart.filter(c => c.variant.id !== variantId));
    };

    // Totals
    const totalUnits = useMemo(() => cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0), [cart]);
    const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + ((parseFloat(item.finalPrice) || 0) * (parseInt(item.qty) || 0)), 0), [cart]);
    const amountPaid = useMemo(() => cart.reduce((sum, item) => {
        if (item.paymentStatus === 'PAID') return sum + ((parseFloat(item.finalPrice) || 0) * (parseInt(item.qty) || 0));
        if (item.paymentStatus === 'PARTIAL') return sum + ((parseFloat(item.downpayment) || 0) * (parseInt(item.qty) || 0));
        return sum;
    }, 0), [cart]);
    const amountUnpaid = cartTotal - amountPaid;

    const resetForm = () => {
        setCart([]);
        setFormData(EMPTY_FORM);
        setShowSummary(false);
        setSearchQuery('');
        setStatus({ type: '', message: '' });
        setTicketNumber(newTicketNumber());
        setOrderMode('REGULAR');
        setSelectedConsigneeId('');
        setShowAddConsignee(false);
        setNewConsigneeName('');
    };

    const handleConfirm = () => {
        const oversold = cart.find(item => parseInt(item.qty) > item.variant.stockQuantity);
        if (oversold) {
            setShowSummary(false);
            setStatus({
                type: 'error',
                message: `"${oversold.variant.displayName}" only has ${oversold.variant.stockQuantity} in stock but you selected ${oversold.qty}.`
            });
            return;
        }

        setSubmitting(true);
        const generatedTransactionId = ticketNumber;
        const payloads = [];

        let remainingSplits = [];
        if (formData.paymentMethod === 'Split Payment' && formData.splits && formData.splits.length > 0) {
            remainingSplits = JSON.parse(JSON.stringify(formData.splits));
        }

        cart.forEach(item => {
            const qty = parseInt(item.qty) || 1;
            const pricePerItem = parseFloat(item.finalPrice) || 0;

            for(let i = 0; i < qty; i++) {
                let amountToPayForItem = 0;
                if (item.paymentStatus === 'PAID') amountToPayForItem = pricePerItem;
                else if (item.paymentStatus === 'PARTIAL') amountToPayForItem = parseFloat(item.downpayment || 0);

                let itemSplits = [];
                if (formData.paymentMethod === 'Split Payment' && amountToPayForItem > 0) {
                    let itemRemaining = amountToPayForItem;
                    for (let split of remainingSplits) {
                        if (itemRemaining <= 0) break;
                        const splitAmt = parseFloat(split.amount) || 0;
                        if (splitAmt <= 0) continue;

                        let take = Math.min(itemRemaining, splitAmt);
                        itemSplits.push({ method: split.method, amount: take });
                        split.amount = splitAmt - take;
                        itemRemaining -= take;
                    }
                }

                payloads.push({
                    transactionId: generatedTransactionId,
                    variant: { id: item.variant.id },
                    customerName: orderMode === 'CONSIGNMENT'
                        ? (consignees.find(c => c.id.toString() === selectedConsigneeId)?.name || '')
                        : formData.customerName,
                    paymentMethod: formData.paymentMethod,
                    paymentDetails: formData.orderNote,
                    status: item.paymentStatus === 'PAID' ? 'FULL' : (item.paymentStatus === 'PARTIAL' ? 'PARTIAL' : 'UNPAID'),
                    downpayment: amountToPayForItem,
                    finalPrice: pricePerItem,
                    transactionType: orderMode,
                    consignee: orderMode === 'CONSIGNMENT' && selectedConsigneeId ? { id: parseInt(selectedConsigneeId) } : null,
                    splits: itemSplits.length > 0 ? itemSplits : null
                });
            }
        });

        const processOrder = async () => {
            const failedItems = [];
            for (const p of payloads) {
                try {
                    await axios.post(`/api/transactions`, p);
                } catch (err) {
                    failedItems.push(err.response?.data?.error || 'Unknown error');
                }
            }

            setShowSummary(false);
            if (failedItems.length === 0) {
                setStatus({ type: 'success', message: `Order #${generatedTransactionId} placed successfully!` });
                resetForm();
                if (refetchProducts) refetchProducts();
            } else if (failedItems.length < payloads.length) {
                setStatus({ type: 'error', message: `Order partially placed — ${payloads.length - failedItems.length} of ${payloads.length} items saved. ${failedItems[0]}` });
                if (refetchProducts) refetchProducts();
            } else {
                setStatus({ type: 'error', message: failedItems[0] || 'Error processing order. Check inventory.' });
            }
            setSubmitting(false);
        };

        processOrder();
    };

    return (
        <div className="max-w-7xl mx-auto w-full space-y-5">
            {/* Print-only CSS */}
            <style>{`
                @media print {
                    body * { visibility: hidden !important; }
                    .pos-ticket-printable, .pos-ticket-printable * { visibility: visible !important; }
                    aside, header, .pos-ticket-no-print { display: none !important; }
                    html, body, #root, .App, .flex, main { overflow: visible !important; height: auto !important; background: white !important; }
                    .pos-ticket-printable {
                        position: absolute !important; left: 0 !important; top: 0 !important;
                        width: 72mm !important; max-width: 72mm !important; padding: 4mm !important;
                        background: white !important; font-size: 9px !important; line-height: 1.25 !important;
                    }
                    @page { size: 72mm auto; margin: 0; }
                }
            `}</style>

            {/* ─── Top Banner (Aesthetic Header) ─── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm pos-ticket-no-print">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Store size={16} />
                        <span>{user?.branchName || 'Point of Sale'}</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        POS Multi-Item Checkout
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        Select items from the catalog on the left to build the order cart, then configure payment and finalize receipt.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    {cart.length > 0 && (
                        <button
                            onClick={resetForm}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-rose-50 hover:text-rose-600 text-stone-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                            <Trash2 size={13} />
                            <span>Clear Cart</span>
                        </button>
                    )}
                    <button
                        onClick={() => refetchProducts && refetchProducts()}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh catalog items"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh Catalog</span>
                    </button>
                </div>
            </div>

            {/* Status alerts */}
            {status.message && (
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 shadow-sm pos-ticket-no-print ${
                    status.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                    <div className="flex items-center gap-2.5 text-sm font-semibold">
                        {status.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-red-600" />}
                        <span>{status.message}</span>
                    </div>
                    <button onClick={() => setStatus({ type: '', message: '' })} className="hover:opacity-75">
                        <X size={15} />
                    </button>
                </div>
            )}

            {/* ─── TWO-COLUMN WORKSPACE (7 cols : 5 cols) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pos-ticket-no-print">

                {/* ─── LEFT PANEL: 1. CATALOG PRODUCTS (7 cols) ─── */}
                <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-[740px]">
                    <div className="space-y-3 mb-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                                1. Catalog Products
                            </label>
                            <span className="text-[11px] font-bold text-stone-400">
                                Click "+ Add" to add to cart
                            </span>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by brand, model, SKU, or color..."
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium text-stone-900 placeholder-stone-400 focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                                >
                                    <X size={15} />
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
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center text-stone-400">
                                <Loader2 size={30} className="animate-spin text-stone-400 mb-2" />
                                <span className="text-xs font-bold">Loading live catalog…</span>
                            </div>
                        ) : filteredCatalog.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-center text-stone-400">
                                <Search size={36} className="text-stone-300 mb-2 stroke-[1.5]" />
                                <p className="text-sm font-bold text-stone-600">No matching products found</p>
                                <p className="text-xs text-stone-400 mt-0.5">Try searching with a different brand, model, or category.</p>
                            </div>
                        ) : (
                            filteredCatalog.map(item => {
                                const inCartQty = cartMap.get(item.id) || 0;
                                const isAvailable = (item.stockQuantity || 0) > 0;
                                const style = CATEGORY_STYLES[item.productCategory] || CATEGORY_STYLES.Default;

                                return (
                                    <div
                                        key={item.id}
                                        className={`p-4 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                                            inCartQty > 0
                                                ? 'bg-stone-50 border-stone-300 shadow-sm'
                                                : 'bg-white hover:bg-stone-50/70 border-stone-200 hover:border-stone-300 shadow-sm'
                                        }`}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md border ${style.bg} ${style.text} ${style.border}`}>
                                                    {item.productCategory}
                                                </span>
                                                <span className="font-mono text-xs text-stone-400 truncate">
                                                    {item.sku}
                                                </span>
                                                {inCartQty > 0 && (
                                                    <span className="px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        ✓ {inCartQty} in cart
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-black text-stone-900 leading-snug truncate">
                                                {item.productBrand} {item.productModel}
                                            </h4>

                                            <div className="text-xs text-stone-500 font-medium mt-0.5 flex items-center gap-2">
                                                <span>{item.variantSpecs}</span>
                                                <span className="text-stone-300">•</span>
                                                <span className={isAvailable ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                                    {isAvailable ? `${item.stockQuantity} in stock` : 'Out of stock'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 shrink-0">
                                            <div className="text-right">
                                                <span className="text-base font-black text-emerald-600 font-mono block">
                                                    {fmt(item.sellingPrice)}
                                                </span>
                                                <span className="text-[10px] text-stone-400 font-medium">per unit</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleAddToCart(item)}
                                                disabled={!isAvailable}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                                                    isAvailable
                                                        ? inCartQty > 0
                                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95'
                                                            : 'bg-stone-900 hover:bg-stone-800 text-white shadow-sm active:scale-95'
                                                        : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                                }`}
                                            >
                                                <Plus size={13} />
                                                <span>{inCartQty > 0 ? 'Add More' : 'Add'}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ─── RIGHT PANEL: 2. ORDER CART & CHECKOUT (5 cols) ─── */}
                <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col h-[740px]">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                                2. Order Cart
                            </label>
                            <span className="text-[11px] font-bold text-stone-400">
                                Configure quantities & payment
                            </span>
                        </div>
                        <span className="text-xs font-black bg-stone-900 text-white px-3 py-1 rounded-full shadow-sm">
                            {cart.length} items • {totalUnits} units
                        </span>
                    </div>

                    {/* Cart Items List */}
                    <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1 custom-scrollbar">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-16 text-stone-400">
                                <Layers size={44} className="text-stone-200 mb-2.5 stroke-[1.2]" />
                                <h4 className="text-sm font-black uppercase tracking-wider text-stone-600">Cart is Empty</h4>
                                <p className="text-xs text-stone-400 mt-1 max-w-[220px]">
                                    Click "+ Add" on any catalog item on the left to add it to this order.
                                </p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <div
                                    key={item.variant.id}
                                    className="p-3.5 bg-stone-50/80 border border-stone-200 rounded-xl space-y-2.5"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <h5 className="text-xs font-black text-stone-900 truncate">
                                                {item.variant.displayName}
                                            </h5>
                                            <span className="text-[10px] font-mono text-stone-400">
                                                {item.variant.sku}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeCartItem(item.variant.id)}
                                            className="text-stone-400 hover:text-rose-500 transition-colors p-1"
                                            title="Remove item"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200/60">
                                        {/* Stepper */}
                                        <div className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-lg p-0.5 shadow-sm">
                                            <button
                                                type="button"
                                                onClick={() => handleQtyStep(item.variant.id, -1)}
                                                className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded text-xs font-bold"
                                            >
                                                <Minus size={11} />
                                            </button>
                                            <span className="w-8 text-center text-xs font-black text-stone-900">
                                                {item.qty}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleQtyStep(item.variant.id, 1)}
                                                className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded text-xs font-bold"
                                            >
                                                <Plus size={11} />
                                            </button>
                                        </div>

                                        {/* Price & Payment Status */}
                                        <div className="flex items-center gap-2">
                                            <select
                                                value={item.paymentStatus}
                                                onChange={(e) => updateCartItem(item.variant.id, 'paymentStatus', e.target.value)}
                                                className="text-[10px] font-black uppercase px-2 py-1 bg-white border border-stone-200 rounded-md focus:outline-none"
                                            >
                                                <option value="PAID">PAID</option>
                                                <option value="PARTIAL">PARTIAL</option>
                                                <option value="UNPAID">UNPAID</option>
                                            </select>
                                            <div className="text-right">
                                                <span className="text-xs font-black text-emerald-600 font-mono">
                                                    {fmt(item.finalPrice * item.qty)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {item.paymentStatus === 'PARTIAL' && (
                                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-200/60 text-xs">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase">Paid / Unit:</span>
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.finalPrice}
                                                value={item.downpayment || ''}
                                                onChange={(e) => updateCartItem(item.variant.id, 'downpayment', e.target.value)}
                                                placeholder="0.00"
                                                className="w-24 px-2 py-1 text-right text-xs font-black border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-stone-900"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Customer & Checkout Controls */}
                    {cart.length > 0 && (
                        <div className="pt-3 border-t border-stone-200 space-y-3 shrink-0">
                            {/* Mode Toggle */}
                            <div className="flex bg-stone-100 p-1 rounded-xl text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setOrderMode('REGULAR')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                                        orderMode === 'REGULAR' ? 'bg-white text-stone-900 shadow-sm font-black' : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    Regular Sale
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderMode('CONSIGNMENT')}
                                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                                        orderMode === 'CONSIGNMENT' ? 'bg-white text-stone-900 shadow-sm font-black' : 'text-stone-500 hover:text-stone-800'
                                    }`}
                                >
                                    Consignment
                                </button>
                            </div>

                            {/* Customer / Consignee Input */}
                            {orderMode === 'REGULAR' ? (
                                <div>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customerName}
                                        onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                        placeholder="Customer Name (e.g. Juan dela Cruz)"
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-medium focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner"
                                    />
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedConsigneeId}
                                            onChange={(e) => setSelectedConsigneeId(e.target.value)}
                                            className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none"
                                        >
                                            <option value="" disabled>-- Select Consignee --</option>
                                            {consignees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddConsignee(v => !v)}
                                            className="px-2.5 py-1 text-xs font-black bg-stone-100 hover:bg-stone-200 rounded-xl"
                                        >
                                            + New
                                        </button>
                                    </div>
                                    {showAddConsignee && (
                                        <div className="flex gap-1.5">
                                            <input
                                                type="text"
                                                value={newConsigneeName}
                                                onChange={(e) => setNewConsigneeName(e.target.value)}
                                                placeholder="New consignee name..."
                                                className="flex-1 px-3 py-1 text-xs border border-stone-200 rounded-lg"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddConsignee}
                                                className="px-3 py-1 bg-stone-900 text-white text-xs font-bold rounded-lg"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Payment Method Pills */}
                            <div>
                                <span className="block text-[10px] font-black uppercase tracking-wider text-stone-400 mb-1.5">
                                    Payment Method:
                                </span>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {PAYMENT_METHODS.map(m => {
                                        const isSelected = formData.paymentMethod === m.id;
                                        const Icon = m.icon;
                                        return (
                                            <button
                                                key={m.id}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, paymentMethod: m.id })}
                                                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-stone-900 border-stone-900 text-white shadow-sm'
                                                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                                                }`}
                                            >
                                                <Icon size={12} />
                                                <span>{m.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Split payment definitions */}
                            {formData.paymentMethod === 'Split Payment' && (
                                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
                                    <div className="flex justify-between items-center text-[10px] font-black uppercase text-stone-500">
                                        <span>Define Splits</span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, splits: [...(formData.splits || []), { method: 'Cash', amount: '' }] })}
                                            className="text-emerald-700 font-bold hover:underline"
                                        >
                                            + Add
                                        </button>
                                    </div>
                                    {(formData.splits || []).map((split, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <select
                                                value={split.method}
                                                onChange={(e) => {
                                                    const s = [...formData.splits]; s[idx].method = e.target.value;
                                                    setFormData({ ...formData, splits: s });
                                                }}
                                                className="flex-1 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold"
                                            >
                                                <option value="GCash">GCash</option>
                                                <option value="Cash">Cash</option>
                                                <option value="Maya">Maya</option>
                                                <option value="Credit Card">Card</option>
                                                <option value="QRPH">QRPH</option>
                                            </select>
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={split.amount}
                                                onChange={(e) => {
                                                    const s = [...formData.splits]; s[idx].amount = e.target.value;
                                                    setFormData({ ...formData, splits: s });
                                                }}
                                                placeholder="Amount"
                                                className="w-24 px-2 py-1 text-xs font-mono font-bold bg-white border border-stone-200 rounded-lg text-right"
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Order Total & Submit Action */}
                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                                        Grand Total
                                    </span>
                                    <span className="text-2xl font-black text-stone-900 font-mono leading-none">
                                        {fmt(cartTotal)}
                                    </span>
                                </div>
                                {amountUnpaid > 0 && (
                                    <span className="text-[10px] font-black px-2 py-1 rounded bg-amber-100 text-amber-800">
                                        Unpaid: {fmt(amountUnpaid)}
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowSummary(true)}
                                disabled={
                                    cart.length === 0 ||
                                    (orderMode === 'REGULAR' ? !formData.customerName.trim() : !selectedConsigneeId) ||
                                    (formData.paymentMethod === 'Split Payment' && (formData.splits || []).reduce((s, x) => s + (parseFloat(x.amount)||0), 0) !== amountPaid)
                                }
                                className="w-full py-3.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 disabled:cursor-not-allowed text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                                <span>Review & Checkout ({fmt(cartTotal)})</span>
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ─── REVIEW & CHECKOUT MODAL ─── */}
            {showSummary && (
                <div className="fixed inset-0 bg-stone-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm pos-ticket-no-print">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="bg-stone-950 px-6 py-4 flex items-center justify-between text-white shrink-0">
                            <div className="flex items-center gap-2.5">
                                <ClipboardList size={18} className="text-emerald-400" />
                                <h3 className="text-base font-black uppercase tracking-wider">Review Order Ticket</h3>
                            </div>
                            <button onClick={() => setShowSummary(false)} className="text-stone-400 hover:text-white">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5">
                            {/* Meta Card */}
                            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 grid grid-cols-2 gap-4 text-xs">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-0.5">
                                        {orderMode === 'REGULAR' ? 'Customer' : 'Consignee'}
                                    </span>
                                    <span className="font-black text-stone-900 text-sm">
                                        {orderMode === 'REGULAR' ? formData.customerName : consignees.find(c => c.id.toString() === selectedConsigneeId)?.name}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-0.5">
                                        Payment Method
                                    </span>
                                    <span className="font-black text-stone-900 text-sm">
                                        {formData.paymentMethod}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-0.5">
                                        Ticket Number
                                    </span>
                                    <span className="font-mono font-bold text-stone-700">
                                        {ticketNumber}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-0.5">
                                        Status
                                    </span>
                                    <span className="font-bold text-emerald-700">
                                        {amountUnpaid > 0 ? 'Partial Payment' : 'Fully Paid'}
                                    </span>
                                </div>
                            </div>

                            {/* Cart Items Table */}
                            <div>
                                <span className="text-xs font-black uppercase tracking-wider text-stone-500 mb-2 block">
                                    Items ({totalUnits} units)
                                </span>
                                <div className="border border-stone-200 rounded-xl overflow-hidden divide-y divide-stone-100 text-xs">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="p-3 bg-white flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="font-black text-stone-900 truncate">
                                                    {item.qty}x {item.variant.displayName}
                                                </div>
                                                <div className="font-mono text-[10px] text-stone-400">
                                                    {item.variant.sku}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-black text-stone-900 font-mono">
                                                    {fmt(item.finalPrice * item.qty)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                                        Total Payable
                                    </span>
                                    <span className="text-2xl font-black text-emerald-700 font-mono">
                                        {fmt(cartTotal)}
                                    </span>
                                </div>
                                {amountUnpaid > 0 && (
                                    <div className="text-right">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                                            Unpaid Balance
                                        </span>
                                        <span className="text-lg font-black text-amber-700 font-mono">
                                            {fmt(amountUnpaid)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Action Footer */}
                        <div className="p-5 bg-stone-50 border-t border-stone-200 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={handlePrintTicket}
                                className="px-4 py-3 bg-white hover:bg-stone-100 border border-stone-200 text-stone-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                                <Printer size={15} />
                                <span>Print Ticket</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowSummary(false)}
                                disabled={submitting}
                                className="flex-1 py-3 px-4 border border-stone-300 font-black text-xs uppercase tracking-wider text-stone-600 hover:bg-stone-100 rounded-xl transition-all cursor-pointer"
                            >
                                Edit Order
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                disabled={submitting}
                                className="flex-[2] py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" />
                                        <span>Processing…</span>
                                    </>
                                ) : (
                                    <>
                                        <Check size={15} />
                                        <span>Confirm Checkout</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Printable Ticket */}
            <div className="pos-ticket-printable hidden">
                <div className="text-center mb-3">
                    <div className="ticket-header-title text-[15px] font-black tracking-wider uppercase">Cebu Pickleball Market</div>
                    <div className="ticket-header-subtitle text-[10px] text-zinc-500 mt-0.5">Authorized Paddle Retailer</div>
                    <div className="ticket-header-subtitle text-[10px] text-zinc-500">{user?.branchName || 'Branch Terminal'}</div>
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                <div className="space-y-0.5 mb-2 text-[10px]">
                    <div className="flex justify-between"><span>Ticket:</span><span className="font-bold">{ticketNumber}</span></div>
                    <div className="flex justify-between"><span>Customer:</span><span className="font-bold">{formData.customerName || 'Walk-in'}</span></div>
                    <div className="flex justify-between"><span>Payment:</span><span className="font-bold">{formData.paymentMethod}</span></div>
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                <div className="space-y-1 mb-2">
                    {cart.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                            <span>{item.qty}x {item.variant.displayName}</span>
                            <span className="font-bold">{fmt(item.finalPrice * item.qty)}</span>
                        </div>
                    ))}
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                <div className="flex justify-between text-[13px] font-black">
                    <span>TOTAL:</span>
                    <span>{fmt(cartTotal)}</span>
                </div>
            </div>
        </div>
    );
};

export default OrderPage;