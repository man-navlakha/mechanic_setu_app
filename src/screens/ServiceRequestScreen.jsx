
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../utils/api';

const { width, height } = Dimensions.get('window');

// --- CONSTANTS ---
const VEHICLE_TYPES = [
    { id: 'bike', name: 'Bike / Scooter', icon: 'motorbike', library: MaterialCommunityIcons },
    { id: 'car', name: 'Car / Sedan', icon: 'car-sedan', library: MaterialCommunityIcons },
    { id: 'truck', name: 'Truck / SUV', icon: 'truck', library: MaterialCommunityIcons }
];

const PROBLEMS = {
    bike: [
        { name: 'Puncture Repair', icon: 'wrench' },
        { name: 'Air Fill-up', icon: 'air' },
        { name: 'Chain Repair', icon: 'link' },
        { name: 'Spark Plug Issue', icon: 'flash' },
        { name: 'Fuel Delivery', icon: 'water' },
        { name: 'Key Issue', icon: 'key' },
        { name: 'General Checkup', icon: 'search' },
        { name: 'Other', icon: 'help-circle' }
    ],
    car: [
        { name: 'Puncture Repair', icon: 'wrench' },
        { name: 'Air Fill-up', icon: 'air' },
        { name: 'Battery Jumpstart', icon: 'battery-charging' },
        { name: 'Tire Replacement', icon: 'settings' },
        { name: 'Fuel Delivery', icon: 'water' },
        { name: 'Key Lockout', icon: 'key' },
        { name: 'Engine Overheat', icon: 'thermometer' },
        { name: 'Other', icon: 'help-circle' }
    ],
    truck: [
        { name: 'Puncture Repair', icon: 'wrench' },
        { name: 'Air Fill-up', icon: 'air' },
        { name: 'Battery Jumpstart', icon: 'battery-charging' },
        { name: 'Tire Replacement', icon: 'settings' },
        { name: 'Fuel Delivery', icon: 'water' },
        { name: 'Engine Issue', icon: 'cog' },
        { name: 'Other', icon: 'help-circle' }
    ],
};

const FORM_STORAGE_KEY = 'punctureRequestFormData';

