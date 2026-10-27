/**
 * Centralized API and WebSocket configuration.
 *
 * Supports:
 * 1. Cloud deployment (Vercel frontend + Render backend):
 *    Set VITE_API_URL or VITE_API_BASE_URL in Vercel environment variables:
 *    e.g. VITE_API_URL=https://your-backend.onrender.com
 *    WS_BASE automatically converts http(s):// to ws(s)://
 *
 * 2. Local development:
 *    Vite proxy (/api and /ws forwarded to http://localhost:8080)
 *
 * 3. Monolithic production:
 *    Same-origin relative paths.
 */

function normalizeHttpUrl(url) {
    if (!url) return '';
    let cleaned = url.trim().replace(/[<>\"']/g, '').replace(/\/+$/, '');
    if (!cleaned) return '';

    // Auto-fix if someone accidentally pasted a nested URL like https://<https://...>.onrender.com
    const renderMatch = cleaned.match(/([a-zA-Z0-9-]+\.onrender\.com)/);
    if (renderMatch) {
        return `https://${renderMatch[1]}`;
    }

    // If protocol was omitted by the user (e.g. cpmonline-backend.onrender.com), prepend https://
    if (!/^https?:\/\//i.test(cleaned)) {
        cleaned = `https://${cleaned}`;
    }
    return cleaned;
}

const rawEnvApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
const normalizedEnvApiUrl = normalizeHttpUrl(rawEnvApiUrl);

// If VITE_API_URL is provided, use its normalized version.
const defaultProdApiUrl = 'https://cpmonline-backend.onrender.com';
const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0');

export const API_BASE = normalizedEnvApiUrl || (isLocalhost ? '' : (import.meta.env.PROD ? defaultProdApiUrl : ''));

export const getWebSocketBaseUrl = () => {
    const rawWsUrl = (import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_WS_URL || '').trim();
    if (rawWsUrl) {
        let wsCleaned = rawWsUrl.replace(/\/+$/, '');
        if (!/^wss?:\/\//i.test(wsCleaned)) {
            wsCleaned = `wss://${wsCleaned}`;
        }
        return wsCleaned;
    }

    if (API_BASE) {
        try {
            const url = new URL(API_BASE);
            const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
            return `${wsProtocol}//${url.host}`;
        } catch (e) {
            console.error('Failed to parse API_BASE for WebSocket URL:', e);
        }
    }

    // Default to current browser origin (local dev with proxy or monolith)
    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8080';
    return `${wsProtocol}//${host}`;
};

export const WS_BASE = getWebSocketBaseUrl();

