import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import { Routes, Route, Link, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useStockSync } from '../useStockSync';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    PackagePlus,
    Boxes,
    History,
    TrendingUp,
    ShoppingCart,
    Loader2,
    Receipt,
    ClipboardList,
    Building2,
    Truck,
    BarChart2,
    Tablet,
    Users,
    Activity,
    Store,
    ShieldCheck,
    LogOut,
    ChevronDown,
    MapPin,
    User,
    DollarSign,
    CreditCard
} from 'lucide-react';

// Main Page Components
const Inventory = lazy(() => import('./Inventory'));
const AddProduct = lazy(() => import('./AddProduct'));
const AddBranchStock = lazy(() => import('./AddBranchStock'));
const OrderPage = lazy(() => import('./OrderPage'));
const OrderHistory = lazy(() => import('./OrderHistory'));
const Analytics = lazy(() => import('./Analytics'));
const Expenses = lazy(() => import('./Expenses'));
const ManageInventory = lazy(() => import('./ManageInventory'));
const Supplies = lazy(() => import('./Supplies'));
const Suppliers = lazy(() => import('./Suppliers'));
const ProductSales = lazy(() => import('./ProductSales'));
const BranchSales = lazy(() => import('./BranchSales'));
const ConsigneesPage = lazy(() => import('./ConsigneesPage'));
const Reporting = lazy(() => import('./Reporting'));
const BranchesAdmin = lazy(() => import('./BranchesAdmin'));
const AccountsAdmin = lazy(() => import('./AccountsAdmin'));

// New Overhaul Components
const BranchDetail = lazy(() => import('./BranchDetail'));
const BranchPrices = lazy(() => import('./BranchPrices'));
const BranchDues = lazy(() => import('./BranchDues'));
const BranchAnalytics = lazy(() => import('./BranchAnalytics'));

