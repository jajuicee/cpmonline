import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import axios from 'axios';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useStockSync } from '../useStockSync';
import { useAuth } from '../context/AuthContext';
import {
    ShoppingCart,
    History,
    PackagePlus,
    Boxes,
    ClipboardList,
    Building2,
    Loader2,
    Truck,
    TrendingUp,
    Receipt,
    BarChart2,
    Monitor,
    Users,
    LogOut,
    Store,
    ShieldCheck
} from 'lucide-react';

// Main Page Components
const OrderPage = lazy(() => import('./OrderPage'));
const OrderHistory = lazy(() => import('./OrderHistory'));
const AddProduct = lazy(() => import('./AddProduct'));
const AddBranchStock = lazy(() => import('./AddBranchStock'));
const Inventory = lazy(() => import('./Inventory'));
const ManageInventory = lazy(() => import('./ManageInventory'));
const Suppliers = lazy(() => import('./Suppliers'));
const Supplies = lazy(() => import('./Supplies'));
const Analytics = lazy(() => import('./Analytics'));
const Expenses = lazy(() => import('./Expenses'));
const ProductSales = lazy(() => import('./ProductSales'));
const BranchSales = lazy(() => import('./BranchSales'));
const ConsigneesPage = lazy(() => import('./ConsigneesPage'));
const BranchesAdmin = lazy(() => import('./BranchesAdmin'));
const AccountsAdmin = lazy(() => import('./AccountsAdmin'));

const TabletLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAdmin, isBranch, currentBranchId } = useAuth();
    
    // Determine if we are under the /tablet prefix or at the root
    const isExplicitTabletPath = location.pathname.startsWith('/tablet');
    const basePath = isExplicitTabletPath ? '/tablet' : '';

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

    const navItems = isBranch
        ? [
            { name: 'POS',        path: `${basePath}/orders`,           icon: ShoppingCart },
            { name: 'Sales',      path: `${basePath}/branch-sales`,     icon: TrendingUp },
            { name: 'Add Stock',  path: `${basePath}/add-stock`,        icon: PackagePlus },
            { name: 'Inventory',  path: `${basePath}/inventory`,        icon: Boxes },
            { name: 'Consignees', path: `${basePath}/consignees`,       icon: Users },
            { name: 'History',    path: `${basePath}/history`,          icon: History },
        ]
        : [
            { name: 'POS',        path: `${basePath}/orders`,           icon: ShoppingCart },
            { name: 'History',    path: `${basePath}/history`,          icon: History },
            { name: 'Consignees', path: `${basePath}/consignees`,       icon: Users },
            { name: 'Add',        path: `${basePath}/add-product`,      icon: PackagePlus },
            { name: 'Stock',      path: `${basePath}/inventory`,        icon: Boxes },
            { name: 'Master Inv', path: `${basePath}/manage-inventory`, icon: ClipboardList },
            { name: 'Supplies',   path: `${basePath}/supplies`,         icon: Truck },
            { name: 'Suppliers',  path: `${basePath}/suppliers`,        icon: Building2 },
            { name: 'Branch Sales', path: `${basePath}/branch-sales`,   icon: TrendingUp },
            { name: 'Product Sales', path: `${basePath}/product-sales`, icon: BarChart2 },
            { name: 'Analytics',  path: `${basePath}/analytics`,        icon: TrendingUp },
            { name: 'Expenses',   path: `${basePath}/expenses`,         icon: Receipt },
        ];

    const currentTab = navItems.find(item => location.pathname.startsWith(item.path))?.name || 'POS System';

    // Redirect root paths to orders
    useEffect(() => {
        if (location.pathname === (basePath || '/') || location.pathname === (basePath ? `${basePath}/` : '/')) {
            navigate(`${basePath}/orders`, { replace: true });
        }
    }, [location.pathname, navigate, basePath]);

    return (
        <div className="flex flex-col h-[100dvh] w-screen bg-[#F7F6F0] font-sans text-brand-black overflow-hidden relative">

            {/* --- TOP HEADER --- */}
            <header className="bg-white border-b border-brand-black/10 px-6 py-3.5 flex justify-between items-center z-10 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="Logo"
                        onError={(e) => { e.target.style.display = 'none'; }}
                        className="w-9 h-9 rounded-full shadow-sm border border-stone-200 object-cover"
                    />
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-black text-brand-black tracking-tight leading-none uppercase">Cebu Pickleball</h1>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-stone-900 text-white">
                                {isBranch ? (user?.branchName || 'Branch') : 'Admin'}
                            </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{currentTab}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {loadingProducts ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full">
                            <Loader2 size={12} className="animate-spin text-amber-700" />
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 hidden sm:inline-block">Syncing</span>
                        </div>
                    ) : wsConnected ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 border border-green-300 rounded-full">
                            <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse shadow-[0_0_6px_rgba(22,163,74,0.8)]"></span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-green-800 hidden sm:inline-block">Live</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 border border-red-300 rounded-full">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 hidden sm:inline-block">Offline</span>
                        </div>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-100 text-zinc-700 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-stone-200 transition-all border border-stone-200 active:scale-95 shadow-sm"
                    >
                        <Monitor size={12} />
                        <span className="hidden sm:inline">Desktop</span>
                    </button>
                    <button
                        onClick={logout}
                        title="Sign Out"
                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            {/* --- MAIN SCROLLABLE CONTENT AREA --- */}
            <main className="flex-1 min-w-0 overflow-hidden relative pb-[85px] w-full">
                <div
                    key={location.pathname}
                    className="h-full w-full min-w-0 overflow-y-auto p-4 sm:p-6"
                    style={{ animation: 'pageSlideIn 250ms ease-out both' }}
                >
                    <Suspense fallback={<div className="h-full w-full flex justify-center items-center p-12"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>}>
                        <Routes>
                            <Route path="orders"           element={<OrderPage products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                            <Route path="branch-sales"     element={<BranchSales />} />
                            <Route path="add-stock"        element={<AddBranchStock products={products} refetchProducts={fetchProducts} />} />
                            <Route path="inventory"        element={<Inventory products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                            <Route path="consignees"       element={<ConsigneesPage />} />
                            <Route path="history"          element={<OrderHistory />} />
                            
                            {isAdmin && (
                                <>
                                    <Route path="add-product"      element={<AddProduct onProductAdded={fetchProducts} />} />
                                    <Route path="manage-inventory" element={<ManageInventory products={products} loading={loadingProducts} refetchProducts={fetchProducts} />} />
                                    <Route path="supplies"         element={<Supplies />} />
                                    <Route path="suppliers"        element={<Suppliers />} />
                                    <Route path="product-sales"    element={<ProductSales products={products} />} />
                                    <Route path="analytics"        element={<Analytics />} />
                                    <Route path="expenses"         element={<Expenses />} />
                                    <Route path="branches"         element={<BranchesAdmin />} />
                                    <Route path="accounts"         element={<AccountsAdmin />} />
                                </>
                            )}
                        </Routes>
                    </Suspense>
                </div>
            </main>

            {/* --- FIXED BOTTOM NAVIGATION --- */}
            <nav className="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-xl border-t border-stone-200 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] z-50 pb-[env(safe-area-inset-bottom)]">
                <div className="flex justify-start sm:justify-around items-center px-2 py-1.5 w-full overflow-x-auto no-scrollbar scroll-smooth">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                className={`flex flex-col items-center justify-center gap-1 min-w-0 flex-1 p-1.5 rounded-xl transition-all duration-150 ${
                                    isActive ? 'text-stone-900 scale-105' : 'text-zinc-400 hover:text-zinc-600 hover:bg-stone-50'
                                }`}
                            >
                                <div className={`p-1 rounded-xl ${isActive ? 'bg-stone-900 text-white shadow-sm' : ''}`}>
                                    <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider ${isActive ? 'font-black' : 'font-bold'}`}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>

            <style>{`
                @keyframes pageSlideIn {
                    0%   { opacity: 0; transform: translateY(-8px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default TabletLayout;
