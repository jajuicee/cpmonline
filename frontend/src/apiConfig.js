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

const envApiUrl = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').trim();
export const API_BASE = envApiUrl ? envApiUrl.replace(/\/+$/, '') : '';

export const getWebSocketBaseUrl = () => {
    const envWsUrl = (import.meta.env.VITE_WS_BASE_URL || import.meta.env.VITE_WS_URL || '').trim();
    if (envWsUrl) {
        return envWsUrl.replace(/\/+$/, '');
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
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${window.location.host}`;
};

export const WS_BASE = getWebSocketBaseUrl();

