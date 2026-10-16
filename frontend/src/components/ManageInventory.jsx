import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import {
    ClipboardList, Search, X, PlusCircle, MinusCircle, Layers,
    CheckCircle, AlertCircle, Loader2, Building2, PackagePlus, Trash2,
    Pencil, AlertTriangle, PackageX, History, Save, Printer,
    CreditCard, Boxes, Clock, CheckCircle2
} from 'lucide-react';
import BatchAddModal from './BatchAddModal';
import PasswordModal from './PasswordModal';

const BASE = '';
const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

const ManageInventory = ({ products = [], loading = false, refetchProducts }) => {
    const [suppliers, setSuppliers] = useState([]);
    const [tableFilter, setTableFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('name-asc');
    const [categoryFilter, setCategoryFilter] = useState('All'); // All, Paddles, Accessories, Shoes
    const [displayedCount, setDisplayedCount] = useState(20);
    const tableContainerRef = useRef(null);

    // --- TAB STATE (Catalog vs Outgoing Branch Allocations Tracker) ---
    const [inventoryTab, setInventoryTab] = useState('catalog'); // 'catalog' | 'allocations'
    const [allocations, setAllocations] = useState([]);
    const [loadingAllocations, setLoadingAllocations] = useState(false);
    const [allocationSearch, setAllocationSearch] = useState('');
    const [allocationStatusFilter, setAllocationStatusFilter] = useState('ALL');

    const fetchAllocations = async () => {
        setLoadingAllocations(true);
        try {
            const res = await axios.get('/api/admin/allocations');
            setAllocations(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to load allocations:', err);
        } finally {
            setLoadingAllocations(false);
        }
    };

    useEffect(() => {
        if (inventoryTab === 'allocations') {
            fetchAllocations();
        }
    }, [inventoryTab]);

    // --- ADD STOCK MODAL STATE ---
    const [addStockModal, setAddStockModal] = useState(null);
    const [addForm, setAddForm] = useState({ quantity: '', acquisitionPrice: '', supplierId: '', consigned: false });
    const [addStatus, setAddStatus] = useState({ type: '', message: '' });
    const [isAdding, setIsAdding] = useState(false);

    // --- DEDUCT STOCK MODAL STATE ---
    const [deductModal, setDeductModal] = useState(null);
    const [deductStatus, setDeductStatus] = useState({ type: '', message: '' });

    // --- BATCH ADD MODAL STATE ---
    const [showBatchAdd, setShowBatchAdd] = useState(false);

    // --- BATCH LIST MODAL STATE ---
    const [batchModal, setBatchModal] = useState(null);
    const [batches, setBatches] = useState([]);
    const [adjustments, setAdjustments] = useState([]);
    const [batchLoading, setBatchLoading] = useState(false);
    // batchSales: { [batchDbId]: [ { transactionId, type, status, consigneeName, customerName, date } ] }
    const [batchSales, setBatchSales] = useState({});
    const [expandedBatches, setExpandedBatches] = useState({});

    // --- EDIT VARIANT MODAL STATE ---
    const [editModal, setEditModal] = useState(null); // { row }
    const [editForm, setEditForm] = useState({});
    const [editStatus, setEditStatus] = useState({ type: '', message: '' });
    const [isSaving, setIsSaving] = useState(false);

    // --- DELETE VARIANT CONFIRM ---
    const [deleteVariantConfirm, setDeleteVariantConfirm] = useState(null);

    // --- PASSWORD PROTECTION ---
    const [pendingAuthAction, setPendingAuthAction] = useState(null);

    const handleAuthConfirm = () => {
        if (!pendingAuthAction) return;
        const { type, payload } = pendingAuthAction;
        setPendingAuthAction(null);
        
        if (type === 'ADD') openAddStock(payload);
        if (type === 'DEDUCT') setDeductModal({ variantId: payload.variantId, name: payload.dropdownName, currentQty: payload.quantity, qty: '', reason: 'Return to Supplier', note: '' });
        if (type === 'EDIT') openEditVariant(payload);
    };

    useEffect(() => {
        axios.get(`${BASE}/api/suppliers`).then(r => setSuppliers(r.data)).catch(() => {});
    }, []);

    // ============ PRINT ============
    const handlePrint = () => {
        const printData = filteredInventory;
        const dateStr = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
        const categoryLabel = categoryFilter === 'All' ? 'All Categories' : categoryFilter;

        const dateHeaders = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        });

        const rows = printData.map((row, i) => {
            const model = `${row.brand} ${row.name}`;
            let variant = '';
            if (row.color && row.color !== '-') variant += row.color;
            if (row.variantDetails && row.variantDetails !== '-') variant += (variant ? ' · ' : '') + row.variantDetails;
            if (!variant) variant = '—';
            return `
                <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
                    <td class="num">${i + 1}</td>
                    <td class="model">${model}</td>
                    <td class="variant">${variant}</td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                    <td class="stock-cell"></td>
                </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Stock Count Sheet — ${dateStr}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10pt;
            color: #111;
            background: #fff;
        }
        @page {
            size: A4 portrait;
            margin: 14mm 14mm 14mm 14mm;
        }
        .page-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            border-bottom: 2.5px solid #111;
            padding-bottom: 6px;
            margin-bottom: 10px;
        }
        .page-header .title {
            font-size: 16pt;
            font-weight: 900;
            letter-spacing: -0.5px;
            color: #111;
        }
        .page-header .meta {
            font-size: 8pt;
            color: #555;
            text-align: right;
            line-height: 1.6;
        }
        .badge {
            display: inline-block;
            background: #f3f3f3;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 1px 7px;
            font-size: 8pt;
            font-weight: 700;
            color: #333;
            margin-bottom: 6px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
        }
        thead th {
            background: #111;
            color: #fff;
            font-weight: 800;
            font-size: 7.5pt;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 6px 8px;
            text-align: left;
        }
        thead th.stock-cell {
            text-align: center;
            width: 45px;
        }
        thead th.num {
            width: 28px;
            text-align: center;
        }
        tbody tr.even { background: #fff; }
        tbody tr.odd  { background: #f9f9f9; }
        tbody td {
            padding: 5px 8px;
            border-bottom: 1px solid #e8e8e8;
            vertical-align: middle;
        }
        td.num {
            color: #aaa;
            font-size: 7.5pt;
            text-align: center;
        }
        td.model {
            font-weight: 700;
            color: #111;
        }
        td.variant {
            color: #555;
            font-size: 8.5pt;
        }
        td.stock-cell {
            width: 45px;
            border: 1px solid #ccc;
            background: #fafafa;
            height: 28px;
        }
        .footer {
            margin-top: 14px;
            font-size: 7.5pt;
            color: #aaa;
            text-align: right;
            border-top: 1px solid #e8e8e8;
            padding-top: 6px;
        }
        .sig-row {
            display: flex;
            gap: 40px;
            margin-top: 28px;
        }
        .sig-block {
            flex: 1;
            border-top: 1.5px solid #333;
            padding-top: 4px;
            font-size: 8pt;
            color: #555;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="page-header">
        <div>
            <div class="title">📋 Stock Count Sheet</div>
            <div style="font-size:8.5pt;color:#555;margin-top:3px;">Ivan PB Market — Physical Inventory Verification</div>
        </div>
        <div class="meta">
            <div><strong>Date:</strong> ${dateStr}</div>
            <div><strong>Category:</strong> ${categoryLabel}</div>
            <div><strong>Total SKUs:</strong> ${printData.length}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th class="num">#</th>
                <th>Model</th>
                <th>Variant</th>
                <th class="stock-cell">${dateHeaders[0]}</th>
                <th class="stock-cell">${dateHeaders[1]}</th>
                <th class="stock-cell">${dateHeaders[2]}</th>
                <th class="stock-cell">${dateHeaders[3]}</th>
                <th class="stock-cell">${dateHeaders[4]}</th>
                <th class="stock-cell">${dateHeaders[5]}</th>
                <th class="stock-cell">${dateHeaders[6]}</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
        </tbody>
    </table>

    <div class="sig-row">
        <div class="sig-block">Counted by: ____________________________</div>
        <div class="sig-block">Verified by: ____________________________</div>
        <div class="sig-block">Date counted: __________________________</div>
    </div>

    <div class="footer">Ivan PB Market · Stock Count Sheet · Generated ${dateStr} · ${printData.length} items</div>
</body>
</html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
    };

    // --- FLATTEN DATA ---
    const flattenedInventory = useMemo(() => {
        return products.flatMap(product =>
            (product.variants || []).map(variant => {
                const isPaddle = product.category === 'Paddles';
                const isShoe = product.category === 'Shoes';
                const qty = variant.stockQuantity ?? 0;
                const threshold = variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
                return {
                    variantId: variant.id,
                    productId: product.id,
                    category: product.category,
                    sku: variant.sku,
                    brand: product.brandName,
                    name: product.modelName,
                    color: (variant.color === 'N/A' || !variant.color) ? '-' : variant.color,
                    rawColor: variant.color || '',
                    thicknessMm: variant.thicknessMm || 0,
                    shape: variant.shape || '',
                    variantDetails: isPaddle
                        ? `${variant.thicknessMm || 0}mm ${variant.shape || ''}`
                        : isShoe
                            ? `Size ${variant.shape || '-'}`
                            : '-',
                    quantity: qty,
                    sellingPrice: variant.sellingPrice ?? 0,
                    acquisitionPrice: variant.acquisitionPrice ?? 0,
                    lowStockThreshold: threshold,
                    isLowStock: qty > 0 && qty <= threshold,
                    isOutOfStock: qty <= 0,
                    totalAdded: variant.totalAdded || 0,
                    totalSold: variant.totalSold || 0,
                    totalAdjusted: variant.totalAdjusted || 0,
                    consigned: variant.consigned,
                    defaultSupplier: variant.defaultSupplier,
                    dropdownName: isPaddle
                        ? `${product.brandName} ${product.modelName} ${variant.color || ''} ${variant.thicknessMm || 0}mm`
                        : isShoe
                            ? `${product.brandName} ${product.modelName} ${variant.shape || ''}`
                            : `${product.brandName} ${product.modelName}`
                };
            })
        );
    }, [products]);

    const filteredInventory = useMemo(() => {
        let result = [...flattenedInventory];
        
        if (categoryFilter !== 'All') {
            result = result.filter(item => item.category === categoryFilter);
        }

        if (tableFilter.trim()) {
            const q = tableFilter.toLowerCase();
            result = result.filter(item =>
                (item.sku || '').toLowerCase().includes(q) ||
                (item.brand || '').toLowerCase().includes(q) ||
                (item.name || '').toLowerCase().includes(q) ||
                (item.dropdownName || '').toLowerCase().includes(q) ||
                (item.defaultSupplier?.name || '').toLowerCase().includes(q)
            );
        }

        result.sort((a, b) => {
            if (sortOrder === 'stock-asc') return a.quantity - b.quantity;
            if (sortOrder === 'stock-desc') return b.quantity - a.quantity;
            if (sortOrder === 'name-asc') return a.dropdownName.localeCompare(b.dropdownName, undefined, { numeric: true });
            if (sortOrder === 'name-desc') return b.dropdownName.localeCompare(a.dropdownName, undefined, { numeric: true });
            return 0;
        });

        return result;
    }, [tableFilter, sortOrder, categoryFilter, flattenedInventory]);

    const visibleData = filteredInventory.slice(0, displayedCount);

    const handleScroll = () => {
        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50 && displayedCount < filteredInventory.length) {
                setDisplayedCount(prev => prev + 20);
            }
        }
    };

    // ============ ADD STOCK ============
    const openAddStock = (row) => {
        setAddForm({
            quantity: '',
            acquisitionPrice: '',
            supplierId: row.defaultSupplier?.id ? String(row.defaultSupplier.id) : '',
            consigned: row.consigned || false
        });
        setAddStatus({ type: '', message: '' });
        setAddStockModal({ variantId: row.variantId, sku: row.sku, name: row.dropdownName });
    };

    const handleConfirmAddStock = async () => {
        if (!addForm.quantity || Number(addForm.quantity) <= 0) return;
        setIsAdding(true);
        setAddStatus({ type: '', message: '' });
        try {
            let url = `${BASE}/api/products/variants/${addStockModal.variantId}/add-stock?quantity=${addForm.quantity}&consigned=${addForm.consigned}`;
            if (addForm.acquisitionPrice) url += `&acquisitionPrice=${addForm.acquisitionPrice}`;
            if (addForm.supplierId) url += `&supplierId=${addForm.supplierId}`;
            await axios.patch(url);
            setAddStatus({ type: 'success', message: 'Stock added successfully!' });
            refetchProducts?.();
            setTimeout(() => setAddStockModal(null), 1200);
        } catch (err) {
            setAddStatus({ type: 'error', message: err.response?.data?.error || 'Failed to add stock.' });
        } finally {
            setIsAdding(false);
        }
    };

    // ============ DEDUCT STOCK ============
    const handleDeductStock = async () => {
        if (!deductModal?.qty || Number(deductModal.qty) <= 0) return;
        setDeductStatus({ type: '', message: '' });
        try {
            const reason = encodeURIComponent(deductModal.reason || 'Manual Adjustment');
            const note = deductModal.note ? `&note=${encodeURIComponent(deductModal.note)}` : '';
            await axios.patch(`${BASE}/api/products/variants/${deductModal.variantId}/deduct-stock?quantity=${deductModal.qty}&reason=${reason}${note}`);
            setDeductModal(null);
            refetchProducts?.();
        } catch (err) {
            setDeductStatus({ type: 'error', message: err.response?.data?.error || 'Failed to deduct stock.' });
        }
    };

    // ============ EDIT VARIANT ============
    const openEditVariant = (row) => {
        setEditForm({
            sku: row.sku,
            color: row.rawColor,
            thicknessMm: row.thicknessMm || 0,
            shape: row.shape || '',
            acquisitionPrice: row.acquisitionPrice,
            sellingPrice: row.sellingPrice,
            lowStockThreshold: row.lowStockThreshold,
            consigned: row.consigned,
            supplierId: row.defaultSupplier?.id ? String(row.defaultSupplier.id) : '',
        });
        setEditStatus({ type: '', message: '' });
        setEditModal({ row });
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setEditStatus({ type: '', message: '' });
        try {
            const payload = {
                sku: editForm.sku?.trim() || undefined,
                color: editForm.color || '',
                thicknessMm: Number(editForm.thicknessMm) || 0,
                shape: editForm.shape || '',
                acquisitionPrice: editForm.acquisitionPrice === '' ? null : Number(editForm.acquisitionPrice),
                sellingPrice: editForm.sellingPrice === '' ? null : Number(editForm.sellingPrice),
                lowStockThreshold: editForm.lowStockThreshold === '' ? null : Number(editForm.lowStockThreshold),
                consigned: !!editForm.consigned,
                defaultSupplier: editForm.supplierId ? { id: parseInt(editForm.supplierId) } : null,
            };
            await axios.put(`${BASE}/api/products/variants/${editModal.row.variantId}`, payload);
            setEditStatus({ type: 'success', message: 'Variant updated.' });
            refetchProducts?.();
            setTimeout(() => setEditModal(null), 900);
        } catch (err) {
            setEditStatus({ type: 'error', message: err.response?.data?.error || 'Failed to update variant.' });
        } finally {
            setIsSaving(false);
        }
    };

    // ============ DELETE VARIANT ============
    const confirmDeleteVariant = async (id) => {
        try {
            await axios.delete(`${BASE}/api/products/variants/${id}`);
            setDeleteVariantConfirm(null);
            refetchProducts?.();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete variant.');
        }
    };

    // ============ VIEW BATCHES + ADJUSTMENTS ============
    const openBatchModal = async (row) => {
        setBatchModal({ variantId: row.variantId, name: row.dropdownName });
        setBatches([]);
        setAdjustments([]);
        setBatchSales({});
        setExpandedBatches({});
        setBatchLoading(true);
        try {
            const [batchRes, adjRes, salesRes] = await Promise.all([
                axios.get(`${BASE}/api/stock-batches/variant/${row.variantId}`),
                axios.get(`${BASE}/api/products/variants/${row.variantId}/adjustments`),
                axios.get(`${BASE}/api/stock-batches/variant/${row.variantId}/sales`),
            ]);
            setBatches(batchRes.data);
            setAdjustments(adjRes.data);
            setBatchSales(salesRes.data || {});
        } catch (err) {
            console.error('Failed to load batches/adjustments', err);
        } finally {
            setBatchLoading(false);
        }
    };

    const toggleBatchExpand = (batchDbId) => {
        setExpandedBatches(prev => ({ ...prev, [batchDbId]: !prev[batchDbId] }));
    };

    const fmtDate = (dt) => dt ? new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
    const fmtDateTime = (dt) => dt ? new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
    const fmtPrice = (p) => p != null ? `₱${Number(p).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

    const handleRevertBatch = async (batchId) => {
        if (!confirm('Are you sure you want to revert this stock batch? This will deduct the remaining quantities and delete the logged Expense.')) return;
        try {
            await axios.delete(`${BASE}/api/batch-actions/revert/${batchId}`);
            setBatches(batches.filter(b => b.batchId !== batchId));
            refetchProducts?.();
        } catch (err) {
            alert('Failed to revert batch.');
            console.error(err);
        }
    };

    const filteredAllocations = useMemo(() => {
        return allocations.filter(a => {
            const matchesStatus =
                allocationStatusFilter === 'ALL' ||
                (allocationStatusFilter === 'PAID' && (a.status === 'PAID' || parseFloat(a.amountPaid || 0) >= parseFloat(a.totalCost || 0))) ||
                (allocationStatusFilter === 'PARTIAL' && a.status === 'PARTIAL') ||
                (allocationStatusFilter === 'PENDING' && (a.status === 'PENDING' || !a.status)) ||
                (allocationStatusFilter === 'OVERDUE' && a.deadline && new Date(a.deadline) < new Date() && parseFloat(a.amountPaid || 0) < parseFloat(a.totalCost || 0));

            const q = allocationSearch.toLowerCase();
            const matchesSearch = !q ||
                (a.branchName && a.branchName.toLowerCase().includes(q)) ||
                (a.modelName && a.modelName.toLowerCase().includes(q)) ||
                (a.sku && a.sku.toLowerCase().includes(q)) ||
                (a.notes && a.notes.toLowerCase().includes(q));

            return matchesStatus && matchesSearch;
        });
    }, [allocations, allocationStatusFilter, allocationSearch]);

    const allocationStats = useMemo(() => {
        let totalUnits = 0;
        let totalCost = 0;
        let totalPaid = 0;
        let overdueCount = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        allocations.forEach(a => {
            const q = parseInt(a.quantity || 0, 10);
            const c = parseFloat(a.totalCost || 0);
            const p = parseFloat(a.amountPaid || 0);
            totalUnits += q;
            totalCost += c;
            totalPaid += p;

            const rem = c - p;
            if (rem > 0 && a.deadline) {
                const dl = new Date(a.deadline);
                dl.setHours(0, 0, 0, 0);
                if (dl < today) overdueCount++;
            }
        });

        return {
            totalUnits,
            totalCost,
            totalPaid,
            outstanding: Math.max(0, totalCost - totalPaid),
            overdueCount
        };
    }, [allocations]);

    return (
        <div className="flex flex-col h-full relative">
            {/* TABS SWITCHER */}
            <div className="flex items-center gap-2 mb-4 shrink-0 border-b border-stone-200 pb-2">
                <button
                    onClick={() => setInventoryTab('catalog')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        inventoryTab === 'catalog'
                            ? 'bg-stone-900 text-white shadow-sm'
                            : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                >
                    Master Catalog & Stocks
                </button>
                <button
                    onClick={() => setInventoryTab('allocations')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                        inventoryTab === 'allocations'
                            ? 'bg-stone-900 text-white shadow-sm'
                            : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                >
                    <Boxes size={14} />
                    <span>Outgoing Allocation Tracker</span>
                    {allocations.length > 0 && (
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                            inventoryTab === 'allocations' ? 'bg-emerald-500 text-white' : 'bg-stone-200 text-stone-700'
                        }`}>
                            {allocations.length}
                        </span>
                    )}
                </button>
            </div>

            {inventoryTab === 'catalog' ? (
                <>
                    {/* HEADER */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-4 shrink-0">
                        <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2">
                            <ClipboardList className="text-zinc-500" /> Manage Inventory
                            {!loading && (
                                <span className="ml-2 text-sm font-normal text-zinc-400 hidden sm:inline">
                                    {tableFilter ? `${filteredInventory.length} of ${flattenedInventory.length}` : `${flattenedInventory.length} items`}
                                </span>
                            )}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                            <button
                                onClick={handlePrint}
                                title={`Print stock count sheet (${filteredInventory.length} items)`}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 hover:border-stone-400 text-zinc-700 text-sm font-bold rounded-lg shadow-sm transition-colors"
                            >
                                <Printer size={15} /> Print Sheet
                            </button>
                            <button
                                onClick={() => setShowBatchAdd(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                            >
                                <PackagePlus size={16} /> Batch Add
                            </button>
                            <div className="flex bg-stone-200/50 p-1.5 rounded-xl border border-stone-200 mr-auto sm:mr-0 h-[38px] items-center">
                                {['All', 'Paddles', 'Accessories', 'Shoes'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => { setCategoryFilter(cat); setDisplayedCount(20); }}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                                            categoryFilter === cat 
                                                ? 'bg-white text-zinc-900 shadow-sm border border-stone-200' 
                                                : 'text-zinc-500 hover:text-zinc-700'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex-1 sm:flex-none">
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="pl-3 pr-8 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none bg-white font-bold text-zinc-600 h-[38px]"
                                >
                                    <option value="name-asc">Name (A-Z)</option>
                                    <option value="name-desc">Name (Z-A)</option>
                                    <option value="stock-asc">Stock (Low to High)</option>
                                    <option value="stock-desc">Stock (High to Low)</option>
                                </select>
                            </div>
                            <div className="relative flex-1 sm:flex-none">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search size={15} className="text-zinc-400" />
                                </div>
                                <input
                                    type="text"
                                    value={tableFilter}
                                    onChange={e => { setTableFilter(e.target.value); setDisplayedCount(20); }}
                                    placeholder="Filter by SKU, brand, supplier…"
                                    className="pl-9 pr-8 py-2 text-sm border border-stone-300 rounded-lg focus:ring-2 focus:ring-zinc-900 outline-none w-64 h-[38px]"
                                />
                                {tableFilter && (
                                    <button onClick={() => setTableFilter('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

            {/* TABLE */}
            <div
                ref={tableContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm relative"
            >
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100 shadow-sm z-10 text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-stone-200">
                        <tr>
                            <th className="px-4 py-4">SKU</th>
                            <th className="px-4 py-4">Brand / Model</th>
                            <th className="px-4 py-4">Variant</th>
                            <th className="px-4 py-4">Supplier</th>
                            <th className="px-4 py-4">Type</th>
                            <th className="px-4 py-4 text-right">Price</th>
                            <th className="px-4 py-4 text-right">Status / Tracking</th>
                            <th className="px-4 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-sm">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {[0,1,2,3,4,5,6,7].map(j => (
                                        <td key={j} className="px-4 py-4">
                                            <div className="h-4 bg-stone-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : visibleData.length > 0 ? visibleData.map(row => (
                            <tr key={row.variantId} className="hover:bg-stone-50 transition-colors group">
                                <td className="px-4 py-4 font-mono font-medium text-zinc-600 text-xs">{row.sku}</td>
                                <td className="px-4 py-4">
                                    <div className="font-bold text-zinc-900">{row.brand}</div>
                                    <div className="text-xs text-zinc-400">{row.name}</div>
                                </td>
                                <td className="px-4 py-4 text-zinc-600">
                                    {row.color !== '-' && <span>{row.color} </span>}
                                    {row.variantDetails !== '-' && <span className="text-xs text-zinc-400">{row.variantDetails}</span>}
                                    {row.color === '-' && row.variantDetails === '-' && <span className="text-zinc-300">—</span>}
                                </td>
                                <td className="px-4 py-4">
                                    {row.defaultSupplier ? (
                                        <span className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                                            <Building2 size={11} /> {row.defaultSupplier.name}
                                        </span>
                                    ) : (
                                        <span className="text-zinc-300 text-xs">—</span>
                                    )}
                                </td>
                                <td className="px-4 py-4">
                                    {row.category === 'Paddles' ? (
                                        row.consigned ? (
                                            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs font-bold">Consigned</span>
                                        ) : (
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">Owned</span>
                                        )
                                    ) : (
                                        <span className="bg-stone-100 text-stone-400 px-2 py-1 rounded-full text-xs font-bold">{row.category}</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                                    {formatPHP(row.sellingPrice)}
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="flex flex-col items-end gap-1.5">
                                        <span className={`text-base font-black leading-none flex items-center gap-2 ${row.isOutOfStock ? 'text-red-600' : row.isLowStock ? 'text-amber-600' : 'text-zinc-900'}`}>
                                            {row.isLowStock && !row.isOutOfStock && <AlertTriangle size={14} className="text-amber-500" />}
                                            {row.isOutOfStock && <PackageX size={14} className="text-red-500" />}
                                            {row.quantity ?? 0} stock{(row.quantity ?? 0) !== 1 ? 's' : ''} left
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" title="Total Sold">
                                                {row.totalSold} sold
                                            </span>
                                            {row.totalAdjusted > 0 && (
                                                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded" title="Manual Deductions / Adjustments">
                                                    -{row.totalAdjusted} adj
                                                </span>
                                            )}
                                            <span className="text-[10px] text-zinc-300">/</span>
                                            <span className="text-[10px] font-bold text-zinc-400 bg-stone-100 px-1.5 py-0.5 rounded" title="Total Added">
                                                {row.totalAdded} total
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <div className="flex items-center justify-end gap-0.5">
                                        <button
                                            onClick={() => openBatchModal(row)}
                                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="View Stock Batches"
                                        >
                                            <Layers size={14} /> Batches
                                        </button>
                                        <button
                                            onClick={() => setPendingAuthAction({ type: 'ADD', payload: row })}
                                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-500 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                                            title="Add Stock"
                                        >
                                            <PlusCircle size={14} /> Add
                                        </button>
                                        <button
                                            onClick={() => setPendingAuthAction({ type: 'DEDUCT', payload: row })}
                                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Deduct Stock"
                                        >
                                            <MinusCircle size={14} /> Deduct
                                        </button>
                                        <button
                                            onClick={() => setPendingAuthAction({ type: 'EDIT', payload: row })}
                                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                                            title="Edit Variant"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteVariantConfirm(row)}
                                            className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-zinc-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete Variant"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="8" className="px-6 py-16 text-center text-zinc-400">
                                    No items found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            </>
            ) : (
                /* OUTGOING ALLOCATION TRACKER VIEW */
                <div className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
                    {/* KPI SUMMARY CARDS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
                        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-stone-400 block">Total Units Dispatched</span>
                            <div className="text-xl font-black text-stone-900 mt-1">
                                {allocationStats.totalUnits} units
                            </div>
                            <span className="text-[11px] text-stone-400 font-medium">To all branch inventories</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-stone-400 block">Total Billed</span>
                            <div className="text-xl font-black text-stone-900 mt-1">
                                {formatPHP(allocationStats.totalCost)}
                            </div>
                            <span className="text-[11px] text-stone-400 font-medium">Gross allocation receivables</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                            <span className="text-[10px] font-black uppercase text-emerald-600 block">Total Remitted</span>
                            <div className="text-xl font-black text-emerald-600 mt-1">
                                {formatPHP(allocationStats.totalPaid)}
                            </div>
                            <span className="text-[11px] text-stone-400 font-medium">Collected payments</span>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm bg-gradient-to-br from-white to-amber-50/20">
                            <span className="text-[10px] font-black uppercase text-amber-700 block">Outstanding Receivables</span>
                            <div className="text-xl font-black text-amber-700 mt-1">
                                {formatPHP(allocationStats.outstanding)}
                            </div>
                            <span className="text-[11px] text-stone-500 font-medium">
                                {allocationStats.overdueCount > 0 ? (
                                    <span className="text-rose-600 font-bold">{allocationStats.overdueCount} overdue batch(es)</span>
                                ) : (
                                    'All payments on schedule'
                                )}
                            </span>
                        </div>
                    </div>

                    {/* FILTER & SEARCH */}
                    <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
                        <div className="relative w-full md:w-80">
                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                            <input
                                type="text"
                                value={allocationSearch}
                                onChange={(e) => setAllocationSearch(e.target.value)}
                                placeholder="Search branch, product, SKU..."
                                className="w-full pl-9 pr-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
                            {[
                                { id: 'ALL', label: 'All Records' },
                                { id: 'OVERDUE', label: `Overdue (${allocationStats.overdueCount})`, isAlert: allocationStats.overdueCount > 0 },
                                { id: 'PENDING', label: 'Pending' },
                                { id: 'PARTIAL', label: 'Partial' },
                                { id: 'PAID', label: 'Settled' },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setAllocationStatusFilter(tab.id)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                        allocationStatusFilter === tab.id
                                            ? 'bg-stone-900 text-white shadow-sm'
                                            : tab.isAlert
                                            ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ALLOCATIONS TRACKER TABLE */}
                    <div className="flex-1 overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm">
                        {loadingAllocations ? (
                            <div className="p-16 flex flex-col items-center justify-center gap-2 text-stone-400">
                                <Loader2 className="w-6 h-6 animate-spin text-stone-600" />
                                <span className="text-xs font-bold">Loading stock allocation history...</span>
                            </div>
                        ) : filteredAllocations.length === 0 ? (
                            <div className="p-16 text-center text-stone-400 text-xs">
                                No stock allocations matching this criteria.
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="sticky top-0 bg-stone-100 shadow-sm z-10 uppercase tracking-wider text-stone-500 font-bold border-b border-stone-200">
                                    <tr>
                                        <th className="px-4 py-3">Dispatched</th>
                                        <th className="px-4 py-3">Destination Branch</th>
                                        <th className="px-4 py-3">Product / SKU</th>
                                        <th className="px-4 py-3">Units</th>
                                        <th className="px-4 py-3">Cost / Unit</th>
                                        <th className="px-4 py-3">Total Billed</th>
                                        <th className="px-4 py-3">Paid / Remaining</th>
                                        <th className="px-4 py-3">Deadline</th>
                                        <th className="px-4 py-3 text-right">Payment Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {filteredAllocations.map(a => {
                                        const cost = parseFloat(a.totalCost || 0);
                                        const paid = parseFloat(a.amountPaid || 0);
                                        const rem = Math.max(0, cost - paid);
                                        const isPaid = paid >= cost && cost > 0;

                                        return (
                                            <tr key={a.id} className="hover:bg-stone-50/70 transition-colors">
                                                <td className="px-4 py-3 text-stone-500 font-mono">
                                                    {a.allocatedAt ? a.allocatedAt.substring(0, 10) : '—'}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                                                        <Building2 size={13} className="text-stone-400" />
                                                        {a.branchName}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-stone-900">{a.modelName}</div>
                                                    <div className="text-[10px] font-mono text-stone-400">{a.sku}</div>
                                                    {a.notes && <div className="text-[10px] text-stone-400 italic">"{a.notes}"</div>}
                                                </td>

                                                <td className="px-4 py-3 font-black text-stone-900">
                                                    {a.quantity} units
                                                </td>

                                                <td className="px-4 py-3 text-stone-600 font-semibold">
                                                    {formatPHP(a.costPerUnit)}
                                                </td>

                                                <td className="px-4 py-3 font-black text-stone-900">
                                                    {formatPHP(cost)}
                                                </td>

                                                <td className="px-4 py-3">
                                                    <span className="font-bold text-emerald-700">{formatPHP(paid)}</span>
                                                    {rem > 0 && (
                                                        <div className="text-[10px] text-rose-600 font-bold">
                                                            Due: {formatPHP(rem)}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="px-4 py-3 text-stone-600 font-semibold">
                                                    {a.deadline || '—'}
                                                </td>

                                                <td className="px-4 py-3 text-right">
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
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ===== ADD STOCK MODAL ===== */}
            {addStockModal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                            <div>
                                <h3 className="font-black text-zinc-900 flex items-center gap-2"><PlusCircle size={18} className="text-green-600" /> Add Stock</h3>
                                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[280px]">{addStockModal.name}</p>
                            </div>
                            <button onClick={() => !isAdding && setAddStockModal(null)} className="text-zinc-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            {addStatus.message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${addStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                    {addStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    <span className="font-medium">{addStatus.message}</span>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Quantity *</label>
                                    <input type="number" min="1" value={addForm.quantity}
                                        onChange={e => setAddForm(f => ({ ...f, quantity: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                                        placeholder="0" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Acquisition Price</label>
                                    <input type="number" step="0.01" min="0" value={addForm.acquisitionPrice}
                                        onChange={e => setAddForm(f => ({ ...f, acquisitionPrice: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900"
                                        placeholder="Optional" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-1">Supplier</label>
                                <select value={addForm.supplierId}
                                    onChange={e => setAddForm(f => ({ ...f, supplierId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-zinc-900">
                                    <option value="">— No supplier —</option>
                                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-2">Ownership Type</label>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setAddForm(f => ({ ...f, consigned: false }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${!addForm.consigned ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-zinc-400 hover:border-stone-300'}`}>
                                        Owned
                                    </button>
                                    <button type="button" onClick={() => setAddForm(f => ({ ...f, consigned: true }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${addForm.consigned ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-stone-200 text-zinc-400 hover:border-stone-300'}`}>
                                        Consigned
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button onClick={() => setAddStockModal(null)} disabled={isAdding} className="flex-1 px-4 py-2 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
                            <button onClick={handleConfirmAddStock}
                                disabled={isAdding || !addForm.quantity || Number(addForm.quantity) <= 0}
                                className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 disabled:opacity-40 transition-colors">
                                {isAdding && <Loader2 size={16} className="animate-spin" />}
                                Confirm Add
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== DEDUCT STOCK MODAL ===== */}
            {deductModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 bg-red-100 rounded-xl"><MinusCircle size={20} className="text-red-600" /></div>
                            <div>
                                <h3 className="font-black text-zinc-900 text-base">Deduct Stock</h3>
                                <p className="text-xs text-zinc-500 truncate max-w-[220px]">{deductModal.name}</p>
                            </div>
                            <button onClick={() => setDeductModal(null)} className="ml-auto text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
                        </div>
                        <div className="space-y-4">
                            {deductStatus.message && (
                                <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 flex items-center gap-2">
                                    <AlertCircle size={16} /><span>{deductStatus.message}</span>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-1">Reason *</label>
                                <select value={deductModal.reason}
                                    onChange={e => setDeductModal(d => ({ ...d, reason: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-red-400">
                                    <option>Return to Supplier</option>
                                    <option>Damaged / Lost</option>
                                    <option>Manual Adjustment</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-1">
                                    Quantity <span className="text-zinc-400 font-normal">(Current: {deductModal.currentQty})</span>
                                </label>
                                <input type="number" min="1" max={deductModal.currentQty} value={deductModal.qty}
                                    onChange={e => setDeductModal(d => ({ ...d, qty: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder={`Max ${deductModal.currentQty}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-1">Note (optional)</label>
                                <input type="text" value={deductModal.note}
                                    onChange={e => setDeductModal(d => ({ ...d, note: e.target.value }))}
                                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-400"
                                    placeholder="Optional detail" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={() => setDeductModal(null)} className="flex-1 px-4 py-2 text-sm font-bold border border-stone-300 rounded-xl hover:bg-stone-50">Cancel</button>
                            <button onClick={handleDeductStock}
                                disabled={!deductModal.qty || Number(deductModal.qty) <= 0}
                                className="flex-1 px-4 py-2 text-sm font-bold bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-40">
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== EDIT VARIANT MODAL ===== */}
            {editModal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                            <div>
                                <h3 className="font-black text-zinc-900 flex items-center gap-2"><Pencil size={18} className="text-zinc-700" /> Edit Variant</h3>
                                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[320px]">{editModal.row.dropdownName}</p>
                            </div>
                            <button onClick={() => !isSaving && setEditModal(null)} className="text-zinc-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {editStatus.message && (
                                <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${editStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                                    {editStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                    <span className="font-medium">{editStatus.message}</span>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">SKU *</label>
                                    <input required type="text" value={editForm.sku || ''}
                                        onChange={e => setEditForm(f => ({ ...f, sku: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-zinc-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Color</label>
                                    <input type="text" value={editForm.color || ''}
                                        onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
                                </div>
                            </div>
                            {editModal.row.category === 'Paddles' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-600 mb-1">Thickness (mm)</label>
                                        <input type="number" min="0" value={editForm.thicknessMm ?? ''}
                                            onChange={e => setEditForm(f => ({ ...f, thicknessMm: e.target.value }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-600 mb-1">Shape</label>
                                        <select value={editForm.shape || ''}
                                            onChange={e => setEditForm(f => ({ ...f, shape: e.target.value }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-zinc-900">
                                            <option value="">—</option>
                                            <option value="Standard">Standard</option>
                                            <option value="Elongated">Elongated</option>
                                            <option value="Hybrid">Hybrid</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Acquisition Price ₱</label>
                                    <input type="number" step="0.01" value={editForm.acquisitionPrice ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, acquisitionPrice: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Selling Price ₱</label>
                                    <input type="number" step="0.01" value={editForm.sellingPrice ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, sellingPrice: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1 flex items-center gap-1.5">
                                        <AlertTriangle size={11} /> Low-stock threshold
                                    </label>
                                    <input type="number" min="0" value={editForm.lowStockThreshold ?? ''}
                                        onChange={e => setEditForm(f => ({ ...f, lowStockThreshold: e.target.value }))}
                                        placeholder={`Default ${DEFAULT_LOW_STOCK_THRESHOLD}`}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-zinc-900" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-600 mb-1">Default Supplier</label>
                                    <select value={editForm.supplierId || ''}
                                        onChange={e => setEditForm(f => ({ ...f, supplierId: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-zinc-900">
                                        <option value="">— None —</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-600 mb-2">Ownership</label>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setEditForm(f => ({ ...f, consigned: false }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${!editForm.consigned ? 'border-green-500 bg-green-50 text-green-700' : 'border-stone-200 text-zinc-400'}`}>
                                        Owned
                                    </button>
                                    <button type="button" onClick={() => setEditForm(f => ({ ...f, consigned: true }))}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold border-2 transition-all ${editForm.consigned ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-stone-200 text-zinc-400'}`}>
                                        Consigned
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditModal(null)} disabled={isSaving}
                                    className="flex-1 px-4 py-2 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={isSaving}
                                    className="flex-1 px-4 py-2 bg-zinc-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-700 disabled:opacity-40">
                                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== DELETE VARIANT CONFIRM ===== */}
            {deleteVariantConfirm && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center">
                        <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={24} className="text-red-600" />
                        </div>
                        <h3 className="font-bold text-zinc-900 text-lg mb-1">Delete Variant?</h3>
                        <p className="text-sm text-zinc-500 mb-1 font-mono">{deleteVariantConfirm.sku}</p>
                        <p className="text-xs text-zinc-400 mb-5">Variants with sales cannot be deleted — only ones never sold.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteVariantConfirm(null)}
                                className="flex-1 px-4 py-2 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50">Cancel</button>
                            <button onClick={() => confirmDeleteVariant(deleteVariantConfirm.variantId)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BATCH HISTORY MODAL ===== */}
            {batchModal && (
                <div className="fixed inset-0 bg-zinc-950/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 shrink-0">
                            <div>
                                <h3 className="font-black text-zinc-900 flex items-center gap-2"><Layers size={18} className="text-indigo-600" /> Stock Batches</h3>
                                <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-[380px]">{batchModal.name}</p>
                            </div>
                            <button onClick={() => setBatchModal(null)} className="text-zinc-400 hover:text-red-500"><X size={20} /></button>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            {batchLoading ? (
                                <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-zinc-400" /></div>
                            ) : (
                                <>
                                    {batches.length === 0 ? (
                                        <div className="py-12 text-center text-zinc-400">
                                            <Layers size={40} className="mx-auto mb-3 opacity-30" />
                                            <p className="font-bold">No stock batches yet</p>
                                            <p className="text-sm">Add stock to create the first batch.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead className="bg-stone-100 text-xs uppercase text-zinc-500 font-bold sticky top-0">
                                                <tr>
                                                    <th className="px-5 py-3">Date Received</th>
                                                    <th className="px-5 py-3 text-center">Qty</th>
                                                    <th className="px-5 py-3 text-center">Remaining</th>
                                                    <th className="px-5 py-3 text-right">Cost</th>
                                                    <th className="px-5 py-3">Supplier</th>
                                                    <th className="px-5 py-3">Type</th>
                                                    <th className="px-5 py-3">Units</th>
                                                    <th className="px-5 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {batches.map((b, i) => {
                                                    const sales = batchSales[String(b.id)] || [];
                                                    const soldCount = (b.quantity || 0) - (b.remainingQuantity || 0);
                                                    const inStockCount = b.remainingQuantity || 0;
                                                    const isExpanded = !!expandedBatches[b.id];
                                                    const totalUnits = b.quantity || 0;
                                                    return (
                                                        <>
                                                            <tr key={b.id} className={`${b.remainingQuantity <= 0 ? 'opacity-50' : 'hover:bg-stone-50'} transition-colors`}>
                                                                <td className="px-5 py-3 text-zinc-500">
                                                                    <div className="font-bold text-zinc-700 text-xs">Batch #{i + 1}</div>
                                                                    <div className="text-zinc-400 text-xs">{fmtDate(b.restockedAt)}</div>
                                                                    {i === 0 && b.remainingQuantity > 0 && (
                                                                        <span className="mt-0.5 inline-block text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">NEXT SELL</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3 text-center font-bold text-zinc-800">{b.quantity}</td>
                                                                <td className="px-5 py-3 text-center">
                                                                    <span className={`font-bold px-2 py-0.5 rounded text-xs ${b.remainingQuantity > 0 ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-400'}`}>
                                                                        {b.remainingQuantity}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-3 text-right font-medium text-zinc-700">{fmtPrice(b.acquisitionPrice)}</td>
                                                                <td className="px-5 py-3">
                                                                    {b.supplier ? (
                                                                        <span className="flex items-center gap-1 text-indigo-700 text-xs font-bold">
                                                                            <Building2 size={11} /> {b.supplier.name}
                                                                        </span>
                                                                    ) : <span className="text-zinc-300 text-xs">—</span>}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    {b.consigned
                                                                        ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">Consigned</span>
                                                                        : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">Owned</span>
                                                                    }
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    {totalUnits > 0 && (
                                                                        <button
                                                                            onClick={() => toggleBatchExpand(b.id)}
                                                                            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg transition-colors whitespace-nowrap"
                                                                        >
                                                                            <Layers size={11} />
                                                                            {soldCount > 0 ? `${soldCount} sold` : ''}
                                                                            {soldCount > 0 && inStockCount > 0 ? ' · ' : ''}
                                                                            {inStockCount > 0 ? `${inStockCount} in stock` : ''}
                                                                            <span className="ml-0.5">{isExpanded ? '▲' : '▼'}</span>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3 text-right">
                                                                    {b.batchId && (
                                                                        <button onClick={() => handleRevertBatch(b.batchId)}
                                                                            className="text-zinc-400 hover:text-red-500 transition-colors p-1"
                                                                            title="Revert Batch Addition">
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                            {/* Per-unit status rows — shown when expanded */}
                                                            {isExpanded && (
                                                                <tr key={`${b.id}-units`}>
                                                                    <td colSpan={8} className="px-0 py-0 bg-slate-50 border-b border-slate-200">
                                                                        <div className="px-6 py-3 space-y-1.5">
                                                                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Batch #{i + 1} — Unit Breakdown</div>
                                                                            {/* Sold units */}
                                                                            {sales.map((sale, unitIdx) => {
                                                                                const isConsignment = sale.type === 'CONSIGNMENT';
                                                                                const isPaid = sale.status === 'FULL';
                                                                                const isPartial = sale.status === 'PARTIAL';
                                                                                const isUnpaid = sale.status === 'UNPAID';
                                                                                // Short order ID for display
                                                                                const shortId = sale.transactionId?.startsWith('LEGACY-')
                                                                                    ? sale.transactionId
                                                                                    : sale.transactionId?.slice(0, 8).toUpperCase();
                                                                                return (
                                                                                    <div key={sale.internalId} className="flex items-center gap-2 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2">
                                                                                        <span className="text-zinc-400 font-mono w-14 shrink-0">Unit {unitIdx + 1}</span>
                                                                                        <span className="text-emerald-600 font-black text-[11px]">✓ SOLD</span>
                                                                                        <span className="text-zinc-300">·</span>
                                                                                        {isConsignment ? (
                                                                                            <span className="text-purple-700 font-bold">
                                                                                                Consignee: <span className="text-purple-900">{sale.consigneeName || '—'}</span>
                                                                                            </span>
                                                                                        ) : (
                                                                                            <span className="text-zinc-700 font-bold">
                                                                                                Order <span className="font-mono text-indigo-700">#{shortId}</span>
                                                                                                {sale.customerName && <span className="text-zinc-400 font-normal"> · {sale.customerName}</span>}
                                                                                            </span>
                                                                                        )}
                                                                                        <span className="text-zinc-300">·</span>
                                                                                        {isPaid && <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black text-[10px] uppercase">Paid</span>}
                                                                                        {isPartial && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black text-[10px] uppercase">Partial</span>}
                                                                                        {isUnpaid && <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-black text-[10px] uppercase">Unpaid</span>}
                                                                                        <span className="ml-auto text-zinc-400 whitespace-nowrap">{fmtDate(sale.date)}</span>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                            {/* In-stock units */}
                                                                            {Array.from({ length: inStockCount }).map((_, j) => (
                                                                                <div key={`stock-${j}`} className="flex items-center gap-2 text-xs bg-white border border-stone-200 rounded-lg px-3 py-2">
                                                                                    <span className="text-zinc-400 font-mono w-14 shrink-0">Unit {sales.length + j + 1}</span>
                                                                                    <span className="text-blue-500 font-black text-[11px]">📦 IN STOCK</span>
                                                                                    <span className="text-zinc-300 ml-auto text-[10px]">Available</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}

                                    {/* Adjustments — surface the deduct "Reason" history */}
                                    {adjustments.length > 0 && (
                                        <div className="px-5 py-4 border-t border-stone-200 bg-stone-50/40">
                                            <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-500 flex items-center gap-2 mb-3">
                                                <History size={12} /> Manual Adjustments
                                                <span className="text-zinc-300 font-normal">— deductions outside of sales</span>
                                            </h4>
                                            <div className="space-y-1.5">
                                                {adjustments.map(a => (
                                                    <div key={a.id} className="flex items-center justify-between text-xs bg-white border border-stone-200 rounded-lg px-3 py-2">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <span className="font-bold text-red-600 whitespace-nowrap">−{a.quantity}</span>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                a.reason === 'Damaged / Lost' ? 'bg-red-50 text-red-600' :
                                                                a.reason === 'Return to Supplier' ? 'bg-amber-50 text-amber-700' :
                                                                'bg-zinc-100 text-zinc-600'
                                                            }`}>{a.reason}</span>
                                                            {a.note && <span className="text-zinc-500 italic truncate">{a.note}</span>}
                                                        </div>
                                                        <span className="text-zinc-400 whitespace-nowrap">{fmtDateTime(a.adjustedAt)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="px-6 py-3 border-t border-stone-200 bg-stone-50 shrink-0 flex justify-between items-center text-xs text-zinc-500">
                            <span>{batches.length} batch{batches.length !== 1 ? 'es' : ''}{adjustments.length > 0 ? ` · ${adjustments.length} adjustment${adjustments.length !== 1 ? 's' : ''}` : ''} · FIFO order (oldest first = sold first)</span>
                            <button onClick={() => setBatchModal(null)} className="px-4 py-1.5 font-bold text-zinc-600 hover:bg-stone-200 rounded-lg">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== BATCH ADD MODAL (NEW COMPONENT) ===== */}
            {showBatchAdd && (
                <BatchAddModal
                    products={products}
                    suppliers={suppliers}
                    onClose={() => setShowBatchAdd(false)}
                    onSuccess={() => { setShowBatchAdd(false); refetchProducts?.(); }}
                />
            )}

            {/* ===== PASSWORD PROMPT MODAL ===== */}
            {pendingAuthAction && (
                <PasswordModal
                    title={`Authenticate to ${pendingAuthAction.type.toLowerCase()}`}
                    onConfirm={handleAuthConfirm}
                    onCancel={() => setPendingAuthAction(null)}
                />
            )}
        </div>
    );
};

export default ManageInventory;
