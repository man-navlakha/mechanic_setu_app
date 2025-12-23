import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import api, { BASE_URL } from '../utils/api';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const ws = useRef(null);
    const appState = useRef(AppState.currentState);
    const reconnectInterval = useRef(null);

    const connect = useCallback(async () => {
        // Prevent connection if not authenticated
        if (!isAuthenticated) {
            console.log('%c[WS-PROVIDER] User not connected (No Auth). Skipping WS connection.', 'color: #ff4500;');
            return;
        }

        // Avoid double connection
        if (ws.current && (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)) {
            console.log('%c[WS-PROVIDER] WebSocket already connected or connecting.', 'color: #008000;');
            return;
        }

        setConnectionStatus('connecting');
        console.log(`%c[WS-PROVIDER] Starting connection for User: ${user?.email || 'Unknown'}`, 'color: #8A2BE2;');

        try {
            // 1. Get One-Time Token for WS Auth
            const res = await api.get("/core/ws-token/");
            const wsToken = res.data.ws_token;

            if (!wsToken) throw new Error("Failed to get WebSocket token");

            // 2. Determine WebSocket URL
            // Extract host from BASE_URL (remove protocol and /api path)
            // BASE_URL is 'https://mechanic-setu.onrender.com/api'
            let wsHost = BASE_URL.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
            const wsScheme = BASE_URL.startsWith('https') ? 'wss' : 'ws';

            // Construct URL: ws://HOST/ws/job_notifications/?token=ABC
            // Result should be: wss://mechanic-setu.onrender.com/ws/job_notifications/...
            const wsUrl = `${wsScheme}://${wsHost}/ws/job_notifications/?token=${wsToken}`;

            console.log(`[WS-PROVIDER] Connecting to: ${wsUrl}`);
            const origin = `${wsScheme === 'wss' ? 'https' : 'http'}://${wsHost}`;

            ws.current = new WebSocket(wsUrl, null, {
                headers: {
                    'Origin': origin
                }
            });

            ws.current.onopen = () => {
                console.log('%c[WS-PROVIDER] ==> Connection successful!', 'color: #008000; font-weight: bold;');
                setConnectionStatus('connected');
                setSocket(ws.current);
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('%c[WS-PROVIDER] ==> Message Received:', 'color: #eab308; font-weight: bold;', data);
                    setLastMessage(data);
                } catch (e) {
                    console.warn('[WS-PROVIDER] Received non-JSON message:', event.data);
                }
            };

            ws.current.onclose = (event) => {
                console.warn(`[WS-PROVIDER] ==> Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                setConnectionStatus('disconnected');
                setSocket(null);
            };

            ws.current.onerror = (error) => {
                console.error('[WS-PROVIDER] ==> An error occurred:', error.message);
                setConnectionStatus('error');
            };

        } catch (error) {
            console.error('[WS-PROVIDER] ==> Connection setup failed:', error);
            setConnectionStatus('error');
        }
    }, [isAuthenticated, user]);

    // 1. Monitor Auth State & Connect/Disconnect
    useEffect(() => {
        if (isAuthenticated) {
            connect();
        } else {
            if (ws.current) {
                console.log('[WS-PROVIDER] User logged out. Closing WebSocket.');
                ws.current.close(1000, "User logged out");
                ws.current = null;
                setConnectionStatus('disconnected');
            }
        }
    }, [isAuthenticated, connect]);

    // 2. Periodic Re-connection (3-5 mins)
    useEffect(() => {
        if (isAuthenticated && connectionStatus === 'connected') {
            // Clear existing interval if any
            if (reconnectInterval.current) clearInterval(reconnectInterval.current);

            // Set new interval (e.g., 4 minutes = 240000 ms)
            reconnectInterval.current = setInterval(() => {
                console.log('%c[WS-PROVIDER] Auto-reconnecting to refresh session (4 min check)...', 'color: #FF4500;');
                if (ws.current) {
                    ws.current.close(1000, "Auto-refresh");
                }
                // connect() will be called automatically? No, close updates state, but we might need to trigger connect manually or rely on some logic. 
                // Actually, easier to just call connect() after a short delay or let it handle itself.
                // Better approach: Close it. The 'onclose' handler sets status to disconnected. 
                // Then cleanly call connect() again.
                connect();
            }, 240000);

            return () => clearInterval(reconnectInterval.current);
        }
    }, [isAuthenticated, connectionStatus, connect]);

    // 3. Handle App State (Background/Foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                console.log('[WS-PROVIDER] App came to foreground. Reconnecting if needed...');
                if (isAuthenticated && (!ws.current || ws.current.readyState === WebSocket.CLOSED)) {
                    connect();
                }
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription.remove();
        };
    }, [isAuthenticated, connect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (reconnectInterval.current) clearInterval(reconnectInterval.current);
            // We consciously decide NOT to close the socket here on unmount of the Provider during dev 
            // hot-reloads to avoid "1000" disconnect spam, but locally it cleans up fine.
            // On production app kill, the OS handles it.
            if (ws.current) {
                console.log('[WS-PROVIDER] Provider unmounting. Closing WebSocket.');
                ws.current.close(1000, "Provider unmounted");
                ws.current = null;
            }
        };
    }, []);

    const value = { socket, lastMessage, connectionStatus };

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
