import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Key, Lock, Eye, EyeOff, X, Check, AlertCircle, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const BranchPasswordModal = ({ isOpen, onClose, branchId: propBranchId, branchName: propBranchName }) => {
    const { user, isAdmin, isBranch, currentBranchId } = useAuth();
    const activeBranchId = propBranchId || (isBranch ? user?.branchId : currentBranchId);
    const activeBranchName = propBranchName || user?.branchName || 'Current Branch';

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        setSuccess('');
        setNewPassword('');
        setConfirmPassword('');
        fetchCurrentPassword();
    }, [isOpen, activeBranchId]);

    const fetchCurrentPassword = async () => {
        setLoading(true);
        setError('');
        try {
            const params = activeBranchId ? { branchId: activeBranchId } : {};
            const res = await axios.get('/api/branches/price-password', { params });
            if (res.data?.priceChangePassword) {
                setCurrentPassword(res.data.priceChangePassword);
            } else {
                setCurrentPassword('admin123');
            }
        } catch (err) {
            console.error('Failed to fetch price password:', err);
            // Default fallback
            setCurrentPassword('admin123');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newPassword.trim()) {
            setError('Please enter a new password.');
            return;
        }

        if (newPassword.length < 4) {
            setError('Password should be at least 4 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                newPassword: newPassword.trim(),
                branchId: activeBranchId
            };
            const res = await axios.put('/api/branches/price-password', payload);
            setCurrentPassword(newPassword.trim());
            setNewPassword('');
            setConfirmPassword('');
            setSuccess(res.data?.message || 'Password successfully updated.');
            setTimeout(() => {
                if (onClose) onClose();
            }, 1600);
        } catch (err) {
            console.error('Failed to update price password:', err);
            setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update password.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-stone-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <Key size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-black tracking-tight">Cashier Price Password</h3>
                            <p className="text-xs text-stone-400">
                                {activeBranchName} • Manager Authorization
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-stone-400 hover:text-white transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Security Notice */}
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
                        <div className="flex items-center gap-2 font-black text-amber-800">
                            <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                            <span>Cashier Mode Protection</span>
                        </div>
                        <p className="text-amber-800/90 leading-relaxed font-medium">
                            Cashiers must provide this password whenever they attempt to modify an item's selling price in Cashier POS mode.
                        </p>
                    </div>

                    {/* Current Active Password Card */}
                    <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4">
                        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block mb-1">
                            Current Active Password
                        </span>
                        {loading ? (
                            <div className="flex items-center gap-2 text-stone-500 text-xs py-1">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Loading current password...</span>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-base font-black text-stone-900 tracking-wider">
                                    {showCurrent ? currentPassword : '••••••••'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowCurrent(!showCurrent)}
                                    className="text-stone-400 hover:text-stone-700 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-stone-200/50"
                                >
                                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                    <span>{showCurrent ? 'Hide' : 'Show'}</span>
                                </button>
                            </div>
                        )}
                        <p className="text-[11px] text-stone-400 mt-1 font-medium">
                            Default system password is <span className="font-mono font-bold text-stone-600">admin123</span>
                        </p>
                    </div>

                    {/* Update Password Form */}
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                Set New Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                                    placeholder="Enter new authorization password"
                                    className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(!showNew)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
                                >
                                    {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-stone-700 mb-1.5">
                                Confirm New Password
                            </label>
                            <input
                                type={showNew ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                placeholder="Re-enter new password"
                                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl font-mono text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={15} className="shrink-0 text-rose-500" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                                <Check size={15} className="shrink-0 text-emerald-600" />
                                <span>{success}</span>
                            </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                            <button
                                type="submit"
                                disabled={saving || !newPassword}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                            >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>Save Password</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default BranchPasswordModal;
