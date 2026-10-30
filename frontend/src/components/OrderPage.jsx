import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    ShoppingCart, Search, User, CreditCard, Tag, X,
    AlertCircle, CheckCircle, Loader2, ClipboardList, Trash2,
    Printer, Receipt, Store, Layers, Plus, Minus, ArrowRight,
    RefreshCw, CheckCircle2, Check, Banknote, QrCode, Split,
    Pen, DollarSign, Calendar, Eye, EyeOff, Lock, Key, ShieldCheck,
    Landmark, Smartphone, Building2, FileText, ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BranchPasswordModal from './BranchPasswordModal';

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
    { id: 'Cash', label: 'Cash', icon: Banknote },
    { id: 'GCash', label: 'GCash', icon: QrCode },
    { id: 'Maya', label: 'Maya', icon: QrCode },
    { id: 'GoTyme', label: 'GoTyme', icon: Smartphone },
    { id: 'BDO', label: 'BDO', icon: Landmark },
    { id: 'BPI', label: 'BPI', icon: Landmark },
    { id: 'MBOS', label: 'MBOS', icon: Building2 },
    { id: 'Credit Card', label: 'Card', icon: CreditCard },
    { id: 'QRPH', label: 'QRPH', icon: QrCode },
    { id: 'Split Payment', label: 'Split', icon: Split }
];

// Ticket number is built once per cart cycle
const newTicketNumber = () =>
    'TRX-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

// Dedicated thermal printer function using an isolated, freshly-created iframe.
// This completely avoids browser print preview caching (where previous receipts print repeatedly)
// and ensures synchronous, deterministic printing of the exact order snapshot.
const printThermalReceipt = (data) => {
    if (!data) return;

    // Purge any existing printing iframe to guarantee a 100% fresh print spool context
    const existingIframe = document.getElementById('pos-thermal-printer-iframe');
    if (existingIframe) {
        existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'pos-thermal-printer-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const {
        ticketNumber = '---',
        date = new Date(),
        customerName = 'Walk-in Customer',
        paymentMethod = 'Cash',
        branchName = '',
        items = [],
        totalUnits = 0,
        cartTotal = 0,
        amountPaid = 0,
        amountUnpaid = 0,
        orderMode = 'REGULAR'
    } = data;

    const receiptDate = date instanceof Date ? date : new Date(date);
    const dateStr = receiptDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = receiptDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    const rawBranch = branchName || '';
    const displayBranch = rawBranch
        ? (rawBranch.toUpperCase().includes('BRANCH') ? rawBranch.toUpperCase() : `${rawBranch.toUpperCase()} BRANCH`)
        : 'PUNTA BRANCH';

    const fmtMoney = (val) => '₱' + (Number(val) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const itemsHtml = items.length === 0
        ? `<div style="text-align: center; color: #777; padding: 10px 0; font-style: italic;">Cart is empty</div>`
        : items.map(item => {
            const qty = parseInt(item.qty, 10) || 0;
            const price = parseFloat(item.finalPrice) || 0;
            const lineTotal = item.lineTotal != null ? item.lineTotal : (qty * price);
            const name = item.displayName || item.variant?.displayName || item.sku || 'Item';
            const specs = item.specs || (item.variantSpecs && item.variantSpecs !== 'Standard'
                ? item.variantSpecs
                : (item.variant?.color && item.variant?.color !== 'N/A' ? item.variant.color : ''));
            const isUnpaid = item.paymentStatus === 'UNPAID';

            return `
                <div style="margin-bottom: 5px; font-size: 10px; line-height: 1.25;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1; padding-right: 6px;">
                            <strong style="color: #000;">${qty} &times; ${name}</strong>
                            ${specs ? `<div style="color: #555; font-size: 9px;">${specs}</div>` : ''}
                            ${isUnpaid ? `<div style="color: #c00; font-weight: bold; font-size: 9px;">[UNPAID]</div>` : ''}
                        </div>
                        <div style="font-weight: bold; white-space: nowrap; text-align: right;">
                            ${fmtMoney(lineTotal)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const hasUnpaid = (amountUnpaid || 0) > 0;

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Receipt #${ticketNumber}</title>
    <style>
        @page {
            size: 72mm auto;
            margin: 0;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
        }
        body {
            padding: 4mm 3mm;
            width: 66mm;
            box-sizing: border-box;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
            font-size: 10px;
            line-height: 1.3;
            color: #000;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
            height: 0;
        }
        .divider-double {
            border-top: 3px double #000;
            margin: 6px 0;
            height: 0;
        }
        .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="text-center" style="margin-bottom: 6px;">
        <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.05em; text-transform: uppercase;">
            CEBU PICKLEBALL MARKET
        </div>
        <div style="font-size: 9px; color: #555; margin-top: 2px;">
            Authorized Paddle Retailer
        </div>
        <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 2px;">
            ${displayBranch}
        </div>
    </div>

    <div class="divider"></div>

    <div style="font-size: 10px; line-height: 1.4;">
        <div class="flex-between">
            <span style="color: #555;">Ticket #:</span>
            <strong style="font-family: monospace; font-size: 11px;">${ticketNumber}</strong>
        </div>
        <div class="flex-between">
            <span style="color: #555;">Date:</span>
            <span>${dateStr} &middot; ${timeStr}</span>
        </div>
        <div class="flex-between">
            <span style="color: #555;">Customer:</span>
            <strong>${customerName || 'Walk-in Customer'}</strong>
        </div>
        <div class="flex-between">
            <span style="color: #555;">Payment:</span>
            <strong>${paymentMethod}</strong>
        </div>
        ${orderMode === 'CONSIGNMENT' ? `
            <div class="flex-between" style="color: #92400e;">
                <span>Mode:</span>
                <strong>Consignment Out</strong>
            </div>
        ` : ''}
    </div>

    <div class="divider"></div>

    <div style="margin: 4px 0;">
        ${itemsHtml}
    </div>

    <div class="divider"></div>

    <div style="font-size: 10px; line-height: 1.4;">
        <div class="flex-between">
            <span style="color: #555;">Total Items:</span>
            <span>${totalUnits} units</span>
        </div>
        <div class="flex-between">
            <span style="color: #555;">Subtotal:</span>
            <span>${fmtMoney(cartTotal)}</span>
        </div>
    </div>

    <div class="divider-double"></div>

    <div class="flex-between" style="font-size: 13px; font-weight: 900;">
        <span>TOTAL:</span>
        <span style="font-size: 14px;">${fmtMoney(cartTotal)}</span>
    </div>

    ${hasUnpaid ? `
        <div style="margin-top: 5px; padding: 4px 6px; background: #fdf6ec; border: 1px dashed #d97706; font-size: 10px; line-height: 1.3;">
            <div class="flex-between" style="color: #047857; font-weight: bold;">
                <span>PAID NOW:</span>
                <span>${fmtMoney(amountPaid)}</span>
            </div>
            <div class="flex-between" style="color: #b45309; font-weight: bold; margin-top: 2px;">
                <span>UNPAID BALANCE:</span>
                <span>${fmtMoney(amountUnpaid)}</span>
            </div>
        </div>
    ` : ''}

    <div class="divider"></div>

    <div class="text-center" style="font-size: 9px; color: #555; margin-top: 6px; line-height: 1.3;">
        <strong style="color: #222;">Thank you for your purchase!</strong><br>
        Keep this receipt for warranty &amp; returns.
    </div>
</body>
</html>`;

    const frameDoc = iframe.contentWindow || iframe.contentDocument;
    const doc = frameDoc.document || frameDoc;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
        try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        } catch (err) {
            console.error('Iframe print error, falling back to window.print():', err);
            window.print();
        }
    }, 150);
};