export default function ServiceRequestScreen() {
    const navigation = useNavigation();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showDebugger, setShowDebugger] = useState(false);

    const mapRef = useRef(null);
    const [formData, setFormData] = useState({
        vehicleType: '',
        location: 'Selecting location...',
        latitude: 23.0225, // Default Ahmedabad
        longitude: 72.5714,
        problem: '',
        additionalNotes: ''
    });

    // Load saved data
    useEffect(() => {
        (async () => {
            try {
                const saved = await SecureStore.getItemAsync(FORM_STORAGE_KEY);
                if (saved) {
                    setFormData(JSON.parse(saved));
                    console.log("[ServiceRequest] Loaded saved drafts.");
                }
            } catch (e) {
                console.warn("Failed to load drafts", e);
            }
        })();
    }, []);

    // Save data on change
    useEffect(() => {
        const saveTimeout = setTimeout(() => {
            SecureStore.setItemAsync(FORM_STORAGE_KEY, JSON.stringify(formData));
        }, 500);
        return () => clearTimeout(saveTimeout);
    }, [formData]);

    const handleNext = () => {
        if (canProceed()) {
            setStep(step + 1);
        }
    };

    const handlePrev = () => {
        if (step > 1) setStep(step - 1);
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            console.log("Submitting Request:", formData);
            const response = await api.post("/jobs/CreateServiceRequest/", {
                latitude: formData.latitude,
                longitude: formData.longitude,
                location: formData.location || "Custom Pin Location",
                vehical_type: formData.vehicleType,
                problem: formData.problem,
                additional_details: formData.additionalNotes,
            });

            console.log("Response:", response.data);

            // Clear draft
            await SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

            // Navigate to finding/tracking screen
            navigation.navigate("FindingMechanic", {
                requestId: response.data.request_id,
                latitude: formData.latitude,
                longitude: formData.longitude,
                vehicleType: formData.vehicleType,
                problem: formData.problem
            });

        } catch (error) {
            console.error("Submission error:", error);
            alert("Failed to submit request. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const canProceed = () => {
        if (step === 1) return !!formData.vehicleType;
        if (step === 2) return true;
        if (step === 3) return !!formData.problem;
        if (step === 4) return true; // Notes are optional
        if (step === 5) return true; // Review step
        return false;
    };

    // Auto-detect location when entering Map step
    useEffect(() => {
        if (step === 2) {
            handleCurrentLocation();
        }
    }, [step]);

    const getAddressFromCoords = async (latitude, longitude) => {
        try {
            const addressResponse = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (addressResponse && addressResponse.length > 0) {
                const addr = addressResponse[0];
                return [
                    addr.name,
                    addr.street,
                    addr.subregion,
                    addr.city,
                    addr.postalCode
                ].filter(Boolean).join(', ');
            }
        } catch (error) {
            console.warn("Reverse geocoding failed", error);
        }
        return `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`;
    };

    const handleCurrentLocation = async () => {
        setFormData(prev => ({ ...prev, location: 'Fetching current location...' }));

        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            const address = await getAddressFromCoords(latitude, longitude);

            setFormData(prev => ({
                ...prev,
                latitude,
                longitude,
                location: address
            }));

            if (mapRef.current) {
                mapRef.current.animateToRegion({
                    latitude,
                    longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 1000);
            }
        } catch (error) {
            console.error(error);
            alert("Could not fetch location");
            setFormData(prev => ({ ...prev, location: 'Location unavailable' }));
        }
    };

    // --- RENDER STEPS ---

    // Step 1: Vehicle
    const renderStep1 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1 px-4 pt-4">
            <Text className="text-2xl font-bold text-gray-900 mb-2">Select Vehicle</Text>
            <Text className="text-gray-500 mb-6">Choose the vehicle you need help with.</Text>

            <View className="flex-row flex-wrap justify-between">
                {VEHICLE_TYPES.map((v) => {
                    const isSelected = formData.vehicleType === v.id;
                    return (
                        <TouchableOpacity
                            key={v.id}
                            onPress={() => setFormData({ ...formData, vehicleType: v.id, problem: '' })}
                            className={`w-[48%] mb-4 p-4 rounded-2xl border-2 items-center justify-center h-40 shadow-sm ${isSelected ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-100'}`}
                        >
                            <v.library
                                name={v.icon}
                                size={48}
                                color={isSelected ? '#3b82f6' : '#9ca3af'}
                            />
                            <Text className={`mt-4 font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                {v.name}
                            </Text>
                            {isSelected && (
                                <View className="absolute top-3 right-3 bg-blue-500 rounded-full p-1">
                                    <Ionicons name="checkmark" size={12} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </Animated.View>
    );

    // Step 2: Location
    const renderStep2 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1 bg-gray-50">
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={{
                    latitude: formData.latitude || 23.0225,
                    longitude: formData.longitude || 72.5714,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }}
                onRegionChangeComplete={async (region) => {
                    setFormData(prev => ({
                        ...prev,
                        latitude: region.latitude,
                        longitude: region.longitude,
                        location: "Identifying location..."
                    }));

                    const address = await getAddressFromCoords(region.latitude, region.longitude);
                    setFormData(prev => ({
                        ...prev,
                        latitude: region.latitude,
                        longitude: region.longitude,
                        location: address
                    }));
                }}
            >
            </MapView>

            <View pointerEvents="none" className="absolute top-0 bottom-0 left-0 right-0 items-center justify-center -mt-8">
                <Ionicons name="location" size={48} color="#ef4444" />
                <View className="w-4 h-4 bg-red-400/30 rounded-full" />
            </View>

            <TouchableOpacity
                onPress={handleCurrentLocation}
                className="absolute bottom-40 right-6 bg-white p-3 rounded-full shadow-lg border border-gray-100"
            >
                <Ionicons name="locate" size={24} color="#3b82f6" />
            </TouchableOpacity>

            <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 shadow-2xl">
                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wide mb-1">Confirm Location</Text>
                <Text className="text-lg font-bold text-gray-900 mb-4" numberOfLines={1}>
                    {formData.location}
                </Text>
                <View className="flex-row items-center space-x-2 bg-blue-50 p-3 rounded-xl">
                    <Ionicons name="information-circle" size={20} color="#3b82f6" />
                    <Text className="text-blue-700 text-xs flex-1">
                        Move the map to place the pin at your exact breakdown location.
                    </Text>
                </View>
            </View>
        </Animated.View>
    );

    // Step 3: Service Type
    const renderStep3 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1 px-4 pt-4">
            <Text className="text-2xl font-bold text-gray-900 mb-2">Service Type</Text>
            <Text className="text-gray-500 mb-6">What seems to be the problem?</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                <View className="flex-row flex-wrap justify-between">
                    {PROBLEMS[formData.vehicleType || 'car']?.map((p, idx) => {
                        const isSelected = formData.problem === p.name;
                        // Ionicons mapping fallback
                        let iconName = 'construct';
                        if (p.icon === 'air') iconName = 'bicycle';
                        if (p.icon === 'battery-charging') iconName = 'battery-charging';
                        if (p.icon === 'settings') iconName = 'cog';
                        if (p.icon === 'key') iconName = 'key';
                        if (p.icon === 'water') iconName = 'water';
                        if (p.icon === 'flash') iconName = 'flash';
                        if (p.icon === 'search') iconName = 'search';
                        if (p.icon === 'thermometer') iconName = 'thermometer';
                        if (p.icon === 'help-circle') iconName = 'help-circle';

                        return (
                            <TouchableOpacity
                                key={idx}
                                onPress={() => setFormData({ ...formData, problem: p.name })}
                                className={`w-[48%] mb-4 p-4 rounded-2xl border items-center justify-center h-32 active:scale-95 transition-transform ${isSelected ? 'bg-blue-50 border-blue-500 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}
                            >
                                <Ionicons name={iconName} size={32} color={isSelected ? '#3b82f6' : '#6b7280'} />
                                <Text className={`mt-3 font-semibold text-center ${isSelected ? 'text-blue-700 font-bold' : 'text-gray-600'}`}>
                                    {p.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </Animated.View>
    );

    // Step 4: Additional Details
    const renderStep4 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1 px-4 pt-4">
            <Text className="text-2xl font-bold text-gray-900 mb-2">Additional Details</Text>
            <Text className="text-gray-500 mb-6">Describe the issue in more detail (Optional).</Text>

            <View className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                <TextInput
                    className="text-gray-800 text-lg h-40 text-top align-top"
                    multiline
                    placeholder="e.g. My car stopped suddenly, there is a weird noise coming from the engine..."
                    placeholderTextColor="#9ca3af"
                    value={formData.additionalNotes}
                    onChangeText={(t) => setFormData({ ...formData, additionalNotes: t })}
                    autoFocus
                />
            </View>
        </Animated.View>
    );

    // Step 5: Review
    const renderStep5 = () => (
        <Animated.View entering={SlideInRight} exiting={SlideOutLeft} className="flex-1 px-4 pt-4">
            <Text className="text-2xl font-bold text-gray-900 mb-2">Review Request</Text>
            <Text className="text-gray-500 mb-6">Please review details before submitting.</Text>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* Card 1: Vehicle & Problem */}
                <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                    <View className="flex-row items-center border-b border-gray-50 pb-4 mb-4">
                        <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mr-4">
                            {(() => {
                                const v = VEHICLE_TYPES.find(t => t.id === formData.vehicleType);
                                if (v) return <v.library name={v.icon} size={24} color="#2563eb" />;
                                return <Ionicons name="car" size={24} color="#2563eb" />;
                            })()}
                        </View>
                        <View>
                            <Text className="text-gray-500 text-xs uppercase tracking-wider font-bold">Vehicle Type</Text>
                            <Text className="text-gray-900 font-bold text-lg capitalize">{formData.vehicleType}</Text>
                        </View>
                    </View>

                    <View>
                        <Text className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Problem</Text>
                        <Text className="text-gray-900 font-bold text-lg">{formData.problem}</Text>
                    </View>
                </View>

                {/* Card 2: Location */}
                <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                    <View className="flex-row items-start">
                        <Ionicons name="location" size={24} color="#ef4444" style={{ marginTop: 2, marginRight: 12 }} />
                        <View className="flex-1">
                            <Text className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Pick-up Location</Text>
                            <Text className="text-gray-900 font-medium leading-6">{formData.location}</Text>
                        </View>
                    </View>
                    <View className="mt-4 pt-4 border-t border-gray-50 flex-row justify-between">
                        <Text className="text-gray-400 text-xs">Lat: {formData.latitude.toFixed(4)}</Text>
                        <Text className="text-gray-400 text-xs">Lng: {formData.longitude.toFixed(4)}</Text>
                    </View>
                </View>

                {/* Card 3: Notes */}
                <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
                    <View className="flex-row items-start">
                        <Ionicons name="create" size={24} color="#6b7280" style={{ marginTop: 2, marginRight: 12 }} />
                        <View className="flex-1">
                            <Text className="text-gray-500 text-xs uppercase tracking-wider font-bold mb-1">Additional Notes</Text>
                            <Text className="text-gray-900 italic">
                                {formData.additionalNotes ? formData.additionalNotes : "No additional details provided."}
                            </Text>
                        </View>
                    </View>
                </View>

            </ScrollView>
        </Animated.View>
    );

    return (
        <SafeAreaView className="flex-1 bg-white">
            <TouchableOpacity
                activeOpacity={1}
                onLongPress={() => setShowDebugger(!showDebugger)}
                className="absolute top-10 right-4 z-50 p-2"
            >
                {showDebugger && <Text className="text-xs text-red-500 bg-white p-1 rounded border">Debug</Text>}
            </TouchableOpacity>

            {showDebugger && (
                <View className="absolute top-20 right-4 z-50 bg-black/80 p-4 rounded-xl w-64">
                    <Text className="text-white font-bold mb-2">Form Data (Debug)</Text>
                    <Text className="text-green-400 text-xs font-mono">
                        {JSON.stringify(formData, null, 2)}
                    </Text>
                </View>
            )}

            {/* Header */}
            <View className="flex-row items-center px-4 py-4 border-b border-gray-100">
                <TouchableOpacity onPress={() => step > 1 ? handlePrev() : navigation.goBack()} className="p-2 bg-gray-50 rounded-full">
                    <Ionicons name="arrow-back" size={24} color="#1f2937" />
                </TouchableOpacity>

                {/* Progress Bar 5 steps */}
                <View className="flex-1 mx-4 h-2 bg-gray-100 rounded-full overflow-hidden flex-row">
                    <View className={`h-full bg-blue-500 transition-all duration-300 ${step >= 1 ? 'w-[20%]' : 'w-0'}`} />
                    <View className={`h-full bg-blue-500 transition-all duration-300 ${step >= 2 ? 'w-[20%]' : 'w-0'}`} />
                    <View className={`h-full bg-blue-500 transition-all duration-300 ${step >= 3 ? 'w-[20%]' : 'w-0'}`} />
                    <View className={`h-full bg-blue-500 transition-all duration-300 ${step >= 4 ? 'w-[20%]' : 'w-0'}`} />
                    <View className={`h-full bg-blue-500 transition-all duration-300 ${step >= 5 ? 'w-[20%]' : 'w-0'}`} />
                </View>

                <Text className="text-gray-400 font-bold text-xs">Step {step}/5</Text>
            </View>

            {/* Content Area */}
            <View className="flex-1 bg-white">
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
                {step === 5 && renderStep5()}
            </View>

            {/* Bottom Footer Action */}
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View className="p-4 border-t border-gray-100 bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-20">
                    <TouchableOpacity
                        onPress={step === 5 ? handleSubmit : handleNext}
                        disabled={!canProceed() || loading}
                        className={`w-full py-4 rounded-2xl flex-row items-center justify-center shadow-lg active:scale-[0.98] ${canProceed() ? 'bg-blue-600 shadow-blue-200' : 'bg-gray-300 shadow-transparent'}`}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-white font-bold text-lg mr-2">
                                    {step === 5 ? 'Submit Request' : 'Next Step'}
                                </Text>
                                <Ionicons name="arrow-forward" size={20} color="white" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
