
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import api from "../utils/api";

const ProcessFormScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { checkAuth } = useAuth();

    // Get status and existing data passed from Login/OTP
    const { status = "Manual", email, id } = route.params || {};

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        phone: "",
    });
    const [errors, setErrors] = useState({});

    // --- FORM NAVIGATION ---
    const nextStep = () => {
        if (validateCurrentStep()) {
            setStep(step + 1);
        }
    };

    const prevStep = () => {
        setStep(step - 1);
    };

    // --- VALIDATION LOGIC ---
    const validateCurrentStep = () => {
        let newErrors = {};
        if (step === 1) {
            if (!formData.firstName) newErrors.firstName = "First name is required";
            if (!formData.lastName) newErrors.lastName = "Last name is required";
        } else if (step === 2) {
            if (!formData.phone) newErrors.phone = "Phone number is required";
            if (formData.phone.length < 10) newErrors.phone = "Enter a valid phone number";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        setLoading(true);
        setErrors({});

        const payload = {
            id: id,
            first_name: status === "Google" ? null : formData.firstName,
            last_name: status === "Google" ? null : formData.lastName,
            // Ensure +91 format
            mobile_number: formData.phone.startsWith('+91') ? formData.phone : `+91${formData.phone}`,
            profile_pic: null
        };

        try {
            console.log("ProcessForm: Submitting...", payload);
            const res = await api.post("/users/SetUsersDetail/", payload);
            console.log("Saved user details:", res.data);

            // Move to success step
            setStep((s) => s + 1);

            // Wait a bit, then checkAuth (which should log the user in and move to Dashboard)
            setTimeout(async () => {
                await checkAuth();
            }, 2000);

        } catch (err) {
            console.error("Save failed:", err);
            if (err.response) {
                console.log("Save Error Data:", JSON.stringify(err.response.data, null, 2));
                console.log("Save Error Status:", err.response.status);
            }
            const msg = err.response?.data?.detail || "Failed to save details. Try again.";
            Alert.alert("Error", msg);
        } finally {
            setLoading(false);
        }
    };

    // --- MODERN PROGRESS BAR ---
    const ProgressBar = ({ currentStep }) => {
        const steps = ["Personal", "Contact", "Review"];
        return (
            <View className="mb-10 px-4">
                <View className="flex-row justify-between items-center relative">
                    {/* Background Line */}
                    <View className="absolute left-0 right-0 h-1 bg-gray-100 rounded-full top-[14px]" />

                    {steps.map((stepLabel, index) => {
                        const stepNum = index + 1;
                        const isActive = currentStep >= stepNum;
                        return (
                            <View key={index} className="items-center z-10 w-20">
                                <View
                                    className={`w-8 h-8 items-center justify-center rounded-full border-4 ${isActive
                                            ? "bg-gray-900 border-gray-900"
                                            : "bg-white border-gray-200"
                                        }`}
                                >
                                    {isActive ? (
                                        <View className="w-2 h-2 rounded-full bg-white" />
                                    ) : null}
                                </View>
                                <Text className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-gray-900" : "text-gray-300"
                                    }`}>
                                    {stepLabel}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    // --- RENDER STEPS ---
    const renderContent = () => {
        if (step === 4) {
            return (
                <View className="items-center justify-center py-10">
                    <View className="w-24 h-24 bg-green-50 rounded-full items-center justify-center mb-6">
                        <Ionicons name="checkmark-sharp" size={48} color="#16a34a" />
                    </View>
                    <Text className="text-3xl font-bold text-gray-900 mb-2">All Set!</Text>
                    <Text className="text-gray-500 text-center px-8">Your profile has been created successfully. Taking you to the dashboard...</Text>
                    <ActivityIndicator size="large" color="#111827" className="mt-8" />
                </View>
            );
        }

        // Google Flow
        if (status === "Google") {
            return (
                <View className="space-y-6 pt-4">
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 bg-blue-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="phone-portrait-outline" size={32} color="#2563eb" />
                        </View>
                        <Text className="text-2xl font-bold text-gray-900 text-center">One Last Thing</Text>
                        <Text className="text-gray-500 text-center px-6">We need your mobile number to connect you with mechanics nearby.</Text>
                    </View>

                    <View>
                        <Text className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">Phone Number</Text>
                        <View className="flex-row items-center border border-gray-200 rounded-xl bg-gray-50 focus:border-gray-900 focus:bg-white overflow-hidden h-14">
                            <View className="pl-4 pr-3 border-r border-gray-200 h-full justify-center items-center bg-gray-100">
                                <Text className="text-gray-500 font-bold">+91</Text>
                            </View>
                            <TextInput
                                value={formData.phone}
                                onChangeText={(text) => {
                                    const cleaned = text.replace(/[^0-9]/g, '');
                                    if (cleaned.length <= 10) setFormData({ ...formData, phone: cleaned });
                                }}
                                placeholder="98765 43210"
                                placeholderTextColor="#9ca3af"
                                keyboardType="number-pad"
                                maxLength={10}
                                className="flex-1 px-4 text-lg text-gray-900 font-medium h-full"
                            />
                        </View>
                        {errors.phone && <Text className="text-red-500 text-sm mt-1 ml-1">{errors.phone}</Text>}
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        className="w-full py-4 bg-gray-900 rounded-xl items-center shadow-lg shadow-gray-200 mt-4 active:scale-95 transition-transform"
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Complete Setup</Text>}
                    </TouchableOpacity>
                </View>
            )
        }

        // Standard Flow
        switch (step) {
            case 1:
                return (
                    <View className="space-y-6">
                        <View className="items-center mb-4">
                            <Text className="text-2xl font-bold text-gray-900">Personal Details</Text>
                            <Text className="text-gray-500">Let's get to know you better</Text>
                        </View>

                        <View>
                            <Text className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">First Name</Text>
                            <TextInput
                                value={formData.firstName}
                                onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                                className="w-full px-4 py-4 bg-gray-50 rounded-xl text-gray-900 border border-gray-200 focus:border-black focus:bg-white text-lg font-medium"
                                placeholder="e.g. Rahul"
                                placeholderTextColor="#9ca3af"
                            />
                            {errors.firstName && <Text className="text-red-500 text-sm mt-1 ml-1">{errors.firstName}</Text>}
                        </View>
                        <View>
                            <Text className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">Last Name</Text>
                            <TextInput
                                value={formData.lastName}
                                onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                                className="w-full px-4 py-4 bg-gray-50 rounded-xl text-gray-900 border border-gray-200 focus:border-black focus:bg-white text-lg font-medium"
                                placeholder="e.g. Sharma"
                                placeholderTextColor="#9ca3af"
                            />
                            {errors.lastName && <Text className="text-red-500 text-sm mt-1 ml-1">{errors.lastName}</Text>}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View className="space-y-6">
                        <View className="items-center mb-4">
                            <Text className="text-2xl font-bold text-gray-900">Contact</Text>
                            <Text className="text-gray-500">Your number is used for OTP verification</Text>
                        </View>

                        <View>
                            <Text className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 ml-1">Phone Number</Text>
                            <View className="flex-row items-center border border-gray-200 rounded-xl bg-gray-50 focus:border-gray-900 focus:bg-white overflow-hidden h-14">
                                <View className="pl-4 pr-3 border-r border-gray-200 h-full justify-center items-center bg-gray-100">
                                    <Text className="text-gray-500 font-bold">+91</Text>
                                </View>
                                <TextInput
                                    value={formData.phone}
                                    onChangeText={(text) => {
                                        const cleaned = text.replace(/[^0-9]/g, '');
                                        if (cleaned.length <= 10) setFormData({ ...formData, phone: cleaned });
                                    }}
                                    placeholder="98765 43210"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="number-pad"
                                    maxLength={10}
                                    className="flex-1 px-4 text-lg text-gray-900 font-medium h-full"
                                />
                            </View>
                            {errors.phone && <Text className="text-red-500 text-sm mt-1 ml-1">{errors.phone}</Text>}
                        </View>
                    </View>
                );
            case 3:
                return (
                    <View>
                        <View className="items-center mb-6">
                            <Text className="text-2xl font-bold text-gray-900">Summary</Text>
                            <Text className="text-gray-500">Please review your details</Text>
                        </View>

                        <View className="bg-white p-6 rounded-2xl space-y-6 border border-gray-100 shadow-md">
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mr-4 border border-blue-100">
                                    <Ionicons name="person" size={20} color="#2563eb" />
                                </View>
                                <View>
                                    <Text className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Full Name</Text>
                                    <Text className="text-gray-900 text-lg font-bold">{formData.firstName} {formData.lastName}</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center">
                                <View className="w-12 h-12 bg-green-50 rounded-full items-center justify-center mr-4 border border-green-100">
                                    <Ionicons name="call" size={20} color="#16a34a" />
                                </View>
                                <View>
                                    <Text className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Phone</Text>
                                    <Text className="text-gray-900 text-lg font-bold">+91 {formData.phone}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
                {/* Header */}
                <View className="flex-row items-center p-4">
                    {step > 1 && step < 4 && status !== "Google" ? (
                        <TouchableOpacity onPress={prevStep} className="p-2 bg-gray-50 rounded-full">
                            <Ionicons name="arrow-back" size={24} color="black" />
                        </TouchableOpacity>
                    ) : (
                        <View className="w-10" />
                    )}
                </View>

                <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 }}>

                    {/* Show Progress Bar only for manual flow and steps 1-3 */}
                    {status !== "Google" && step <= 3 && <ProgressBar currentStep={step} />}

                    {/* Form Content */}
                    <View className="flex-1 justify-center">
                        {renderContent()}
                    </View>

                    {/* Navigation Buttons for Manual Flow */}
                    {step < 4 && status !== "Google" && (
                        <View className="mt-10">
                            {step < 3 ? (
                                <TouchableOpacity
                                    onPress={nextStep}
                                    className="w-full py-4 rounded-xl bg-gray-900 shadow-lg shadow-gray-200 items-center active:scale-95 transition-transform"
                                >
                                    <Text className="text-white font-bold text-lg">Continue</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={loading}
                                    className="w-full py-4 rounded-xl bg-gray-900 shadow-lg shadow-gray-200 items-center active:scale-95 transition-transform"
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-bold text-lg">Create Account</Text>}
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ProcessFormScreen;