const OrderPage = ({ products = [], loading = false, refetchProducts }) => {
    const { user, isBranch, isCashier, isAdmin, currentBranchId } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const isHqDirectMode = isAdmin && searchParams.get('mode') === 'hq';
    const activeBranchId = isHqDirectMode ? null : ((isBranch || isCashier) ? user?.branchId : (currentBranchId || user?.branchId || 1));
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
    const [consigneeSearchTerm, setConsigneeSearchTerm] = useState('');
    const [isConsigneeDropdownOpen, setIsConsigneeDropdownOpen] = useState(false);
    const [showAddConsignee, setShowAddConsignee] = useState(false);
    const [newConsigneeName, setNewConsigneeName] = useState('');

    // Filter active (non-archived) consignees
    const activeConsignees = useMemo(() => {
        return consignees.filter(c => !c.archived);
    }, [consignees]);

    const filteredConsignees = useMemo(() => {
        if (!consigneeSearchTerm.trim()) return activeConsignees;
        const q = consigneeSearchTerm.trim().toLowerCase();
        return activeConsignees.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.contactInfo && c.contactInfo.toLowerCase().includes(q)) ||
            (c.branch?.name && c.branch.name.toLowerCase().includes(q))
        );
    }, [activeConsignees, consigneeSearchTerm]);

    const selectedConsigneeObj = useMemo(() => {
        if (!selectedConsigneeId) return null;
        return consignees.find(c => c.id.toString() === selectedConsigneeId.toString()) || null;
    }, [consignees, selectedConsigneeId]);

    // --- IN-TAB PRICE EDITING STATE ---
    const [priceModalOpen, setPriceModalOpen]   = useState(false);
    const [editingVariant, setEditingVariant]   = useState(null);
    const [newPriceInput, setNewPriceInput]     = useState('');
    const [savingPrice, setSavingPrice]         = useState(false);

    // --- CASHIER PRICE CHANGE AUTHORIZATION STATE ---
    const [authModalOpen, setAuthModalOpen]             = useState(false);
    const [pendingEditData, setPendingEditData]         = useState(null); // { variant, currentCartPrice }
    const [authPassword, setAuthPassword]               = useState('');
    const [authVerifying, setAuthVerifying]             = useState(false);
    const [authError, setAuthError]                     = useState('');
    const [showAuthPassword, setShowAuthPassword]       = useState(false);
    const [verifiedPassword, setVerifiedPassword]       = useState('');

    // --- BRANCH OWNER PASSWORD MODAL ---
    const [branchPasswordModalOpen, setBranchPasswordModalOpen] = useState(false);

    // --- RECEIPT SYSTEM STATE ---
    const [completedReceipt, setCompletedReceipt] = useState(null);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // Prints the active in-progress cart slip (for Cart Slip button and Order Summary modal)
    const handlePrintCurrentCart = () => {
        const customerDisplay = orderMode === 'REGULAR'
            ? (formData.customerName || 'Walk-in Customer')
            : (consignees.find(c => c.id?.toString() === selectedConsigneeId?.toString())?.name || 'Consignment Account');

        printThermalReceipt({
            ticketNumber,
            customerName: customerDisplay,
            paymentMethod: formData.paymentMethod,
            orderMode,
            orderNote: formData.orderNote,
            items: cart.map(item => ({
                displayName: item.variant?.displayName || item.displayName,
                sku: item.variant?.sku || item.sku,
                specs: item.variant?.variantSpecs || item.specs,
                qty: item.qty,
                finalPrice: item.finalPrice,
                paymentStatus: item.paymentStatus,
                lineTotal: (parseFloat(item.finalPrice) || 0) * (parseInt(item.qty, 10) || 0)
            })),
            totalUnits,
            cartTotal,
            amountPaid,
            amountUnpaid,
            branchName: isHqDirectMode ? 'Central HQ Direct Store (Master Inventory)' : (user?.branchName || 'Cebu Pickleball Market'),
            date: new Date()
        });
    };

    // Prints the completed transaction receipt
    const handlePrintCompletedReceipt = () => {
        if (completedReceipt) {
            printThermalReceipt(completedReceipt);
        }
    };

    // Generic fallback handler
    const handlePrintTicket = () => {
        if (showReceiptModal && completedReceipt) {
            handlePrintCompletedReceipt();
        } else {
            handlePrintCurrentCart();
        }
    };

    const openPriceEdit = (variant, currentCartPrice = null) => {
        if (isCashier) {
            // In cashier mode, ask for manager/branch password first
            setPendingEditData({ variant, currentCartPrice });
            setAuthPassword('');
            setAuthError('');
            setShowAuthPassword(false);
            setAuthModalOpen(true);
            return;
        }

        // Branch Owner or Admin can directly edit price
        setEditingVariant(variant);
        const p = currentCartPrice != null ? currentCartPrice : (variant.sellingPrice || '');
        setNewPriceInput(p != null ? p.toString() : '');
        setVerifiedPassword('');
        setPriceModalOpen(true);
    };

    const handleVerifyCashierAuth = async (e) => {
        e.preventDefault();
        if (!authPassword.trim()) {
            setAuthError('Please enter the authorization password.');
            return;
        }

        setAuthVerifying(true);
        setAuthError('');

        try {
            const targetBranchId = activeBranchId || user?.branchId || 1;
            const res = await axios.post('/api/branches/verify-price-password', {
                password: authPassword.trim(),
                branchId: targetBranchId
            });

            if (res.data?.valid) {
                const { variant, currentCartPrice } = pendingEditData || {};
                setVerifiedPassword(authPassword.trim());
                setAuthModalOpen(false);
                setEditingVariant(variant);
                const p = currentCartPrice != null ? currentCartPrice : (variant?.sellingPrice || '');
                setNewPriceInput(p != null ? p.toString() : '');
                setPriceModalOpen(true);
            }
        } catch (err) {
            console.error('Password verification failed:', err);
            setAuthError(err.response?.data?.error || 'Incorrect password. Authorization failed.');
        } finally {
            setAuthVerifying(false);
        }
    };

    const handleSavePrice = (e) => {
        e.preventDefault();
        if (!editingVariant) return;
        const val = parseFloat(newPriceInput);
        if (isNaN(val) || val < 0) {
            alert('Please enter a valid non-negative selling price.');
            return;
        }

        // Temporary price adjustment strictly for this transaction / active sale
        setCart(prev => {
            const exists = prev.find(c => c.variant.id === editingVariant.id);
            if (exists) {
                return prev.map(c =>
                    c.variant.id === editingVariant.id ? { ...c, finalPrice: val } : c
                );
            }
            return [...prev, {
                variant: editingVariant,
                qty: 1,
                finalPrice: val,
                paymentStatus: 'PAID',
                downpayment: ''
            }];
        });

        setPriceModalOpen(false);
        setVerifiedPassword('');
        setStatus({
            type: 'success',
            message: `Sale price for "${editingVariant.displayName || editingVariant.sku}" set to ${fmt(val)} for this transaction.`
        });
    };

    const fetchConsignees = async () => {
        try {
            const params = activeBranchId ? { branchId: activeBranchId } : {};
            const res = await axios.get(`/api/consignees`, { params });
            setConsignees(Array.isArray(res.data) ? res.data : []);
        } catch {
            console.error('Failed to fetch consignees');
        }
    };

    useEffect(() => {
        try {
            sessionStorage.removeItem('pos_order_success');
        } catch (e) {
            // Clean up any legacy session storage key
        }
    }, []);

    useEffect(() => {
        if (refetchProducts) refetchProducts();
        fetchConsignees();
    }, [activeBranchId]);

    const handleAddConsignee = async () => {
        if (!newConsigneeName.trim()) return;
        try {
            const payload = {
                name: newConsigneeName.trim(),
                branch: activeBranchId ? { id: activeBranchId } : null,
                archived: false
            };
            const params = activeBranchId ? { branchId: activeBranchId } : { branchId: 0 };
            const res = await axios.post(`/api/consignees`, payload, { params });
            setConsignees(prev => [...prev, res.data]);
            setSelectedConsigneeId(res.data.id.toString());
            setShowAddConsignee(false);
            setNewConsigneeName('');
            setConsigneeSearchTerm('');
            setIsConsigneeDropdownOpen(false);
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

            const effectiveStock = isHqDirectMode ? (v.mainStock ?? 0) : (v.stockQuantity ?? 0);

            return {
                ...v,
                productCategory: p.category || 'General',
                productBrand: p.brandName,
                productModel: p.modelName,
                variantSpecs: specs,
                effectiveStock,
                stockQuantity: effectiveStock,
                displayName: `${p.brandName} ${p.modelName}${v.color && v.color !== 'N/A' ? ` (${v.color})` : ''}${isShoe && v.shape ? ` Size ${v.shape}` : ''}`
            };
        })).sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true }));
    }, [products, isHqDirectMode]);

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

    // Auto-clamp cart quantities if stock changes or exceeds available units
    useEffect(() => {
        if (cart.length > 0 && inventoryList.length > 0) {
            setCart(prev => {
                let changed = false;
                const next = prev.map(c => {
                    const live = inventoryList.find(i => i.id === c.variant.id);
                    if (!live) return c;
                    const maxStock = live.stockQuantity ?? 0;
                    if (maxStock <= 0) {
                        changed = true;
                        return null;
                    }
                    if (c.qty > maxStock) {
                        changed = true;
                        return {
                            ...c,
                            qty: maxStock,
                            variant: { ...c.variant, stockQuantity: maxStock }
                        };
                    }
                    return c;
                }).filter(Boolean);

                return changed ? next : prev;
            });
        }
    }, [inventoryList]);

    const handleAddToCart = (item) => {
        // Clear previous completed receipt whenever a new item is added to cart
        if (completedReceipt) {
            setCompletedReceipt(null);
        }
        const maxStock = item.stockQuantity ?? 0;
        if (maxStock <= 0) {
            setStatus({ type: 'error', message: `Cannot add "${item.displayName || item.sku}": Out of stock.` });
            return;
        }

        const existing = cart.find(c => c.variant.id === item.id);
        if (existing) {
            if (existing.qty >= maxStock) {
                setStatus({
                    type: 'error',
                    message: `Maximum available stock (${maxStock}) already in cart for "${item.displayName || item.sku}".`
                });
                return;
            }
            setCart(cart.map(c => c.variant.id === item.id ? { ...c, qty: Math.min(maxStock, c.qty + 1) } : c));
        } else {
            setCart([...cart, { variant: item, qty: 1, finalPrice: item.sellingPrice, paymentStatus: 'PAID', downpayment: '' }]);
        }
        setStatus({ type: '', message: '' });
    };

    const updateCartItem = (variantId, field, value) => {
        setCart(cart.map(c => {
            if (c.variant.id !== variantId) return c;
            if (field === 'qty') {
                const maxStock = c.variant.stockQuantity ?? 0;
                const parsed = parseInt(value, 10);
                if (isNaN(parsed) || parsed <= 0) return { ...c, qty: 1 };
                return { ...c, qty: Math.min(parsed, maxStock) };
            }
            return { ...c, [field]: value };
        }));
    };

    const handleQtyStep = (variantId, delta) => {
        const item = cart.find(c => c.variant.id === variantId);
        if (!item) return;
        const maxStock = item.variant.stockQuantity ?? 0;
        const newQty = item.qty + delta;
        if (newQty <= 0) {
            removeCartItem(variantId);
        } else if (newQty > maxStock) {
            setStatus({
                type: 'error',
                message: `Maximum stock for "${item.variant.displayName || item.variant.sku}" is ${maxStock}.`
            });
        } else {
            updateCartItem(variantId, 'qty', newQty);
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
        setConsigneeSearchTerm('');
        setIsConsigneeDropdownOpen(false);
        setShowAddConsignee(false);
        setNewConsigneeName('');
        setCompletedReceipt(null);
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
                    branch: isHqDirectMode ? null : (activeBranchId ? { id: activeBranchId } : null),
                    customerName: orderMode === 'CONSIGNMENT'
                        ? (consignees.find(c => c.id.toString() === selectedConsigneeId)?.name || '')
                        : formData.customerName,
                    paymentMethod: formData.paymentMethod,
                    paymentDetails: formData.orderNote,
                    notes: formData.orderNote,
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
                // Build complete receipt record
                const customerDisplay = orderMode === 'REGULAR'
                    ? (formData.customerName || 'Walk-in Customer')
                    : (consignees.find(c => c.id.toString() === selectedConsigneeId)?.name || 'Consignment Account');

                const receiptData = {
                    ticketNumber: generatedTransactionId,
                    date: new Date(),
                    customerName: customerDisplay,
                    paymentMethod: formData.paymentMethod,
                    splits: formData.paymentMethod === 'Split Payment' ? formData.splits : null,
                    orderMode,
                    orderNote: formData.orderNote,
                    notes: formData.orderNote,
                    items: cart.map(item => ({
                        id: item.variant.id,
                        displayName: item.variant.displayName,
                        sku: item.variant.sku,
                        specs: item.variant.variantSpecs,
                        qty: item.qty,
                        finalPrice: item.finalPrice,
                        paymentStatus: item.paymentStatus,
                        downpayment: item.downpayment,
                        lineTotal: (parseFloat(item.finalPrice) || 0) * (parseInt(item.qty, 10) || 0)
                    })),
                    totalUnits,
                    cartTotal,
                    amountPaid,
                    amountUnpaid,
                    branchName: isHqDirectMode ? 'Central HQ Direct Store (Master Inventory)' : (user?.branchName || 'Cebu Pickleball Market')
                };

                setCompletedReceipt(receiptData);
                setShowReceiptModal(true);
                setStatus({ type: 'success', message: `Order #${generatedTransactionId} placed successfully!` });

                // Reset the active cart and advance the ticket number for the next transaction
                setCart([]);
                setFormData(EMPTY_FORM);
                setTicketNumber(newTicketNumber());
                setOrderMode('REGULAR');
                setSelectedConsigneeId('');
                setConsigneeSearchTerm('');
                setIsConsigneeDropdownOpen(false);
                setShowAddConsignee(false);
                setNewConsigneeName('');

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

    // Active receipt preview derivation:
    // If the completed receipt modal is open, preview that completed order.
    // If the cart currently has items, preview the active cart slip.
    // Otherwise, show completed receipt if available, or fall back to empty cart.
    const isModalReceipt = showReceiptModal && completedReceipt;
    const isCartActive = cart.length > 0;

    const currentCustomerDisplay = orderMode === 'REGULAR'
        ? (formData.customerName || 'Walk-in Customer')
        : (consignees.find(c => c.id?.toString() === selectedConsigneeId?.toString())?.name || 'Consignment Account');

    const activeRawBranch = isModalReceipt
        ? completedReceipt.branchName
        : (isHqDirectMode ? 'Central HQ Direct Store (Master Inventory)' : (user?.branchName || ''));

    const branchDisplayName = activeRawBranch
        ? (activeRawBranch.toUpperCase().includes('BRANCH')
            ? activeRawBranch.toUpperCase()
            : `${activeRawBranch.toUpperCase()} BRANCH`)
        : 'PUNTA BRANCH';

    const activeReceiptDate = isModalReceipt
        ? (completedReceipt.date ? new Date(completedReceipt.date) : new Date())
        : new Date();
    const dateStr = activeReceiptDate.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = activeReceiptDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

    const activeTicketNumber = isModalReceipt
        ? completedReceipt.ticketNumber
        : (isCartActive ? ticketNumber : (completedReceipt?.ticketNumber || ticketNumber));

    const activeCustomer = isModalReceipt
        ? completedReceipt.customerName
        : (isCartActive ? currentCustomerDisplay : (completedReceipt?.customerName || currentCustomerDisplay));

    const activePaymentMethod = isModalReceipt
        ? completedReceipt.paymentMethod
        : (isCartActive ? formData.paymentMethod : (completedReceipt?.paymentMethod || formData.paymentMethod));

    const activeReceiptItems = isModalReceipt
        ? (completedReceipt.items || [])
        : (isCartActive ? cart : (completedReceipt?.items || []));

    const activeTotalAmount = isModalReceipt
        ? completedReceipt.cartTotal
        : (isCartActive ? cartTotal : (completedReceipt?.cartTotal ?? cartTotal));

    const activePaidAmount = isModalReceipt
        ? completedReceipt.amountPaid
        : (isCartActive ? amountPaid : (completedReceipt?.amountPaid ?? amountPaid));

    const activeUnpaidAmount = isModalReceipt
        ? completedReceipt.amountUnpaid
        : (isCartActive ? amountUnpaid : (completedReceipt?.amountUnpaid ?? amountUnpaid));

    const activeHasUnpaid = activeUnpaidAmount > 0;

    const activeTotalUnits = isModalReceipt
        ? completedReceipt.totalUnits
        : (isCartActive ? totalUnits : (completedReceipt?.totalUnits ?? totalUnits));

    return (
        <div className="max-w-7xl mx-auto w-full min-w-0 space-y-5">
            {/* Print-only CSS: Replicated from original thermal printer settings (72mm thermal width) */}
            <style>{`
                @media print {
                    /* Hide everything on the page by default */
                    body * {
                        visibility: hidden !important;
                    }

                    /* Make only the receipt ticket and its contents visible */
                    .pos-ticket-printable, .pos-ticket-printable * {
                        visibility: visible !important;
                    }

                    /* Remove layout-blocking elements, headers, sidebars, modals from taking space */
                    aside, header, nav, .pos-ticket-no-print, [role="dialog"], .backdrop-blur-sm {
                        display: none !important;
                    }

                    /* Prevent parent containers from clipping the ticket */
                    html, body, #root, .App, .flex, .flex-col, .flex-1, main, div, .overflow-hidden, .overflow-y-auto {
                        overflow: visible !important;
                        height: auto !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        background: white !important;
                        border: none !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        position: static !important;
                    }

                    /* Target printable container (72mm thermal width, matching original commit) */
                    .pos-ticket-printable {
                        display: block !important;
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 72mm !important;
                        max-width: 72mm !important;
                        height: auto !important;
                        max-height: none !important;
                        padding: 3mm 4mm !important;
                        background: white !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        overflow: visible !important;
                        font-family: monospace, 'Courier New', Courier !important;
                        font-size: 9px !important;
                        line-height: 1.25 !important;
                        color: #000000 !important;
                        z-index: 9999999 !important;
                    }

                    .pos-ticket-printable * {
                        color: #000000 !important;
                    }

                    .pos-ticket-printable .ticket-header-title {
                        font-size: 12px !important;
                        font-weight: 900 !important;
                        letter-spacing: 0.05em !important;
                    }

                    .pos-ticket-printable .ticket-header-sub {
                        font-size: 8px !important;
                    }

                    .pos-ticket-printable .ticket-header-branch {
                        font-size: 9px !important;
                        font-weight: bold !important;
                    }

                    .pos-ticket-printable .ticket-divider {
                        border-top: 1px dashed #000000 !important;
                        margin: 4px 0 !important;
                        height: 0 !important;
                    }

                    .pos-ticket-printable .ticket-double {
                        border-top: 3px double #000000 !important;
                        margin: 4px 0 !important;
                        height: 0 !important;
                    }

                    .pos-ticket-printable .ticket-item {
                        font-size: 9px !important;
                        margin-bottom: 2px !important;
                    }

                    .pos-ticket-printable .ticket-total {
                        font-size: 13px !important;
                        font-weight: 900 !important;
                    }

                    .pos-ticket-printable .ticket-total-label {
                        font-size: 10px !important;
                        font-weight: 900 !important;
                    }

                    @page {
                        size: 72mm auto;
                        margin: 0;
                    }
                }
            `}</style>

            {/* ─── Top Banner (Aesthetic Header) ─── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm pos-ticket-no-print">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Store size={16} />
                        <span>{isHqDirectMode ? 'Central HQ — Master Holding Storage' : (user?.branchName || 'Point of Sale')}</span>
                        {isHqDirectMode && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Direct Retail Sale
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        {isHqDirectMode ? 'Central HQ Direct POS' : 'POS Multi-Item Checkout'}
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        {isHqDirectMode
                            ? 'Selling directly to walk-ins and direct buyers from unallocated Central Master Inventory (Holding Pool).'
                            : 'Select items from the catalog on the left to build the order cart, then configure payment and finalize receipt.'}
                    </p>

                    {/* Mode Switcher for Admin */}
                    {isAdmin && (
                        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200 mt-2.5 w-fit">
                            <button
                                onClick={() => setSearchParams({ mode: 'hq' })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                    isHqDirectMode
                                        ? 'bg-stone-900 text-white shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                <ShoppingCart size={13} />
                                <span>HQ Direct POS</span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold">Master Storage</span>
                            </button>
                            <button
                                onClick={() => setSearchParams({})}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                                    !isHqDirectMode
                                        ? 'bg-stone-900 text-white shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                <Store size={13} />
                                <span>Branch POS Terminal</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Branch Owner / Admin: Manage Cashier Price Password */}
                    {(isBranch || isAdmin) && !isHqDirectMode && (
                        <button
                            type="button"
                            onClick={() => setBranchPasswordModalOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-stone-200/80"
                            title="Set or view password required for cashiers to change prices"
                        >
                            <Key size={13} className="text-emerald-600" />
                            <span>Cashier Password</span>
                        </button>
                    )}

                    {/* Cashier Mode Badge */}
                    {isCashier && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 rounded-xl text-xs font-bold border border-amber-200/80">
                            <Lock size={12} className="text-amber-600" />
                            <span>Cashier Mode</span>
                        </div>
                    )}

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
                    <div className="flex items-center gap-2">
                        {completedReceipt && status.type === 'success' && (
                            <button
                                type="button"
                                onClick={() => setShowReceiptModal(true)}
                                className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                            >
                                <Printer size={13} />
                                <span>View / Print Receipt</span>
                            </button>
                        )}
                        <button onClick={() => setStatus({ type: '', message: '' })} className="hover:opacity-75 cursor-pointer">
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* ─── TWO-COLUMN WORKSPACE (7 cols : 5 cols) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start min-w-0 pos-ticket-no-print">

                {/* ─── LEFT PANEL: 1. CATALOG PRODUCTS (7 cols) ─── */}
                <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col min-w-0 h-[740px]">
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
                                <p className="text-xs text-stone-400 mt-0.5">Try searching with a different brand, model, or category.</p>
                            </div>
                        ) : (
                            filteredCatalog.map(item => {
                                const inCartQty = cartMap.get(item.id) || 0;
                                const maxStock = item.stockQuantity ?? 0;
                                const hasStock = maxStock > 0;
                                const canAddMore = inCartQty < maxStock;
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
                                                    <span className={`px-2 py-0.5 text-[10px] font-black rounded-md border ${
                                                        !canAddMore
                                                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    }`}>
                                                        ✓ {inCartQty} in cart {!canAddMore && '(Max)'}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm font-black text-stone-900 leading-snug truncate">
                                                {item.productBrand} {item.productModel}
                                            </h4>

                                            <div className="text-xs text-stone-500 font-medium mt-0.5 flex items-center gap-2">
                                                <span>{item.variantSpecs}</span>
                                                <span className="text-stone-300">•</span>
                                                <span className={hasStock ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                                    {hasStock ? `${maxStock} ${isHqDirectMode ? 'in master pool' : 'in stock'}` : (isHqDirectMode ? 'Out of stock in master pool' : 'Out of stock')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openPriceEdit(item)}
                                                    className="group flex items-center justify-end gap-1 hover:opacity-80 transition-opacity cursor-pointer"
                                                    title="Click to adjust price for this sale"
                                                >
                                                    <span className="text-base font-black text-emerald-600 font-mono block">
                                                        {fmt(item.sellingPrice)}
                                                    </span>
                                                    <Pen size={12} className="text-stone-400 group-hover:text-emerald-700" />
                                                </button>
                                                <span className="text-[10px] text-stone-400 font-medium">per unit</span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleAddToCart(item)}
                                                disabled={!hasStock || !canAddMore}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 ${
                                                    !hasStock
                                                        ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                                        : !canAddMore
                                                        ? 'bg-amber-50 text-amber-800 border border-amber-300 cursor-not-allowed opacity-80'
                                                        : inCartQty > 0
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 cursor-pointer'
                                                        : 'bg-stone-900 hover:bg-stone-800 text-white shadow-sm active:scale-95 cursor-pointer'
                                                }`}
                                            >
                                                {!hasStock ? (
                                                    <span>Out of Stock</span>
                                                ) : !canAddMore ? (
                                                    <span>Max in Cart</span>
                                                ) : (
                                                    <>
                                                        <Plus size={13} />
                                                        <span>{inCartQty > 0 ? 'Add More' : 'Add'}</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ─── RIGHT PANEL: 2. ORDER CART & CHECKOUT (5 cols) ─── */}
                <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col min-w-0 h-[740px]">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700">
                                2. Order Cart
                            </label>
                            <span className="text-[11px] font-bold text-stone-400">
                                Configure quantities & payment
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handlePrintCurrentCart}
                                disabled={cart.length === 0}
                                className="flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer"
                                title="Print thermal receipt ticket for active cart"
                            >
                                <Printer size={13} />
                                <span>Print Slip</span>
                            </button>
                            <span className="text-xs font-black bg-stone-900 text-white px-3 py-1 rounded-full shadow-sm">
                                {cart.length} items • {totalUnits} units
                            </span>
                        </div>
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
                                                className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 rounded text-xs font-bold cursor-pointer"
                                            >
                                                <Minus size={11} />
                                            </button>
                                            <span className="w-8 text-center text-xs font-black text-stone-900">
                                                {item.qty}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleQtyStep(item.variant.id, 1)}
                                                disabled={item.qty >= (item.variant.stockQuantity ?? 0)}
                                                className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                                                    item.qty >= (item.variant.stockQuantity ?? 0)
                                                        ? 'text-stone-300 cursor-not-allowed bg-stone-50'
                                                        : 'text-stone-600 hover:bg-stone-100 cursor-pointer'
                                                }`}
                                                title={item.qty >= (item.variant.stockQuantity ?? 0) ? 'Maximum available stock reached' : 'Add 1 more'}
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
                                                <button
                                                    type="button"
                                                    onClick={() => openPriceEdit(item.variant, item.finalPrice)}
                                                    className="group flex items-center justify-end gap-1 hover:opacity-80 cursor-pointer"
                                                    title="Click to adjust price for this sale"
                                                >
                                                    {Number(item.finalPrice) !== Number(item.variant.sellingPrice) && (
                                                        <span className="text-[10px] text-stone-400 line-through font-mono mr-0.5">
                                                            {fmt(item.variant.sellingPrice * item.qty)}
                                                        </span>
                                                    )}
                                                    <span className={`text-xs font-black font-mono ${
                                                        Number(item.finalPrice) !== Number(item.variant.sellingPrice)
                                                            ? 'text-amber-600'
                                                            : 'text-emerald-600'
                                                    }`}>
                                                        {fmt(item.finalPrice * item.qty)}
                                                    </span>
                                                    <Pen size={10} className="text-stone-400 group-hover:text-amber-700" />
                                                </button>
                                                {item.qty > 1 && (
                                                    <span className="text-[10px] text-stone-400 font-medium block">
                                                        ({fmt(item.finalPrice)}/ea)
                                                    </span>
                                                )}
                                                {Number(item.finalPrice) !== Number(item.variant.sellingPrice) && (
                                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                                            Custom Price
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateCartItem(item.variant.id, 'finalPrice', item.variant.sellingPrice)}
                                                            className="text-[9px] text-stone-400 hover:text-rose-600 underline cursor-pointer"
                                                            title="Reset to standard catalog price"
                                                        >
                                                            Reset
                                                        </button>
                                                    </div>
                                                )}
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
                                    {selectedConsigneeObj ? (
                                        <div className="flex items-center justify-between p-2.5 bg-blue-50/70 border-2 border-blue-200 rounded-xl">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                                                    <User size={15} />
                                                </div>
                                                <div className="truncate">
                                                    <div className="text-xs font-black text-blue-950 truncate flex items-center gap-1.5">
                                                        <span>{selectedConsigneeObj.name}</span>
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                                                            selectedConsigneeObj.branch?.name
                                                                ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                                : 'bg-amber-100 text-amber-800 border-amber-200'
                                                        }`}>
                                                            {selectedConsigneeObj.branch?.name ? `🏬 ${selectedConsigneeObj.branch.name}` : '👑 Main Admin'}
                                                        </span>
                                                    </div>
                                                    {selectedConsigneeObj.contactInfo && (
                                                        <div className="text-[10px] text-stone-500 truncate">
                                                            {selectedConsigneeObj.contactInfo}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSelectedConsigneeId('');
                                                    setConsigneeSearchTerm('');
                                                    setIsConsigneeDropdownOpen(true);
                                                }}
                                                className="px-2.5 py-1 text-[11px] font-bold text-stone-600 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-stone-200 shrink-0"
                                            >
                                                ✕ Change
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <div className="flex gap-1.5">
                                                <div className="relative flex-1">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        value={consigneeSearchTerm}
                                                        onChange={(e) => {
                                                            setConsigneeSearchTerm(e.target.value);
                                                            setIsConsigneeDropdownOpen(true);
                                                        }}
                                                        onFocus={() => setIsConsigneeDropdownOpen(true)}
                                                        placeholder="🔍 Search consignee name or club..."
                                                        className="w-full pl-8 pr-7 py-2 text-xs font-bold bg-stone-50 border-2 border-stone-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all shadow-inner"
                                                    />
                                                    {consigneeSearchTerm && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setConsigneeSearchTerm('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsConsigneeDropdownOpen(v => !v)}
                                                    className="px-2.5 py-2 text-xs font-bold border border-stone-200 bg-stone-50 hover:bg-stone-100 rounded-xl flex items-center gap-1 text-stone-600"
                                                    title="Toggle consignee list"
                                                >
                                                    <ChevronDown size={14} className={`transition-transform duration-200 ${isConsigneeDropdownOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAddConsignee(v => !v)}
                                                    className="px-2.5 py-2 text-xs font-black bg-stone-900 text-white hover:bg-stone-800 rounded-xl shrink-0 shadow-sm"
                                                >
                                                    + New
                                                </button>
                                            </div>

                                            {/* Search Dropdown Results */}
                                            {isConsigneeDropdownOpen && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setIsConsigneeDropdownOpen(false)}
                                                    />
                                                    <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto bg-white border border-stone-200 rounded-xl shadow-2xl z-50 divide-y divide-stone-100 animate-in fade-in zoom-in-95 duration-100">
                                                        <div className="px-3 py-1.5 bg-stone-50 text-[10px] font-bold text-stone-500 flex items-center justify-between sticky top-0 z-10 border-b border-stone-100">
                                                            <span>Active Consignees ({filteredConsignees.length})</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsConsigneeDropdownOpen(false)}
                                                                className="text-stone-400 hover:text-stone-700 font-bold"
                                                            >
                                                                ✕
                                                            </button>
                                                        </div>
                                                        {filteredConsignees.length === 0 ? (
                                                            <div className="p-4 text-center">
                                                                <p className="text-xs text-stone-500 mb-2">
                                                                    No active consignee found matching "{consigneeSearchTerm}".
                                                                </p>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setNewConsigneeName(consigneeSearchTerm);
                                                                        setShowAddConsignee(true);
                                                                        setIsConsigneeDropdownOpen(false);
                                                                    }}
                                                                    className="text-xs font-bold text-blue-600 hover:underline"
                                                                >
                                                                    + Add "{consigneeSearchTerm}" as new consignee
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            filteredConsignees.map(c => (
                                                                <button
                                                                    key={c.id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedConsigneeId(c.id.toString());
                                                                        setIsConsigneeDropdownOpen(false);
                                                                        setConsigneeSearchTerm('');
                                                                    }}
                                                                    className="w-full text-left px-3.5 py-2.5 hover:bg-blue-50/70 flex items-center justify-between transition-colors group"
                                                                >
                                                                    <div className="truncate pr-2">
                                                                        <div className="font-bold text-xs text-stone-800 group-hover:text-blue-900 truncate">
                                                                            {c.name}
                                                                        </div>
                                                                        {c.contactInfo && (
                                                                            <div className="text-[10px] text-stone-400 truncate">
                                                                                {c.contactInfo}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                                                        c.branch?.name
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                                                    }`}>
                                                                        {c.branch?.name ? `🏬 ${c.branch.name}` : '👑 Main Admin'}
                                                                    </span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {showAddConsignee && (
                                        <div className="flex gap-1.5 pt-1">
                                            <input
                                                type="text"
                                                value={newConsigneeName}
                                                onChange={(e) => setNewConsigneeName(e.target.value)}
                                                placeholder="New consignee name..."
                                                className="flex-1 px-3 py-1.5 text-xs border border-stone-200 rounded-xl focus:border-stone-900 outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddConsignee}
                                                className="px-3 py-1.5 bg-stone-900 text-white text-xs font-bold rounded-xl hover:bg-stone-700 transition-colors"
                                            >
                                                Add
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddConsignee(false)}
                                                className="px-2 py-1.5 border border-stone-200 text-stone-500 text-xs font-bold rounded-xl hover:bg-stone-50"
                                            >
                                                Cancel
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
                                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-1.5">
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
                                                <option value="Cash">Cash</option>
                                                <option value="GCash">GCash</option>
                                                <option value="Maya">Maya</option>
                                                <option value="GoTyme">GoTyme</option>
                                                <option value="BDO">BDO</option>
                                                <option value="BPI">BPI</option>
                                                <option value="MBOS">MBOS</option>
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

                            {/* Purchase Notes / Remarks */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                                        <FileText size={12} className="text-stone-400" />
                                        <span>Purchase Notes / Remarks</span>
                                    </label>
                                    <span className="text-[10px] font-semibold text-stone-400">Optional</span>
                                </div>
                                <div className="relative">
                                    <textarea
                                        rows={2}
                                        value={formData.orderNote}
                                        onChange={(e) => setFormData({ ...formData, orderNote: e.target.value })}
                                        placeholder="Add note (e.g. contact #, pickup date, discount reason, transfer ref#)..."
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-medium focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner resize-none text-stone-800 placeholder:text-stone-400 leading-relaxed"
                                    />
                                    {formData.orderNote && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, orderNote: '' })}
                                            className="absolute right-2 top-2 text-stone-300 hover:text-stone-500 p-0.5 rounded transition-colors"
                                            title="Clear note"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>

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

                                {formData.orderNote ? (
                                    <div className="col-span-2 pt-2.5 border-t border-stone-200/70">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                                                <FileText size={11} className="text-stone-400" />
                                                <span>Purchase Note / Remarks</span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, orderNote: '' })}
                                                className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                        <div className="p-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-800 leading-relaxed whitespace-pre-wrap">
                                            {formData.orderNote}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="col-span-2 pt-2 border-t border-stone-200/60">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-stone-400 flex items-center gap-1.5 mb-1">
                                            <FileText size={11} className="text-stone-400" />
                                            <span>Purchase Note (Optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.orderNote}
                                            onChange={(e) => setFormData({ ...formData, orderNote: e.target.value })}
                                            placeholder="Add purchase note or customer remarks before confirming..."
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:border-stone-900"
                                        />
                                    </div>
                                )}
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
                                onClick={handlePrintCurrentCart}
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

            {/* ===== CASHIER AUTHORIZATION MODAL ===== */}
            {authModalOpen && pendingEditData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pos-ticket-no-print animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl border border-stone-200 overflow-hidden">
                        <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Manager Authorization</h3>
                                    <p className="text-xs text-stone-400">Cashier Mode Price Change</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setAuthModalOpen(false); setPendingEditData(null); }}
                                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleVerifyCashierAuth} className="p-5 space-y-4">
                            <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs space-y-1">
                                <div className="font-black text-stone-900 text-xs truncate">
                                    {pendingEditData.variant.productBrand || ''} {pendingEditData.variant.productModel || ''}
                                </div>
                                <div className="text-stone-500 font-medium text-[11px]">
                                    {pendingEditData.variant.variantSpecs || pendingEditData.variant.sku}
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-stone-200/60 mt-1">
                                    <span className="text-[11px] text-stone-400 font-medium">Current Selling Price:</span>
                                    <span className="font-mono font-black text-emerald-600 text-xs">
                                        {fmt(pendingEditData.currentCartPrice != null ? pendingEditData.currentCartPrice : pendingEditData.variant.sellingPrice)}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                    Branch Owner / Manager Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showAuthPassword ? 'text' : 'password'}
                                        autoFocus
                                        value={authPassword}
                                        onChange={(e) => { setAuthPassword(e.target.value); setAuthError(''); }}
                                        placeholder="Enter password (default: admin123)"
                                        className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowAuthPassword(!showAuthPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                                    >
                                        {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-stone-400 mt-1">
                                    Default password is <span className="font-mono font-bold text-stone-600">admin123</span>
                                </p>
                            </div>

                            {authError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle size={15} className="shrink-0 text-rose-500" />
                                    <span>{authError}</span>
                                </div>
                            )}

                            <div className="pt-2 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => { setAuthModalOpen(false); setPendingEditData(null); }}
                                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={authVerifying || !authPassword}
                                    className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                                >
                                    {authVerifying ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                                    <span>Authorize</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== TEMPORARY SALE PRICE ADJUSTMENT MODAL ===== */}
            {priceModalOpen && editingVariant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 pos-ticket-no-print animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
                        <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                                    ₱
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Adjust Price (This Sale Only)</h3>
                                    <p className="text-xs text-stone-400">Temporary price — catalog price stays unchanged</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setPriceModalOpen(false); setVerifiedPassword(''); }}
                                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSavePrice} className="p-6 space-y-4">
                            {isCashier && (
                                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                                    <span>Manager Authorized • Ready to set custom price</span>
                                </div>
                            )}

                            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1">
                                <div className="font-black text-stone-900 text-sm">
                                    {editingVariant.productBrand} {editingVariant.productModel}
                                </div>
                                <div className="text-stone-500 font-medium">
                                    {editingVariant.variantSpecs}
                                </div>
                                <div className="font-mono text-stone-400 text-[11px] flex items-center justify-between pt-1 border-t border-stone-200/60 mt-1">
                                    <span>SKU: {editingVariant.sku}</span>
                                    <span>Standard Catalog Price: <strong className="text-stone-800">{fmt(editingVariant.sellingPrice)}</strong></span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                    Temporary Sale Price per Unit (₱)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-stone-500 text-sm">
                                        ₱
                                    </span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        autoFocus
                                        value={newPriceInput}
                                        onChange={(e) => setNewPriceInput(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-8 pr-4 py-3 bg-white border border-stone-300 rounded-xl font-mono text-base font-black text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                                    />
                                </div>
                                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2 font-medium">
                                    💡 This custom price applies <strong>strictly to the current sale</strong> and will not overwrite the branch catalog price.
                                </p>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => { setPriceModalOpen(false); setVerifiedPassword(''); }}
                                    className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Check size={14} />
                                    <span>Apply to Sale</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== BRANCH OWNER CASHIER PASSWORD MODAL ===== */}
            <BranchPasswordModal
                isOpen={branchPasswordModalOpen}
                onClose={() => setBranchPasswordModalOpen(false)}
                branchId={activeBranchId}
                branchName={user?.branchName}
            />

            {/* ===== COMPLETED ORDER RECEIPT MODAL ===== */}
            {showReceiptModal && completedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 pos-ticket-no-print animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden my-8 flex flex-col max-h-[92vh]">
                        {/* Modal Header */}
                        <div className="bg-stone-950 p-6 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                    <Receipt size={22} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black tracking-tight">Order Receipt</h3>
                                    <p className="text-xs text-stone-400">Payment completed & recorded</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowReceiptModal(false)}
                                className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Paper-styled Receipt Card */}
                        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-stone-100/70">
                            <div className="bg-white rounded-2xl border border-stone-300/80 p-6 shadow-md font-mono text-xs text-stone-800 space-y-4">
                                {/* Receipt Header */}
                                <div className="text-center pb-4 border-b border-dashed border-stone-300">
                                    <h2 className="text-base font-black uppercase tracking-wider text-stone-900 font-sans">
                                        CEBU PICKLEBALL MARKET
                                    </h2>
                                    <div className="text-[11px] text-stone-500 font-sans mt-0.5">
                                        Authorized Paddle Retailer
                                    </div>
                                    <div className="text-xs font-bold uppercase tracking-wider text-stone-800 mt-1 font-sans">
                                        {branchDisplayName}
                                    </div>
                                </div>

                                {/* Order Meta */}
                                <div className="space-y-1 text-[11px]">
                                    <div className="flex justify-between">
                                        <span className="text-stone-400">Ticket #:</span>
                                        <span className="font-bold text-stone-900">{completedReceipt.ticketNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-stone-400">Date:</span>
                                        <span>{new Date(completedReceipt.date).toLocaleString('en-PH')}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-stone-400">Customer:</span>
                                        <span className="font-bold text-stone-900">{completedReceipt.customerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-stone-400">Payment:</span>
                                        <span className="font-bold text-stone-900">{completedReceipt.paymentMethod}</span>
                                    </div>
                                </div>

                                {/* Items Breakdown */}
                                <div className="border-t border-b border-dashed border-stone-300 py-3 space-y-2">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-stone-400">
                                        <span>Item Description</span>
                                        <span>Amount</span>
                                    </div>
                                    {completedReceipt.items.map((it, i) => (
                                        <div key={i} className="flex justify-between items-start text-[11px]">
                                            <div className="pr-2 min-w-0">
                                                <div className="font-bold text-stone-900">
                                                    {it.qty}x {it.displayName}
                                                </div>
                                                <div className="text-[10px] text-stone-400 font-sans">
                                                    {it.sku} • {fmt(it.finalPrice)}/ea
                                                </div>
                                                {it.paymentStatus !== 'PAID' && (
                                                    <span className="text-[10px] font-bold text-amber-700">
                                                        [{it.paymentStatus}]
                                                    </span>
                                                )}
                                            </div>
                                            <div className="font-bold text-stone-900 shrink-0">
                                                {fmt(it.lineTotal)}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Totals & Due */}
                                <div className="space-y-1.5 pt-1 text-xs">
                                    <div className="flex justify-between text-stone-500">
                                        <span>Total Units:</span>
                                        <span>{completedReceipt.totalUnits}</span>
                                    </div>
                                    <div className="flex justify-between text-sm font-black text-stone-900 pt-1 border-t border-stone-200">
                                        <span>TOTAL:</span>
                                        <span className="text-emerald-700 font-black">{fmt(completedReceipt.cartTotal)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-stone-700">
                                        <span>Amount Paid:</span>
                                        <span>{fmt(completedReceipt.amountPaid)}</span>
                                    </div>
                                    {completedReceipt.amountUnpaid > 0 && (
                                        <div className="flex justify-between font-bold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                            <span>Balance Due:</span>
                                            <span>{fmt(completedReceipt.amountUnpaid)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Footer Thank You */}
                                <div className="text-center pt-4 border-t border-dashed border-stone-300 text-[10px] text-stone-400 font-sans leading-relaxed">
                                    <div className="font-bold text-stone-700">Thank you for your purchase!</div>
                                    <div>Keep this receipt for warranty and returns.</div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="p-5 bg-white border-t border-stone-200 flex items-center justify-between gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={handlePrintCompletedReceipt}
                                className="px-5 py-3 bg-stone-900 hover:bg-black text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                            >
                                <Printer size={15} />
                                <span>Print Receipt</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowReceiptModal(false);
                                    setCompletedReceipt(null);
                                    resetForm();
                                }}
                                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>New Order</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Printable Ticket (Active Cart or Completed Order) */}
            <div className="pos-ticket-printable hidden print:block">
                {/* Header */}
                <div className="text-center mb-3">
                    <div className="ticket-header-title text-[13px] font-black tracking-wider uppercase font-sans">
                        CEBU PICKLEBALL MARKET
                    </div>
                    <div className="ticket-header-sub text-[10px] text-zinc-500 mt-0.5 font-sans">
                        Authorized Paddle Retailer
                    </div>
                    <div className="ticket-header-branch text-[11px] font-bold uppercase tracking-wider text-zinc-800 mt-0.5 font-sans">
                        {branchDisplayName}
                    </div>
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                {/* Meta */}
                <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Ticket #</span>
                        <span className="font-bold">{activeTicketNumber}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Date</span>
                        <span>{dateStr} · {timeStr}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Customer</span>
                        <span className={activeCustomer ? 'font-bold' : 'italic text-zinc-400'}>{activeCustomer || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Payment</span>
                        <span className="font-bold">{activePaymentMethod}</span>
                    </div>
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                {/* Line items */}
                <div className="space-y-1.5">
                    {activeReceiptItems.length === 0 ? (
                        <div className="text-center text-zinc-400 italic py-4 text-[10px]">
                            Cart is empty.<br />Add items to build the ticket.
                        </div>
                    ) : (
                        activeReceiptItems.map((item, idx) => {
                            const qty = parseInt(item.qty, 10) || 0;
                            const price = parseFloat(item.finalPrice) || 0;
                            const lineTotal = qty * price;
                            const name = item.displayName || item.variant?.displayName || item.sku || 'Item';
                            const specs = item.specs || (item.variantSpecs && item.variantSpecs !== 'Standard'
                                ? item.variantSpecs
                                : (item.variant?.color && item.variant?.color !== 'N/A' ? item.variant.color : ''));
                            return (
                                <div key={idx} className="ticket-item text-[10px] leading-tight py-0.5">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-2">
                                            <span className="font-bold">{qty} × {name}</span>
                                            {specs ? <span className="text-zinc-500 block text-[9px]">{specs}</span> : null}
                                            {item.paymentStatus === 'UNPAID' && (
                                                <span className="text-amber-700 font-bold text-[9px] block">[UNPAID]</span>
                                            )}
                                        </div>
                                        <span className="font-bold whitespace-nowrap">
                                            ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-2" />

                {/* Totals */}
                <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Items</span>
                        <span>{activeTotalUnits}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-zinc-500">Subtotal</span>
                        <span>₱{activeTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <div className="ticket-double border-t border-double border-zinc-700 my-2" />

                <div className="flex justify-between items-baseline">
                    <span className="ticket-total-label text-[12px] font-black uppercase">Total</span>
                    <span className="ticket-total text-[15px] font-black">
                        ₱{activeTotalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </span>
                </div>

                {activeHasUnpaid && (
                    <div className="mt-2 space-y-0.5 text-[10px]">
                        <div className="flex justify-between text-emerald-700 font-bold">
                            <span>PAID NOW</span>
                            <span>₱{activePaidAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between font-bold text-amber-800">
                            <span>UNPAID BALANCE</span>
                            <span>₱{activeUnpaidAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                )}

                <div className="ticket-divider border-t border-dashed border-zinc-400 my-3" />

                <div className="text-center text-[10px] text-zinc-600 leading-snug">
                    <div className="font-bold text-zinc-800">Thank you for your purchase!</div>
                    <div className="mt-0.5 text-[9px]">Keep this receipt for warranty &amp; returns.</div>
                </div>
            </div>
        </div>
    );
};

export default OrderPage;