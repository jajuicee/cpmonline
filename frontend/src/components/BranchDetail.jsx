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
    ListFilter,
    Table,
    LayoutGrid,
    Maximize2,
    Percent,
    Pencil,
    SlidersHorizontal,
    ChevronDown,
    AlertCircle,
    Receipt,
    Download,
    ShoppingBag,
    Eye,
    FileText,
    RefreshCw,
    XCircle,
    Filter,
    ArrowRight,
    Key
} from 'lucide-react';
import BranchAnalytics from './BranchAnalytics';
import Expenses from './Expenses';
import BranchPasswordModal from './BranchPasswordModal';

const formatCurrency = (val) =>
    `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const BranchDetail = () => {
    const { branchId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [branch, setBranch] = useState(null);
    const [loadingBranch, setLoadingBranch] = useState(true);
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'overview');
    const [passwordModalOpen, setPasswordModalOpen] = useState(false);

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

    const [manifest, setManifest] = useState([]); // Array of { variantId, sku, brandName, modelName, maxStock, quantity, costPerUnit, acquisitionPrice }
    const [manifestViewMode, setManifestViewMode] = useState('table'); // 'table' | 'cards'
    const [priceReviewModalOpen, setPriceReviewModalOpen] = useState(false);

    // Batch Accordion & Payment State (Consignment style)
    const [expandedBatches, setExpandedBatches] = useState(() => new Set());
    const [selectedBatch, setSelectedBatch] = useState(null);

    // Inline branch price editing in Tab 4 (Branch Inventory Tracker)
    const [editingPriceVariantId, setEditingPriceVariantId] = useState(null);
    const [editingPriceValue, setEditingPriceValue] = useState('');
    const [savingInlinePrice, setSavingInlinePrice] = useState(false);

    // Tab 4: Branch Inventory Tracker & Master Catalog Gap State
    const [invSubTab, setInvSubTab] = useState('in_stock'); // 'in_stock' | 'missing' | 'all'
    const [invSearch, setInvSearch] = useState('');
    const [invCategory, setInvCategory] = useState('All');
    const [invOnlyHqAvailable, setInvOnlyHqAvailable] = useState(false);
    const [selectedMissingVariantIds, setSelectedMissingVariantIds] = useState(() => new Set());

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

    // ── Remittable Sales Feature State ─────────────────────────────────────────
    const [remittableSalesData, setRemittableSalesData] = useState({ summary: {}, items: [] });
    const [loadingRemittableSales, setLoadingRemittableSales] = useState(false);
    const [remittanceSearch, setRemittanceSearch] = useState('');
    const [remittanceStatusFilter, setRemittanceStatusFilter] = useState('ALL'); // ALL, PENDING, REMITTED, PARTIAL
    const [remittanceDatePreset, setRemittanceDatePreset] = useState('all'); // all, today, this_week, this_month, custom
    const [remittanceCustomFrom, setRemittanceCustomFrom] = useState('');
    const [remittanceCustomTo, setRemittanceCustomTo] = useState('');
    const [selectedSoldItemModal, setSelectedSoldItemModal] = useState(null);

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

    // 5. Fetch Remittable Sales for this branch
    const fetchRemittableSales = async (preset = remittanceDatePreset, customFrom = remittanceCustomFrom, customTo = remittanceCustomTo) => {
        if (!branchId) return;
        setLoadingRemittableSales(true);
        try {
            let fromStr = '';
            let toStr = '';

            const now = new Date();
            if (preset === 'today') {
                const todayStr = now.toISOString().split('T')[0];
                fromStr = `${todayStr}T00:00:00`;
                toStr = `${todayStr}T23:59:59`;
            } else if (preset === 'this_week') {
                const firstDayOfWeek = new Date(now);
                const day = now.getDay() || 7;
                firstDayOfWeek.setDate(now.getDate() - day + 1);
                fromStr = `${firstDayOfWeek.toISOString().split('T')[0]}T00:00:00`;
                toStr = `${now.toISOString().split('T')[0]}T23:59:59`;
            } else if (preset === 'this_month') {
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                fromStr = `${firstDayOfMonth.toISOString().split('T')[0]}T00:00:00`;
                toStr = `${now.toISOString().split('T')[0]}T23:59:59`;
            } else if (preset === 'custom' && customFrom && customTo) {
                fromStr = `${customFrom}T00:00:00`;
                toStr = `${customTo}T23:59:59`;
            }

            let url = `/api/admin/branches/${branchId}/remittable-sales`;
            const params = [];
            if (fromStr && toStr) {
                params.push(`from=${encodeURIComponent(fromStr)}`);
                params.push(`to=${encodeURIComponent(toStr)}`);
            }
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const res = await axios.get(url);
            setRemittableSalesData(res.data || { summary: {}, items: [] });
        } catch (err) {
            console.error('Failed to load remittable sales:', err);
            showFeedback('error', 'Failed to load branch remittable sales.');
        } finally {
            setLoadingRemittableSales(false);
        }
    };

    useEffect(() => {
        if (branchId) {
            fetchBranch();
            fetchAdminProducts();
            fetchBranchProducts();
            fetchAllocations();
            fetchRemittableSales();
        }
    }, [branchId]);

    useEffect(() => {
        if (activeTab === 'remittance' && branchId) {
            fetchRemittableSales(remittanceDatePreset, remittanceCustomFrom, remittanceCustomTo);
        }
    }, [activeTab, remittanceDatePreset]);

    // Flatten Admin Catalog into selectable variants with available stock
    const availableAdminVariants = useMemo(() => {
        const rows = [];
        adminProducts.forEach(p => {
            (p.variants || []).forEach(v => {
                const stock = v.mainStock != null ? v.mainStock : (v.stockQuantity ?? 0);
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
                    adminStock: stock,
                    totalCompanyStock: v.stockQuantity ?? 0,
                    branchStock: v.branchStock || 0
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
                    color: v.color || '',
                    shape: v.shape || '',
                    thicknessMm: v.thicknessMm || '',
                    category: v.category || 'General',
                    maxStock: v.adminStock,
                    quantity: 1,
                    // Default transfer cost per unit: acquisition price or holding cost
                    costPerUnit: v.acquisitionPrice > 0 ? v.acquisitionPrice : (v.sellingPrice || 0),
                    acquisitionPrice: v.acquisitionPrice || 0
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
                const defaultCost = v.acquisitionPrice > 0 ? v.acquisitionPrice : (v.sellingPrice || 0);

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
                        color: v.color || '',
                        shape: v.shape || '',
                        thicknessMm: v.thicknessMm || '',
                        category: v.category || 'General',
                        maxStock: v.adminStock,
                        quantity: targetQty,
                        costPerUnit: defaultCost,
                        acquisitionPrice: v.acquisitionPrice || 0
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
            const acq = v?.acquisitionPrice > 0 ? v.acquisitionPrice : (m.acquisitionPrice || 0);

            if (type === 'acquisition') {
                return { ...m, costPerUnit: acq > 0 ? acq : m.costPerUnit };
            } else if (type === 'markup15') {
                const base = acq > 0 ? acq : m.costPerUnit;
                return { ...m, costPerUnit: Math.round(base * 1.15) };
            } else if (type === 'markup25') {
                const base = acq > 0 ? acq : m.costPerUnit;
                return { ...m, costPerUnit: Math.round(base * 1.25) };
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
            setPriceReviewModalOpen(false);
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

    // Tab 4 (Branch Inventory Tracker) inline price editor helper
    const startEditingBranchPrice = (variantId, currentPrice) => {
        setEditingPriceVariantId(variantId);
        setEditingPriceValue(currentPrice != null ? currentPrice.toString() : '');
    };

    const handleSaveInlineBranchPrice = async (variantId) => {
        const priceNum = parseFloat(editingPriceValue);
        if (isNaN(priceNum) || priceNum < 0) {
            showFeedback('error', 'Please enter a valid price >= 0.');
            return;
        }
        setSavingInlinePrice(true);
        try {
            await axios.put(`/api/products/variants/${variantId}/branch-price`, {
                branchId: parseInt(branchId, 10),
                sellingPrice: priceNum
            });
            showFeedback('success', `Branch selling price updated to ${formatCurrency(priceNum)}`);
            setEditingPriceVariantId(null);
            fetchBranchProducts();
        } catch (err) {
            console.error('Failed to update branch price:', err);
            showFeedback('error', err.response?.data?.error || 'Failed to update branch selling price.');
        } finally {
            setSavingInlinePrice(false);
        }
    };

    // ── Tab 4 Branch Catalog & Gap Analysis (In-Stock vs Missing Products to Add) ──
    const branchVariantMap = useMemo(() => {
        const map = new Map();
        (branchProducts || []).forEach(p => {
            (p.variants || []).forEach(v => {
                map.set(v.id, {
                    ...v,
                    productId: p.id,
                    brandName: p.brandName,
                    modelName: p.modelName,
                    category: p.category || 'General',
                    branchStock: v.stockQuantity ?? 0
                });
            });
        });
        return map;
    }, [branchProducts]);

    const branchCatalogAnalysis = useMemo(() => {
        const rows = [];
        let inStockCount = 0;
        let missingCount = 0;
        let hqAvailableMissingCount = 0;
        let totalUnitsInBranch = 0;

        (adminProducts || []).forEach(p => {
            (p.variants || []).forEach(v => {
                const bVariant = branchVariantMap.get(v.id);
                const branchStock = bVariant ? (bVariant.branchStock ?? 0) : 0;
                const hasBranchHistory = Boolean(bVariant);
                const adminStock = v.mainStock != null ? v.mainStock : (v.stockQuantity ?? 0);
                const hasCustomPrice = bVariant?.hasCustomPrice || false;
                const branchSellingPrice = bVariant?.branchSellingPrice != null ? bVariant.branchSellingPrice : v.sellingPrice;

                let status = 'NOT_CARRIED'; // Never carried at this branch
                if (branchStock > 0) {
                    status = 'IN_STOCK';
                    inStockCount++;
                    totalUnitsInBranch += branchStock;
                } else if (hasBranchHistory) {
                    status = 'OUT_OF_STOCK';
                    missingCount++;
                    if (adminStock > 0) hqAvailableMissingCount++;
                } else {
                    status = 'NOT_CARRIED';
                    missingCount++;
                    if (adminStock > 0) hqAvailableMissingCount++;
                }

                rows.push({
                    productId: p.id,
                    brandName: p.brandName,
                    modelName: p.modelName,
                    category: p.category || 'General',
                    variantId: v.id,
                    sku: v.sku,
                    color: v.color || '',
                    shape: v.shape || '',
                    thicknessMm: v.thicknessMm || '',
                    acquisitionPrice: v.acquisitionPrice ?? 0,
                    defaultSellingPrice: v.sellingPrice ?? 0,
                    branchSellingPrice,
                    hasCustomPrice,
                    branchStock,
                    adminStock,
                    status,
                    hasBranchHistory
                });
            });
        });

        // Defensive: include any branch variants not in master catalog
        const processedIds = new Set(rows.map(r => r.variantId));
        branchVariantMap.forEach((bv, vId) => {
            if (!processedIds.has(vId)) {
                const bStock = bv.branchStock ?? 0;
                if (bStock > 0) {
                    inStockCount++;
                    totalUnitsInBranch += bStock;
                } else {
                    missingCount++;
                }
                rows.push({
                    productId: bv.productId,
                    brandName: bv.brandName,
                    modelName: bv.modelName,
                    category: bv.category || 'General',
                    variantId: bv.id,
                    sku: bv.sku,
                    color: bv.color || '',
                    shape: bv.shape || '',
                    thicknessMm: bv.thicknessMm || '',
                    acquisitionPrice: bv.acquisitionPrice ?? 0,
                    defaultSellingPrice: bv.sellingPrice ?? 0,
                    branchSellingPrice: bv.branchSellingPrice ?? bv.sellingPrice ?? 0,
                    hasCustomPrice: bv.hasCustomPrice || false,
                    branchStock: bStock,
                    adminStock: 0,
                    status: bStock > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                    hasBranchHistory: true
                });
            }
        });

        return {
            items: rows,
            inStockCount,
            missingCount,
            hqAvailableMissingCount,
            totalCatalogCount: rows.length,
            totalUnitsInBranch
        };
    }, [adminProducts, branchVariantMap]);

    const invCategories = useMemo(() => {
        const set = new Set(branchCatalogAnalysis.items.map(it => it.category));
        return ['All', ...Array.from(set).filter(Boolean)];
    }, [branchCatalogAnalysis.items]);

    const filteredInventoryItems = useMemo(() => {
        return branchCatalogAnalysis.items.filter(item => {
            if (invSubTab === 'in_stock' && item.status !== 'IN_STOCK') {
                return false;
            }
            if (invSubTab === 'missing' && item.status === 'IN_STOCK') {
                return false;
            }
            if (invOnlyHqAvailable && item.adminStock <= 0) {
                return false;
            }
            if (invCategory !== 'All' && item.category !== invCategory) {
                return false;
            }
            if (invSearch.trim()) {
                const q = invSearch.toLowerCase().trim();
                const matchBrand = item.brandName?.toLowerCase().includes(q);
                const matchModel = item.modelName?.toLowerCase().includes(q);
                const matchSku = item.sku?.toLowerCase().includes(q);
                const matchColor = item.color?.toLowerCase().includes(q);
                const matchCategory = item.category?.toLowerCase().includes(q);
                if (!matchBrand && !matchModel && !matchSku && !matchColor && !matchCategory) {
                    return false;
                }
            }
            return true;
        });
    }, [branchCatalogAnalysis.items, invSubTab, invCategory, invSearch, invOnlyHqAvailable]);

    const handleQuickAllocateFromInventory = (item) => {
        addToManifest({
            variantId: item.variantId,
            sku: item.sku,
            brandName: item.brandName,
            modelName: item.modelName,
            color: item.color,
            shape: item.shape,
            thicknessMm: item.thicknessMm,
            category: item.category,
            adminStock: item.adminStock,
            acquisitionPrice: item.acquisitionPrice,
            sellingPrice: item.defaultSellingPrice
        });
        handleTabChange('allocate');
        showFeedback('success', `Added "${item.brandName} ${item.modelName}" to allocation manifest.`);
    };

    const toggleSelectMissingVariant = (variantId) => {
        setSelectedMissingVariantIds(prev => {
            const next = new Set(prev);
            if (next.has(variantId)) next.delete(variantId);
            else next.add(variantId);
            return next;
        });
    };

    const toggleSelectAllMissing = () => {
        const selectable = filteredInventoryItems.filter(it => it.adminStock > 0);
        if (selectedMissingVariantIds.size >= selectable.length && selectable.length > 0) {
            setSelectedMissingVariantIds(new Set());
        } else {
            setSelectedMissingVariantIds(new Set(selectable.map(it => it.variantId)));
        }
    };

    const handleBulkAllocateMissing = () => {
        const itemsToAllocate = filteredInventoryItems.filter(it => selectedMissingVariantIds.has(it.variantId) && it.adminStock > 0);
        if (itemsToAllocate.length === 0) {
            showFeedback('error', 'Select at least one product with available Admin HQ stock.');
            return;
        }
        itemsToAllocate.forEach(it => {
            addToManifest({
                variantId: it.variantId,
                sku: it.sku,
                brandName: it.brandName,
                modelName: it.modelName,
                color: it.color,
                shape: it.shape,
                thicknessMm: it.thicknessMm,
                category: it.category,
                adminStock: it.adminStock,
                acquisitionPrice: it.acquisitionPrice,
                sellingPrice: it.defaultSellingPrice
            });
        });
        setSelectedMissingVariantIds(new Set());
        handleTabChange('allocate');
        showFeedback('success', `Added ${itemsToAllocate.length} items to allocation manifest.`);
    };

    // Batch Accordion Expand Toggle
    const toggleBatchExpand = (batchId) => {
        setExpandedBatches(prev => {
            const next = new Set(prev);
            if (next.has(batchId)) {
                next.delete(batchId);
            } else {
                next.add(batchId);
            }
            return next;
        });
    };

    // Open Payment Record Modal for single item
    const openPaymentModal = (alloc) => {
        setSelectedAllocation(alloc);
        setSelectedBatch(null);
        const rem = parseFloat(alloc.totalCost || 0) - parseFloat(alloc.amountPaid || 0);
        setPaymentAmount(rem > 0 ? rem.toString() : '');
        setPaymentModalOpen(true);
    };

    // Open Payment Record Modal for entire batch (Consignment style)
    const openBatchPaymentModal = (batch) => {
        setSelectedBatch(batch);
        setSelectedAllocation(null);
        setPaymentAmount(batch.totalUnpaid > 0 ? batch.totalUnpaid.toString() : '');
        setPaymentModalOpen(true);
    };

    // Submit Payment Record (Handles both batch and single item)
    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!selectedAllocation && !selectedBatch) return;

        const amt = parseFloat(paymentAmount);
        if (isNaN(amt) || amt <= 0) {
            showFeedback('error', 'Please enter a valid positive payment amount.');
            return;
        }

        setRecordingPayment(true);
        try {
            if (selectedBatch) {
                await axios.put(`/api/admin/allocations/batch/${selectedBatch.rawBatchId}/payment`, {
                    amount: amt
                });
                showFeedback('success', `Payment of ${formatCurrency(amt)} recorded for batch #${selectedBatch.shortId}.`);
            } else {
                await axios.put(`/api/admin/allocations/${selectedAllocation.id}/payment`, {
                    amount: amt
                });
                showFeedback('success', `Payment of ${formatCurrency(amt)} recorded.`);
            }
            setPaymentModalOpen(false);
            setSelectedBatch(null);
            setSelectedAllocation(null);
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

    // Group Allocations by Batch (Consignment Accordion Style)
    const groupedAllocations = useMemo(() => {
        const map = new Map();

        allocations.forEach(a => {
            const batchKey = a.adminBatchId || `batch_${a.allocatedAt || a.id}`;
            if (!map.has(batchKey)) {
                const rawId = a.adminBatchId || String(a.id);
                const shortId = rawId.startsWith('BATCH-')
                    ? rawId.replace('BATCH-', '')
                    : String(rawId).slice(-6).toUpperCase();

                map.set(batchKey, {
                    batchId: batchKey,
                    rawBatchId: rawId,
                    shortId,
                    allocatedAt: a.allocatedAt ? new Date(a.allocatedAt) : null,
                    deadline: a.deadline,
                    notes: a.notes,
                    items: [],
                    totalUnits: 0,
                    totalSold: 0,
                    totalRemaining: 0,
                    totalCost: 0,
                    totalPaid: 0,
                    hasOverdue: false
                });
            }

            const group = map.get(batchKey);
            group.items.push(a);
            const qty = parseInt(a.quantity, 10) || 0;
            const sold = parseInt(a.soldQuantity, 10) || 0;
            const remUnits = parseInt(a.remainingQuantity, 10) || 0;
            const cost = parseFloat(a.totalCost || 0);
            const paid = parseFloat(a.amountPaid || 0);

            group.totalUnits += qty;
            group.totalSold += sold;
            group.totalRemaining += remUnits;
            group.totalCost += cost;
            group.totalPaid += paid;
            if (a.overdue) group.hasOverdue = true;
        });

        return Array.from(map.values()).map(g => {
            const totalUnpaid = Math.max(0, g.totalCost - g.totalPaid);
            const isPaid = totalUnpaid <= 0 && g.totalCost > 0;
            let status = 'PENDING';
            if (isPaid) {
                status = 'PAID';
            } else if (g.totalPaid > 0) {
                status = 'PARTIAL';
            }

            return {
                ...g,
                totalUnpaid,
                isPaid,
                status
            };
        }).sort((a, b) => {
            const timeA = a.allocatedAt ? a.allocatedAt.getTime() : 0;
            const timeB = b.allocatedAt ? b.allocatedAt.getTime() : 0;
            return timeB - timeA;
        });
    }, [allocations]);

    // ── Filtered Remittable Items ──────────────────────────────────────────────
    const filteredRemittableItems = useMemo(() => {
        const list = remittableSalesData.items || [];
        return list.filter(item => {
            if (remittanceStatusFilter !== 'ALL') {
                if (remittanceStatusFilter === 'PENDING' && item.remittanceStatus !== 'PENDING') return false;
                if (remittanceStatusFilter === 'REMITTED' && item.remittanceStatus !== 'REMITTED') return false;
                if (remittanceStatusFilter === 'PARTIAL' && item.remittanceStatus !== 'PARTIAL') return false;
            }

            if (remittanceSearch.trim()) {
                const q = remittanceSearch.toLowerCase();
                const brand = (item.variant?.brandName || '').toLowerCase();
                const model = (item.variant?.modelName || '').toLowerCase();
                const sku = (item.variant?.sku || '').toLowerCase();
                const customer = (item.customerName || '').toLowerCase();
                const ticket = (item.orderTicketId || '').toLowerCase();
                const notes = (item.notes || '').toLowerCase();
                const payment = (item.paymentMethod || '').toLowerCase();

                const match = brand.includes(q) ||
                    model.includes(q) ||
                    sku.includes(q) ||
                    customer.includes(q) ||
                    ticket.includes(q) ||
                    notes.includes(q) ||
                    payment.includes(q);
                if (!match) return false;
            }

            return true;
        });
    }, [remittableSalesData.items, remittanceStatusFilter, remittanceSearch]);

    // ── Dynamic Filtered Remittance Summary ────────────────────────────────────
    const filteredRemittanceSummary = useMemo(() => {
        let totalItems = 0;
        let totalGross = 0;
        let totalRemittable = 0;
        let totalRemitted = 0;
        let totalPending = 0;
        let totalProfit = 0;

        filteredRemittableItems.forEach(item => {
            totalItems++;
            totalGross += Number(item.finalPrice || 0);
            totalRemittable += Number(item.remittableCost || 0);
            totalRemitted += Number(item.remittedAmount || 0);
            totalPending += Number(item.pendingRemittance || 0);
            totalProfit += Number(item.branchProfit || 0);
        });

        const margin = totalGross > 0 ? (totalProfit / totalGross) * 100 : 0;

        return {
            totalItems,
            totalGross,
            totalRemittable,
            totalRemitted,
            totalPending,
            totalProfit,
            margin
        };
    }, [filteredRemittableItems]);

    // ── CSV Exporter for Remittable Sales ───────────────────────────────────────
    const exportRemittanceCsv = () => {
        if (!filteredRemittableItems.length) return;
        const headers = [
            "Date",
            "Order Ticket",
            "Customer",
            "Brand",
            "Model",
            "Category",
            "SKU",
            "Specs",
            "Payment Method",
            "Order Notes",
            "Selling Price (Gross)",
            "Remittable Cost (Wholesale Base)",
            "Branch Profit",
            "Margin %",
            "Remittance Status",
            "Remitted to HQ",
            "Pending Remittance",
            "Allocation Batch ID"
        ];

        const rows = filteredRemittableItems.map(item => [
            item.transactionDate ? new Date(item.transactionDate).toLocaleString('en-PH') : '',
            item.orderTicketId || '',
            `"${(item.customerName || 'Walk-in Customer').replace(/"/g, '""')}"`,
            `"${(item.variant?.brandName || '').replace(/"/g, '""')}"`,
            `"${(item.variant?.modelName || '').replace(/"/g, '""')}"`,
            `"${(item.variant?.category || 'General').replace(/"/g, '""')}"`,
            item.variant?.sku || '',
            `"${[item.variant?.color, item.variant?.thicknessMm ? `${item.variant.thicknessMm}mm` : '', item.variant?.shape].filter(Boolean).join(', ')}"`,
            item.paymentMethod || '',
            `"${(item.notes || '').replace(/"/g, '""')}"`,
            item.finalPrice || 0,
            item.remittableCost || 0,
            item.branchProfit || 0,
            item.profitMarginPct ? item.profitMarginPct.toFixed(2) : 0,
            item.remittanceStatus || '',
            item.remittedAmount || 0,
            item.pendingRemittance || 0,
            item.adminBatchId || ''
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${(branch?.name || 'Branch').replace(/\s+/g, '_')}_Remittable_Sales_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Consignment-Style Batch Accordion History Renderer
    const renderAllocationBatchHistory = (
        title = "Stock Allocation & Batch History",
        subtitle = "Batch records of dispatched inventory with live sales tracking and payments"
    ) => {
        return (
            <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden space-y-0">
                {/* Section Header */}
                <div className="p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70">
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="font-black text-stone-900 text-base">{title}</h4>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-stone-200/80 text-stone-700">
                                {groupedAllocations.length} {groupedAllocations.length === 1 ? 'batch' : 'batches'}
                            </span>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
                    </div>

                    <div className="flex items-center gap-2">
                        {groupedAllocations.length > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (expandedBatches.size === groupedAllocations.length) {
                                        setExpandedBatches(new Set());
                                    } else {
                                        setExpandedBatches(new Set(groupedAllocations.map(g => g.batchId)));
                                    }
                                }}
                                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-xs font-bold text-stone-700 transition-colors shadow-2xs cursor-pointer"
                            >
                                {expandedBatches.size === groupedAllocations.length ? 'Collapse All' : 'Expand All'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Batch List */}
                <div className="p-5 space-y-3.5 bg-stone-50/30">
                    {groupedAllocations.length === 0 ? (
                        <div className="p-16 text-center text-stone-400 bg-white rounded-2xl border border-dashed border-stone-200">
                            <PackagePlus size={28} className="mx-auto mb-2 opacity-30 text-stone-400" />
                            <p className="text-xs font-bold text-stone-600">No stock allocations on record</p>
                            <p className="text-[11px] text-stone-400 mt-0.5">Use the manifest above to dispatch stock to this branch</p>
                        </div>
                    ) : (
                        groupedAllocations.map(group => {
                            const isExpanded = expandedBatches.has(group.batchId);
                            const isUnfinished = !group.isPaid;

                            return (
                                <div
                                    key={group.batchId}
                                    className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:border-stone-300 transition-all"
                                >
                                    {/* Group Header (Consignment style) */}
                                    <div
                                        className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none hover:bg-stone-50/80 transition-colors"
                                        onClick={() => toggleBatchExpand(group.batchId)}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className={`p-1.5 rounded-lg bg-stone-100 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                <ChevronDown size={16} className="text-stone-500" />
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-black text-xs text-stone-500">
                                                        #{group.shortId}
                                                    </span>
                                                    {group.hasOverdue && (
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 flex items-center gap-1">
                                                            <AlertCircle size={10} /> Overdue
                                                        </span>
                                                    )}
                                                    {group.deadline && (
                                                        <span className="text-[10px] text-stone-400 font-medium">
                                                            Deadline: {group.deadline}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="font-black text-stone-900 text-sm truncate mt-0.5">
                                                    {group.allocatedAt
                                                        ? group.allocatedAt.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                                                        : 'Recent Batch'}
                                                </div>

                                                <div className="text-xs text-stone-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                                                    <span className="font-bold text-stone-700">
                                                        {group.items.length} {group.items.length === 1 ? 'product' : 'products'}
                                                    </span>
                                                    <span className="text-stone-300">•</span>
                                                    <span className="font-bold text-stone-700">
                                                        {group.totalUnits} units dispatched
                                                    </span>
                                                    {group.totalSold > 0 && (
                                                        <>
                                                            <span className="text-stone-300">•</span>
                                                            <span className="text-emerald-700 font-bold">
                                                                {group.totalSold} sold
                                                            </span>
                                                        </>
                                                    )}
                                                    <span className="text-stone-300">•</span>
                                                    <span className="font-mono font-bold text-stone-800">
                                                        Billed: {formatCurrency(group.totalCost)}
                                                    </span>
                                                    {group.notes && (
                                                        <>
                                                            <span className="text-stone-300">•</span>
                                                            <span className="italic text-stone-400 truncate max-w-xs">
                                                                "{group.notes}"
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0 ml-auto" onClick={e => e.stopPropagation()}>
                                            {isUnfinished ? (
                                                <>
                                                    <div className="text-right">
                                                        <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">
                                                            Balance Due
                                                        </div>
                                                        <div className="text-base font-black text-amber-600 font-mono">
                                                            {formatCurrency(group.totalUnpaid)}
                                                        </div>
                                                        {group.totalPaid > 0 && (
                                                            <div className="text-[10px] text-emerald-600 font-semibold">
                                                                Paid: {formatCurrency(group.totalPaid)}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => openBatchPaymentModal(group)}
                                                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer active:scale-95"
                                                    >
                                                        <CreditCard size={13} />
                                                        <span>Record Payment</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="text-right">
                                                    <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-3.5 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                                                        <CheckCircle2 size={13} /> FULLY SETTLED ✓
                                                    </span>
                                                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                                                        {formatCurrency(group.totalCost)} paid
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Itemized Details (Consignment style dropdown) */}
                                    {isExpanded && (
                                        <div className="border-t border-stone-100 bg-stone-50/50">
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-stone-100/70 text-[10px] font-black uppercase tracking-wider text-stone-500 border-b border-stone-200">
                                                        <tr>
                                                            <th className="py-2.5 px-5">Product & Specs</th>
                                                            <th className="py-2.5 px-4 text-center">Dispatched Qty</th>
                                                            <th className="py-2.5 px-4 text-center">Branch Stock Status</th>
                                                            <th className="py-2.5 px-4">Transfer Cost / Unit</th>
                                                            <th className="py-2.5 px-4">Total Billed</th>
                                                            <th className="py-2.5 px-4">Paid / Balance</th>
                                                            <th className="py-2.5 px-4">Status</th>
                                                            <th className="py-2.5 px-5 text-right">Action</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-100 bg-white">
                                                        {group.items.map(item => {
                                                            const totalCost = parseFloat(item.totalCost || 0);
                                                            const amountPaid = parseFloat(item.amountPaid || 0);
                                                            const remaining = Math.max(0, totalCost - amountPaid);
                                                            const isItemPaid = amountPaid >= totalCost && totalCost > 0;

                                                            return (
                                                                <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                                                                    <td className="py-3 px-5">
                                                                        <div className="font-black text-stone-900 text-xs">
                                                                            {item.modelName}
                                                                        </div>
                                                                        <div className="text-[11px] text-stone-500 font-semibold">
                                                                            {item.brandName} • {item.category || 'General'}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[10px] font-mono text-stone-400 mt-0.5">
                                                                            <span>{item.sku}</span>
                                                                            {item.variant?.color && <span>• {item.variant.color}</span>}
                                                                            {item.variant?.thicknessMm && <span>• {item.variant.thicknessMm}mm</span>}
                                                                        </div>
                                                                    </td>

                                                                    <td className="py-3 px-4 text-center font-black text-stone-900 text-xs">
                                                                        {item.quantity} units
                                                                    </td>

                                                                    <td className="py-3 px-4 text-center text-xs">
                                                                        {item.soldQuantity != null ? (
                                                                            <div className="inline-flex flex-col items-center">
                                                                                <div className="flex items-center gap-1 text-[11px] font-bold">
                                                                                    <span className="text-emerald-700">{item.soldQuantity || 0} sold</span>
                                                                                    <span className="text-stone-300">•</span>
                                                                                    <span className="text-indigo-700">
                                                                                        {item.remainingQuantity != null ? item.remainingQuantity : item.quantity} in branch
                                                                                    </span>
                                                                                </div>
                                                                                {item.isAllSold && (
                                                                                    <span className="text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mt-0.5">
                                                                                        100% Sold Out
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-stone-400 text-[11px]">—</span>
                                                                        )}
                                                                    </td>

                                                                    <td className="py-3 px-4 font-semibold text-stone-700 text-xs">
                                                                        {formatCurrency(item.costPerUnit)}
                                                                    </td>

                                                                    <td className="py-3 px-4 font-black text-stone-900 text-xs">
                                                                        {formatCurrency(totalCost)}
                                                                    </td>

                                                                    <td className="py-3 px-4 text-xs">
                                                                        <div className="font-bold text-stone-800">
                                                                            {formatCurrency(amountPaid)}
                                                                        </div>
                                                                        {remaining > 0 && (
                                                                            <div className="text-[10px] text-amber-600 font-bold">
                                                                                Due: {formatCurrency(remaining)}
                                                                            </div>
                                                                        )}
                                                                    </td>

                                                                    <td className="py-3 px-4">
                                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                                            isItemPaid
                                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                                : item.status === 'PARTIAL'
                                                                                ? 'bg-amber-100 text-amber-800'
                                                                                : 'bg-stone-100 text-stone-700'
                                                                        }`}>
                                                                            {isItemPaid ? 'Settled' : item.status}
                                                                        </span>
                                                                    </td>

                                                                    <td className="py-3 px-5 text-right">
                                                                        {!isItemPaid ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openPaymentModal(item)}
                                                                                className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                                                                            >
                                                                                Pay Item
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-[11px] font-bold text-emerald-600">✓ Done</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

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
        <div className="space-y-6 max-w-7xl mx-auto min-w-0 pb-12">
            {/* Top Navigation & Branch Title */}
            <div className="flex flex-wrap items-center justify-between gap-3">
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

                <button
                    type="button"
                    onClick={() => setPasswordModalOpen(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-stone-50 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer border border-stone-200 shadow-sm"
                    title="Manage Cashier Price Override Password"
                >
                    <Key size={14} className="text-emerald-600" />
                    <span>Cashier Password</span>
                </button>
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
            <div className="flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3">
                {[
                    { id: 'overview', label: 'Overview', icon: Building2 },
                    { id: 'allocate', label: 'Allocate Stock', icon: PackagePlus, highlight: true },
                    { id: 'dues', label: `Dues & Payments (${allocations.length})`, icon: CreditCard },
                    { id: 'remittance', label: `Sold Items & Remittance (${remittableSalesData.items?.length || 0})`, icon: DollarSign },
                    { id: 'inventory', label: 'Inventory Tracker', icon: Boxes },
                    { id: 'analytics', label: 'Analytics & P&L', icon: TrendingUp },
                    { id: 'expenses', label: 'Branch Expenses', icon: Receipt },
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                        <div
                            onClick={() => handleTabChange('remittance')}
                            className="bg-white rounded-2xl p-6 border border-blue-200 hover:border-blue-400 shadow-sm transition-all cursor-pointer group"
                        >
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                                <DollarSign size={20} />
                            </div>
                            <h4 className="font-black text-stone-900 text-lg">Sold Items & Remittance</h4>
                            <p className="text-xs text-stone-500 mt-1">
                                See item-by-item breakdown of items bought, customer prices, remittable wholesale base to HQ, and profit margins.
                            </p>
                            <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-blue-700">
                                View Remittable Sales ({remittableSalesData.items?.length || 0}) <ArrowUpRight size={14} />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ALLOCATE STOCK (MULTI-PRODUCT SUPPORT) */}
            {activeTab === 'allocate' && (
                <div className="space-y-6">
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
                                                            {v.adminStock} in holding pool
                                                        </div>
                                                        {v.branchStock > 0 && (
                                                            <div className="text-[10px] text-indigo-600 font-bold">
                                                                +{v.branchStock} in branches
                                                            </div>
                                                        )}
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
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                                <div>
                                    <h4 className="font-black text-stone-900 text-sm">Allocation Manifest</h4>
                                    <p className="text-[11px] text-stone-400">Review & allocate products to {branch.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {/* View Toggle */}
                                    <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                                        <button
                                            type="button"
                                            onClick={() => setManifestViewMode('table')}
                                            className={`p-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                manifestViewMode === 'table'
                                                    ? 'bg-white text-stone-900 shadow-xs'
                                                    : 'text-stone-500 hover:text-stone-900'
                                            }`}
                                            title="Table Form (Review and edit prices easily)"
                                        >
                                            <Table size={13} />
                                            <span className="hidden sm:inline">Table</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setManifestViewMode('cards')}
                                            className={`p-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                                manifestViewMode === 'cards'
                                                    ? 'bg-white text-stone-900 shadow-xs'
                                                    : 'text-stone-500 hover:text-stone-900'
                                            }`}
                                            title="Cards Form"
                                        >
                                            <LayoutGrid size={13} />
                                            <span className="hidden sm:inline">Cards</span>
                                        </button>
                                    </div>

                                    {manifest.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setPriceReviewModalOpen(true)}
                                            className="px-2 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                                            title="Open full table to review and change all prices"
                                        >
                                            <Maximize2 size={11} />
                                            <span>Full Table</span>
                                        </button>
                                    )}

                                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-100">
                                        {manifest.length}
                                    </span>
                                </div>
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

                                    {/* Set All Cost / Pricing */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-stone-200/60 text-xs">
                                        <span className="text-[10px] font-bold text-stone-400">Apply unit cost:</span>
                                        <button
                                            type="button"
                                            onClick={() => applyBulkPricingToManifest('acquisition')}
                                            className="px-2 py-0.5 bg-white border border-stone-200 hover:border-stone-400 rounded-md text-[10px] font-bold text-stone-700 shadow-xs cursor-pointer"
                                            title="Set transfer cost to holding acquisition cost"
                                        >
                                            Base Cost
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyBulkPricingToManifest('markup15')}
                                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md text-[10px] font-bold text-emerald-800 shadow-xs cursor-pointer"
                                            title="Cost + 15%"
                                        >
                                            +15%
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => applyBulkPricingToManifest('markup25')}
                                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md text-[10px] font-bold text-emerald-800 shadow-xs cursor-pointer"
                                            title="Cost + 25%"
                                        >
                                            +25%
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Manifest Items: Table View vs. Card View */}
                            {manifest.length === 0 ? (
                                <div className="p-8 text-center text-stone-400 border border-dashed border-stone-200 rounded-xl">
                                    <PackagePlus size={24} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-bold text-stone-600">Manifest is empty</p>
                                    <p className="text-[11px] text-stone-400 mt-0.5">Select products from the master catalog to allocate at once</p>
                                </div>
                            ) : manifestViewMode === 'table' ? (
                                /* Table Form View */
                                <div className="border border-stone-200 rounded-xl overflow-hidden bg-white shadow-xs">
                                    <div className="overflow-x-auto max-h-[350px] custom-scrollbar">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-wider text-stone-500 border-b border-stone-200 sticky top-0 z-10">
                                                <tr>
                                                    <th className="py-2.5 px-3">Product / SKU</th>
                                                    <th className="py-2.5 px-2 text-center">Qty</th>
                                                    <th className="py-2.5 px-2">Cost/Unit (₱)</th>
                                                    <th className="py-2.5 px-2 text-right">Subtotal</th>
                                                    <th className="py-2.5 px-1.5 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100">
                                                {manifest.map(item => {
                                                    const lineTotal = (parseInt(item.quantity, 10) || 0) * (parseFloat(item.costPerUnit) || 0);
                                                    return (
                                                        <tr key={item.variantId} className="hover:bg-stone-50/70 transition-colors">
                                                            <td className="py-2 px-3 align-top">
                                                                <div className="font-black text-stone-900 text-xs truncate max-w-[150px]" title={item.modelName}>
                                                                    {item.modelName}
                                                                </div>
                                                                <div className="text-[10px] font-mono text-stone-400 truncate max-w-[150px]">
                                                                    {item.sku}
                                                                </div>
                                                                {(item.color || item.thicknessMm) && (
                                                                    <div className="text-[9px] text-stone-400">
                                                                        {item.color} {item.thicknessMm ? `• ${item.thicknessMm}mm` : ''}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="py-2 px-2 text-center align-top">
                                                                <input
                                                                    type="number"
                                                                    min="1"
                                                                    max={item.maxStock}
                                                                    value={item.quantity}
                                                                    onChange={(e) => updateManifestItem(item.variantId, 'quantity', e.target.value)}
                                                                    className="w-13 px-1 py-1 text-xs text-center font-black rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                                                                />
                                                                <div className="text-[9px] text-stone-400 mt-0.5">max {item.maxStock}</div>
                                                            </td>

                                                            <td className="py-2 px-2 align-top">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={item.costPerUnit}
                                                                    onChange={(e) => updateManifestItem(item.variantId, 'costPerUnit', e.target.value)}
                                                                    className="w-24 px-2 py-1 text-xs font-black rounded-lg border border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                                                                    title="Transfer cost charged to branch (Admin Due)"
                                                                />
                                                                {item.acquisitionPrice > 0 && (
                                                                    <div className="text-[9px] text-stone-400 mt-0.5" title="Acquisition Cost">
                                                                        cost: {formatCurrency(item.acquisitionPrice)}
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="py-2 px-2 text-right align-top font-black text-stone-900 text-xs whitespace-nowrap">
                                                                {formatCurrency(lineTotal)}
                                                            </td>

                                                            <td className="py-2 px-1.5 text-center align-top">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeFromManifest(item.variantId)}
                                                                    className="text-stone-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                                                    title="Remove item"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                /* Cards View */
                                <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
                                    {manifest.map(item => (
                                        <div key={item.variantId} className="p-3 rounded-xl border border-stone-200 bg-stone-50/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-black text-stone-900 text-xs">{item.modelName}</div>
                                                    <div className="text-[10px] font-mono text-stone-500">{item.sku}</div>
                                                </div>
                                                <button
                                                    onClick={() => removeFromManifest(item.variantId)}
                                                    className="text-stone-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
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
                                                        className="w-full px-2 py-1 text-xs font-black rounded-lg border border-stone-300 bg-white"
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
                                                        className="w-full px-2 py-1 text-xs font-black rounded-lg border border-emerald-300 bg-white text-emerald-800"
                                                    />
                                                </div>
                                            </div>

                                            <div className="text-right text-[11px] font-bold text-stone-600">
                                                Subtotal: {formatCurrency((parseInt(item.quantity, 10) || 0) * (parseFloat(item.costPerUnit) || 0))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

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
                            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                                <div className="flex justify-between text-stone-500 font-semibold">
                                    <span>Total Items in Manifest:</span>
                                    <span className="font-black text-stone-900">{manifest.length} products</span>
                                </div>
                                <div className="flex justify-between text-stone-500 font-semibold">
                                    <span>Total Units to Dispatch:</span>
                                    <span className="font-black text-stone-900">{manifestTotalUnits} units</span>
                                </div>
                                <div className="flex justify-between text-stone-500 font-semibold pt-1 border-t border-stone-200">
                                    <span>Total Transfer Cost (Dues):</span>
                                    <span className="font-black text-emerald-700 text-sm">{formatCurrency(manifestTotalCost)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPriceReviewModalOpen(true)}
                                    disabled={manifest.length === 0}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                                        manifest.length === 0
                                            ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-not-allowed'
                                            : 'bg-white text-stone-800 hover:bg-stone-50 border-stone-300 shadow-2xs hover:border-stone-400'
                                    }`}
                                >
                                    <Table size={14} className="text-emerald-600" />
                                    <span>Review Manifest Table</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPriceReviewModalOpen(true)}
                                    disabled={manifest.length === 0 || allocating}
                                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center justify-center gap-2 ${
                                        manifest.length === 0
                                            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                >
                                    <PackagePlus size={15} />
                                    <span>Confirm Transfer</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Consignment-Style Batch Accordion History in Allocate Area */}
                <div className="pt-2">
                    {renderAllocationBatchHistory(
                        "Stock Allocation & Dispatch History",
                        "Batch records of dispatched inventory with live branch sales tracking and remittance history"
                    )}
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

                    {/* Consignment-Style Batch Accordion Records in Dues Tab */}
                    {renderAllocationBatchHistory(
                        "Stock Allocation & Payment Records",
                        "Grouped by batch with itemized drop-down details and remittance actions"
                    )}
                </div>
            )}

            {/* TAB: SOLD ITEMS & REMITTANCE BREAKDOWN */}
            {activeTab === 'remittance' && (
                <div className="space-y-6">
                    {/* Summary KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">Sold Units</span>
                                <ShoppingBag size={16} className="text-stone-400" />
                            </div>
                            <div className="text-2xl font-black text-stone-900 mt-1">
                                {filteredRemittanceSummary.totalItems}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Items bought at this branch</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">Gross Sales Collected</span>
                                <DollarSign size={16} className="text-stone-400" />
                            </div>
                            <div className="text-2xl font-black text-stone-900 mt-1">
                                {formatCurrency(filteredRemittanceSummary.totalGross)}
                            </div>
                            <span className="text-xs text-stone-500 font-medium">Customer retail payments</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-amber-200 bg-amber-50/20 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 block">Remittable to Admin</span>
                                <CreditCard size={16} className="text-amber-600" />
                            </div>
                            <div className="text-2xl font-black text-amber-600 mt-1">
                                {formatCurrency(filteredRemittanceSummary.totalRemittable)}
                            </div>
                            <span className="text-xs text-amber-700/80 font-medium">Wholesale base capital due to HQ</span>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-emerald-200 bg-emerald-50/20 shadow-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 block">Branch Retained Profit</span>
                                <TrendingUp size={16} className="text-emerald-600" />
                            </div>
                            <div className="text-2xl font-black text-emerald-600 mt-1">
                                {formatCurrency(filteredRemittanceSummary.totalProfit)}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                    +{filteredRemittanceSummary.margin.toFixed(1)}% margin
                                </span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
                            <span className="text-[11px] font-black uppercase tracking-wider text-stone-400 block">Remittance Status</span>
                            <div className="mt-2 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-stone-500 flex items-center gap-1">
                                        <CheckCircle2 size={12} className="text-emerald-600" /> Remitted:
                                    </span>
                                    <span className="font-bold text-emerald-600">
                                        {formatCurrency(filteredRemittanceSummary.totalRemitted)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-100">
                                    <span className="text-stone-500 flex items-center gap-1">
                                        <Clock size={12} className="text-amber-500" /> Pending:
                                    </span>
                                    <span className="font-black text-amber-600">
                                        {formatCurrency(filteredRemittanceSummary.totalPending)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Filter, Search & Controls Bar */}
                    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            {/* Search bar */}
                            <div className="relative flex-1 min-w-[280px]">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    value={remittanceSearch}
                                    onChange={(e) => setRemittanceSearch(e.target.value)}
                                    placeholder="Search by product, model, SKU, customer, ticket ID, remarks..."
                                    className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:border-stone-400 placeholder:text-stone-400"
                                />
                                {remittanceSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setRemittanceSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {/* Date Presets */}
                            <div className="flex flex-wrap items-center gap-1.5 bg-stone-100/80 p-1 rounded-xl">
                                {[
                                    { id: 'all', label: 'All Time' },
                                    { id: 'today', label: 'Today' },
                                    { id: 'this_week', label: 'This Week' },
                                    { id: 'this_month', label: 'This Month' },
                                    { id: 'custom', label: 'Custom' },
                                ].map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setRemittanceDatePreset(p.id);
                                            if (p.id !== 'custom') {
                                                fetchRemittableSales(p.id);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            remittanceDatePreset === p.id
                                                ? 'bg-white text-stone-900 shadow-xs'
                                                : 'text-stone-600 hover:text-stone-900'
                                        }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>

                            {/* Actions: Refresh & CSV Export */}
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => fetchRemittableSales(remittanceDatePreset, remittanceCustomFrom, remittanceCustomTo)}
                                    disabled={loadingRemittableSales}
                                    title="Reload remittance data"
                                    className="p-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
                                >
                                    <RefreshCw size={15} className={loadingRemittableSales ? 'animate-spin' : ''} />
                                </button>

                                <button
                                    type="button"
                                    onClick={exportRemittanceCsv}
                                    disabled={!filteredRemittableItems.length}
                                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-bold text-stone-700 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                                >
                                    <Download size={14} />
                                    <span>Export CSV</span>
                                </button>
                            </div>
                        </div>

                        {/* Custom Date Range Row (if 'custom' selected) */}
                        {remittanceDatePreset === 'custom' && (
                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-stone-100 text-xs">
                                <span className="font-bold text-stone-500">Custom Date Range:</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={remittanceCustomFrom}
                                        onChange={(e) => setRemittanceCustomFrom(e.target.value)}
                                        className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-stone-50"
                                    />
                                    <span className="text-stone-400">to</span>
                                    <input
                                        type="date"
                                        value={remittanceCustomTo}
                                        onChange={(e) => setRemittanceCustomTo(e.target.value)}
                                        className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-stone-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fetchRemittableSales('custom', remittanceCustomFrom, remittanceCustomTo)}
                                        disabled={!remittanceCustomFrom || !remittanceCustomTo || loadingRemittableSales}
                                        className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer"
                                    >
                                        Apply Range
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Filter Tabs */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-stone-100">
                            {[
                                { id: 'ALL', label: 'All Items', count: remittableSalesData.items?.length || 0 },
                                { id: 'PENDING', label: 'Pending Remittance', count: remittableSalesData.items?.filter(i => i.remittanceStatus === 'PENDING').length || 0, badgeClass: 'bg-amber-100 text-amber-800' },
                                { id: 'REMITTED', label: 'Fully Remitted', count: remittableSalesData.items?.filter(i => i.remittanceStatus === 'REMITTED').length || 0, badgeClass: 'bg-emerald-100 text-emerald-800' },
                                { id: 'PARTIAL', label: 'Partially Remitted', count: remittableSalesData.items?.filter(i => i.remittanceStatus === 'PARTIAL').length || 0, badgeClass: 'bg-blue-100 text-blue-800' },
                            ].map(filter => (
                                <button
                                    key={filter.id}
                                    type="button"
                                    onClick={() => setRemittanceStatusFilter(filter.id)}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        remittanceStatusFilter === filter.id
                                            ? 'bg-stone-900 text-white shadow-2xs'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                    }`}
                                >
                                    <span>{filter.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        remittanceStatusFilter === filter.id
                                            ? 'bg-white/20 text-white'
                                            : filter.badgeClass || 'bg-stone-200 text-stone-700'
                                    }`}>
                                        {filter.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sold Items & Remittance Table */}
                    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 bg-stone-50/70">
                            <div>
                                <h4 className="font-black text-stone-900 text-base">Itemized Sold Products & Remittable Dues</h4>
                                <p className="text-xs text-stone-500 mt-0.5">
                                    Shows every paddle & item bought by customers, customer selling price, remittable wholesale base owed to Admin HQ, and branch profit.
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold bg-stone-200/70 text-stone-700">
                                Showing {filteredRemittableItems.length} of {remittableSalesData.items?.length || 0} sold items
                            </span>
                        </div>

                        {loadingRemittableSales ? (
                            <div className="p-16 text-center text-stone-400 space-y-3">
                                <Loader2 size={32} className="mx-auto animate-spin text-stone-400" />
                                <p className="text-xs font-bold text-stone-600">Loading branch remittance data...</p>
                            </div>
                        ) : filteredRemittableItems.length === 0 ? (
                            <div className="p-16 text-center text-stone-400 space-y-2">
                                <ShoppingBag size={36} className="mx-auto opacity-30 text-stone-400" />
                                <p className="text-sm font-black text-stone-700">No sold items found</p>
                                <p className="text-xs text-stone-400">
                                    {remittanceSearch || remittanceStatusFilter !== 'ALL'
                                        ? 'No records match your active search or filters.'
                                        : 'No completed or recorded retail purchases for this branch yet.'}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-stone-50 border-b border-stone-200 text-[11px] font-black uppercase tracking-wider text-stone-400">
                                        <tr>
                                            <th className="py-3.5 px-5">Date & Order Ticket</th>
                                            <th className="py-3.5 px-4">Item Bought & Specs</th>
                                            <th className="py-3.5 px-4 text-right">Customer Price</th>
                                            <th className="py-3.5 px-4 text-right">Remittable to HQ</th>
                                            <th className="py-3.5 px-4 text-right">Branch Profit</th>
                                            <th className="py-3.5 px-4 text-center">Remittance Status</th>
                                            <th className="py-3.5 px-4 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {filteredRemittableItems.map(item => {
                                            const v = item.variant || {};
                                            const isRemitted = item.remittanceStatus === 'REMITTED';
                                            const isPartial = item.remittanceStatus === 'PARTIAL';
                                            const isPending = item.remittanceStatus === 'PENDING';

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-stone-50/80 transition-colors group"
                                                >
                                                    {/* Date & Order Ticket */}
                                                    <td className="py-3.5 px-5 align-top">
                                                        <div className="font-mono font-bold text-stone-900 flex items-center gap-1.5">
                                                            <span>#{item.orderTicketId || `ID-${item.id}`}</span>
                                                        </div>
                                                        <div className="text-[11px] text-stone-400 mt-0.5">
                                                            {item.transactionDate
                                                                ? new Date(item.transactionDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                                                                : 'N/A'} • {item.transactionDate ? new Date(item.transactionDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </div>
                                                        <div className="text-[11px] font-medium text-stone-600 mt-1">
                                                            👤 {item.customerName || 'Walk-in Customer'}
                                                        </div>
                                                        {item.notes && (
                                                            <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-[10px] text-stone-600 font-medium max-w-[220px] truncate" title={item.notes}>
                                                                <FileText size={10} className="shrink-0 text-stone-400" />
                                                                <span className="truncate">Note: {item.notes}</span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Item Bought & Specs */}
                                                    <td className="py-3.5 px-4 align-top">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-stone-900 text-sm">
                                                                {v.brandName ? `${v.brandName} ` : ''}{v.modelName || 'Unnamed Product'}
                                                            </span>
                                                            {v.category && (
                                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-600">
                                                                    {v.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-stone-500">
                                                            {v.sku && (
                                                                <span className="font-mono font-bold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                                                                    {v.sku}
                                                                </span>
                                                            )}
                                                            {v.color && <span>• {v.color}</span>}
                                                            {v.thicknessMm && <span>• {v.thicknessMm}mm</span>}
                                                            {v.shape && <span>• {v.shape}</span>}
                                                        </div>
                                                    </td>

                                                    {/* Customer Selling Price */}
                                                    <td className="py-3.5 px-4 text-right align-top">
                                                        <div className="font-black text-stone-900 text-sm">
                                                            {formatCurrency(item.finalPrice)}
                                                        </div>
                                                        <div className="flex items-center justify-end gap-1.5 mt-1">
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600">
                                                                {item.paymentMethod || 'Cash'}
                                                            </span>
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                                item.status === 'FULL'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {item.status || 'FULL'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Remittable to Admin HQ (Wholesale Cost) */}
                                                    <td className="py-3.5 px-4 text-right align-top">
                                                        <div className="font-black text-amber-700 text-sm font-mono">
                                                            {formatCurrency(item.remittableCost)}
                                                        </div>
                                                        <div className="text-[11px] text-stone-400 mt-0.5">
                                                            Wholesale Cost Base
                                                        </div>
                                                        {item.adminBatchId && (
                                                            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
                                                                Batch #{item.adminBatchId.slice(-6).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Branch Retained Profit */}
                                                    <td className="py-3.5 px-4 text-right align-top">
                                                        <div className="font-black text-emerald-600 text-sm">
                                                            +{formatCurrency(item.branchProfit)}
                                                        </div>
                                                        <div className="mt-1">
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                +{item.profitMarginPct ? item.profitMarginPct.toFixed(1) : '0.0'}% margin
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Remittance Status Badge */}
                                                    <td className="py-3.5 px-4 text-center align-top">
                                                        {isRemitted && (
                                                            <div>
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800">
                                                                    <CheckCircle2 size={12} /> Remitted to HQ
                                                                </span>
                                                                <div className="text-[10px] text-stone-400 mt-1">
                                                                    Paid {formatCurrency(item.remittedAmount)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {isPending && (
                                                            <div>
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800">
                                                                    <Clock size={12} /> Pending Remittance
                                                                </span>
                                                                <div className="text-[10px] font-bold text-amber-700 mt-1">
                                                                    {formatCurrency(item.pendingRemittance)} owed
                                                                </div>
                                                            </div>
                                                        )}
                                                        {isPartial && (
                                                            <div>
                                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800">
                                                                    <CreditCard size={12} /> Partially Remitted
                                                                </span>
                                                                <div className="text-[10px] text-stone-500 mt-1">
                                                                    {formatCurrency(item.remittedAmount)} / {formatCurrency(item.remittableCost)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Action: Inspect Details */}
                                                    <td className="py-3.5 px-4 text-center align-top">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedSoldItemModal(item)}
                                                            className="px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto"
                                                            title="Inspect item remittance breakdown"
                                                        >
                                                            <Eye size={13} />
                                                            <span>Details</span>
                                                        </button>
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

            {/* TAB 4: INVENTORY TRACKER & MASTER CATALOG GAP */}
            {activeTab === 'inventory' && (
                <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden space-y-0">
                    {/* Header */}
                    <div className="p-5 border-b border-stone-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-stone-50/50">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h4 className="font-black text-stone-900 text-sm sm:text-base">Branch Inventory Tracker</h4>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-stone-100 text-stone-700 border border-stone-200">
                                    {branchCatalogAnalysis.totalUnitsInBranch} Total Stocked Units
                                </span>
                            </div>
                            <p className="text-xs text-stone-400 mt-1">
                                Live stock currently held at <strong className="text-stone-700 font-bold">{branch.name}</strong> vs. master catalog products available to add.
                            </p>
                        </div>

                        {/* Sub-Tab Navigation Pills */}
                        <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-2xl shrink-0 self-start lg:self-auto">
                            <button
                                type="button"
                                onClick={() => setInvSubTab('in_stock')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    invSubTab === 'in_stock'
                                        ? 'bg-white text-stone-900 shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${invSubTab === 'in_stock' ? 'bg-emerald-500' : 'bg-emerald-400/50'}`} />
                                Carried In-Stock
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    invSubTab === 'in_stock' ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200 text-stone-600'
                                }`}>
                                    {branchCatalogAnalysis.inStockCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setInvSubTab('missing')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    invSubTab === 'missing'
                                        ? 'bg-white text-stone-900 shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${invSubTab === 'missing' ? 'bg-rose-500' : 'bg-rose-400/50'}`} />
                                Missing / Products to Add
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    invSubTab === 'missing' ? 'bg-rose-50 text-rose-700' : 'bg-stone-200 text-stone-600'
                                }`}>
                                    {branchCatalogAnalysis.missingCount}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setInvSubTab('all')}
                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                                    invSubTab === 'all'
                                        ? 'bg-white text-stone-900 shadow-sm'
                                        : 'text-stone-600 hover:text-stone-900'
                                }`}
                            >
                                All Master Catalog
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    invSubTab === 'all' ? 'bg-indigo-50 text-indigo-700' : 'bg-stone-200 text-stone-600'
                                }`}>
                                    {branchCatalogAnalysis.totalCatalogCount}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Filter & Action Bar */}
                    <div className="p-4 border-b border-stone-100 flex flex-wrap items-center justify-between gap-3 bg-white">
                        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                            {/* Search */}
                            <div className="relative flex-1 min-w-[220px] max-w-md">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder={invSubTab === 'missing' ? "Search products branch doesn't have (e.g. Wika Fire)..." : "Search brand, model, SKU, color..."}
                                    value={invSearch}
                                    onChange={(e) => setInvSearch(e.target.value)}
                                    className="w-full pl-9 pr-7 py-2 text-xs font-semibold rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-stone-50/50 focus:bg-white transition-all"
                                />
                                {invSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setInvSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Category Filter */}
                            <select
                                value={invCategory}
                                onChange={(e) => setInvCategory(e.target.value)}
                                className="px-3 py-2 text-xs font-bold rounded-xl border border-stone-200 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                                {invCategories.map(cat => (
                                    <option key={cat} value={cat}>{cat} {cat === 'All' ? 'Categories' : ''}</option>
                                ))}
                            </select>

                            {/* HQ Stock Only Toggle for Missing or All */}
                            {invSubTab !== 'in_stock' && (
                                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-stone-200 bg-stone-50/60 text-xs font-bold text-stone-700 cursor-pointer hover:bg-stone-100 transition-colors select-none">
                                    <input
                                        type="checkbox"
                                        checked={invOnlyHqAvailable}
                                        onChange={(e) => setInvOnlyHqAvailable(e.target.checked)}
                                        className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer"
                                    />
                                    <span>Only with Admin HQ Stock ({branchCatalogAnalysis.hqAvailableMissingCount})</span>
                                </label>
                            )}
                        </div>

                        {/* Bulk Allocate for Missing Tab */}
                        {invSubTab === 'missing' && selectedMissingVariantIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleBulkAllocateMissing}
                                className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
                            >
                                <PackagePlus size={14} />
                                Allocate Selected ({selectedMissingVariantIds.size}) to Branch
                            </button>
                        )}
                    </div>

                    {/* Table View */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-stone-50 text-[11px] font-black uppercase tracking-wider text-stone-400 border-b border-stone-100">
                                <tr>
                                    {invSubTab === 'missing' && (
                                        <th className="py-3.5 pl-6 pr-2 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    filteredInventoryItems.filter(it => it.adminStock > 0).length > 0 &&
                                                    filteredInventoryItems.filter(it => it.adminStock > 0).every(it => selectedMissingVariantIds.has(it.variantId))
                                                }
                                                onChange={toggleSelectAllMissing}
                                                title="Select all with HQ stock"
                                                className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                                            />
                                        </th>
                                    )}
                                    <th className={`py-3.5 px-6 ${invSubTab === 'missing' ? 'pl-2' : ''}`}>Product & Model</th>
                                    <th className="py-3.5 px-4">SKU / Specs</th>
                                    <th className="py-3.5 px-4">
                                        {invSubTab === 'missing' ? 'Branch Status' : 'In Stock Units'}
                                    </th>
                                    {invSubTab !== 'in_stock' && (
                                        <th className="py-3.5 px-4">Available in Admin HQ</th>
                                    )}
                                    <th className="py-3.5 px-4">Default Admin Price</th>
                                    <th className="py-3.5 px-6">
                                        {invSubTab === 'missing' ? 'Quick Action' : 'Branch Selling Price'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {filteredInventoryItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={invSubTab === 'missing' ? 7 : (invSubTab === 'all' ? 6 : 5)} className="py-12 text-center">
                                            <div className="max-w-xs mx-auto space-y-2">
                                                <div className="w-10 h-10 rounded-2xl bg-stone-100 text-stone-400 mx-auto flex items-center justify-center font-black">
                                                    <Boxes size={20} />
                                                </div>
                                                <p className="font-bold text-stone-700 text-sm">
                                                    {invSubTab === 'missing'
                                                        ? 'No missing products found'
                                                        : invSubTab === 'in_stock'
                                                        ? 'No stocked items found'
                                                        : 'No products match your filter'}
                                                </p>
                                                <p className="text-xs text-stone-400">
                                                    {invSubTab === 'missing'
                                                        ? `${branch.name} already carries all products matching your filters.`
                                                        : 'Try adjusting your search query or category filter.'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInventoryItems.map(item => {
                                        const isMissingTab = invSubTab === 'missing';
                                        const isOutOfStock = item.status === 'OUT_OF_STOCK';
                                        const isNotCarried = item.status === 'NOT_CARRIED';
                                        const isSelected = selectedMissingVariantIds.has(item.variantId);

                                        return (
                                            <tr
                                                key={item.variantId}
                                                className={`transition-colors ${
                                                    isSelected ? 'bg-emerald-50/40' : 'hover:bg-stone-50/70'
                                                }`}
                                            >
                                                {/* Checkbox for missing tab */}
                                                {isMissingTab && (
                                                    <td className="py-3.5 pl-6 pr-2 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            disabled={item.adminStock <= 0}
                                                            onChange={() => toggleSelectMissingVariant(item.variantId)}
                                                            className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                                        />
                                                    </td>
                                                )}

                                                {/* Product & Model */}
                                                <td className={`py-3.5 px-6 ${isMissingTab ? 'pl-2' : ''}`}>
                                                    <div className="font-black text-stone-900 text-xs flex items-center gap-2">
                                                        <span>{item.modelName}</span>
                                                        {isNotCarried && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                                                                Not in Branch
                                                            </span>
                                                        )}
                                                        {isOutOfStock && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                                                                0 Stock
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-stone-400 font-semibold">
                                                        {item.brandName} • {item.category}
                                                    </div>
                                                </td>

                                                {/* SKU / Specs */}
                                                <td className="py-3.5 px-4">
                                                    <span className="font-mono text-xs font-semibold text-stone-600">{item.sku}</span>
                                                    <div className="text-[11px] text-stone-400">
                                                        {item.color || ''} {item.thicknessMm ? `• ${item.thicknessMm}mm` : ''} {item.shape ? `• ${item.shape}` : ''}
                                                    </div>
                                                </td>

                                                {/* Branch Stock Units / Status */}
                                                <td className="py-3.5 px-4">
                                                    {isMissingTab ? (
                                                        isNotCarried ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                                <XCircle size={12} />
                                                                Never Carried
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                                                <AlertCircle size={12} />
                                                                0 units (Out)
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                                                            item.branchStock > 5
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : item.branchStock > 0
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-rose-50 text-rose-700'
                                                        }`}>
                                                            <Boxes size={12} />
                                                            {item.branchStock} units
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Admin HQ Available (Missing & All tabs) */}
                                                {invSubTab !== 'in_stock' && (
                                                    <td className="py-3.5 px-4">
                                                        {item.adminStock > 0 ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                                                <Boxes size={12} />
                                                                {item.adminStock} units in HQ
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-400">
                                                                0 at HQ
                                                            </span>
                                                        )}
                                                    </td>
                                                )}

                                                {/* Default Admin Price */}
                                                <td className="py-3.5 px-4 font-semibold text-stone-500 text-xs">
                                                    {formatCurrency(item.defaultSellingPrice)}
                                                </td>

                                                {/* Action Column: Quick Allocate if missing, or Branch Selling Price if in_stock/all */}
                                                <td className="py-3.5 px-6 font-black text-stone-900 text-xs">
                                                    {isMissingTab ? (
                                                        item.adminStock > 0 ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickAllocateFromInventory(item)}
                                                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                                                                title="Add to allocation manifest and dispatch"
                                                            >
                                                                <PackagePlus size={13} />
                                                                + Allocate to Branch
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs text-stone-400 font-semibold italic">
                                                                No HQ Stock
                                                            </span>
                                                        )
                                                    ) : (
                                                        /* Inline Price Editor for In-Stock & All */
                                                        editingPriceVariantId === item.variantId ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-stone-400 text-xs">₱</span>
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={editingPriceValue}
                                                                    onChange={(e) => setEditingPriceValue(e.target.value)}
                                                                    className="w-24 px-2 py-1 text-xs font-black rounded-lg border border-indigo-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSaveInlineBranchPrice(item.variantId)}
                                                                    disabled={savingInlinePrice}
                                                                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer"
                                                                    title="Save Price"
                                                                >
                                                                    {savingInlinePrice ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEditingPriceVariantId(null)}
                                                                    className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all cursor-pointer"
                                                                    title="Cancel"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-between group/price gap-2">
                                                                {item.hasCustomPrice ? (
                                                                    <div className="flex items-center gap-1.5 text-emerald-700">
                                                                        <span>{formatCurrency(item.branchSellingPrice)}</span>
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] uppercase bg-emerald-100 font-black">
                                                                            Custom
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-stone-700">{formatCurrency(item.defaultSellingPrice)}</span>
                                                                )}
                                                                <div className="flex items-center gap-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => startEditingBranchPrice(item.variantId, item.hasCustomPrice ? item.branchSellingPrice : item.defaultSellingPrice)}
                                                                        className="opacity-0 group-hover/price:opacity-100 p-1 rounded-md text-stone-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer"
                                                                        title="Edit Branch Selling Price"
                                                                    >
                                                                        <Pencil size={12} />
                                                                    </button>
                                                                    {/* If in All tab and item has HQ stock, show quick allocate too */}
                                                                    {invSubTab === 'all' && item.adminStock > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleQuickAllocateFromInventory(item)}
                                                                            className="opacity-0 group-hover/price:opacity-100 p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer"
                                                                            title="Allocate this item to branch"
                                                                        >
                                                                            <PackagePlus size={13} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 5: BRANCH ANALYTICS & P&L */}
            {activeTab === 'analytics' && (
                <div className="space-y-6 animate-fadeIn">
                    <BranchAnalytics branchId={branch.id} branchName={branch.name} />
                </div>
            )}

            {/* TAB 6: BRANCH EXPENSES */}
            {activeTab === 'expenses' && (
                <div className="space-y-6 animate-fadeIn">
                    <Expenses initialBranchId={branch.id} branchName={branch.name} />
                </div>
            )}

            {/* COMPREHENSIVE ALLOCATION REVIEW TABLE MODAL */}
            {(priceReviewModalOpen || confirmModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-7 shadow-2xl border border-stone-200 space-y-5 my-8 max-h-[92vh] flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-stone-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                                    <Table size={20} />
                                </div>
                                <div>
                                    <h3 className="font-black text-lg text-stone-900 flex items-center gap-2">
                                        Review Transfer Manifest
                                        <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-100">
                                            {manifest.length} {manifest.length === 1 ? 'item' : 'items'}
                                        </span>
                                    </h3>
                                    <p className="text-xs text-stone-400 mt-0.5">
                                        Review dispatch quantities and transfer costs before allocating to <strong className="text-stone-700">{branch.name}</strong>.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setPriceReviewModalOpen(false);
                                    setConfirmModalOpen(false);
                                }}
                                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Batch Controls Toolbar inside Modal */}
                        <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider">Transfer Cost:</span>
                                <button
                                    type="button"
                                    onClick={() => applyBulkPricingToManifest('acquisition')}
                                    className="px-2.5 py-1 bg-white border border-stone-200 hover:border-stone-400 rounded-lg text-xs font-bold text-stone-700 shadow-2xs transition-all cursor-pointer"
                                    title="Set transfer cost to holding acquisition cost"
                                >
                                    Acquisition Cost
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyBulkPricingToManifest('markup15')}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 shadow-2xs transition-all cursor-pointer"
                                    title="Cost + 15%"
                                >
                                    Cost + 15%
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyBulkPricingToManifest('markup25')}
                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 shadow-2xs transition-all cursor-pointer"
                                    title="Cost + 25%"
                                >
                                    Cost + 25%
                                </button>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider">Set Qty:</span>
                                {[1, 2, 5, 10].map(q => (
                                    <button
                                        key={q}
                                        type="button"
                                        onClick={() => applyBulkQtyToManifest(q)}
                                        className="px-2 py-0.5 bg-white border border-stone-200 hover:border-stone-400 rounded-md text-xs font-black text-stone-700 shadow-2xs cursor-pointer"
                                    >
                                        {q}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => applyBulkQtyToManifest('max')}
                                    className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-md text-xs font-black text-emerald-800 shadow-2xs cursor-pointer"
                                >
                                    Max
                                </button>
                            </div>
                        </div>

                        {/* Interactive Table */}
                        <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-xs flex-1 min-h-[220px] overflow-auto custom-scrollbar">
                            <table className="w-full min-w-[750px] text-left text-xs">
                                <thead className="bg-stone-50 text-[10px] font-black uppercase tracking-wider text-stone-500 border-b border-stone-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="py-3 px-3 w-8 text-center">#</th>
                                        <th className="py-3 px-4">Product & Model</th>
                                        <th className="py-3 px-3">Specs / SKU</th>
                                        <th className="py-3 px-3 text-center">Holding Stock</th>
                                        <th className="py-3 px-3 text-center">Transfer Qty</th>
                                        <th className="py-3 px-3 text-right">Acquisition Cost</th>
                                        <th className="py-3 px-4">Cost Charged to Branch (₱)</th>
                                        <th className="py-3 px-4 text-right">Subtotal Due</th>
                                        <th className="py-3 px-3 text-center"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {manifest.map((item, idx) => {
                                        const qty = parseInt(item.quantity, 10) || 0;
                                        const cost = parseFloat(item.costPerUnit) || 0;
                                        const lineTotal = qty * cost;

                                        return (
                                            <tr key={item.variantId} className="hover:bg-stone-50/70 transition-colors">
                                                <td className="py-3 px-3 text-center font-bold text-stone-400">
                                                    {idx + 1}
                                                </td>

                                                <td className="py-3 px-4">
                                                    <div className="font-black text-stone-900 text-xs">{item.modelName}</div>
                                                    <div className="text-[11px] text-stone-400 font-semibold">{item.brandName} • {item.category}</div>
                                                </td>

                                                <td className="py-3 px-3">
                                                    <div className="font-mono text-stone-600 font-semibold">{item.sku}</div>
                                                    {(item.color || item.thicknessMm) && (
                                                        <div className="text-[10px] text-stone-400">
                                                            {item.color} {item.thicknessMm ? `• ${item.thicknessMm}mm` : ''}
                                                        </div>
                                                    )}
                                                </td>

                                                <td className="py-3 px-3 text-center font-black text-stone-700">
                                                    <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px]">
                                                        {item.maxStock} avail
                                                    </span>
                                                </td>

                                                <td className="py-3 px-3 text-center">
                                                    <div className="inline-flex items-center gap-1">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max={item.maxStock}
                                                            value={item.quantity}
                                                            onChange={(e) => updateManifestItem(item.variantId, 'quantity', e.target.value)}
                                                            className="w-16 px-2 py-1.5 text-xs text-center font-black rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                                                        />
                                                    </div>
                                                </td>

                                                <td className="py-3 px-3 text-right font-semibold text-stone-400">
                                                    {formatCurrency(item.acquisitionPrice)}
                                                </td>

                                                <td className="py-3 px-4">
                                                    <div className="relative">
                                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-700 text-xs font-bold">₱</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.costPerUnit}
                                                            onChange={(e) => updateManifestItem(item.variantId, 'costPerUnit', e.target.value)}
                                                            className="w-32 pl-6 pr-2 py-1.5 text-xs font-black rounded-xl border border-emerald-300 bg-emerald-50/30 text-emerald-900 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                                                            title="Transfer Price charged to branch (Admin Due)"
                                                        />
                                                    </div>
                                                </td>

                                                <td className="py-3 px-4 text-right font-black text-stone-900 text-xs whitespace-nowrap">
                                                    {formatCurrency(lineTotal)}
                                                </td>

                                                <td className="py-3 px-3 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFromManifest(item.variantId)}
                                                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Financial Totals Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 shrink-0 text-xs">
                            <div>
                                <span className="text-[10px] font-black uppercase text-stone-400 block">Total Items in Manifest</span>
                                <div className="text-lg font-black text-stone-900 mt-0.5">{manifest.length} products</div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-stone-400 block">Total Units to Dispatch</span>
                                <div className="text-lg font-black text-stone-900 mt-0.5">{manifestTotalUnits} units</div>
                            </div>
                            <div>
                                <span className="text-[10px] font-black uppercase text-emerald-700 block">Total Dues to Admin</span>
                                <div className="text-lg font-black text-emerald-700 mt-0.5">{formatCurrency(manifestTotalCost)}</div>
                            </div>
                        </div>

                        {/* Settlement Terms */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 shrink-0">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-black text-stone-800 flex items-center gap-1.5">
                                        <Calendar size={13} className="text-stone-500" />
                                        Payment Settlement Deadline *
                                    </label>
                                    <div className="flex items-center gap-1">
                                        {[
                                            { label: '+7d', days: 7 },
                                            { label: '+14d', days: 14 },
                                            { label: '+30d', days: 30 }
                                        ].map(preset => (
                                            <button
                                                key={preset.label}
                                                type="button"
                                                onClick={() => setDeadlinePreset(preset.days)}
                                                className="px-2 py-0.5 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] font-black transition-all cursor-pointer"
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={setDeadlineEndOfMonth}
                                            className="px-2 py-0.5 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-black transition-all cursor-pointer"
                                        >
                                            End of Month
                                        </button>
                                    </div>
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
                                    placeholder="e.g. Restock batch shipment..."
                                    value={allocationNotes}
                                    onChange={(e) => setAllocationNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-stone-300 bg-stone-50 focus:bg-white focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-between pt-3 border-t border-stone-100 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setPriceReviewModalOpen(false);
                                    setConfirmModalOpen(false);
                                }}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                Back to Catalog
                            </button>

                            <button
                                onClick={handleAllocateSubmit}
                                disabled={allocating || manifest.length === 0}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed"
                            >
                                {allocating ? <Loader2 size={15} className="animate-spin" /> : <PackagePlus size={15} />}
                                <span>{allocating ? 'Allocating...' : `Confirm & Allocate ${manifestTotalUnits} Units`}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* RECORD PAYMENT MODAL (Supports both entire batch and individual item) */}
            {paymentModalOpen && (selectedAllocation || selectedBatch) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                            <div>
                                <h3 className="font-black text-lg text-stone-900">
                                    {selectedBatch ? `Record Batch Payment` : 'Record Item Payment'}
                                </h3>
                                <p className="text-xs text-stone-400 mt-0.5">
                                    {selectedBatch
                                        ? `Batch #${selectedBatch.shortId} (${selectedBatch.items.length} products · ${selectedBatch.totalUnits} units)`
                                        : `${selectedAllocation.modelName} (${selectedAllocation.sku})`}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setPaymentModalOpen(false);
                                    setSelectedBatch(null);
                                    setSelectedAllocation(null);
                                }}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleRecordPayment} className="space-y-4">
                            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Total Billed:</span>
                                    <span className="font-black text-stone-900">
                                        {formatCurrency(selectedBatch ? selectedBatch.totalCost : selectedAllocation.totalCost)}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-stone-500">Already Paid:</span>
                                    <span className="font-bold text-emerald-700">
                                        {formatCurrency(selectedBatch ? selectedBatch.totalPaid : selectedAllocation.amountPaid)}
                                    </span>
                                </div>
                                <div className="flex justify-between pt-1 border-t border-stone-200">
                                    <span className="text-stone-500">Remaining Balance:</span>
                                    <span className="font-black text-rose-600">
                                        {formatCurrency(
                                            selectedBatch
                                                ? selectedBatch.totalUnpaid
                                                : Math.max(0, parseFloat(selectedAllocation.totalCost || 0) - parseFloat(selectedAllocation.amountPaid || 0))
                                        )}
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
                                    max={
                                        selectedBatch
                                            ? selectedBatch.totalUnpaid
                                            : Math.max(0, parseFloat(selectedAllocation.totalCost || 0) - parseFloat(selectedAllocation.amountPaid || 0))
                                    }
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
                                    onClick={() => {
                                        setPaymentModalOpen(false);
                                        setSelectedBatch(null);
                                        setSelectedAllocation(null);
                                    }}
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

            {/* SOLD ITEM REMITTANCE DETAIL MODAL */}
            {selectedSoldItemModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-scaleUp">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                                    Item Sale & Remittance Breakdown
                                </span>
                                <h3 className="text-lg font-black text-stone-900 mt-0.5">
                                    {selectedSoldItemModal.variant?.brandName} {selectedSoldItemModal.variant?.modelName}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSoldItemModal(null)}
                                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Customer & Ticket Info */}
                        <div className="bg-stone-50 rounded-2xl p-4 space-y-2 text-xs border border-stone-100">
                            <div className="flex justify-between">
                                <span className="text-stone-400">Order Ticket ID:</span>
                                <span className="font-mono font-bold text-stone-900">#{selectedSoldItemModal.orderTicketId || selectedSoldItemModal.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">Transaction Date:</span>
                                <span className="font-bold text-stone-800">
                                    {selectedSoldItemModal.transactionDate
                                        ? new Date(selectedSoldItemModal.transactionDate).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
                                        : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">Customer Name:</span>
                                <span className="font-bold text-stone-900">{selectedSoldItemModal.customerName || 'Walk-in Customer'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-stone-400">Payment Method:</span>
                                <span className="font-bold text-stone-800">{selectedSoldItemModal.paymentMethod || 'Cash'}</span>
                            </div>
                            {selectedSoldItemModal.notes && (
                                <div className="pt-2 border-t border-stone-200">
                                    <span className="text-stone-400 block mb-0.5">Purchase Remarks / Notes:</span>
                                    <div className="font-medium text-stone-800 bg-white p-2.5 rounded-xl border border-stone-200">
                                        "{selectedSoldItemModal.notes}"
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Financial Math Breakdown */}
                        <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl p-5 text-white space-y-3 shadow-md">
                            <div className="flex items-center justify-between text-xs text-stone-300">
                                <span>Gross Retail Sale Price:</span>
                                <span className="text-base font-black text-white">{formatCurrency(selectedSoldItemModal.finalPrice)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-amber-300 pt-2 border-t border-stone-700">
                                <span>Remittable to Admin HQ (Cost Base):</span>
                                <span className="text-base font-black text-amber-300">- {formatCurrency(selectedSoldItemModal.remittableCost)}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-emerald-400 pt-2 border-t border-stone-700">
                                <span>Branch Retained Margin:</span>
                                <span className="text-base font-black text-emerald-400">+ {formatCurrency(selectedSoldItemModal.branchProfit)}</span>
                            </div>
                            <div className="text-right text-[11px] text-stone-400">
                                Branch Margin: <span className="font-bold text-emerald-300">+{selectedSoldItemModal.profitMarginPct?.toFixed(1)}%</span>
                            </div>
                        </div>

                        {/* Remittance Status & Batch Details */}
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                                <span className="text-stone-500">Remittance Settlement:</span>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                                    selectedSoldItemModal.remittanceStatus === 'REMITTED'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : selectedSoldItemModal.remittanceStatus === 'PARTIAL'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {selectedSoldItemModal.remittanceStatus === 'REMITTED'
                                        ? 'Fully Remitted'
                                        : selectedSoldItemModal.remittanceStatus === 'PARTIAL'
                                        ? 'Partially Remitted'
                                        : 'Pending Remittance'}
                                </span>
                            </div>

                            {selectedSoldItemModal.adminBatchId && (
                                <div className="p-3 rounded-xl bg-stone-50 border border-stone-100 space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-stone-400">Allocation Batch:</span>
                                        <span className="font-mono font-bold text-stone-800">#{selectedSoldItemModal.adminBatchId.slice(-6).toUpperCase()}</span>
                                    </div>
                                    {selectedSoldItemModal.allocationDeadline && (
                                        <div className="flex justify-between">
                                            <span className="text-stone-400">Payment Deadline:</span>
                                            <span className="font-bold text-stone-700">{selectedSoldItemModal.allocationDeadline}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedSoldItemModal(null);
                                    handleTabChange('dues');
                                }}
                                className="px-4 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
                            >
                                Go to Dues & Payments
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedSoldItemModal(null)}
                                className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Cashier Price Password Management Modal */}
            <BranchPasswordModal
                isOpen={passwordModalOpen}
                onClose={() => { setPasswordModalOpen(false); fetchBranch(); }}
                branchId={branch?.id}
                branchName={branch?.name}
            />
        </div>
    );
};

export default BranchDetail;
