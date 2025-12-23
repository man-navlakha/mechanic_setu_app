import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'https://mechanic-setu.onrender.com/api';

const api = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
});

// Flags to avoid loops
let isRefreshing = false;
let refreshSubscribers = [];

// Retry queued requests after refresh
function onRefreshed() {
    refreshSubscribers.forEach((cb) => cb());
    refreshSubscribers = [];
}

function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}

// Request Interceptor: Logging
api.interceptors.request.use(
    async (config) => {
        console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);

        // Add debugger breakpoint if needed
        // debugger; 

        // Optional: If you need to attach token manually from Store
        // const token = await SecureStore.getItemAsync('token');
        // if (token) config.headers.Authorization = `Bearer ${token}`;

        return config;
    },
    (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
    }
);

// Response Interceptor: Handling Refreshes & Logging
api.interceptors.response.use(
    (response) => {
        console.log(`[API Response] ${response.status} ${response.config.url}`, response.data);
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        console.warn(`[API Error] ${error.response?.status} ${originalRequest?.url}`, error.response?.data);

        // Prevent infinite loop if refresh request itself fails
        // Note: ensure the URL path matches your backend
        const isRefreshRequest = originalRequest?.url?.includes('/token/refresh/');

        if (
            error.response?.status === 401 &&
            !originalRequest?._retry &&
            !isRefreshRequest
        ) {
            if (isRefreshing) {
                return new Promise((resolve) => {
                    subscribeTokenRefresh(() => resolve(api(originalRequest)));
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                console.log("Attempting to refresh token...");
                await axios.post(`${BASE_URL}/core/token/refresh/`, {}, { withCredentials: true });
                console.log("Token refresh successful.");

                isRefreshing = false;
                onRefreshed();

                // Simulating Cookies.set("Logged", true)
                await SecureStore.setItemAsync("Logged", "true");

                return api(originalRequest);
            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
                isRefreshing = false;

                // Clear logged status
                await SecureStore.setItemAsync("Logged", "false");
                await SecureStore.deleteItemAsync("otp_ctx");

                // Redirect only if not already on login page
                // Expo Router doesn't give synchronous access to current path easily outside of hooks,
                // but we can force navigation to login.
                // Redirect logic handled by AuthContext or Main Navigation state
                // router.replace('/login');

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
