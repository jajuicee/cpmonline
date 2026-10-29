import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

// Immediately configure axios headers if token exists in localStorage
const initialToken = localStorage.getItem('cpm_token');
if (initialToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

// Request interceptor to always attach current token
axios.interceptors.request.use((config) => {
    const t = localStorage.getItem('cpm_token');
    if (t) {
        config.headers.Authorization = `Bearer ${t}`;
    }
    return config;
}, (error) => Promise.reject(error));

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => localStorage.getItem('cpm_token') || null);
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('cpm_user');
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });
    // For admin to filter views globally: null = All Branches, or branchId number
    const [selectedBranchId, setSelectedBranchId] = useState(() => {
        try {
            const s = sessionStorage.getItem('cpm_selected_branch');
            return s ? Number(s) : null;
        } catch {
            return null;
        }
    });

    const setAndPersistSelectedBranchId = (id) => {
        setSelectedBranchId(id);
        try {
            if (id != null) {
                sessionStorage.setItem('cpm_selected_branch', String(id));
            } else {
                sessionStorage.removeItem('cpm_selected_branch');
            }
        } catch {}
    };
    const [loading, setLoading] = useState(true);

    // Synchronize Axios default header and interceptors
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Setup global response interceptor for 401 handling
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    const isLoginReq = error.config && error.config.url && (error.config.url.includes('/api/auth/login') || error.config.url.includes('/api/auth/me'));
                    if (!isLoginReq) {
                        logout();
                    }
                }
                return Promise.reject(error);
            }
        );
        return () => axios.interceptors.response.eject(interceptor);
    }, []);

    // Validate token on mount
    useEffect(() => {
        const checkAuth = async () => {
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await axios.get('/api/auth/me');
                if (res.data) {
                    const updatedUser = {
                        username: res.data.username,
                        role: res.data.role,
                        branchId: res.data.branchId,
                        branchName: res.data.branchName,
                    };
                    setUser(updatedUser);
                    localStorage.setItem('cpm_user', JSON.stringify(updatedUser));
                }
            } catch (err) {
                console.warn('Session expired or invalid token:', err);
                logout();
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, [token]);

    const login = async (username, password) => {
        const res = await axios.post('/api/auth/login', { username, password });
        const { token: jwtToken, username: uname, role, branchId, branchName } = res.data;
        const userInfo = { username: uname, role, branchId, branchName };

        localStorage.setItem('cpm_token', jwtToken);
        localStorage.setItem('cpm_user', JSON.stringify(userInfo));

        setToken(jwtToken);
        setUser(userInfo);
        axios.defaults.headers.common['Authorization'] = `Bearer ${jwtToken}`;
        return userInfo;
    };

    const logout = () => {
        localStorage.removeItem('cpm_token');
        localStorage.removeItem('cpm_user');
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common['Authorization'];
    };

    const isAuthenticated = !!token && !!user;
    const isAdmin = user?.role === 'ADMIN';
    const isBranch = user?.role === 'BRANCH';
    const isCashier = user?.role === 'CASHIER';

    // The effective branch ID:
    // If branch user or cashier, always their own branchId.
    // If admin, whatever branch they currently selected (or null for consolidated).
    const currentBranchId = (isBranch || isCashier) ? user?.branchId : selectedBranchId;

    return (
        <AuthContext.Provider
            value={{
                token,
                user,
                loading,
                login,
                logout,
                isAuthenticated,
                isAdmin,
                isBranch,
                isCashier,
                selectedBranchId,
                setSelectedBranchId: setAndPersistSelectedBranchId,
                currentBranchId,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
