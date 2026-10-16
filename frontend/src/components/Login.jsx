import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import pickleballImg from '../assets/pickleball.png';

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
        <div
            className="login-page min-h-screen w-full bg-[#F4F2EC] flex items-center justify-center p-6 md:p-12 lg:p-16 select-none overflow-hidden relative font-montserrat"
        >
            {/* Subtle background ambient highlights */}
            <div className="absolute -top-32 -left-32 w-96 h-96 bg-stone-200/50 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-stone-300/40 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-7xl h-full flex flex-col lg:flex-row items-center justify-between gap-12 lg:gap-16 z-10">
                {/* ─── LEFT: BRANDING WITH WAVE BOUNCE ANIMATION ─── */}
                <div className="w-full lg:w-1/2 flex flex-col justify-center items-center lg:items-start text-center lg:text-left pl-0 lg:pl-8">
                    {/* "welcome to" subtitle in Montserrat */}
                    <span
                        style={{ fontFamily: "'Montserrat', sans-serif" }}
                        className="text-stone-800 text-lg sm:text-xl md:text-2xl font-medium tracking-tight block mb-1 lowercase"
                    >
                        welcome to
                    </span>

                    {/* Wordmark: "c p m ." with realistic pickleball strictly in line with m */}
                    <div className="font-black text-stone-900 tracking-tighter cursor-default text-[95px] sm:text-[135px] md:text-[160px] lg:text-[185px] leading-none select-none text-center lg:text-left whitespace-nowrap">
                        {/* Letter 'c' */}
                        <span className="inline-block wave-letter wave-c transform origin-bottom hover:scale-105 transition-transform">
                            c
                        </span>

                        {/* Letter 'p' */}
                        <span className="inline-block wave-letter wave-p transform origin-bottom hover:scale-105 transition-transform">
                            p
                        </span>

                        {/* Letter 'm' */}
                        <span className="inline-block wave-letter wave-m transform origin-bottom hover:scale-105 transition-transform">
                            m
                        </span>

                        {/* Realistic Pickleball locked to the exact bottom of m */}
                        <span
                            className="inline-block wave-letter wave-ball transform origin-bottom ml-1.5 sm:ml-2.5"
                            style={{
                                verticalAlign: 'baseline',
                            }}
                        >
                            <img
                                src={pickleballImg}
                                alt="Pickleball dot"
                                className="w-8 h-8 sm:w-11 sm:h-11 md:w-14 md:h-14 lg:w-16 lg:h-16 inline-block select-none pointer-events-none translate-y-1 sm:translate-y-1.5"
                            />
                        </span>
                    </div>
                </div>

                {/* ─── RIGHT: WHITE ROUNDED CARD FOR LOGIN DETAILS ─── */}
                <div className="w-full lg:w-[480px] shrink-0">
                    <div className="bg-white rounded-[36px] sm:rounded-[44px] p-8 sm:p-10 md:p-12 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.08)] border border-stone-200/90 relative">
                        {/* Header inside card */}
                        <div className="mb-7">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200/80 mb-3 shadow-xs">
                                <ShieldCheck size={13} className="text-emerald-600" />
                                Staff & Branch Login
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
                                Sign In
                            </h2>
                            <p className="text-xs sm:text-sm text-stone-500 mt-1 font-medium">
                                Enter your credentials to access store operations
                            </p>
                        </div>

                        {/* Error Alert Message */}
                        {error && (
                            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-shake">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-1.5 shrink-0" />
                                <span className="leading-relaxed">{error}</span>
                            </div>
                        )}

                        {/* Login Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Username Input */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5 ml-1">
                                    Username
                                </label>
                                <div className="relative">
                                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="Enter your username"
                                        autoComplete="username"
                                        className="w-full pl-11 pr-4 py-3.5 bg-stone-50/80 focus:bg-white border border-stone-200 focus:border-stone-900 rounded-2xl text-sm font-semibold text-stone-900 placeholder-stone-400 shadow-xs focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-700 mb-1.5 ml-1">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        className="w-full pl-11 pr-11 py-3.5 bg-stone-50/80 focus:bg-white border border-stone-200 focus:border-stone-900 rounded-2xl text-sm font-semibold text-stone-900 placeholder-stone-400 shadow-xs focus:outline-none transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 transition-colors p-1"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full mt-4 py-4 px-6 rounded-2xl bg-stone-900 hover:bg-black text-white font-bold text-xs uppercase tracking-widest shadow-md hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin text-white" />
                                        <span>Authenticating…</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In to Terminal</span>
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* ─── WAVE BOUNCE CSS ANIMATION STYLES ─── */}
            <style>{`
                /* Enforce Montserrat across all login elements including headings & inputs */
                .login-page, .login-page * {
                    font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                }

                /* Wave letter bounce keyframes */
                @keyframes letterWaveBounce {
                    0%, 100% {
                        transform: translateY(0) scale(1, 1);
                    }
                    5% {
                        transform: translateY(2px) scale(1.05, 0.95);
                    }
                    11% {
                        transform: translateY(-42px) scale(0.94, 1.06);
                    }
                    17% {
                        transform: translateY(0) scale(1.09, 0.91);
                    }
                    21% {
                        transform: translateY(-10px) scale(0.98, 1.02);
                    }
                    25% {
                        transform: translateY(0) scale(1, 1);
                    }
                    30%, 100% {
                        transform: translateY(0) scale(1, 1);
                    }
                }

                /* Realistic Pickleball bounce keyframes: strictly in line with m, clean vertical bounce & squash */
                @keyframes ballWaveBounce {
                    0%, 100% {
                        transform: translateY(0) scale(1, 1);
                    }
                    5% {
                        transform: translateY(2px) scale(1.08, 0.92);
                    }
                    11% {
                        transform: translateY(-42px) scale(0.94, 1.06);
                    }
                    17% {
                        transform: translateY(0) scale(1.12, 0.88);
                    }
                    21% {
                        transform: translateY(-10px) scale(0.97, 1.03);
                    }
                    25% {
                        transform: translateY(0) scale(1.02, 0.98);
                    }
                    28%, 100% {
                        transform: translateY(0) scale(1, 1);
                    }
                }

                /* Animation assignments with staggered wave delay on 2.6s loop */
                .wave-letter {
                    display: inline-block;
                    animation-duration: 2.6s;
                    animation-iteration-count: infinite;
                    animation-timing-function: cubic-bezier(0.28, 0.84, 0.42, 1);
                }

                .wave-c {
                    animation-name: letterWaveBounce;
                    animation-delay: 0s;
                }

                .wave-p {
                    animation-name: letterWaveBounce;
                    animation-delay: 0.22s;
                }

                .wave-m {
                    animation-name: letterWaveBounce;
                    animation-delay: 0.44s;
                }

                .wave-ball {
                    animation-name: ballWaveBounce;
                    animation-delay: 0.66s;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    20%, 60% { transform: translateX(-4px); }
                    40%, 80% { transform: translateX(4px); }
                }
                .animate-shake {
                    animation: shake 350ms ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default Login;
