import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const OTPScreen = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { checkAuth } = useAuth();

    // Destructure params passed from Login Page
    const { email, key, id, status } = route.params || {};

    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [timer, setTimer] = useState(3);
    const [canResend, setCanResend] = useState(false);
    const otpInputRef = useRef(null);
    useEffect(() => {
        // Small delay to ensure the screen is fully mounted before opening keyboard
        const timer = setTimeout(() => {
            otpInputRef.current?.focus();
        }, 500);
        return () => clearTimeout(timer);
    }, []);
    // Timer Logic
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
        } else {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleVerify = async () => {
        console.log("OTPScreen: handleVerify pressed", { otp, email });
        if (!otp || otp.length < 6) {
            Alert.alert("Invalid OTP", "Please enter a valid 6-digit OTP.");
            return;
        }

        setLoading(true);
        try {
            // 1. Verify OTP
            console.log("OTPScreen: Sending verification request...");
            // Adjust URL based on your specific backend route for verification
            // Common pattern: /users/verify_otp/ or similar. 
            // Based on your web app logic, we send the key and otp.

            const response = await api.post('/users/otp-verify/', {
                id: id,
                otp: otp,
                key: key
            });
            console.log("OTPScreen: Verification successful", response.data);

            // 2. Handle Success
            if (response.status === 200 || response.status === 201) {

                if (status === 'New User') {
                    // Navigate to the ProcessForm if new
                    console.log("New User verified. Navigate to ProcessForm.");
                    navigation.replace('ProcessForm', { email, id });
                } else {
                    await checkAuth();
                    // Navigation is handled automatically by App.js when isAuthenticated becomes true
                }
            }
        } catch (error) {
            console.error("OTPScreen: Verification error", error);
            const errorMsg = error.response?.data?.error || "Verification failed.";
            Alert.alert("Error", errorMsg);
            setOtp(''); // Clear OTP so they can rewrite from scratch
            otpInputRef.current?.focus(); // Refocus the input
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setLoading(true);
        try {
            // Call your resend API here with both email and id
            const payload = { email };
            if (id) {
                payload.id = id;
            }
            console.log("OTPScreen: Resending OTP with payload:", payload);
            await api.post('/users/resend-otp/', payload);

            setTimer(60);
            setCanResend(false);
            Alert.alert("Success", "OTP has been resent to your email.");
        } catch (error) {
            console.error("OTPScreen: Resend error", error);
            const errorMsg = error.response?.data?.error || "Failed to resend OTP. Try again later.";
            Alert.alert("Error", errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                className="flex-1"
            >
                {/* Header */}
                <View className="flex-row items-center p-4 border-b border-gray-100">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-lg font-bold text-gray-900 mr-10">
                        OTP Verification
                    </Text>
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
                    <View className="items-center mt-8">
                        <Text className="text-3xl font-bold text-gray-900 mb-2 text-center">
                            {status === 'New User' ? 'Welcome to Mechanic Setu' : 'Welcome Back!'}
                        </Text>
                        <Text className="text-lg font-medium text-gray-600 mb-6 text-center">
                            OTP Verification
                        </Text>

                        <Text className="text-gray-500 text-center mb-8 px-8">
                            We have sent a verification code to {"\n"}
                            <Text className="font-bold text-gray-900">{email}</Text>
                        </Text>
                    </View>

                    <View className="flex-1 px-6 pt-10 items-center">

                        {/* OTP Inputs */}
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => otpInputRef.current?.focus()} // Force focus when tapping anywhere in the area
                            className="relative flex-row justify-between w-full mb-8 px-2"
                        >
                            {/* Display Boxes */}
                            {Array(6).fill().map((_, i) => (
                                <View
                                    key={i}
                                    className={`w-11 h-14 rounded-xl border items-center justify-center ${otp[i]
                                        ? 'border-gray-900 bg-gray-50'
                                        : 'border-gray-300 bg-white'
                                        }`}
                                >
                                    <Text className="text-gray-900 text-xl font-bold">
                                        {otp[i]}
                                    </Text>
                                </View>
                            ))}

                            {/* Hidden Input Layer */}
                            <TextInput
                                ref={otpInputRef} // Attach the ref
                                value={otp}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/[^0-9]/g, '');
                                    if (cleaned.length <= 6) {
                                        setOtp(cleaned); // Allow rewriting/updating state
                                    }
                                }}
                                maxLength={6}
                                keyboardType="number-pad"
                                caretHidden={true}
                                selectionColor="transparent" // Hide the selection highlight
                                style={{
                                    position: 'absolute',
                                    width: '100%',
                                    height: '100%',
                                    opacity: 0, // Keep it invisible but functional
                                    fontSize: 1, // Minimize visual impact on some devices
                                }}
                                autoFocus={true}
                            />
                        </TouchableOpacity>

                        {/* Resend Timer */}
                        <View className="mb-10">
                            {canResend ? (
                                <TouchableOpacity onPress={handleResend}>
                                    <Text className="text-blue-600 font-bold text-base">Resend Code</Text>
                                </TouchableOpacity>
                            ) : (
                                <Text className="text-gray-400 text-base">
                                    Resend Code in <Text className="text-gray-600 font-medium">{timer}s</Text>
                                </Text>
                            )}
                        </View>

                        {/* Verify Button */}
                        <TouchableOpacity
                            onPress={handleVerify}
                            disabled={loading}
                            className={`w-full py-4 rounded-xl items-center shadow-sm ${loading ? 'bg-gray-400' : 'bg-gray-900'}`}
                        >
                            <Text className="text-white font-bold text-lg tracking-wide">
                                {loading ? 'Verifying...' : 'Verify'}
                            </Text>
                        </TouchableOpacity>

                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default OTPScreen;
