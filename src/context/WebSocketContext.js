import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import api, { API_URL } from '../utils/api';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const useWebSocket = () => useContext(WebSocketContext);

// Exponential backoff delays in milliseconds
const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 30000]; // 1s, 2s, 5s, 10s, 30s
const MAX_BACKOFF_INDEX = BACKOFF_DELAYS.length - 1;

export const WebSocketProvider = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [queueSize, setQueueSize] = useState(0);
    const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);
    const ws = useRef(null);
    const appState = useRef(AppState.currentState);
    const reconnectInterval = useRef(null);
    const reconnectTimeout = useRef(null);
    const reconnectAttempt = useRef(0);
    const messageQueue = useRef([]);
    const isReconnecting = useRef(false);
    const isMounted = useRef(false);
    const heartbeatInterval = useRef(null); // For periodic heartbeat
    const activeJobId = useRef(null); // Use ref instead of state to avoid closure issues

    // Track mounted state
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    // Function to send a message (with automatic queuing if offline)
    const sendMessage = useCallback((message) => {
        const messageData = typeof message === 'string' ? message : JSON.stringify(message);

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            // Connection is open, send immediately
            try {
                ws.current.send(messageData);
                console.log('%c[WS-PROVIDER] Message sent:', 'color: #00CED1;', messageData);
                return true;
            } catch (error) {
                console.error('[WS-PROVIDER] Error sending message:', error);
                // Queue the message if send fails
                messageQueue.current.push(messageData);
                if (isMounted.current) {
                    setQueueSize(messageQueue.current.length);
                }
                console.log('%c[WS-PROVIDER] Message queued (send failed):', 'color: #FFA500;', messageData);
                return false;
            }
        } else {
            // Connection not open, queue the message
            messageQueue.current.push(messageData);
            if (isMounted.current) {
                setQueueSize(messageQueue.current.length);
            }
            console.log('%c[WS-PROVIDER] Message queued (offline):', 'color: #FFA500;', messageData);
            console.log(`[WS-PROVIDER] Queue size: ${messageQueue.current.length}`);
            return false;
        }
    }, []);

    // Function to flush the message queue
    const flushMessageQueue = useCallback(() => {
        if (messageQueue.current.length > 0 && ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log(`%c[WS-PROVIDER] Flushing ${messageQueue.current.length} queued messages...`, 'color: #32CD32; font-weight: bold;');

            const queueCopy = [...messageQueue.current];
            messageQueue.current = [];
            if (isMounted.current) {
                setQueueSize(0);
            }

            queueCopy.forEach((message, index) => {
                try {
                    ws.current.send(message);
                    console.log(`%c[WS-PROVIDER] Sent queued message ${index + 1}/${queueCopy.length}:`, 'color: #32CD32;', message);
                } catch (error) {
                    console.error(`[WS-PROVIDER] Failed to send queued message ${index + 1}:`, error);
                    // Re-queue failed messages
                    messageQueue.current.push(message);
                    if (isMounted.current) {
                        setQueueSize(messageQueue.current.length);
                    }
                }
            });
        }
    }, []);

    // Function to set active job ID
    const setActiveJobId = useCallback((jobId) => {
        activeJobId.current = jobId;
        console.log('[WS-PROVIDER] Active job ID updated:', jobId);
    }, []);

    // Exponential backoff reconnect
    const scheduleReconnect = useCallback(() => {
        if (!isAuthenticated || isReconnecting.current) return;

        const delay = BACKOFF_DELAYS[Math.min(reconnectAttempt.current, MAX_BACKOFF_INDEX)];
        console.log(`%c[WS-PROVIDER] Scheduling reconnect attempt ${reconnectAttempt.current + 1} in ${delay}ms...`, 'color: #FF6347;');

        reconnectTimeout.current = setTimeout(() => {
            reconnectAttempt.current += 1;
            if (isMounted.current) {
                setReconnectAttemptCount(reconnectAttempt.current);
            }
            connect();
        }, delay);
    }, [isAuthenticated]);

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

        // Set reconnecting flag
        isReconnecting.current = true;
        setConnectionStatus('connecting');
        console.log(`%c[WS-PROVIDER] Starting connection for User: ${user?.email || 'Unknown'} (Attempt: ${reconnectAttempt.current + 1})`, 'color: #8A2BE2;');

        try {
            // 1. Get One-Time Token for WS Auth
            const res = await api.get("/core/ws-token/");
            const wsToken = res.data.ws_token;

            if (!wsToken) throw new Error("Failed to get WebSocket token");

            // 2. Determine WebSocket URL
            let wsHost = API_URL.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');
            const wsScheme = API_URL.startsWith('https') ? 'wss' : 'ws';
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
                if (!isMounted.current) return;

                setConnectionStatus('connected');
                setSocket(ws.current);
                isReconnecting.current = false;

                // Reset reconnect attempt counter on successful connection
                reconnectAttempt.current = 0;
                setReconnectAttemptCount(0);

                // Start periodic heartbeat (every 25 seconds)
                if (heartbeatInterval.current) {
                    clearInterval(heartbeatInterval.current);
                }

                heartbeatInterval.current = setInterval(() => {
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                        try {
                            const heartbeatMessage = JSON.stringify({
                                type: 'user_heartbeat',
                                timestamp: Date.now(),
                                job_id: activeJobId.current // Include active job ID if available
                            });
                            ws.current.send(heartbeatMessage);
                            console.log('%c[WS-PROVIDER] 💓 Heartbeat sent:', 'color: #3b82f6;', { job_id: activeJobId.current });
                        } catch (err) {
                            console.error('[WS-PROVIDER] Failed to send heartbeat:', err);
                        }
                    }
                }, 25000); // Every 25 seconds

                // Flush any queued messages
                flushMessageQueue();
            };

            ws.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // ENHANCED LOGGING: Show all message details
                    console.log('%c╔════════════════════════════════════════════════════════════╗', 'color: #22c55e; font-weight: bold;');
                    console.log('%c║  [WS-PROVIDER] 📨 MESSAGE RECEIVED', 'color: #22c55e; font-weight: bold;');
                    console.log('%c╠════════════════════════════════════════════════════════════╣', 'color: #22c55e;');
                    console.log('%c║  Type:', 'color: #22c55e;', data.type);
                    console.log('%c║  Request ID:', 'color: #22c55e;', data.request_id);
                    console.log('%c║  Job ID:', 'color: #22c55e;', data.job_id);
                    console.log('%c║  Timestamp:', 'color: #22c55e;', new Date().toLocaleTimeString());
                    console.log('%c║  Full Data:', 'color: #22c55e;', data);
                    console.log('%c╚════════════════════════════════════════════════════════════╝', 'color: #22c55e; font-weight: bold;');

                    if (isMounted.current) {
                        setLastMessage(data);
                    }
                } catch (e) {
                    console.warn('[WS-PROVIDER] Received non-JSON message:', event.data);
                }
            };

            ws.current.onclose = (event) => {
                console.warn(`[WS-PROVIDER] ==> Disconnected. Code: ${event.code}, Reason: ${event.reason}`);
                if (isMounted.current) {
                    setConnectionStatus('disconnected');
                    setSocket(null);
                }
                isReconnecting.current = false;

                // Only auto-reconnect if not a normal closure and user is authenticated
                if (event.code !== 1000 && isAuthenticated) {
                    scheduleReconnect();
                }
            };

            ws.current.onerror = (error) => {
                console.error('[WS-PROVIDER] ==> An error occurred:', error.message);
                if (isMounted.current) {
                    setConnectionStatus('error');
                }
            };

        } catch (error) {
            console.error('[WS-PROVIDER] ==> Connection setup failed:', error);
            setConnectionStatus('error');
            isReconnecting.current = false;

            // Schedule reconnect on error
            if (isAuthenticated) {
                scheduleReconnect();
            }
        }
    }, [isAuthenticated, user, flushMessageQueue, scheduleReconnect]);

    // 1. Monitor Auth State & Connect/Disconnect
    useEffect(() => {
        if (isAuthenticated) {
            connect();
        } else {
            // Clear any pending reconnect attempts
            if (reconnectTimeout.current) {
                clearTimeout(reconnectTimeout.current);
                reconnectTimeout.current = null;
            }
            reconnectAttempt.current = 0;
            if (isMounted.current) {
                setReconnectAttemptCount(0);
            }

            if (ws.current) {
                console.log('[WS-PROVIDER] User logged out. Closing WebSocket.');
                ws.current.close(1000, "User logged out");
                ws.current = null;
                if (isMounted.current) {
                    setConnectionStatus('disconnected');
                }
            }

            // Clear message queue on logout
            if (messageQueue.current.length > 0) {
                console.log(`[WS-PROVIDER] Clearing ${messageQueue.current.length} queued messages due to logout.`);
                messageQueue.current = [];
                if (isMounted.current) {
                    setQueueSize(0);
                }
            }
        }
    }, [isAuthenticated, connect]);

    // 2. Periodic Re-connection (3-5 mins) to refresh token
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
                // Reset attempt counter for planned reconnect
                reconnectAttempt.current = 0;
                if (isMounted.current) {
                    setReconnectAttemptCount(0);
                }
                setTimeout(() => connect(), 500);
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
                    // Reset attempt counter when app comes to foreground
                    reconnectAttempt.current = 0;
                    if (isMounted.current) {
                        setReconnectAttemptCount(0);
                    }
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
            if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
            if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);

            if (ws.current) {
                console.log('[WS-PROVIDER] Provider unmounting. Closing WebSocket.');
                ws.current.close(1000, "Provider unmounted");
                ws.current = null;
            }
        };
    }, []);

    const value = useMemo(() => ({
        socket,
        lastMessage,
        connectionStatus,
        sendMessage,
        queueSize,
        reconnectAttempt: reconnectAttemptCount,
        setActiveJobId // Expose function to update active job ID
    }), [socket, lastMessage, connectionStatus, sendMessage, queueSize, reconnectAttemptCount, setActiveJobId]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};
