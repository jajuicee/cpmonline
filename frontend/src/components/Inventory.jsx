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
        <div className="w-full space-y-2.5 min-w-0">
            {/* Header / Branch Info Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-700">
                        <Store size={14} />
                        <span>{user?.branchName || 'Live Inventory'}</span>
                    </div>
                    <h1 className="text-lg font-black text-stone-900 tracking-tight mt-0.5">
                        Current Inventory & Stock Health
                    </h1>
                    <p className="text-[11px] text-stone-500 font-medium">
                        Real-time physical stock counts, variants, and valuation across all merchandise categories.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetchProducts && refetchProducts()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="Refresh current inventory"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        <span>Refresh Stocks</span>
                    </button>
                </div>
            </div>

            {/* STAT CARDS (Aesthetic 5-Card Grid) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
                <StatCard
                    Icon={Boxes}
                    label="Total Units"
                    primary={stats.totalUnits}
                    secondary={stats.branchUnits > 0 ? `${stats.warehouseUnits} unallocated · ${stats.branchUnits} in branches` : `${stats.totalSkus} active SKUs`}
                    loading={loading}
                />
                <StatCard Icon={Coins} label="Inventory Value" primary={loading ? '—' : formatPHP(stats.value)} secondary="valuation at selling price" accent="emerald" loading={loading} />
                <StatCard Icon={AlertTriangle} label="Low Stock" primary={stats.lowStock} secondary={`≤ ${DEFAULT_LOW_STOCK_THRESHOLD} units warning`} accent="amber" loading={loading}
                    active={stockFilter === 'low'} onClick={() => { setStockFilter(stockFilter === 'low' ? 'all' : 'low'); setDisplayedCount(15); }} />
                <StatCard Icon={PackageX} label="Out of Stock" primary={stats.outOfStock} secondary="critical zero stock" accent="red" loading={loading}
                    active={stockFilter === 'out'} onClick={() => { setStockFilter(stockFilter === 'out' ? 'all' : 'out'); setDisplayedCount(15); }} />
                <StatCard Icon={Tag} label="Consigned Stock" primary={stats.consignedUnits} secondary="items on consignment" accent="indigo" loading={loading} />
            </div>

            {/* CONTROLS BAR: CATEGORIES, SORT, SEARCH */}
            <div className="bg-white p-2 px-3 rounded-xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2">
                {/* Category Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 md:pb-0 no-scrollbar">
                    {['All', 'Paddles', 'Accessories', 'Balls', 'Apparel', 'Shoes', 'Bags'].map(cat => (
                        <button
                            key={cat}
                            onClick={() => { setCategoryFilter(cat); setDisplayedCount(15); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                categoryFilter === cat 
                                    ? 'bg-stone-900 text-white shadow-sm font-black' 
                                    : 'bg-stone-100 hover:bg-stone-200 text-stone-600'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-stone-200 rounded-lg focus:outline-none focus:border-stone-900 bg-stone-50 font-bold text-stone-700 shadow-inner cursor-pointer"
                    >
                        <option value="name-asc">Sort: Name (A-Z)</option>
                        <option value="name-desc">Sort: Name (Z-A)</option>
                        <option value="stock-asc">Stock: Low to High</option>
                        <option value="stock-desc">Stock: High to Low</option>
                    </select>

                    <div className="relative flex-1 sm:w-56">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            value={tableFilter}
                            onChange={e => { setTableFilter(e.target.value); setDisplayedCount(15); }}
                            placeholder="Filter by SKU, brand, model..."
                            className="w-full pl-8 pr-7 py-1 text-xs border border-stone-200 rounded-lg bg-stone-50 focus:outline-none focus:border-stone-900 focus:bg-white transition-all shadow-inner font-medium"
                        />
                        {tableFilter && (
                            <button
                                onClick={() => { setTableFilter(''); setDisplayedCount(15); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* SEARCH SUMMARY */}
            {searchSummary?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-0.5">
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Matched:</span>
                    {searchSummary.map(group => (
                        <div key={group.label} className="flex items-center gap-1.5 px-2.5 py-0.5 bg-white border border-stone-200 rounded-full shadow-sm text-xs">
                            <span className="font-bold text-stone-800">{group.label}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800" title="Current Qty">{group.totalQty} in stock</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-mono" title="Unsold Value">{formatPHP(group.totalValue)}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* TABLE CONTAINER */}
            <div
                ref={tableContainerRef}
                onScroll={handleScroll}
                className="overflow-auto bg-white border border-stone-200 rounded-xl shadow-sm relative min-h-[350px]"
            >
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-stone-100 shadow-sm z-10 text-[11px] uppercase tracking-wider text-zinc-600 font-black border-b border-stone-200">
                        <tr>
                            <th className="px-3 py-2">SKU</th>
                            <th className="px-3 py-2">Brand</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Color</th>
                            <th className="px-3 py-2">Variant</th>
                            <th className="px-3 py-2">Supplier</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2 text-right">Price</th>
                            <th className="px-3 py-2 text-right">Total Value</th>
                            <th className="px-3 py-2 text-right">Status / Tracking</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 text-xs">
                        {loading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    {Array.from({ length: 10 }).map((_, j) => (
                                        <td key={j} className="px-3 py-2">
                                            <div className="h-3.5 bg-stone-200 rounded w-3/4" />
                                        </td>
                                    ))}
                                </tr>
                            ))
                        ) : visibleData.length > 0 ? (
                            visibleData.map(row => (
                                <tr key={row.variantId} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-3 py-2 font-mono font-bold text-zinc-600 text-xs">{row.sku}</td>
                                    <td className="px-3 py-2 font-black text-zinc-900">{row.brand}</td>
                                    <td className="px-3 py-2 font-bold text-zinc-800">{row.name}</td>
                                    <td className="px-3 py-2 text-zinc-600">{row.color}</td>
                                    <td className="px-3 py-2 text-zinc-600">{row.variantDetails}</td>
                                    <td className="px-3 py-2">
                                        {row.defaultSupplier ? (
                                            <span className="inline-flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md text-[11px] font-bold w-fit">
                                                <Building2 size={10} /> {row.defaultSupplier.name}
                                            </span>
                                        ) : <span className="text-zinc-300 text-xs">—</span>}
                                    </td>
                                    <td className="px-3 py-2">
                                        {row.category === 'Paddles'
                                            ? row.consigned
                                                ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-amber-200">Consigned</span>
                                                : <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-200">Owned</span>
                                            : <span className="text-zinc-400 text-xs font-medium">{row.category}</span>
                                        }
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-emerald-700 whitespace-nowrap">
                                        {formatPHP(row.sellingPrice)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-black text-emerald-800 whitespace-nowrap">
                                        {formatPHP((row.sellingPrice || 0) * (row.quantity || 0))}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`text-xs font-black flex items-center gap-1 ${row.isOutOfStock ? 'text-red-600' : row.isLowStock ? 'text-amber-600' : 'text-zinc-900'}`}>
                                                    {row.isLowStock && !row.isOutOfStock && <AlertTriangle size={12} className="text-amber-500" />}
                                                    {row.isOutOfStock && <PackageX size={12} className="text-red-500" />}
                                                    {row.quantity ?? 0} left
                                                </span>
                                                {row.totalSold > 0 && (
                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                                                        {row.totalSold} sold
                                                    </span>
                                                )}
                                            </div>

                                            {/* Live Location Breakdown */}
                                            {row.locationBreakdown && row.locationBreakdown.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap justify-end max-w-[280px]">
                                                    {row.locationBreakdown.map((loc, idx) => (
                                                        <span
                                                            key={idx}
                                                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 ${
                                                                loc.isMain
                                                                    ? 'bg-stone-100 text-stone-700 border border-stone-200'
                                                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            }`}
                                                            title={`${loc.branchName}: ${loc.quantity} unsold units`}
                                                        >
                                                            <span>{loc.isMain ? 'Admin' : loc.branchName}:</span>
                                                            <strong className="font-black">{loc.quantity}</strong>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="10" className="px-6 py-10 text-center text-zinc-500 border-dashed border-t text-xs">
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

/* -------- Stat card subcomponent (aesthetic rounded-xl variant) -------- */
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
            className={`relative overflow-hidden bg-white border ${c.border} rounded-xl p-2.5 shadow-sm hover:shadow-md transition-all ${isClickable ? 'cursor-pointer hover:-translate-y-0.5' : ''} ${active ? `ring-2 ${c.ringA}` : ''}`}
        >
            <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${c.gradient} rounded-t-xl`} />
            <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-400">{label}</span>
                <div className={`p-1 rounded-lg ${c.bg}`}>
                    <Icon size={12} className={c.ic} />
                </div>
            </div>
            {loading ? (
                <div className="h-5 bg-stone-100 rounded animate-pulse w-2/3" />
            ) : (
                <div className={`text-lg font-black tracking-tight ${c.text} truncate`}>{primary}</div>
            )}
            <p className="text-[10px] font-medium text-zinc-400 mt-0.5 truncate">{secondary}</p>
        </div>
    );
};

export default Inventory;
