import { useEffect, useRef, useState, useCallback } from 'react';
import { WS_BASE } from './apiConfig';

const WS_URL = `${WS_BASE}/ws/stock`;
const RECONNECT_DELAY_MS = 3000; // wait 3s before retrying after disconnect

/**
 * useStockSync — connects to the backend WebSocket and calls `onStockUpdate`
 * whenever the server broadcasts a STOCK_UPDATE event.
 *
 * Returns `{ wsConnected }` so components can show a live connection badge.
 *
 * Features:
 *  - Auto-reconnects after disconnect / server restart
 *  - Cleans up properly on component unmount
 *  - Calls onStockUpdate immediately on connect (catches any changes during disconnect)
 */
export function useStockSync(onStockUpdate) {
    const [wsConnected, setWsConnected] = useState(false);
    const wsRef = useRef(null);
    const reconnectTimer = useRef(null);
    const isMounted = useRef(true);
    const connectRef = useRef(null);

    const connect = useCallback(() => {
        if (!isMounted.current) return;

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            if (!isMounted.current) return;
            setWsConnected(true);
            // Immediately fetch on connect — catches any changes that happened while disconnected
            if (onStockUpdate) onStockUpdate();
            clearTimeout(reconnectTimer.current);
        };

        ws.onmessage = (event) => {
            if (!isMounted.current) return;
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'STOCK_UPDATE' && onStockUpdate) {
                    onStockUpdate();
                }
            } catch {
                // Ignore malformed messages
            }
        };

        ws.onclose = () => {
            if (!isMounted.current) return;
            setWsConnected(false);
            // Schedule reconnect safely via ref to avoid TDZ / self-reference issues
            reconnectTimer.current = setTimeout(() => {
                if (isMounted.current && connectRef.current) {
                    connectRef.current();
                }
            }, RECONNECT_DELAY_MS);
        };

        ws.onerror = () => {
            // Let onclose handle reconnect
            ws.close();
        };
    }, [onStockUpdate]);

    connectRef.current = connect;

    useEffect(() => {
        isMounted.current = true;
        connect();

        return () => {
            isMounted.current = false;
            clearTimeout(reconnectTimer.current);
            if (wsRef.current) {
                wsRef.current.onclose = null; // prevent reconnect on intentional unmount
                wsRef.current.close();
            }
        };
    }, [connect]);

    return { wsConnected };
}
