import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    ShieldCheck,
    Store,
    Key,
    Loader2,
    X,
    AlertCircle,
    CheckCircle2,
    Lock,
    UserCheck,
    UserX
} from 'lucide-react';

const AccountsAdmin = () => {
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    const [formUsername, setFormUsername] = useState('');
    const [formPassword, setFormPassword] = useState('');
    const [formRole, setFormRole] = useState('BRANCH');
    const [formBranchId, setFormBranchId] = useState('');
    const [formActive, setFormActive] = useState(true);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, branchesRes] = await Promise.all([
                axios.get('/api/admin/users'),
                axios.get('/api/admin/branches')
            ]);
            setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
            setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
        } catch (err) {
            console.error('Failed to load accounts or branches:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleOpenModal = (user = null) => {
        setEditingUser(user);
        if (user) {
            setFormUsername(user.username || '');
            setFormPassword(''); // blank means don't change password
            setFormRole(user.role || 'BRANCH');
            setFormBranchId(user.branchId || '');
            setFormActive(user.active !== false);
        } else {
            setFormUsername('');
            setFormPassword('');
            setFormRole('BRANCH');
            setFormBranchId(branches[0]?.id || '');
            setFormActive(true);
        }
        setError('');
        setModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');

        if (!formUsername.trim()) {
            setError('Username is required.');
            return;
        }

        if (!editingUser && !formPassword) {
            setError('Password is required for new accounts.');
            return;
        }

        if (formRole === 'BRANCH' && !formBranchId) {
            setError('Please assign a branch to this branch user.');
            return;
        }

        setSaving(true);

        const payload = {
            username: formUsername.trim(),
            role: formRole,
            active: formActive,
            branchId: formRole === 'BRANCH' ? formBranchId : null
        };

        if (formPassword) {
            payload.password = formPassword;
        }

        try {
            if (editingUser) {
                await axios.put(`/api/admin/users/${editingUser.id}`, payload);
                setSuccessMessage(`Account '${formUsername}' updated successfully.`);
            } else {
                await axios.post('/api/admin/users', payload);
                setSuccessMessage(`Account '${formUsername}' created successfully.`);
            }
            setModalOpen(false);
            fetchData();
        } catch (err) {
            console.error('Failed to save user:', err);
            setError(err.response?.data?.error || 'Failed to save account.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (id, uname) => {
        if (!window.confirm(`Are you sure you want to permanently delete user '${uname}'?`)) {
            return;
        }
        try {
            await axios.delete(`/api/admin/users/${id}`);
            setSuccessMessage(`User '${uname}' removed.`);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to delete user.');
        }
    };

    const handleToggleStatus = async (user) => {
        try {
            await axios.put(`/api/admin/users/${user.id}`, {
                active: !user.active
            });
            fetchData();
        } catch (err) {
            alert('Failed to update status.');
        }
    };

    return (
        <div className="max-w-6xl mx-auto w-full space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                        <ShieldCheck size={16} />
                        <span>Security & Access Control</span>
                    </div>
                    <h1 className="text-2xl font-black text-stone-900 tracking-tight mt-1">
                        User Accounts
                    </h1>
                    <p className="text-xs text-stone-500 mt-1">
                        Manage logins for Admin and Branch personnel. Public registration is permanently disabled.
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                >
                    <Plus size={16} />
                    <span>Create Account</span>
                </button>
            </div>

            {/* Notification messages */}
            {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>{successMessage}</span>
                    </div>
                    <button onClick={() => setSuccessMessage('')} className="text-stone-400 hover:text-stone-700">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 text-stone-400 text-xs">
                        No user accounts found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="py-4 px-6">User / Login</th>
                                    <th className="py-4 px-6">Role</th>
                                    <th className="py-4 px-6">Assigned Branch</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Last Login</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                {users.map((u) => {
                                    const isAdmin = u.role === 'ADMIN';
                                    return (
                                        <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-stone-900 text-sm">
                                                    {u.username}
                                                </div>
                                                <div className="text-[10px] text-stone-400 font-mono">
                                                    ID: #{u.id}
                                                </div>
                                            </td>

                                            <td className="py-4 px-6">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                    isAdmin
                                                        ? 'bg-purple-100 text-purple-800'
                                                        : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {isAdmin ? <ShieldCheck size={12} /> : <Store size={12} />}
                                                    <span>{u.role}</span>
                                                </span>
                                            </td>

                                            <td className="py-4 px-6">
                                                {isAdmin ? (
                                                    <span className="text-stone-400 font-medium italic">
                                                        All Branches (Central Hub)
                                                    </span>
                                                ) : (
                                                    <div className="font-bold text-stone-800 flex items-center gap-1.5">
                                                        <Store size={14} className="text-emerald-600" />
                                                        <span>{u.branchName || 'Unassigned'}</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="py-4 px-6">
                                                <button
                                                    onClick={() => handleToggleStatus(u)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                                        u.active
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                    }`}
                                                    title="Click to toggle active status"
                                                >
                                                    {u.active ? <UserCheck size={12} /> : <UserX size={12} />}
                                                    <span>{u.active ? 'Active' : 'Disabled'}</span>
                                                </button>
                                            </td>

                                            <td className="py-4 px-6 text-stone-500 font-mono text-[11px]">
                                                {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                                            </td>

                                            <td className="py-4 px-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(u)}
                                                        className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                                        title="Edit user / reset password"
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u.id, u.username)}
                                                        className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Delete user"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-stone-200">
                        <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
                            <h3 className="font-black text-lg text-stone-900">
                                {editingUser ? `Edit Account: ${editingUser.username}` : 'Create New Account'}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    value={formUsername}
                                    onChange={(e) => setFormUsername(e.target.value)}
                                    placeholder="e.g. branch_lahug"
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Password {editingUser ? '(leave blank to keep current)' : '*'}
                                </label>
                                <div className="relative">
                                    <Key size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                    <input
                                        type="password"
                                        value={formPassword}
                                        onChange={(e) => setFormPassword(e.target.value)}
                                        placeholder={editingUser ? 'Leave blank to keep password' : 'Enter account password'}
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm font-medium text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                        required={!editingUser}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                    Account Role *
                                </label>
                                <select
                                    value={formRole}
                                    onChange={(e) => setFormRole(e.target.value)}
                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                >
                                    <option value="BRANCH">BRANCH (Restricted to POS, Add Inventory, Consign, Inventory)</option>
                                    <option value="ADMIN">ADMIN (Full System Access & Analytics)</option>
                                </select>
                            </div>

                            {formRole === 'BRANCH' && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                                        Assigned Branch Store *
                                    </label>
                                    <select
                                        value={formBranchId}
                                        onChange={(e) => setFormBranchId(e.target.value)}
                                        className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-stone-900 focus:outline-none focus:border-stone-900 focus:bg-white"
                                        required
                                    >
                                        <option value="">-- Select Store --</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name} {b.address ? `(${b.address})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formActive}
                                        onChange={(e) => setFormActive(e.target.checked)}
                                        className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900"
                                    />
                                    <span className="text-xs font-bold text-stone-800">Account is Active</span>
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2.5 text-stone-600 hover:text-stone-900 text-xs font-bold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {saving && <Loader2 size={14} className="animate-spin" />}
                                    <span>{editingUser ? 'Save Changes' : 'Create Account'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AccountsAdmin;
