import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Debugging hook to check router availability
    // Check Login Status & Fetch Profile
    const checkAuth = useCallback(async () => {
        console.log("[AuthContext] checkAuth: Checking login status...");
        try {
            // Try fetching the full profile directly which serves as auth check + data
            const res = await api.get("/Profile/UserProfile/");
            console.log("[AuthContext] checkAuth: User profile fetched:", res.data);

            setUser(res.data);
            await SecureStore.setItemAsync("Logged", "true");
        } catch (err) {
            console.log("[AuthContext] checkAuth: Not logged in or session expired:", err.message);
            setUser(null);
            await SecureStore.setItemAsync("Logged", "false");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);


    // Rename loginWithEmail -> login to align with LoginScreen.jsx
    const login = async (email) => {
        setError('');
        console.log(`[AuthContext] login called with: ${email}`);
        try {
            console.log(`[AuthContext] Sending POST to /users/Login_SignUp/`);
            const res = await api.post('/users/Login_SignUp/', { email });
            console.log("[AuthContext] Login API response:", res.data);

            // Navigate to Verify
            const ctx = {
                key: res.data.key,
                id: res.data.id?.toString(),
                status: res.data.status,
                email: email
            };

            // Store context if needed for persistence across hard reloads
            // await SecureStore.setItemAsync('otp_ctx', JSON.stringify(ctx));

            // Note: Components like LoginScreen might handle navigation themselves using the return value.
            // But we can also push here if we are using expo-router exclusively.
            // Since LoginScreen uses navigation.navigate('Verify'), we can return data and let it handle UI.
            // IF we want to use router.push, do it here. 
            // Current LoginScreen uses: navigation.navigate('Verify', { ...data })

            return res.data;
        } catch (err) {
            console.error("[AuthContext] Login failed:", err);
            const msg = err.response?.data?.error || 'Login failed. Please check your email or try again.';
            setError(msg);
            throw err;
        }
    };

    const googleLogin = async (token) => {
        setError('');
        console.log("[AuthContext] googleLogin with token");
        try {
            const res = await api.post("/users/google/", { token });
            console.log("[AuthContext] Google login success:", res.data);

            if (res.data.status === 'New User') {
                // Use router if available, or return logic
                // router.push({ pathname: '/form', ... });
                return { status: 'New User' };
            } else {
                await checkAuth();
                // router.replace('/');
            }
        } catch (err) {
            console.error("Google login error:", err);
            setError(err.response?.data?.detail || "Google login failed on our server.");
            throw err;
        }
    };

    const verifyOtp = async (key, id, otp, status) => {
        setError('');
        console.log(`[AuthContext] verifyOtp: ${otp}`);
        try {
            const payload = { key, id, otp };
            await api.post('/users/otp-verify/', payload);

            await checkAuth();

            if (status === 'New User') {
                // Return status so component can navigate to ProcessForm
                // router.replace({ pathname: '/form', ... });
                return { status: 'New User' };
            } else {
                // State update handles redirect to Home
                // router.replace('/');
            }
        } catch (err) {
            console.error('[AuthContext] OTP verify failed:', err);
            const msg = err?.response?.data?.error || 'Verification failed. Try again.';
            setError(msg);
            throw err;
        }
    };

    const resendOtp = async (key, id) => {
        console.log("[AuthContext] Resending OTP...");
        try {
            const res = await api.post('/users/resend-otp/', { key, id });
            console.log("[AuthContext] Resend success:", res.data);
            return res.data;
        } catch (err) {
            console.error('[AuthContext] Resend failed:', err);
            throw err;
        }
    };

    const logout = async () => {
        console.log("[AuthContext] Logging out...");
        try {
            await api.post('/users/logout/');
        } catch (err) {
            console.error('[AuthContext] Logout failed on server:', err);
        } finally {
            setUser(null);
            await SecureStore.deleteItemAsync("Logged");
            await SecureStore.deleteItemAsync("otp_ctx");
            // router.replace('/login'); // Removed: State change handles navigation
        }
    };
    const isAuthenticated = loading ? null : !!user;

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            isAuthenticated,
            checkAuth,
            profile: user, // Alias user as profile for Dashboard usage
            login,
            googleLogin,
            verifyOtp,
            resendOtp,
            logout,
            setError
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
