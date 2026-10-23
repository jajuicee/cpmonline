import React, { useState, useMemo, useRef } from 'react';
import { Package, X, Search, Building2, Boxes, Coins, AlertTriangle, PackageX, Tag, Store, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const formatPHP = (n) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(n) || 0);

// Read-only current stock view. Stock additions and deductions are in "Manage Inventory".
const Inventory = ({ products = [], loading = false, refetchProducts }) => {
    const { user } = useAuth();

    // --- INFINITE SCROLL ---
    const [displayedCount, setDisplayedCount] = useState(15);
    const tableContainerRef = useRef(null);

    // --- TABLE FILTER ---
    const [tableFilter, setTableFilter] = useState('');
    const [sortOrder, setSortOrder] = useState('name-asc');
    const [categoryFilter, setCategoryFilter] = useState('All'); // All, Paddles, Accessories, Shoes
    const [stockFilter, setStockFilter] = useState('all'); // all | low | out

    // --- FLATTEN DATA ---
    const flattenedInventory = useMemo(() => {
        return products.flatMap(product =>
            (product.variants || []).map(variant => {
                const isPaddle = product.category === 'Paddles';
                const isShoe = product.category === 'Shoes';
                const qty = variant.stockQuantity ?? 0;
                const threshold = variant.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
                const mainStock = variant.mainStock != null ? variant.mainStock : qty;
                const branchStock = variant.branchStock || 0;
                const locationBreakdown = variant.locationBreakdown || [];

                return {
                    variantId: variant.id,
                    sku: variant.sku,
                    brand: product.brandName,
                    name: product.modelName,
                    color: (variant.color === 'N/A' || !variant.color) ? '-' : variant.color,
                    variantDetails: isPaddle
                        ? `${variant.thicknessMm || 0}mm ${variant.shape || ''}`
                        : isShoe
                            ? `Size ${variant.shape || '-'}`
                            : '-',
                    quantity: qty,
                    mainStock,
                    branchStock,
                    locationBreakdown,
                    sellingPrice: variant.sellingPrice ?? 0,
                    acquisitionPrice: variant.acquisitionPrice ?? 0,
                    totalAdded: variant.totalAdded || 0,
                    totalSold: variant.totalSold || 0,
                    consigned: variant.consigned,
                    defaultSupplier: variant.defaultSupplier,
                    category: product.category,
                    lowStockThreshold: threshold,
                    isLowStock: qty > 0 && qty <= threshold,
                    isOutOfStock: qty <= 0,
                    dropdownName: isPaddle
                        ? `${product.brandName} ${product.modelName} ${variant.color || ''} ${variant.thicknessMm || 0}mm`
                        : isShoe
                            ? `${product.brandName} ${product.modelName} ${variant.shape || ''}`
                            : `${product.brandName} ${product.modelName}`
                };
            })
        );
    }, [products]);

    // --- STATS ---
    const stats = useMemo(() => {
        let totalSkus = flattenedInventory.length;
        let totalUnits = 0;
        let warehouseUnits = 0;
        let branchUnits = 0;
        let value = 0;
        let lowStock = 0;
        let outOfStock = 0;
        let consignedUnits = 0;
        for (const row of flattenedInventory) {
            totalUnits += row.quantity;
            warehouseUnits += (row.mainStock || 0);
            branchUnits += (row.branchStock || 0);
            value += row.quantity * Number(row.sellingPrice || 0);
            if (row.isOutOfStock) outOfStock++;
            else if (row.isLowStock) lowStock++;
            if (row.consigned) consignedUnits += row.quantity;
        }
        return { totalSkus, totalUnits, warehouseUnits, branchUnits, value, lowStock, outOfStock, consignedUnits };
    }, [flattenedInventory]);

    const filteredInventory = useMemo(() => {
        let list = [...flattenedInventory];
        
        if (categoryFilter !== 'All') {
            list = list.filter(i => i.category === categoryFilter);
        }

        if (stockFilter === 'low') list = list.filter(i => i.isLowStock);
        else if (stockFilter === 'out') list = list.filter(i => i.isOutOfStock);
        
        if (tableFilter.trim()) {
            const q = tableFilter.toLowerCase();
            list = list.filter(item =>
                (item.sku || '').toLowerCase().includes(q) ||
                (item.brand || '').toLowerCase().includes(q) ||
                (item.name || '').toLowerCase().includes(q) ||
                (item.dropdownName || '').toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            if (sortOrder === 'stock-asc') return a.quantity - b.quantity;
            if (sortOrder === 'stock-desc') return b.quantity - a.quantity;
            if (sortOrder === 'name-asc') return a.dropdownName.localeCompare(b.dropdownName, undefined, { numeric: true });
            if (sortOrder === 'name-desc') return b.dropdownName.localeCompare(a.dropdownName, undefined, { numeric: true });
            return 0;
        });

        return list;
    }, [tableFilter, stockFilter, sortOrder, categoryFilter, flattenedInventory]);

    const searchSummary = useMemo(() => {
        if (!tableFilter.trim()) return null;
        const grouped = {};
        filteredInventory.forEach(item => {
            const key = `${item.brand} ${item.name}`;
            if (!grouped[key]) grouped[key] = { label: key, totalQty: 0, totalValue: 0, totalSold: 0, totalAdded: 0, variantCount: 0 };
            grouped[key].totalQty += (item.quantity || 0);
            grouped[key].totalValue += (item.quantity || 0) * (item.sellingPrice || 0);
            grouped[key].totalSold += (item.totalSold || 0);
            grouped[key].totalAdded += (item.totalAdded || 0);
            grouped[key].variantCount += 1;
        });
        return Object.values(grouped);
    }, [tableFilter, filteredInventory]);

    const handleScroll = () => {
        if (tableContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50 && displayedCount < filteredInventory.length) {
                setDisplayedCount(prev => prev + 15);
            }
        }
    };

    const visibleData = filteredInventory.slice(0, displayedCount);

    return (
        <div className="max-w-7xl mx-auto w-full space-y-5">
            {/* Header / Branch Info Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <Store size={16} />
                        <span>{user?.branchName || 'Live Inventory'}</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        Current Inventory & Stock Health
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        Real-time physical stock counts, variants, and valuation across all merchandise categories.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => refetchProducts && refetchProducts()}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh current inventory"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh Stocks</span>
                    </button>
                </div>
            </div>

            {/* STAT CARDS (Aesthetic 5-Card Grid) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 shrink-0">
                <StatCard
                    Icon={Boxes}
                    label="Total Units"
                    primary={stats.totalUnits}
                    secondary={stats.branchUnits > 0 ? `${stats.warehouseUnits} unallocated (Admin) · ${stats.branchUnits} in branches` : `${stats.totalSkus} active SKUs`}
                    loading={loading}
                />
                <StatCard Icon={Coins} label="Inventory Value" primary={loading ? '—' : formatPHP(stats.value)} secondary="valuation at selling price" accent="emerald" loading={loading} />
                <StatCard Icon={AlertTriangle} label="Low Stock" primary={stats.lowStock} secondary={`≤ ${DEFAULT_LOW_STOCK_THRESHOLD} units (reorder warning)`} accent="amber" loading={loading}
                    active={stockFilter === 'low'} onClick={() => { setStockFilter(stockFilter === 'low' ? 'all' : 'low'); setDisplayedCount(15); }} />
                <StatCard Icon={PackageX} label="Out of Stock" primary={stats.outOfStock} secondary="critical zero stock" accent="red" loading={loading}
                    active={stockFilter === 'out'} onClick={() => { setStockFilter(stockFilter === 'out' ? 'all' : 'out'); setDisplayedCount(15); }} />
                <StatCard Icon={Tag} label="Consigned Stock" primary={stats.consignedUnits} secondary="items on consignment" accent="indigo" loading={loading} />
            </div>

            {/* CONTROLS BAR: CATEGORIES, SORT, SEARCH */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                    {['All', 'Paddles', 'Accessories', 'Balls', 'Apparel', 'Shoes', 'Bags'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setCategoryFilter(cat); setDisplayedCount(15); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                categoryFilter === cat 
                                    ? 'bg-stone-900 text-white shadow-sm font-black' 
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-stone-900 bg-stone-50 font-bold text-stone-700 shadow-inner cursor-pointer"
                    >
                        <option value="name-asc">Sort: Name (A-Z)</option>
                        <option value="name-desc">Sort: Name (Z-A)</option>
                        <option value="stock-asc">Stock: Low to High</option>
                        <option value="stock-desc">Stock: High to Low</option>
                    </select>

                    <div className="relative flex-1 sm:w-64">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            value={tableFilter}
                            onChange={e => { setTableFilter(e.target.value); setDisplayedCount(15); }}
                            placeholder="Filter by SKU, brand, model..."
                            className="w-full pl-9 pr-8 py-2 text-xs border border-stone-200 rounded-xl bg-stone-50 focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner font-medium"
                        />
                        {tableFilter && (
                            <button
                                onClick={() => { setTableFilter(''); setDisplayedCount(15); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* SEARCH SUMMARY */}
            {searchSummary?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Matched:</span>
                    {searchSummary.map(group => (
                        <div key={group.label} className="flex items-center gap-2 px-3 py-1 bg-white border border-stone-200 rounded-full shadow-sm text-xs">
                            <span className="font-bold text-stone-800">{group.label}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800" title="Current Qty">{group.totalQty} in stock</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-mono" title="Unsold Value">{formatPHP(group.totalValue)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* TABLE CONTAINER */}
            <div
                ref={tableContainerRef}
                onScroll={handleScroll}
                className="overflow-auto bg-white border border-stone-200 rounded-2xl shadow-sm relative min-h-[420px]"
            >
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100 shadow-sm z-10 text-xs uppercase tracking-wider text-zinc-500 font-bold border-b border-stone-200">
                        <tr>
                            <th className="px-5 py-4">SKU</th>
                            <th className="px-5 py-4">Brand</th>
                            <th className="px-5 py-4">Name</th>
                            <th className="px-5 py-4">Color</th>
                            <th className="px-5 py-4">Variant</th>
                            <th className="px-5 py-4">Supplier</th>
                            <th className="px-5 py-4">Type</th>
                            <th className="px-5 py-4 text-right">Price</th>
                            <th className="px-5 py-4 text-right">Total Value</th>
                            <th className="px-5 py-4 text-right">Status / Tracking</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-sm">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 10 }).map((_, j) => (
                                        <td key={j} className="px-5 py-4">
                                            <div className="h-4 bg-stone-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : visibleData.length > 0 ? (
                            visibleData.map(row => (
                                <tr key={row.variantId} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-5 py-4 font-mono font-medium text-zinc-600 text-xs">{row.sku}</td>
                                    <td className="px-5 py-4 font-bold text-zinc-900">{row.brand}</td>
                                    <td className="px-5 py-4 text-zinc-700">{row.name}</td>
                                    <td className="px-5 py-4 text-zinc-600">{row.color}</td>
                                    <td className="px-5 py-4 text-zinc-600">{row.variantDetails}</td>
                                    <td className="px-5 py-4">
                                        {row.defaultSupplier ? (
                                            <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                                                <Building2 size={10} /> {row.defaultSupplier.name}
                                            </span>
                                        ) : <span className="text-zinc-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-5 py-4">
                                        {row.category === 'Paddles'
                                            ? row.consigned
                                                ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-bold">Consigned</span>
                                                : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">Owned</span>
                                            : <span className="text-zinc-400 text-xs">{row.category}</span>
                                        }
                                    </td>
                                    <td className="px-5 py-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                                        {formatPHP(row.sellingPrice)}
                                    </td>
                                    <td className="px-5 py-4 text-right font-black text-emerald-800 whitespace-nowrap">
                                        {formatPHP((row.sellingPrice || 0) * (row.quantity || 0))}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`text-base font-black leading-none flex items-center gap-2 ${row.isOutOfStock ? 'text-red-600' : row.isLowStock ? 'text-amber-600' : 'text-zinc-900'}`}>
                                                {row.isLowStock && !row.isOutOfStock && <AlertTriangle size={14} className="text-amber-500" />}
                                                {row.isOutOfStock && <PackageX size={14} className="text-red-500" />}
                                                {row.quantity ?? 0} stock{(row.quantity ?? 0) !== 1 ? 's' : ''} left
                                            </span>

                                            {/* Live Location Breakdown Pills (Warehouse vs Branches) */}
                                            {row.locationBreakdown && row.locationBreakdown.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap justify-end max-w-[240px]">
                                                    {row.locationBreakdown.map((loc, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                                                                loc.isMain
                                                                    ? 'bg-stone-100 text-stone-700'
                                                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            }`}
                                                            title={`${loc.branchName}: ${loc.quantity} unsold units`}
                                                        >
                                                            <Building2 size={9} className="opacity-60" />
                                                            <span>{loc.isMain ? 'Admin (Unallocated)' : loc.branchName}:</span>
                                                            <strong className="font-black">{loc.quantity}</strong>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                    {row.totalSold} sold
                                                </span>
                                                <span className="text-[10px] text-zinc-300">/</span>
                                                <span className="text-[10px] font-bold text-zinc-400 bg-stone-100 px-1.5 py-0.5 rounded">
                                                    {row.totalAdded} total
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="10" className="px-6 py-12 text-center text-zinc-500 border-dashed border-t">
                                    No products match the current filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* -------- Stat card subcomponent (aesthetic rounded-2xl variant) -------- */
const StatCard = (props) => {
    const { label, primary, secondary, accent = 'zinc', loading, active, onClick } = props;
    const Icon = props.Icon;
    const accentMap = {
        zinc:    { border: 'border-stone-200',  text: 'text-zinc-900',   ic: 'text-zinc-500',   bg: 'bg-stone-50',   gradient: 'from-stone-400 to-stone-600', ringA: 'ring-zinc-900' },
        emerald: { border: 'border-emerald-100', text: 'text-emerald-700', ic: 'text-emerald-600', bg: 'bg-emerald-50', gradient: 'from-emerald-400 to-emerald-600', ringA: 'ring-emerald-500' },
        indigo:  { border: 'border-indigo-100',  text: 'text-indigo-700',  ic: 'text-indigo-600',  bg: 'bg-indigo-50',  gradient: 'from-indigo-400 to-indigo-600', ringA: 'ring-indigo-500' },
        amber:   { border: 'border-amber-100',   text: 'text-amber-700',   ic: 'text-amber-600',   bg: 'bg-amber-50',   gradient: 'from-amber-400 to-amber-600', ringA: 'ring-amber-500' },
        red:     { border: 'border-red-100',     text: 'text-rose-700',     ic: 'text-rose-600',     bg: 'bg-rose-50',     gradient: 'from-rose-400 to-rose-600', ringA: 'ring-rose-500' },
    };
    const c = accentMap[accent] || accentMap.zinc;
    const isClickable = !!onClick;
    return (
        <div
            onClick={onClick}
            className={`relative overflow-hidden bg-white border ${c.border} rounded-2xl p-4 shadow-sm hover:shadow-md transition-all ${isClickable ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${active ? `ring-2 ${c.ringA}` : ''}`}
        >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${c.gradient} rounded-t-2xl`} />
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{label}</span>
                <div className={`p-1.5 rounded-xl ${c.bg}`}>
                    <Icon size={14} className={c.ic} />
                </div>
            </div>
            {loading ? (
                <div className="h-6 bg-stone-100 rounded-lg animate-pulse w-2/3" />
            ) : (
                <div className={`text-xl font-black tracking-tight ${c.text} truncate`}>{primary}</div>
            )}
            <p className="text-[11px] font-medium text-zinc-400 mt-0.5 truncate">{secondary}</p>
        </div>
    );
};

export default Inventory;
