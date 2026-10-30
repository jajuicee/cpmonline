import React, { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import {
    Users, UserPlus, CreditCard, CheckCircle2, Loader2,
    AlertCircle, X, Undo2, ChevronDown, Trash2, Search, Tag,
    Store, Lock, Phone, Filter, Edit2, Archive, ArchiveRestore, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BASE = '';

const fmt = (n) => Number(n || 0).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

const ConsigneesPage = () => {
    const { user, isAdmin, isBranch, currentBranchId } = useAuth();

    const [allConsignees, setAllConsignees] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedConsigneeId, setSelectedConsigneeId] = useState(null);

    // Branch filter state: 'ALL' or a specific branch ID (number)
    // Branch user is strictly locked to their branch!
    const [selectedBranchFilter, setSelectedBranchFilter] = useState(() => {
        if (isBranch && user?.branchId) return user.branchId;
        return currentBranchId || 'ALL';
    });

    const [showAddConsignee, setShowAddConsignee] = useState(false);
    const [newConsigneeName, setNewConsigneeName] = useState('');
    const [newConsigneeContact, setNewConsigneeContact] = useState('');
    const [newConsigneeBranchId, setNewConsigneeBranchId] = useState(() => {
        if (isBranch && user?.branchId) return user.branchId;
        return (selectedBranchFilter !== 'ALL' && selectedBranchFilter) ? selectedBranchFilter : 'MAIN';
    });

    // Archive & Status Filter State ('ALL' | 'ACTIVE' | 'ARCHIVED')
    const [consigneeStatusFilter, setConsigneeStatusFilter] = useState('ACTIVE');

    // Edit Consignee State
    const [editingConsignee, setEditingConsignee] = useState(null);
    const [editConsigneeName, setEditConsigneeName] = useState('');
    const [editConsigneeContact, setEditConsigneeContact] = useState('');
    const [editConsigneeBranchId, setEditConsigneeBranchId] = useState('MAIN');
    const [editConsigneeArchived, setEditConsigneeArchived] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    const [deleteConfirm, setDeleteConfirm] = useState(null);

    // Payment states
    const [completing, setCompleting] = useState(null);
    const [payingGroup, setPayingGroup] = useState(null); // group being paid
    const [itemPaySelections, setItemPaySelections] = useState({}); // { [id]: boolean }
    const [customAmount, setCustomAmount] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('GCash');

    const PAYMENT_METHODS = ['GCash', 'QRPH', 'Cash', 'Credit Card', 'BDO', 'BPI', 'Banko', 'Maya', 'Check', 'GoTyme'];

    // Return states
    const [returningItem, setReturningItem] = useState(null); // id being returned
    const [returnConfirmItem, setReturnConfirmItem] = useState(null); // { item, group }

    // Price Change states
    const [priceEditItem, setPriceEditItem] = useState(null); // item being edited
    const [newPriceInput, setNewPriceInput] = useState('');
    const [savingPrice, setSavingPrice] = useState(false);

    const [toast, setToast] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(new Set());
    const [consigneeSort, setConsigneeSort] = useState('DATE_DESC'); // 'DATE_DESC' | 'DATE_ASC' | 'NAME'
    const [itemSearch, setItemSearch] = useState('');
    const [searchScope, setSearchScope] = useState('SELECTED'); // 'SELECTED' | 'ALL'
    const [consigneeSearch, setConsigneeSearch] = useState('');

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Synchronize branch filter when auth context changes
    useEffect(() => {
        if (isBranch && user?.branchId) {
            setSelectedBranchFilter(user.branchId);
            setNewConsigneeBranchId(user.branchId);
        } else if (currentBranchId && currentBranchId !== 'ALL') {
            setSelectedBranchFilter(currentBranchId);
            setNewConsigneeBranchId(Number(currentBranchId));
        }
    }, [isBranch, user?.branchId, currentBranchId]);

    // Fetch active branches
    const fetchBranches = async () => {
        try {
            const res = await axios.get(`${BASE}/api/branches`);
            if (Array.isArray(res.data) && res.data.length > 0) {
                setBranches(res.data);
            }
        } catch {
            try {
                const res2 = await axios.get(`${BASE}/api/admin/branches`);
                if (Array.isArray(res2.data)) setBranches(res2.data);
            } catch {
                setBranches([]);
            }
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const [consRes, txRes] = await Promise.all([
                axios.get(`${BASE}/api/consignees`, { params: { includeArchived: true } }),
                axios.get(`${BASE}/api/transactions/consignment`),
            ]);
            setAllConsignees(Array.isArray(consRes.data) ? consRes.data : []);
            setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
        } catch {
            showToast('Failed to load data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
        fetchData();
    }, []);

    // ── Branch Counts for Filter Tabs ──────────────────────────────────────────
    const branchCounts = useMemo(() => {
        const counts = { ALL: allConsignees.length, MAIN: 0 };
        branches.forEach(b => { counts[b.id] = 0; });
        allConsignees.forEach(c => {
            if (!c.branch || !c.branch.id) {
                counts.MAIN = (counts.MAIN || 0) + 1;
            } else {
                const bid = c.branch.id;
                counts[bid] = (counts[bid] || 0) + 1;
            }
        });
        return counts;
    }, [allConsignees, branches]);

    // ── Status Counts (Active vs Archived) ─────────────────────────────────────
    const statusCounts = useMemo(() => {
        let active = 0;
        let archived = 0;
        allConsignees.forEach(c => {
            if (c.archived) archived++;
            else active++;
        });
        return { ACTIVE: active, ARCHIVED: archived, ALL: allConsignees.length };
    }, [allConsignees]);

    // ── Strictly Scoped Consignees per selected branch & status filter ─────────
    const visibleConsignees = useMemo(() => {
        let list = allConsignees;
        if (isBranch) {
            list = list.filter(c => !user?.branchId || c.branch?.id === user.branchId);
        } else if (selectedBranchFilter === 'MAIN' || selectedBranchFilter === 0 || selectedBranchFilter === '0') {
            list = list.filter(c => !c.branch || !c.branch.id);
        } else if (selectedBranchFilter !== 'ALL') {
            list = list.filter(c => c.branch?.id === Number(selectedBranchFilter));
        }

        if (consigneeStatusFilter === 'ACTIVE') {
            list = list.filter(c => !c.archived);
        } else if (consigneeStatusFilter === 'ARCHIVED') {
            list = list.filter(c => c.archived);
        }
        return list;
    }, [allConsignees, selectedBranchFilter, consigneeStatusFilter, isBranch, user?.branchId]);

    // ── Strictly Scoped Transactions per selected branch ───────────────────────
    const visibleTransactions = useMemo(() => {
        if (isBranch) {
            return transactions.filter(t => !user?.branchId || (t.branch?.id || t.consignee?.branch?.id) === user.branchId);
        }
        if (selectedBranchFilter === 'ALL') {
            return transactions;
        }
        if (selectedBranchFilter === 'MAIN' || selectedBranchFilter === 0 || selectedBranchFilter === '0') {
            return transactions.filter(t => (!t.branch && !t.consignee?.branch) || (!t.branch?.id && !t.consignee?.branch?.id));
        }
        const bId = Number(selectedBranchFilter);
        return transactions.filter(t => (t.branch?.id === bId) || (t.consignee?.branch?.id === bId));
    }, [transactions, selectedBranchFilter, isBranch, user?.branchId]);

    // Keep selectedConsigneeId valid when filtering
    useEffect(() => {
        if (visibleConsignees.length > 0) {
            if (!selectedConsigneeId || !visibleConsignees.some(c => c.id === selectedConsigneeId)) {
                setSelectedConsigneeId(visibleConsignees[0].id);
            }
        } else {
            setSelectedConsigneeId(null);
        }
    }, [visibleConsignees]);

    const handleAddConsignee = async (e) => {
        e.preventDefault();
        if (!newConsigneeName.trim()) return;
        try {
            const isMain = !isBranch && (newConsigneeBranchId === 'MAIN' || newConsigneeBranchId === '' || newConsigneeBranchId === 0 || newConsigneeBranchId === '0');
            const targetBranchId = isBranch ? user?.branchId : (isMain ? null : Number(newConsigneeBranchId));
            const payload = {
                name: newConsigneeName.trim(),
                contactInfo: newConsigneeContact.trim() || undefined,
                branch: targetBranchId ? { id: targetBranchId } : null
            };
            const params = {
                branchId: targetBranchId ? targetBranchId : 0
            };
            const res = await axios.post(`${BASE}/api/consignees`, payload, { params });
            setAllConsignees(prev => [...prev, res.data]);
            setSelectedConsigneeId(res.data.id);
            setShowAddConsignee(false);
            setNewConsigneeName('');
            setNewConsigneeContact('');
            showToast(`Consignee added to ${res.data.branch?.name || 'Main Admin'}!`, 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to add consignee.', 'error');
        }
    };

    const handleOpenEditConsignee = (c, e) => {
        if (e) e.stopPropagation();
        setEditingConsignee(c);
        setEditConsigneeName(c.name || '');
        setEditConsigneeContact(c.contactInfo || '');
        setEditConsigneeBranchId(c.branch?.id ? c.branch.id : 'MAIN');
        setEditConsigneeArchived(Boolean(c.archived));
    };

    const handleToggleArchive = async (c, e) => {
        if (e) e.stopPropagation();
        try {
            const res = await axios.patch(`${BASE}/api/consignees/${c.id}/archive`);
            setAllConsignees(prev => prev.map(item => item.id === c.id ? res.data : item));
            showToast(
                res.data.archived 
                    ? `"${c.name}" hidden & archived from POS.` 
                    : `"${c.name}" restored & visible in POS.`,
                'success'
            );
        } catch (err) {
            showToast('Failed to update consignee archive status.', 'error');
        }
    };

    const handleSaveEditConsignee = async (e) => {
        e.preventDefault();
        if (!editingConsignee || !editConsigneeName.trim()) return;
        setSavingEdit(true);
        try {
            const isMain = !isBranch && (editConsigneeBranchId === 'MAIN' || editConsigneeBranchId === '' || editConsigneeBranchId === 0 || editConsigneeBranchId === '0');
            const targetBranchId = isBranch ? user?.branchId : (isMain ? null : Number(editConsigneeBranchId));
            const payload = {
                name: editConsigneeName.trim(),
                contactInfo: editConsigneeContact.trim() || '',
                branch: targetBranchId ? { id: targetBranchId } : null,
                archived: editConsigneeArchived
            };
            const params = {
                branchId: targetBranchId ? targetBranchId : 0
            };
            const res = await axios.put(`${BASE}/api/consignees/${editingConsignee.id}`, payload, { params });
            setAllConsignees(prev => prev.map(c => c.id === res.data.id ? res.data : c));
            setEditingConsignee(null);
            showToast('Consignee updated successfully!', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update consignee.', 'error');
        } finally {
            setSavingEdit(false);
        }
    };

    // ── Grouping ──────────────────────────────────────────────────────────────
    const groupedTransactions = useMemo(() => {
        if (!selectedConsigneeId) return [];
        const consigneeTxs = visibleTransactions.filter(t =>
            t.consignee?.id === selectedConsigneeId
        );

        const groups = {};
        consigneeTxs.forEach(t => {
            const tid = t.transactionId;
            if (!groups[tid]) {
                groups[tid] = {
                    orderId: tid,
                    date: new Date(t.transactionDate),
                    items: [],
                };
            }
            groups[tid].items.push({
                ...t,
                finalPrice: Number(t.finalPrice || 0),
                downpayment: Number(t.downpayment || 0),
            });
        });

        const sorted = Object.values(groups).sort((a, b) => b.date - a.date);
        sorted.forEach(g => {
            const hasUnpaid  = g.items.some(i => i.status === 'UNPAID');
            const hasPartial = g.items.some(i => i.status === 'PARTIAL');
            g.status = hasUnpaid ? 'UNPAID' : hasPartial ? 'PARTIAL' : 'FULL';
            g.totalPrice   = g.items.reduce((s, i) => s + i.finalPrice, 0);
            g.totalUnpaid  = g.items.reduce((s, i) =>
                s + (i.status === 'FULL' ? 0 : i.finalPrice - i.downpayment), 0);
        });

        return sorted;
    }, [visibleTransactions, selectedConsigneeId]);

    // ── Sorted consignee list ─────────────────────────────────────────────────
    const sortedConsignees = useMemo(() => {
        const latestDate = {};
        visibleTransactions.forEach(t => {
            const cid = t.consignee?.id;
            if (!cid) return;
            const d = new Date(t.transactionDate);
            if (!latestDate[cid] || d > latestDate[cid]) latestDate[cid] = d;
        });

        return [...visibleConsignees].sort((a, b) => {
            if (consigneeSort === 'NAME') {
                return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
            }
            const da = latestDate[a.id] || new Date(0);
            const db = latestDate[b.id] || new Date(0);
            return consigneeSort === 'DATE_DESC' ? db - da : da - db;
        });
    }, [visibleConsignees, visibleTransactions, consigneeSort]);

    // ── Consignees filtered by sidebar search ──────────────────────────────────
    const filteredConsignees = useMemo(() => {
        if (!consigneeSearch.trim()) return sortedConsignees;
        const q = consigneeSearch.trim().toLowerCase();
        return sortedConsignees.filter(c =>
            c.name.toLowerCase().includes(q) ||
            (c.contactInfo && c.contactInfo.toLowerCase().includes(q))
        );
    }, [sortedConsignees, consigneeSearch]);

    // ── Item search (scoped to selected consignee by default or across all) ──
    const searchResults = useMemo(() => {
        const q = itemSearch.trim().toLowerCase();
        if (!q) return [];
        const consigneeMap = {};
        const branchMap = {};
        allConsignees.forEach(c => {
            consigneeMap[c.id] = c.name;
            branchMap[c.id] = c.branch?.name || 'Main Admin';
        });

        // When searchScope is 'SELECTED' and a consignee is selected, search ONLY that consignee's items!
        const isScopedToConsignee = searchScope === 'SELECTED' && selectedConsigneeId;
        const targetPool = isScopedToConsignee
            ? visibleTransactions.filter(t => t.consignee?.id === selectedConsigneeId)
            : visibleTransactions;

        const matched = targetPool.filter(t => {
            const brand = t.variant?.product?.brandName || '';
            const model = t.variant?.product?.modelName || '';
            const color = t.variant?.color || '';
            const sku   = t.variant?.sku || '';
            return `${brand} ${model} ${color} ${sku}`.toLowerCase().includes(q);
        });
        const groups = {};
        matched.forEach(t => {
            const tid = t.transactionId;
            if (!groups[tid]) {
                groups[tid] = {
                    orderId: tid,
                    date: new Date(t.transactionDate),
                    consigneeId: t.consignee?.id,
                    consigneeName: consigneeMap[t.consignee?.id] || 'Unknown',
                    branchName: branchMap[t.consignee?.id] || t.branch?.name || '',
                    items: [],
                };
            }
            groups[tid].items.push({
                ...t,
                finalPrice: Number(t.finalPrice || 0),
                downpayment: Number(t.downpayment || 0),
            });
        });
        return Object.values(groups)
            .sort((a, b) => b.date - a.date)
            .map(g => ({
                ...g,
                totalPrice:  g.items.reduce((s, i) => s + i.finalPrice, 0),
                totalUnpaid: g.items.reduce((s, i) => s + (i.status === 'FULL' ? 0 : i.finalPrice - i.downpayment), 0),
                status: g.items.some(i => i.status === 'UNPAID') ? 'UNPAID'
                      : g.items.some(i => i.status === 'PARTIAL') ? 'PARTIAL' : 'FULL',
            }));
    }, [itemSearch, visibleTransactions, allConsignees, searchScope, selectedConsigneeId]);

    const toggleGroup = (orderId) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(orderId) ? next.delete(orderId) : next.add(orderId);
            return next;
        });
    };

    // ── Open Pay Amount modal ─────────────────────────────────────────────────
    const openPayModal = (group) => {
        const unpaidItems = group.items.filter(i => i.status !== 'FULL');
        // Default: pre-select all unpaid items
        const sel = {};
        unpaidItems.forEach(i => { sel[i.id] = true; });
        setItemPaySelections(sel);
        setCustomAmount('');
        setSelectedPaymentMethod('GCash');
        setPayingGroup(group);
    };

    // When custom amount changes, auto-select paddles that fit within the amount
    const handleCustomAmountChange = (val, unpaidItems) => {
        setCustomAmount(val);
        const budget = parseFloat(val);
        if (isNaN(budget) || budget <= 0) {
            // Clear all
            const next = {};
            unpaidItems.forEach(i => { next[i.id] = false; });
            setItemPaySelections(next);
            return;
        }

        // Sort paddles by remaining balance ascending (cheapest / closest to done first)
        const sorted = [...unpaidItems].sort((a, b) => {
            const balA = Math.max(0, Number(a.finalPrice || 0) - Number(a.downpayment || 0));
            const balB = Math.max(0, Number(b.finalPrice || 0) - Number(b.downpayment || 0));
            return balA - balB;
        });

        let remaining = budget;
        const next = {};
        unpaidItems.forEach(i => { next[i.id] = false; });

        for (const item of sorted) {
            if (remaining <= 0) break;
            const itemBalance = Math.max(0, Number(item.finalPrice || 0) - Number(item.downpayment || 0));
            if (itemBalance <= 0) continue;

            // Select this item
            next[item.id] = true;

            if (remaining >= itemBalance) {
                // Fully pays this item
                remaining -= itemBalance;
            } else {
                // The remaining payment amount partially covers this item!
                remaining = 0;
                break;
            }
        }
        setItemPaySelections(next);
    };

    // ── Submit pay modal ──────────────────────────────────────────────────────
    const handlePaySubmit = async (e) => {
        e.preventDefault();
        const group = payingGroup;
        let selectedIds = Object.entries(itemPaySelections)
            .filter(([, v]) => v)
            .map(([id]) => Number(id));

        if (selectedIds.length === 0) {
            showToast('Please select at least one item to pay.', 'error');
            return;
        }

        const unpaidItems = group.items.filter(i => i.status !== 'FULL');

        // Sum the true remaining balance of selected items (finalPrice - downpayment)
        let selectedTotalBalance = parseFloat(
            unpaidItems
                .filter(i => itemPaySelections[i.id])
                .reduce((s, i) => s + Math.max(0, Number(i.finalPrice || 0) - Number(i.downpayment || 0)), 0)
                .toFixed(2)
        );

        let amountToPay = customAmount && parseFloat(customAmount) > 0 
            ? parseFloat(parseFloat(customAmount).toFixed(2))
            : selectedTotalBalance;

        // If the entered payment amount is larger than the selected items' balance:
        // Automatically include the next unpaid items in this order so the extra funds are absorbed!
        if (amountToPay > selectedTotalBalance) {
            const unselectedItems = unpaidItems.filter(i => !itemPaySelections[i.id]);
            let needed = amountToPay - selectedTotalBalance;
            const newSelectedIds = [...selectedIds];

            for (const item of unselectedItems) {
                if (needed <= 0) break;
                const bal = Math.max(0, Number(item.finalPrice || 0) - Number(item.downpayment || 0));
                newSelectedIds.push(item.id);
                selectedTotalBalance += bal;
                needed -= bal;
            }
            selectedIds = newSelectedIds;

            // If amountToPay still exceeds ALL unpaid items in this order, cap it to the full balance
            if (amountToPay > selectedTotalBalance) {
                amountToPay = selectedTotalBalance;
            }
        }

        setPayingGroup(null);
        setCompleting(group.orderId);
        try {
            await axios.patch(`${BASE}/api/transactions/pay-selected`, {
                itemIds: selectedIds,
                amount: amountToPay,
                paymentMethod: selectedPaymentMethod
            });
            await fetchData();
            showToast(`Applied payment of ${fmt(amountToPay)} successfully.`, 'success');
        } catch {
            await fetchData();
            showToast('Network error — could not apply payment.', 'error');
        } finally {
            setCompleting(null);
        }
    };

    // ── Return paddle ─────────────────────────────────────────────────────────
    const handleReturnItem = async (item) => {
        setReturnConfirmItem(null);
        setReturningItem(item.id);
        try {
            await axios.delete(`${BASE}/api/transactions/${item.id}/return`);
            await fetchData();
            showToast('Paddle returned and stock restored.', 'success');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to return item.', 'error');
        } finally {
            setReturningItem(null);
        }
    };

    // ── Change Price of Item ──────────────────────────────────────────────────
    const handleOpenPriceEdit = (item) => {
        setPriceEditItem(item);
        setNewPriceInput(String(item.finalPrice || ''));
    };

    const handleUpdatePrice = async (e) => {
        e.preventDefault();
        if (!priceEditItem) return;
        const val = parseFloat(newPriceInput);
        if (isNaN(val) || val < 0) {
            showToast('Please enter a valid price.', 'error');
            return;
        }
        if (priceEditItem.downpayment && val < priceEditItem.downpayment) {
            showToast(`New price cannot be lower than the already received downpayment (${fmt(priceEditItem.downpayment)}).`, 'error');
            return;
        }

        setSavingPrice(true);
        try {
            await axios.patch(`${BASE}/api/transactions/${priceEditItem.id}/price`, { price: val });
            await fetchData();
            showToast(`Price updated to ${fmt(val)}.`, 'success');
            setPriceEditItem(null);
            setNewPriceInput('');
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to update price.', 'error');
        } finally {
            setSavingPrice(false);
        }
    };

    // ── Delete Consignee ──────────────────────────────────────────────────────
    const handleDeleteConsignee = async (id) => {
        try {
            await axios.delete(`${BASE}/api/consignees/${id}`);
            showToast('Consignee deleted successfully.', 'success');
            setDeleteConfirm(null);
            if (selectedConsigneeId === id) setSelectedConsigneeId(null);
            fetchData();
        } catch (err) {
            showToast(err.response?.data?.error || 'Failed to delete consignee.', 'error');
        }
    };

    // ── Derived state for selected consignee summary ──────────────────────────
    const selectedConsignee = allConsignees.find(c => c.id === selectedConsigneeId);
    const totalOutstanding = groupedTransactions.reduce((s, g) => s + g.totalUnpaid, 0);
    const totalValue = groupedTransactions.reduce((s, g) => s + g.totalPrice, 0);

    // Consignees management is strictly Admin-only; redirect branch accounts safely
    if (!isAdmin) {
        return <Navigate to="/orders" replace />;
    }

    return (
        <div className="w-full h-full flex flex-col md:flex-row bg-stone-50 overflow-hidden relative">

            {/* ── Toast ──────────────────────────────────────────────────── */}
            {toast && (
                <div className={`absolute top-4 right-4 z-[999] px-4 py-3 rounded-xl shadow-xl font-bold text-sm flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {toast.message}
                </div>
            )}

            {/* ── Left Panel: Consignees List ──────────────────────────── */}
            <div className="w-full md:w-80 min-w-0 bg-white border-r border-stone-200 flex flex-col h-[45vh] md:h-full shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center shrink-0">
                    <h2 className="font-bold text-zinc-800 flex items-center gap-2 text-base">
                        <Users size={17} className="text-zinc-500" /> Consignees
                    </h2>
                    <button
                        onClick={() => {
                            if (isBranch && user?.branchId) {
                                setNewConsigneeBranchId(user.branchId);
                            } else {
                                setNewConsigneeBranchId(selectedBranchFilter !== 'ALL' ? selectedBranchFilter : 'MAIN');
                            }
                            setShowAddConsignee(true);
                        }}
                        className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-bold shadow-sm"
                        title="Add Consignee"
                    >
                        <UserPlus size={14} />
                        <span>Add</span>
                    </button>
                </div>

                {/* ── Dedicated Branch Filter ──────────────────────── */}
                <div className="px-3.5 py-2.5 border-b border-stone-200 bg-stone-50/70 shrink-0">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-stone-500 uppercase tracking-wider flex items-center gap-1">
                            <Store size={12} className="text-stone-400" /> Branch Filter
                        </span>
                        {isBranch ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                <Lock size={10} /> Locked
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold text-stone-400">
                                {visibleConsignees.length} showing
                            </span>
                        )}
                    </div>

                    {isBranch ? (
                        <div className="px-3 py-2 bg-white rounded-xl border border-stone-200 text-xs font-bold text-stone-800 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-1.5 truncate">
                                <Store size={14} className="text-blue-600 shrink-0" />
                                <span className="truncate">{user?.branchName || branches.find(b => b.id === user?.branchId)?.name || 'Branch'}</span>
                            </div>
                            <span className="text-[10px] bg-stone-100 px-2 py-0.5 rounded-md font-mono text-stone-600 font-bold shrink-0">
                                {visibleConsignees.length}
                            </span>
                        </div>
                    ) : (
                        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                            <button
                                type="button"
                                onClick={() => setSelectedBranchFilter('ALL')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm ${
                                    selectedBranchFilter === 'ALL'
                                        ? 'bg-zinc-900 text-white'
                                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                                }`}
                            >
                                <span>All</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                    selectedBranchFilter === 'ALL' ? 'bg-zinc-700 text-white' : 'bg-stone-100 text-stone-500'
                                }`}>
                                    {allConsignees.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setSelectedBranchFilter('MAIN')}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm ${
                                    selectedBranchFilter === 'MAIN'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-white text-stone-700 border border-stone-200 hover:bg-stone-100'
                                }`}
                            >
                                <span>👑 Main Admin</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                    selectedBranchFilter === 'MAIN' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-500'
                                }`}>
                                    {branchCounts.MAIN || 0}
                                </span>
                            </button>

                            {branches.map(branch => {
                                const count = branchCounts[branch.id] || 0;
                                const isSelected = String(selectedBranchFilter) === String(branch.id);
                                return (
                                    <button
                                        key={branch.id}
                                        type="button"
                                        onClick={() => setSelectedBranchFilter(branch.id)}
                                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm ${
                                            isSelected
                                                ? 'bg-zinc-900 text-white'
                                                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                                        }`}
                                    >
                                        <span className="truncate max-w-[110px]">{branch.name}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                                            isSelected ? 'bg-zinc-700 text-white' : 'bg-stone-100 text-stone-500'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sort toggle */}
                <div className="flex gap-1 px-3 py-2 border-b border-stone-100 bg-stone-50 shrink-0">
                    {[
                        { id: 'DATE_DESC', label: 'Newest' },
                        { id: 'DATE_ASC',  label: 'Oldest' },
                        { id: 'NAME',      label: 'A–Z' },
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setConsigneeSort(opt.id)}
                            className="flex-1 py-1 text-[11px] font-bold rounded-md transition-colors"
                            style={{
                                backgroundColor: consigneeSort === opt.id ? '#09090b' : '#f1f5f9',
                                color: consigneeSort === opt.id ? '#ffffff' : '#64748b',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {/* Status Filter (Active / Archived) */}
                <div className="flex gap-1 px-3 py-1.5 border-b border-stone-100 bg-stone-50/60 shrink-0">
                    <button
                        type="button"
                        onClick={() => setConsigneeStatusFilter('ACTIVE')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                            consigneeStatusFilter === 'ACTIVE'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                    >
                        <span>Active</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            consigneeStatusFilter === 'ACTIVE' ? 'bg-emerald-800 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                            {statusCounts.ACTIVE}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setConsigneeStatusFilter('ARCHIVED')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                            consigneeStatusFilter === 'ARCHIVED'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                    >
                        <span>Archived</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            consigneeStatusFilter === 'ARCHIVED' ? 'bg-amber-800 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                            {statusCounts.ARCHIVED}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setConsigneeStatusFilter('ALL')}
                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                            consigneeStatusFilter === 'ALL'
                                ? 'bg-zinc-800 text-white shadow-sm'
                                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
                        }`}
                    >
                        <span>All</span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                            consigneeStatusFilter === 'ALL' ? 'bg-zinc-700 text-white' : 'bg-stone-100 text-stone-500'
                        }`}>
                            {statusCounts.ALL}
                        </span>
                    </button>
                </div>

                {/* Consignee search input */}
                <div className="px-3 py-2 border-b border-stone-100 bg-stone-50/50 shrink-0">
                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                            type="text"
                            value={consigneeSearch}
                            onChange={e => setConsigneeSearch(e.target.value)}
                            placeholder="Filter consignees by name..."
                            className="w-full pl-8 pr-7 py-1.5 text-xs border border-stone-200 rounded-lg outline-none bg-white focus:border-zinc-400 transition-colors"
                        />
                        {consigneeSearch && (
                            <button onClick={() => setConsigneeSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Consignee List */}
                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="p-6 text-center text-zinc-400 flex flex-col items-center gap-2">
                            <Loader2 className="animate-spin" size={20} /> Loading consignees...
                        </div>
                    ) : filteredConsignees.length === 0 ? (
                        <div className="p-8 text-center text-zinc-400 text-xs">
                            {consigneeSearch.trim() ? `No consignees matching "${consigneeSearch}".` : 'No consignees found for this branch filter.'}
                        </div>
                    ) : (
                        filteredConsignees.map(c => {
                            const isSelected = selectedConsigneeId === c.id;
                            const isMainAdmin = !c.branch || !c.branch.id;
                            const branchName = isMainAdmin ? 'Main Admin' : c.branch.name;
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        setSelectedConsigneeId(c.id);
                                        setSearchScope('SELECTED');
                                    }}
                                    className={`group w-full text-left px-3.5 py-2.5 mb-1.5 rounded-xl font-medium text-sm flex flex-col gap-1 transition-all ${
                                        isSelected
                                            ? 'bg-zinc-900 text-white shadow-md'
                                            : 'bg-white hover:bg-stone-50 text-zinc-700 border border-stone-200/60'
                                    }`}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="font-bold text-sm truncate">{c.name}</span>
                                        <div className="flex items-center gap-1">
                                            {!isBranch && (
                                                <div
                                                    onClick={(e) => handleToggleArchive(c, e)}
                                                    className={`p-1 rounded-lg transition-opacity ${
                                                        isSelected 
                                                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 opacity-80 group-hover:opacity-100' 
                                                            : c.archived
                                                                ? 'text-amber-600 hover:bg-amber-50 opacity-90 group-hover:opacity-100'
                                                                : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-amber-600 hover:bg-amber-50'
                                                    }`}
                                                    title={c.archived ? "Unhide / Restore to POS" : "Hide / Archive from POS"}
                                                >
                                                    {c.archived ? <Eye size={13} /> : <EyeOff size={13} />}
                                                </div>
                                            )}
                                            {!isBranch && (
                                                <div
                                                    onClick={(e) => handleOpenEditConsignee(c, e)}
                                                    className={`p-1 rounded-lg transition-opacity ${
                                                        isSelected 
                                                            ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 opacity-80 group-hover:opacity-100' 
                                                            : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-blue-600 hover:bg-blue-50'
                                                    }`}
                                                    title="Edit Consignee"
                                                >
                                                    <Edit2 size={13} />
                                                </div>
                                            )}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirm(c.id); }}
                                                className={`p-1 rounded-lg transition-opacity ${
                                                    isSelected 
                                                        ? 'text-zinc-400 hover:text-white hover:bg-zinc-800 opacity-80 group-hover:opacity-100' 
                                                        : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-600 hover:bg-red-50'
                                                }`}
                                                title="Delete Consignee"
                                            >
                                                <Trash2 size={13} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                            isSelected 
                                                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' 
                                                : isMainAdmin
                                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                        }`}>
                                            {isMainAdmin ? '👑 Main Admin' : <><Store size={10} /> {branchName}</>}
                                        </span>
                                        {c.archived && (
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                isSelected ? 'bg-amber-900/60 text-amber-200 border border-amber-700' : 'bg-stone-100 text-stone-500 border border-stone-200'
                                            }`}>
                                                <EyeOff size={10} /> Hidden
                                            </span>
                                        )}
                                        {c.contactInfo && (
                                            <span className={`text-[10px] truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-400'}`}>
                                                {c.contactInfo}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Right Panel ──────────────────────────────────────── */}
            <div className="flex-1 flex flex-col h-[60vh] md:h-full overflow-hidden bg-stone-100">

                {/* Search bar — with scope toggle */}
                <div className="px-4 py-3 bg-white border-b border-stone-200 shrink-0 flex flex-col gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                            type="text"
                            value={itemSearch}
                            onChange={e => setItemSearch(e.target.value)}
                            placeholder={selectedConsignee && searchScope === 'SELECTED'
                                ? `Search paddles for ${selectedConsignee.name}…`
                                : 'Search paddles across all consignees…'}
                            className="w-full pl-9 pr-8 py-2 text-sm border border-stone-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 outline-none bg-stone-50 transition-all"
                        />
                        {itemSearch && (
                            <button onClick={() => setItemSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    {/* Scope toggle buttons if a consignee is selected */}
                    {selectedConsignee && (
                        <div className="flex items-center justify-between text-xs pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Search in:</span>
                                <div className="inline-flex bg-stone-100 p-0.5 rounded-lg border border-stone-200">
                                    <button
                                        type="button"
                                        onClick={() => setSearchScope('SELECTED')}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                            searchScope === 'SELECTED'
                                                ? 'bg-zinc-900 text-white shadow-xs'
                                                : 'text-zinc-500 hover:text-zinc-800'
                                        }`}
                                    >
                                        👤 {selectedConsignee.name} only
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSearchScope('ALL')}
                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                            searchScope === 'ALL'
                                                ? 'bg-zinc-900 text-white shadow-xs'
                                                : 'text-zinc-500 hover:text-zinc-800'
                                        }`}
                                    >
                                        🌐 All Consignees
                                    </button>
                                </div>
                            </div>

                            {itemSearch.trim() && (
                                <span className="text-[11px] text-zinc-400">
                                    {searchResults.length === 0
                                        ? 'No matching paddles'
                                        : `${searchResults.reduce((s, g) => s + g.items.length, 0)} paddle(s) found`}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Search results mode */}
                {itemSearch.trim() ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {searchResults.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-3">
                                <Search size={36} className="opacity-20" />
                                <p className="text-sm">No paddles matched "{itemSearch}"</p>
                            </div>
                        ) : searchResults.map(group => {
                            const shortId = String(group.orderId).slice(-6).toUpperCase();
                            return (
                                <div key={group.orderId} className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs text-zinc-400">#{shortId}</span>
                                                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{group.consigneeName}</span>
                                                {group.branchName && (
                                                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                        <Store size={10} /> {group.branchName}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-zinc-500 mt-0.5">
                                                {group.date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {group.status !== 'FULL' ? (
                                                <>
                                                    <div className="text-[10px] text-zinc-400 font-bold uppercase">Due</div>
                                                    <div className="text-sm font-black text-amber-600 font-mono">{fmt(group.totalUnpaid)}</div>
                                                </>
                                            ) : (
                                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded-lg">FULLY PAID ✓</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="divide-y divide-stone-100">
                                        {group.items.map(item => {
                                            const isPaid = item.status === 'FULL';
                                            const productName = item.variant?.product
                                                ? `${item.variant.product.brandName} ${item.variant.product.modelName}${item.variant?.color ? ` (${item.variant.color})` : ''}`
                                                : (item.variant?.sku || '—');
                                            return (
                                                <div key={item.id} className="px-5 py-3 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-zinc-800 text-sm truncate">{productName}</div>
                                                        <div className="text-xs text-zinc-400 font-mono">{item.variant?.sku}</div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="font-black text-zinc-900 font-mono text-sm">{fmt(item.finalPrice)}</div>
                                                        {!isPaid && item.downpayment > 0 && (
                                                            <div className="text-[10px] text-amber-600 font-bold">DP: {fmt(item.downpayment)}</div>
                                                        )}
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {isPaid ? (
                                                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md">PAID</span>
                                                        ) : (
                                                            <>
                                                                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">{item.status}</span>
                                                                <button
                                                                    onClick={() => handleOpenPriceEdit(item)}
                                                                    className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 border border-blue-200 shadow-sm"
                                                                    title="Change Price (Sale/Discount)"
                                                                >
                                                                    <Tag size={10} /> Price
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedConsigneeId(group.consigneeId);
                                                                        setItemSearch('');
                                                                        setTimeout(() => openPayModal(group), 50);
                                                                    }}
                                                                    className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 shadow-sm"
                                                                >
                                                                    <CreditCard size={10} /> Pay
                                                                </button>
                                                                <button
                                                                    onClick={() => setReturnConfirmItem({ item, group })}
                                                                    disabled={returningItem === item.id}
                                                                    className="px-2 py-1 text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                                                    style={{ backgroundColor: '#d97706' }}
                                                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b45309'}
                                                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#d97706'}
                                                                >
                                                                    {returningItem === item.id ? <Loader2 size={10} className="animate-spin" /> : <Undo2 size={10} />}
                                                                    Return
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                /* Normal consignee view when search is empty */
                !selectedConsigneeId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 gap-3">
                        <Users size={48} className="opacity-20" />
                        <p className="text-sm">Select a consignee to view their consignments.</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="p-5 bg-white border-b border-stone-200 shrink-0">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-xl font-black text-zinc-900">
                                            {selectedConsignee?.name}'s Consignments
                                        </h2>
                                        {(!selectedConsignee?.branch || !selectedConsignee?.branch?.id) ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                👑 Main Admin (Central HQ)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                <Store size={12} /> {selectedConsignee.branch.name}
                                            </span>
                                        )}
                                        {selectedConsignee?.archived ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-stone-100 text-stone-600 border border-stone-300">
                                                <EyeOff size={12} /> Hidden from POS (Archived)
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <CheckCircle2 size={12} /> Visible in POS
                                            </span>
                                        )}
                                        {!isBranch && selectedConsignee && (
                                            <button
                                                type="button"
                                                onClick={() => handleToggleArchive(selectedConsignee)}
                                                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
                                                    selectedConsignee.archived
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                        : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
                                                }`}
                                                title={selectedConsignee.archived ? "Restore to POS" : "Hide / Archive from POS"}
                                            >
                                                {selectedConsignee.archived ? <><Eye size={13} /> Restore to POS</> : <><EyeOff size={13} /> Hide from POS</>}
                                            </button>
                                        )}
                                        {!isBranch && selectedConsignee && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditConsignee(selectedConsignee)}
                                                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                                                title="Edit Consignee"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">Manage consigned items strictly assigned to this consignee.</p>
                                </div>
                                <div className="flex items-center gap-4 text-right text-xs font-bold text-zinc-500">
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider mb-0.5">Total Value</div>
                                        <div className="text-base font-black text-zinc-800 font-mono">{fmt(totalValue)}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] uppercase tracking-wider mb-0.5">Outstanding</div>
                                        <div className={`text-base font-black font-mono ${totalOutstanding > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                            {fmt(totalOutstanding)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {groupedTransactions.length === 0 ? (
                                <div className="text-center text-zinc-400 py-16 text-sm">No consignments found.</div>
                            ) : (
                                groupedTransactions.map(group => {
                                    const isExpanded = expandedGroups.has(group.orderId);
                                    const isUnfinished = group.status !== 'FULL';
                                    const shortId = String(group.orderId).slice(-6).toUpperCase();

                                    return (
                                        <div key={group.orderId} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
                                            {/* Group header */}
                                            <div
                                                className="px-5 py-4 flex items-center justify-between cursor-pointer select-none hover:bg-stone-50 transition-colors"
                                                onClick={() => toggleGroup(group.orderId)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`p-1 rounded transition-transform ${isExpanded ? 'rotate-0' : '-rotate-90'}`}>
                                                        <ChevronDown size={16} className="text-zinc-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-mono text-xs text-zinc-400">#{shortId}</div>
                                                        <div className="font-bold text-zinc-800 text-sm truncate">
                                                            {group.date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-0.5">
                                                            {group.items.length} paddle{group.items.length !== 1 ? 's' : ''} · {fmt(group.totalPrice)}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                                    {isUnfinished ? (
                                                        <>
                                                            <div className="text-right mr-1">
                                                                <div className="text-[10px] text-zinc-400 font-bold uppercase">Due</div>
                                                                <div className="text-sm font-black text-amber-600 font-mono">{fmt(group.totalUnpaid)}</div>
                                                            </div>
                                                            <button
                                                                onClick={() => openPayModal(group)}
                                                                disabled={completing === group.orderId}
                                                                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
                                                            >
                                                                <CreditCard size={12} /> Pay Balance
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs font-bold text-green-700 bg-green-100 px-3 py-1.5 rounded-lg">
                                                            FULLY PAID ✓
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Expanded items */}
                                            {isExpanded && (
                                                <div className="border-t border-stone-100 divide-y divide-stone-100">
                                                    {group.items.map(item => {
                                                        const isPaid = item.status === 'FULL';
                                                        const productName = item.variant?.product
                                                            ? `${item.variant.product.brandName} ${item.variant.product.modelName}${item.variant?.color ? ` (${item.variant.color})` : ''}`
                                                            : (item.variant?.sku || '—');
                                                        return (
                                                            <div key={item.id} className="px-5 py-3 flex items-center gap-4 hover:bg-stone-50 transition-colors">
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-bold text-zinc-800 text-sm truncate">{productName}</div>
                                                                    <div className="text-xs text-zinc-400 font-mono">{item.variant?.sku}</div>
                                                                </div>
                                                                <div className="text-right shrink-0">
                                                                    <div className="font-black text-zinc-900 font-mono text-sm">{fmt(item.finalPrice)}</div>
                                                                    {!isPaid && item.downpayment > 0 && (
                                                                        <div className="text-[10px] text-amber-600 font-bold">
                                                                            DP: {fmt(item.downpayment)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="shrink-0 flex items-center gap-1.5">
                                                                    {isPaid ? (
                                                                        <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md">PAID</span>
                                                                    ) : (
                                                                        <>
                                                                            <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-md">
                                                                                {item.status}
                                                                            </span>
                                                                            <button
                                                                                onClick={() => handleOpenPriceEdit(item)}
                                                                                className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 border border-blue-200 shadow-sm"
                                                                                title="Change Price (Sale/Discount)"
                                                                            >
                                                                                <Tag size={11} /> Price
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    // Pay just this single item
                                                                                    openPayModal({
                                                                                        ...group,
                                                                                        items: [item],
                                                                                    });
                                                                                }}
                                                                                disabled={completing === item.id}
                                                                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                                                            >
                                                                                {completing === item.id
                                                                                    ? <Loader2 size={11} className="animate-spin" />
                                                                                    : <CheckCircle2 size={11} />}
                                                                                Pay
                                                                            </button>
                                                                            <button
                                                                                onClick={() => setReturnConfirmItem({ item, group })}
                                                                                disabled={returningItem === item.id}
                                                                                className="px-2 py-1 text-white text-[10px] font-bold rounded-md transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
                                                                                style={{ backgroundColor: '#d97706' }}
                                                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b45309'}
                                                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#d97706'}
                                                                            >
                                                                                {returningItem === item.id
                                                                                    ? <Loader2 size={11} className="animate-spin" />
                                                                                    : <Undo2 size={11} />}
                                                                                Return
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </>
                )
                )} {/* end: itemSearch ternary */}
            </div>

            {/* ── Add Consignee Modal ─────────────────────────────────── */}
            {showAddConsignee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                        <div className="p-4 bg-stone-50 border-b border-stone-100 flex justify-between items-center">
                            <h3 className="font-bold text-zinc-800 flex items-center gap-2">
                                <UserPlus size={16} className="text-blue-500" /> Add Consignee
                            </h3>
                            <button onClick={() => setShowAddConsignee(false)} className="text-zinc-400 hover:text-zinc-800 p-1 rounded-full hover:bg-stone-100">
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleAddConsignee} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-bold text-zinc-600 mb-1.5 block uppercase tracking-wider">
                                    Consignee Name *
                                </label>
                                <input
                                    type="text" autoFocus required
                                    value={newConsigneeName}
                                    onChange={e => setNewConsigneeName(e.target.value)}
                                    className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                                    placeholder="e.g. Coach Dennis, Mark Consignment..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-zinc-600 mb-1.5 block uppercase tracking-wider">
                                    Contact Info / Phone (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newConsigneeContact}
                                    onChange={e => setNewConsigneeContact(e.target.value)}
                                    className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                                    placeholder="e.g. 0917-123-4567"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-zinc-600 mb-1.5 flex items-center justify-between uppercase tracking-wider">
                                    <span>Assigned Branch *</span>
                                    {isBranch && (
                                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                            <Lock size={10} /> Strict Branch
                                        </span>
                                    )}
                                </label>
                                {isBranch ? (
                                    <div className="w-full px-3 py-2.5 bg-stone-100 border-2 border-stone-200 rounded-xl text-stone-700 text-sm font-bold flex items-center gap-2">
                                        <Store size={15} className="text-stone-500" />
                                        <span>{user?.branchName || branches.find(b => b.id === user?.branchId)?.name || 'Current Branch'}</span>
                                    </div>
                                ) : (
                                    <select
                                        value={newConsigneeBranchId}
                                        onChange={e => setNewConsigneeBranchId(e.target.value)}
                                        className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold bg-white"
                                    >
                                        <option value="MAIN">👑 Main Admin (Central HQ)</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                🏬 {b.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-[11px] text-stone-400 mt-1">
                                    Assign this consignee to Main Admin (Central HQ) or a specific retail branch.
                                </p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowAddConsignee(false)}
                                    className="flex-1 py-2.5 border border-stone-200 text-stone-600 font-bold rounded-xl hover:bg-stone-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!newConsigneeName.trim()}
                                    className="flex-1 py-2.5 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 shadow-sm"
                                >
                                    Save Consignee
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Pay Amount Modal (checkbox + custom amount) ─────────── */}
            {payingGroup && (() => {
                const unpaidItems = payingGroup.items.filter(i => i.status !== 'FULL');
                const selectedIds = Object.entries(itemPaySelections).filter(([, v]) => v).map(([id]) => Number(id));
                const selectedBalance = unpaidItems
                    .filter(i => itemPaySelections[i.id])
                    .reduce((s, i) => s + Math.max(0, Number(i.finalPrice || 0) - Number(i.downpayment || 0)), 0);
                const allSelected = unpaidItems.length > 0 && unpaidItems.every(i => itemPaySelections[i.id]);
                const parsedCustomAmount = customAmount && parseFloat(customAmount) > 0 ? parseFloat(customAmount) : 0;

                return (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
                            {/* Header */}
                            <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between shrink-0">
                                <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                    <CreditCard size={17} className="text-blue-500" /> Select Items to Pay
                                </h3>
                                <button onClick={() => setPayingGroup(null)} className="p-1 hover:bg-stone-200 rounded-full text-stone-400">
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handlePaySubmit} className="flex flex-col overflow-hidden">
                                {/* Custom amount input */}
                                <div className="px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                                        Enter paid amount to auto-select paddles
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">₱</span>
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={customAmount}
                                            onChange={e => handleCustomAmountChange(e.target.value, unpaidItems)}
                                            className="w-full pl-8 pr-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-lg text-stone-800 outline-none"
                                            placeholder="0.00"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[10px] text-zinc-400 mt-1.5">Or manually check the paddles below.</p>
                                </div>
                                
                                {/* Payment Method Selector */}
                                <div className="px-5 py-3 border-b border-stone-100 shrink-0">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5 block">
                                        Payment Method
                                    </label>
                                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                        {PAYMENT_METHODS.map(method => (
                                            <button
                                                key={method}
                                                type="button"
                                                onClick={() => setSelectedPaymentMethod(method)}
                                                className="px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors"
                                                style={{
                                                    backgroundColor: selectedPaymentMethod === method ? '#09090b' : '#f5f5f4',
                                                    color: selectedPaymentMethod === method ? '#fff' : '#52525b',
                                                }}
                                            >
                                                {method}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Select All toggle */}
                                <div className="px-5 py-2.5 flex items-center justify-between border-b border-stone-100 bg-stone-50 shrink-0">
                                    <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                                        {unpaidItems.length} unpaid paddle{unpaidItems.length !== 1 ? 's' : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const next = {};
                                            unpaidItems.forEach(i => { next[i.id] = !allSelected; });
                                            setItemPaySelections(next);
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        {allSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>

                                {/* Paddle list */}
                                <div className="overflow-y-auto flex-1">
                                    {unpaidItems.map(item => {
                                        const isChecked = !!itemPaySelections[item.id];
                                        const itemRemaining = Math.max(0, Number(item.finalPrice || 0) - Number(item.downpayment || 0));
                                        const productName = item.variant?.product
                                            ? `${item.variant.product.brandName} ${item.variant.product.modelName}${item.variant?.color ? ` (${item.variant.color})` : ''}`
                                            : (item.variant?.sku || '—');
                                        return (
                                            <label
                                                key={item.id}
                                                className="flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-stone-100 last:border-0 transition-colors"
                                                style={{ backgroundColor: isChecked ? '#f0fdf4' : 'transparent' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={e => {
                                                        setItemPaySelections(prev => ({ ...prev, [item.id]: e.target.checked }));
                                                    }}
                                                    className="w-4 h-4 accent-green-600 cursor-pointer shrink-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-zinc-800 truncate">{productName}</div>
                                                    <div className="text-[11px] text-zinc-400 font-mono">{item.variant?.sku}</div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className={`text-sm font-black font-mono ${isChecked ? 'text-green-700' : 'text-zinc-800'}`}>
                                                        {fmt(itemRemaining)}
                                                    </div>
                                                    {item.downpayment > 0 && (
                                                        <div className="text-[10px] text-amber-600 font-bold">Paid: {fmt(item.downpayment)} of {fmt(item.finalPrice)}</div>
                                                    )}
                                                </div>
                                            </label>
                                        );
                                    })}
                                </div>

                                {/* Running total + actions */}
                                <div className="shrink-0 border-t border-stone-200 bg-stone-50">
                                    <div className="px-5 py-3 flex items-center justify-between">
                                        <div>
                                            <span className="text-xs font-bold text-stone-500 block">
                                                {selectedIds.length} paddle{selectedIds.length !== 1 ? 's' : ''} selected
                                            </span>
                                            {parsedCustomAmount > 0 && (
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                                                    {parsedCustomAmount < selectedBalance 
                                                        ? `⚡ Partial payment to apply: ${fmt(parsedCustomAmount)}`
                                                        : `Full payment to apply: ${fmt(Math.min(parsedCustomAmount, selectedBalance))}`}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-stone-400 block">Total Balance Due</span>
                                            <span className="text-lg font-black text-green-700 font-mono">{fmt(selectedBalance)}</span>
                                        </div>
                                    </div>
                                    <div className="px-5 pb-4 flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setPayingGroup(null)}
                                            className="flex-1 py-2.5 text-sm font-bold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={selectedIds.length === 0}
                                            className="flex-1 py-2.5 text-sm font-bold text-white rounded-xl transition-colors shadow-sm disabled:opacity-40"
                                            style={{ backgroundColor: '#16a34a' }}
                                            onMouseEnter={e => { if (selectedIds.length > 0) e.currentTarget.style.backgroundColor = '#15803d'; }}
                                            onMouseLeave={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                                        >
                                            Confirm Payment
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* ── Return Confirmation Modal ───────────────────────────── */}
            {returnConfirmItem && (() => {
                const { item, group } = returnConfirmItem;
                const productName = item.variant?.product
                    ? `${item.variant.product.brandName} ${item.variant.product.modelName}${item.variant?.color ? ` (${item.variant.color})` : ''}`
                    : (item.variant?.sku || 'this item');
                return (
                    <div className="fixed inset-0 bg-zinc-950/60 z-[200] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
                            <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: '#d97706' }}>
                                <Undo2 size={20} className="text-white" />
                                <h3 className="font-bold text-base text-white">Return Paddle?</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-sm text-zinc-700">
                                    Return <strong>{productName}</strong> to stock?
                                </p>
                                <p className="text-xs text-zinc-400 font-medium mt-3">
                                    Price: {fmt(item.finalPrice)} · Stock will be restored by 1 unit.
                                </p>
                            </div>
                            <div className="px-6 pb-6 flex gap-3">
                                <button
                                    onClick={() => setReturnConfirmItem(null)}
                                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-zinc-600 font-bold text-sm hover:bg-stone-50 transition-colors"
                                >
                                    Keep
                                </button>
                                <button
                                    onClick={() => handleReturnItem(item)}
                                    className="flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
                                    style={{ backgroundColor: '#d97706' }}
                                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#b45309'}
                                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#d97706'}
                                >
                                    Yes, Return
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* ── Change Price Modal ─────────────────────────────────────── */}
            {priceEditItem && (() => {
                const productName = priceEditItem.variant?.product
                    ? `${priceEditItem.variant.product.brandName} ${priceEditItem.variant.product.modelName}${priceEditItem.variant?.color ? ` (${priceEditItem.variant.color})` : ''}`
                    : (priceEditItem.variant?.sku || 'this item');
                const origPrice = priceEditItem.finalPrice || 0;
                const downpayment = priceEditItem.downpayment || 0;

                return (
                    <div className="fixed inset-0 bg-zinc-950/60 z-[250] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-up">
                            <div className="px-6 py-4 bg-blue-600 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-white font-bold text-base">
                                    <Tag size={18} />
                                    <span>Change Selling Price</span>
                                </div>
                                <button
                                    onClick={() => setPriceEditItem(null)}
                                    className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <form onSubmit={handleUpdatePrice} className="p-6">
                                <div className="mb-4">
                                    <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider mb-1">Paddle</div>
                                    <div className="text-sm font-bold text-zinc-800">{productName}</div>
                                    <div className="text-xs text-zinc-400 font-mono mt-0.5">{priceEditItem.variant?.sku}</div>
                                </div>

                                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 mb-4 flex justify-between items-center text-xs">
                                    <span className="text-zinc-500 font-medium">Current Price:</span>
                                    <span className="font-mono font-bold text-zinc-800">{fmt(origPrice)}</span>
                                </div>

                                {downpayment > 0 && (
                                    <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 mb-4 text-xs text-amber-800">
                                        <span className="font-bold">Notice:</span> Downpayment of <strong>{fmt(downpayment)}</strong> has already been received. New price must be at least {fmt(downpayment)}.
                                    </div>
                                )}

                                <div className="mb-5">
                                    <label className="text-xs font-bold text-zinc-600 mb-1.5 block uppercase tracking-wider">
                                        New Agreed Price (₱)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        min={downpayment > 0 ? downpayment : 0}
                                        autoFocus
                                        required
                                        value={newPriceInput}
                                        onChange={e => setNewPriceInput(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full px-3.5 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none font-mono text-base font-bold text-zinc-900 transition-all"
                                    />
                                    <p className="text-[11px] text-zinc-400 mt-1.5">
                                        Adjust price in case of discounts or special sales without returning item to stock.
                                    </p>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setPriceEditItem(null)}
                                        className="flex-1 py-2.5 rounded-xl border border-stone-200 text-zinc-600 font-bold text-sm hover:bg-stone-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingPrice}
                                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {savingPrice ? <Loader2 size={16} className="animate-spin" /> : null}
                                        {savingPrice ? 'Saving...' : 'Save Price'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* ── Delete Confirm Modal ────────────────────────────────────── */}
            {/* Edit Consignee Modal */}
            {editingConsignee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="p-4 bg-stone-50 border-b border-stone-200 flex justify-between items-center">
                            <h3 className="font-bold text-zinc-900 text-sm flex items-center gap-2">
                                <Edit2 size={16} className="text-blue-600" /> Edit Consignee
                            </h3>
                            <button
                                onClick={() => setEditingConsignee(null)}
                                className="text-stone-400 hover:text-stone-600 p-1"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveEditConsignee} className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Consignee Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editConsigneeName}
                                    onChange={e => setEditConsigneeName(e.target.value)}
                                    placeholder="e.g. Coach Dennis, Manila Club"
                                    className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-stone-600 mb-1.5">
                                    Contact Info (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={editConsigneeContact}
                                    onChange={e => setEditConsigneeContact(e.target.value)}
                                    placeholder="e.g. 0917-xxx-xxxx / dennis@email.com"
                                    className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-medium"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-stone-600 flex items-center justify-between mb-1.5">
                                    <span>Assigned Branch / Location *</span>
                                    {isBranch && (
                                        <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                                            <Lock size={10} /> Strict Branch
                                        </span>
                                    )}
                                </label>
                                {isBranch ? (
                                    <div className="w-full px-3 py-2.5 bg-stone-100 border-2 border-stone-200 rounded-xl text-stone-700 text-sm font-bold flex items-center gap-2">
                                        <Store size={15} className="text-stone-500" />
                                        <span>{user?.branchName || branches.find(b => b.id === user?.branchId)?.name || 'Current Branch'}</span>
                                    </div>
                                ) : (
                                    <select
                                        value={editConsigneeBranchId}
                                        onChange={e => setEditConsigneeBranchId(e.target.value)}
                                        className="w-full px-3 py-2.5 border-2 border-stone-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm font-bold bg-white"
                                    >
                                        <option value="MAIN">👑 Main Admin (Central HQ)</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>
                                                🏬 {b.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-[11px] text-stone-400 mt-1">
                                    Select Main Admin (Central HQ) or a specific store branch.
                                </p>
                            </div>

                            <div>
                                <label className="flex items-center gap-2.5 text-xs font-bold text-stone-700 cursor-pointer p-3 bg-stone-50 rounded-xl border border-stone-200 hover:bg-stone-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={editConsigneeArchived}
                                        onChange={e => setEditConsigneeArchived(e.target.checked)}
                                        className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                                    />
                                    <div>
                                        <span className="flex items-center gap-1.5">
                                            <EyeOff size={13} className="text-stone-500" />
                                            Hide / Archive from POS
                                        </span>
                                        <p className="text-[10px] text-stone-400 font-normal mt-0.5">
                                            When checked, this consignee will not appear in the POS checkout consignee list.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingConsignee(null)}
                                    className="flex-1 py-2.5 border border-stone-200 text-stone-600 font-bold rounded-xl hover:bg-stone-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!editConsigneeName.trim() || savingEdit}
                                    className="flex-1 py-2.5 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-700 transition-colors disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
                                >
                                    {savingEdit ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 bg-zinc-950/60 z-[300] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center animate-fade-in-up">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                            <Trash2 size={24} />
                        </div>
                        <h3 className="font-bold text-zinc-900 text-lg mb-1">Delete Consignee?</h3>
                        <p className="text-sm text-zinc-500 mb-5">Consignees referenced by past transactions cannot be deleted. Are you sure?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2.5 border border-stone-300 rounded-xl font-bold text-zinc-600 hover:bg-stone-50 transition-colors">Cancel</button>
                            <button onClick={() => handleDeleteConsignee(deleteConfirm)}
                                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-sm">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ConsigneesPage;