const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAdmin, isBranch, selectedBranchId, setSelectedBranchId, currentBranchId } = useAuth();

    // Branch list for Admin dropdown
    const [branchList, setBranchList] = useState([]);
    useEffect(() => {
        if (isAdmin) {
            axios.get('/api/admin/branches')
                .then(res => setBranchList(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error('Failed to load branches for selector:', err));
        }
    }, [isAdmin]);

    // ─── SINGLE SHARED DATA FETCH ────────────────────────────────────────────
    const [products, setProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(true);

    const fetchProducts = useCallback(() => {
        setLoadingProducts(true);
        const url = currentBranchId ? `/api/products?branchId=${currentBranchId}` : `/api/products`;
        axios.get(url)
            .then(res => setProducts(Array.isArray(res.data) ? res.data : []))
            .catch(err => {
                console.error('Failed to load products:', err);
                setProducts([]);
            })
            .finally(() => setLoadingProducts(false));
    }, [currentBranchId]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    // ─── WEBSOCKET REAL-TIME SYNC ─────────────────────────────────────────────
    const { wsConnected } = useStockSync(fetchProducts);

    // Navigation Sections with Category Headers
    const navSections = isBranch
        ? [
            {
                title: 'Store Operations',
                items: [
                    { name: 'POS System',        path: '/orders',           icon: ShoppingCart },
                    { name: 'Analytics',         path: '/branch-analytics', icon: TrendingUp },
                ]
            },
            {
                title: 'Inventory & Pricing',
                items: [
                    { name: 'Current Inventory', path: '/inventory',        icon: Boxes },
                    { name: 'Set Prices',        path: '/branch-prices',    icon: DollarSign },
                    { name: 'Consignees',        path: '/consignees',       icon: Users },
                ]
            },
            {
                title: 'Payments & Records',
                items: [
                    { name: 'My Dues',           path: '/branch-dues',      icon: CreditCard },
                    { name: 'Order History',     path: '/history',          icon: History },
                ]
            }
        ]
        : [
            {
                title: 'Store Operations',
                items: [
                    { name: 'POS System',       path: '/orders',           icon: ShoppingCart },
                    { name: 'Branch Sales',     path: '/branch-sales',     icon: TrendingUp },
                    { name: 'Product Sales',    path: '/product-sales',    icon: BarChart2 },
                ]
            },
            {
                title: 'Inventory & Supplies',
                items: [
                    { name: 'Add Products',     path: '/add-product',      icon: PackagePlus },
                    { name: 'View Inventory',   path: '/inventory',        icon: Boxes },
                    { name: 'Master Inventory', path: '/manage-inventory', icon: ClipboardList },
                    { name: 'Supplies',         path: '/supplies',         icon: Truck },
                    { name: 'Suppliers',        path: '/suppliers',        icon: Building2 },
                ]
            },
            {
                title: 'Financials & Reports',
                items: [
                    { name: 'Order History',    path: '/history',          icon: History },
                    { name: 'Reporting',        path: '/reporting',        icon: Activity },
                    { name: 'Analytics',        path: '/analytics',        icon: TrendingUp },
                    { name: 'Expenses',         path: '/expenses',         icon: Receipt },
                ]
            },
            {
                title: 'System & Users',
                items: [
                    { name: 'Consignees',       path: '/consignees',       icon: Users },
                    { name: 'Branches',         path: '/branches',         icon: Store },
                    { name: 'User Accounts',    path: '/accounts',         icon: ShieldCheck },
                ]
            }
        ];

    const navItems = navSections.flatMap(s => s.items);
    const currentTab = navItems.find(item => location.pathname.startsWith(item.path))?.name || 'Dashboard';

    return (
        <div className="flex h-screen bg-[#F8F7F4] font-sans text-brand-black overflow-hidden">

            {/* --- LEFT SIDEBAR (LUXURY OBSIDIAN & ANIMATED) --- */}
            <aside className="w-68 bg-[#0d0e12] text-stone-300 flex flex-col shadow-[4px_0_30px_rgba(0,0,0,0.25)] z-20 border-r border-stone-800/80 shrink-0 select-none">
                {/* Brand Header */}
                <div className="p-6 text-center border-b border-stone-800/60 flex flex-col items-center relative overflow-hidden">
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                    
                    <div className="relative group cursor-pointer mb-3">
                        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500/30 to-amber-500/30 blur-sm group-hover:blur-md transition-all duration-300 opacity-70 group-hover:opacity-100" />
                        <img
                            src="/logo.png"
                            alt="Cebu Pickleball Market Logo"
                            onError={(e) => { e.target.style.display = 'none'; }}
                            className="relative w-20 h-20 rounded-full brightness-105 shadow-xl border-2 border-stone-700/60 object-cover transform transition-transform duration-300 group-hover:scale-105"
                        />
                    </div>

                    <h1 className="text-lg tracking-wider text-white uppercase leading-tight font-black">
                        Cebu PICKLEBALL
                        <span className="block text-[11px] text-emerald-400 mt-0.5 tracking-widest font-black uppercase">
                            Market Online
                        </span>
                    </h1>

                    {/* Role / Branch Tag with Live Glow Indicator */}
                    <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-stone-900/90 text-stone-200 border border-stone-800 shadow-inner">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="truncate max-w-[140px]">
                            {isBranch ? (user?.branchName || 'Assigned Branch') : 'Central Admin'}
                        </span>
                    </div>
                </div>

                {/* Navigation Sections */}
                <nav className="flex-1 px-3.5 py-4 space-y-5 overflow-y-auto custom-scrollbar">
                    {navSections.map((sec, sIdx) => (
                        <div key={sec.title} className="space-y-1">
                            <div className="px-3 text-[10px] font-black uppercase tracking-widest text-stone-300 flex items-center justify-between">
                                <span>{sec.title}</span>
                                <span className="h-px bg-stone-800/80 flex-1 ml-2.5" />
                            </div>

                            <div className="space-y-1 pt-1">
                                {sec.items.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname.startsWith(item.path);
                                    return (
                                        <Link
                                            key={item.name}
                                            to={item.path}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                                                isActive
                                                    ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent text-white font-black border-l-4 border-emerald-400 shadow-sm'
                                                    : 'text-stone-400 hover:text-white hover:bg-white/[0.06] font-bold hover:translate-x-1'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`p-1 rounded-lg transition-all duration-200 ${
                                                    isActive ? 'text-emerald-400' : 'text-stone-500 group-hover:text-stone-200 group-hover:scale-110'
                                                }`}>
                                                    <Icon size={17} />
                                                </div>
                                                <span className="text-xs truncate tracking-wide">{item.name}</span>
                                            </div>

                                            {isActive && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                {/* Footer User Info & Logout Card */}
                <div className="p-3.5 border-t border-stone-800/80 bg-[#0a0b0e]">
                    <div className="p-2.5 bg-stone-900/90 border border-stone-800/90 rounded-2xl flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center font-black text-xs shadow-md shrink-0">
                                {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-xs font-black text-white truncate leading-tight">
                                    {user?.username}
                                </div>
                                <div className="text-[10px] text-stone-400 truncate font-semibold mt-0.5">
                                    {isBranch ? user?.branchName : 'Master Admin'}
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={logout}
                            title="Sign Out"
                            className="p-2 text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all duration-200 cursor-pointer hover:scale-110"
                        >
                            <LogOut size={16} />
                        </button>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#F8F7F4]">
                <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 px-8 py-3.5 flex flex-wrap justify-between items-center z-10 shadow-sm relative gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-stone-900 text-white rounded-xl shadow-sm">
                            <LayoutDashboard size={18} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-stone-900 tracking-tight leading-none">{currentTab}</h2>
                            <p className="text-[11px] text-stone-400 font-bold mt-1 uppercase tracking-wider">
                                {isBranch ? (user?.branchName || 'Branch Terminal') : 'Central Hub Management'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3.5 flex-wrap">
                        {/* Admin Branch Selector */}
                        {isAdmin && (
                            <div className="flex items-center gap-2 bg-white border border-stone-200 px-3 py-1.5 rounded-xl shadow-sm hover:border-stone-300 transition-colors">
                                <MapPin size={14} className="text-emerald-600" />
                                <span className="text-xs font-black text-stone-400 uppercase tracking-wider text-[10px]">Filter Branch:</span>
                                <select
                                    value={selectedBranchId || ''}
                                    onChange={(e) => setSelectedBranchId(e.target.value ? Number(e.target.value) : null)}
                                    className="bg-transparent text-xs font-black text-stone-900 focus:outline-none cursor-pointer"
                                >
                                    <option value="">Consolidated View (All Branches)</option>
                                    {branchList
                                        .filter(b => b.active && (b.name == null || !b.name.toLowerCase().includes('warehouse')))
                                        .map((b) => (
                                            <option key={b.id} value={b.id}>
                                                🏬 {b.name}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}

                        {/* Branch User Store Indicator */}
                        {isBranch && (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-xl text-xs font-black text-emerald-800 shadow-sm">
                                <Store size={14} className="text-emerald-600" />
                                <span>{user?.branchName || 'Assigned Branch'}</span>
                            </div>
                        )}

                        {/* Sync Status Badges */}
                        {loadingProducts && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full shadow-sm">
                                <Loader2 size={12} className="animate-spin text-amber-600" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-amber-700">Syncing</span>
                            </div>
                        )}
                        {!loadingProducts && wsConnected && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full shadow-sm">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700">Live Sync</span>
                            </div>
                        )}
                        {!loadingProducts && !wsConnected && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-full shadow-sm">
                                <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                                <span className="text-[11px] font-black uppercase tracking-wider text-rose-700">Offline</span>
                            </div>
                        )}

                        <button
                            onClick={() => navigate('/tablet')}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 cursor-pointer"
                        >
                            <Tablet size={13} />
                            Tablet Mode
                        </button>
                    </div>
                </header>

                {/* ── ROUTED VIEWS ── */}
                <div className="flex-1 overflow-hidden bg-[#F7F6F0]">
                    <div
                        key={location.pathname + (currentBranchId || 'all')}
                        className="h-full flex flex-col p-8 pb-12 w-full mx-auto min-h-0 overflow-y-auto custom-scrollbar"
                        style={{ animation: 'pageSlideIn 280ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
                    >
                        <Suspense fallback={<div className="h-full w-full flex justify-center items-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>}>
                            <Routes>
                                <Route path="/" element={<Navigate to="/orders" replace />} />
                                <Route path="/orders" element={<OrderPage products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                                
                                {isAdmin ? (
                                    <>
                                        <Route path="/add-stock" element={<AddBranchStock products={products} refetchProducts={fetchProducts} />} />
                                        <Route path="/add-product" element={<AddProduct onProductAdded={fetchProducts} />} />
                                        <Route path="/inventory" element={<Inventory products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                                        <Route path="/manage-inventory" element={<ManageInventory products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                                        <Route path="/supplies" element={<Supplies />} />
                                        <Route path="/suppliers" element={<Suppliers />} />
                                        <Route path="/branch-sales" element={<BranchSales />} />
                                        <Route path="/product-sales" element={<ProductSales products={products} />} />
                                        <Route path="/history" element={<OrderHistory />} />
                                        <Route path="/consignees" element={<ConsigneesPage />} />
                                        <Route path="/reporting" element={<Reporting />} />
                                        <Route path="/analytics" element={<Analytics />} />
                                        <Route path="/expenses" element={<Expenses />} />
                                        <Route path="/branches" element={<BranchesAdmin />} />
                                        <Route path="/branches/:branchId" element={<BranchDetail />} />
                                        <Route path="/accounts" element={<AccountsAdmin />} />
                                    </>
                                ) : (
                                    <>
                                        <Route path="/inventory" element={<Inventory products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                                        <Route path="/branch-prices" element={<BranchPrices products={products} refetchProducts={fetchProducts} />} />
                                        <Route path="/branch-dues" element={<BranchDues />} />
                                        <Route path="/branch-analytics" element={<BranchAnalytics />} />
                                        <Route path="/history" element={<OrderHistory />} />
                                        <Route path="/consignees" element={<ConsigneesPage />} />
                                        {/* Fallback for unauthorized branch routes */}
                                        <Route path="*" element={<Navigate to="/orders" replace />} />
                                    </>
                                )}
                            </Routes>
                        </Suspense>
                    </div>
                </div>
            </main>

            <style>{`
                @keyframes pageSlideIn {
                    0%   { opacity: 0; transform: translateY(-8px) scale(0.99); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;