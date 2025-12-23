import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
// import { GoogleSignin } from '@react-native-google-signin/google-signin'; // Setup later

export default function LoginScreen({ navigation }) {
    const { login, checkAuth, isAuthenticated } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    // Check session on mount
    useEffect(() => {
        const checkSession = async () => {
            console.log("LoginScreen: Mounting...");

            // Log Cookies
            try {
                const cookies = await SecureStore.getItemAsync('UserCookies');
                console.log("LoginScreen: Current Cookies in Store:", cookies);
            } catch (e) { console.log("LoginScreen: No cookies or Store error"); }

            console.log("LoginScreen: Current Auth State (isAuthenticated):", isAuthenticated);

            // Double check session (optional, as AuthProvider already does this on mount)
            // await checkAuth(); 
        };
        checkSession();
    }, [isAuthenticated]);

    // Redirect if authenticated
    useEffect(() => {
        if (isAuthenticated) {
            console.log("LoginScreen: User is authenticated. Redirecting to Home...");
            // Force navigation if the App wrapper doesn't do it automatically
            // navigation.reset... or just rely on parent. 
            // If user manually navigated BACK to login, they might be stuck unless we pop.
            if (navigation.canGoBack()) {
                navigation.goBack();
            } else {
                // If this is the root, we might need to replace.
                // Assuming 'Main' or 'Home' is the logged-in route name? 
                // Since I don't know the exact route name for Home, I'll rely on the App logic 
                // OR just console log for now as requested.
            }
        }
    }, [isAuthenticated]);

    console.log("LoginScreen: Rendering");
    const version = Constants.expoConfig?.version || '1.0.0';

    const handleEmailLogin = async () => {
        console.log("LoginScreen: handleEmailLogin pressed with", email);
        if (!email) {
            Alert.alert("Error", "Please enter your email.");
            return;
        }
        try {
            setLoading(true);
            console.log("LoginScreen: Calling login function...");
            const data = await login(email);
            console.log("LoginScreen: Login function returned", data);
            // Navigate to Verify/OTP screen passing params
            navigation.navigate('Verify', {
                key: data.key,
                id: data.id,
                status: data.status,
                email: email
            });
        } catch (err) {
            console.error("LoginScreen: Error caught", err);
            const msg = err.response?.data?.error || 'Login failed. Please try again.';
            Alert.alert("Login Failed", msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        // Placeholder: Google Login in Expo requires specific setup (expo-auth-session)
        Alert.alert("Info", "Google Login requires Google Cloud Console setup for Mobile.");
    };

    return (
        <View className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">

                    {/* Top Section - Decorative Background or spacing */}
                    <View className="h-1/3 bg-blue-50 w-full items-center justify-center rounded-b-[40px] mb-8 overflow-hidden relative">
                        {/* Abstract circles/decoration to mimic the 'grid' feel or just a nice header */}
                        <View className="absolute -top-10 -left-10 w-40 h-40 bg-blue-100 rounded-full opacity-50" />
                        <View className="absolute top-20 right-10 w-20 h-20 bg-indigo-100 rounded-full opacity-50" />
                        <View className="absolute bottom-10 -left-5 w-24 h-24 bg-blue-200 rounded-full opacity-30" />

                        {/* Logo */}
                        <View className="w-48 h-48 items-center justify-center p-2 mb-0">
                            <Image className="w-full h-full rounded-xl" source={require('../../assets/logo.png')} />
                        </View>
                        <Text className="text-3xl font-extrabold text-gray-900 text-center mb-3">
                            Mechanic Setu
                        </Text>
                    </View>

                    <View className="px-6 flex-1">

                        {/* Titles */}
                        <View className="items-center mb-8">

                            <Text className="text-xl text-gray-600 font-medium">
                                Log in or Sign up
                            </Text>
                        </View>

                        {/* Form Section */}
                        <View className="w-full space-y-6">
                            {/* Email Input */}
                            <View>
                                <TextInput
                                    placeholder="Enter your email"
                                    placeholderTextColor="#9ca3af"
                                    className="w-full px-5 py-4 bg-white rounded-xl text-gray-900 border border-gray-300 focus:border-black focus:border-2 mb-2 text-lg"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            {/* Terms Text - Placed BEFORE the button as requested */}
                            <View>
                                <Text className="text-center text-gray-500 text-xs mb-2 mt-3 leading-4">
                                    By continuing, you agree to our{' '}
                                    <Text className="underline decoration-gray-400">Terms of service</Text>
                                    {' & '}
                                    <Text className="underline decoration-gray-400">Privacy policy</Text>
                                </Text>
                            </View>

                            {/* Continue Button */}
                            <TouchableOpacity
                                onPress={handleEmailLogin}
                                disabled={loading}
                                className={`w-full py-4 rounded-xl items-center justify-center ${loading ? 'bg-gray-400' : 'bg-gray-900'} shadow-sm active:scale-95 transition-transform`}
                            >
                                <Text className="text-white font-bold text-lg tracking-wide">
                                    {loading ? 'Processing...' : 'Continue'}
                                </Text>
                            </TouchableOpacity>

                        </View>

                        {/* Google Login (Optional - Styled minimally to fit new theme) */}
                        <TouchableOpacity
                            onPress={handleGoogleLogin}
                            className="mt-4 w-full py-3 bg-white border border-gray-200 rounded-xl flex-row justify-center items-center"
                        >
                            <Text className="text-gray-700 font-semibold">Sign in with Google</Text>
                        </TouchableOpacity>

                    </View>

                    {/* Footer Section */}
                    <View className="py-6 items-center mb-12">
                        <Text className="text-gray-400 text-xs mb-1">Version {version}</Text>
                        <Text className="text-gray-400 text-xs font-semibold tracking-widest">Man 🤞 Dhruv</Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
