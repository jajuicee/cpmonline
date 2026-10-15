import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = () => {
    const { login, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // If already logged in, redirect
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username.trim() || !password) {
            setError('Please enter both username and password.');
            return;
        }

        setLoading(true);
        try {
            await login(username.trim(), password);
            navigate('/', { replace: true });
        } catch (err) {
            console.error('Login error:', err);
            if (!err.response) {
                setError('Cannot connect to backend server. Please ensure the backend is active.');
            } else if (err.response.status === 401) {
                setError(err.response.data?.error || 'Invalid username or password. Please try again.');
            } else {
                setError(err.response.data?.error || `Server error (${err.response.status}). Please try again.`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#0d0f12] text-white relative overflow-hidden px-4 font-sans selection:bg-emerald-500 selection:text-black">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-15%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-15%] right-[-10%] w-[550px] h-[550px] rounded-full bg-amber-500/10 blur-[140px] pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center mb-4 relative group">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-amber-500/20 border border-white/10 p-1 flex items-center justify-center shadow-2xl backdrop-blur-md group-hover:scale-105 transition-transform duration-300">
                            <img
                                src="/logo.png"
                                alt="Cebu Pickleball Market"
                                className="w-full h-full object-contain rounded-xl"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.parentNode.innerHTML = '<span class="text-3xl font-black text-emerald-400">CPM</span>';
                                }}
                            />
                        </div>
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                        Cebu Pickleball Market
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-emerald-400/90 font-bold mt-1">
                        Multi-Branch Cloud System
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-[#14171d]/80 border border-white/10 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative">
                    <div className="flex items-center gap-2 mb-6 text-xs font-bold uppercase tracking-wider text-stone-400">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span>Authorized Personnel Login</span>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium flex items-start gap-3 animate-shake">
                            <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 mb-2">
                                Username
                            </label>
                            <div className="relative">
                                <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    autoComplete="username"
                                    className="w-full bg-[#0d0f12]/90 border border-stone-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-stone-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    className="w-full bg-[#0d0f12]/90 border border-stone-800 rounded-xl pl-11 pr-11 py-3 text-sm text-white placeholder-stone-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-black font-black text-sm uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Authenticating…</span>
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-white/5 text-center">
                        <p className="text-[11px] text-stone-500 leading-relaxed">
                            Accounts are provisioned by Central Administration.<br />
                            Contact your manager for branch or staff credentials.
                        </p>
                    </div>
                </div>

                <div className="text-center mt-6 text-[11px] text-stone-600 uppercase tracking-widest font-bold">
                    Cebu Pickleball Market © 2026
                </div>
            </div>
        </div>
    );
};

export default Login;
