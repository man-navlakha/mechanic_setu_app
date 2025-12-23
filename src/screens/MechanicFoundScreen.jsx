import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
// import { useNavigation, useRoute } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Modal,
    SafeAreaView,
    ScrollView,
    Text,
    TouchableOpacity, View
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../utils/api';

const { width, height } = Dimensions.get('window');

const SNAP_POINTS = {
    COLLAPSED: height * 0.65,
    EXPANDED: height * 0.35,
};

const ACTIVE_JOB_STORAGE_KEY = 'mechanicAcceptedData';
const FORM_STORAGE_KEY = 'punctureRequestFormData';

// ... (keep helper functions like getDistanceFromLatLonInKm, deg2rad, calculateETA same) ...
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function calculateETA(userCoords, mechCoords) {
    if (!userCoords || !mechCoords) return null;
    const distance = getDistanceFromLatLonInKm(
        userCoords.latitude,
        userCoords.longitude,
        mechCoords.latitude,
        mechCoords.longitude
    );
    const avgSpeedKmh = 30;
    const timeMinutes = Math.round((distance / avgSpeedKmh) * 60);
    return timeMinutes + 1;
}

const MechanicFoundScreen = ({ navigation, route }) => {
    const { data: routeData, userLocation: paramLocation } = route.params || {};

    const { socket, lastMessage } = useWebSocket();

    // State
    const [mechanic, setMechanic] = useState(null);
    const [jobDetails, setJobDetails] = useState(null);
    const [userLocation, setUserLocation] = useState(paramLocation || null);
    const [mechanicLocation, setMechanicLocation] = useState(null);
    const [estimatedTime, setEstimatedTime] = useState(null);
    const [requestId, setRequestId] = useState(null);

    const [isCancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState('');

    const mapRef = useRef(null);

    // Animation Values for Bottom Sheet
    const translateY = useSharedValue(SNAP_POINTS.COLLAPSED);
    const context = useSharedValue({ y: 0 });

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = event.translationY + context.value.y;
            // Limit range: EXPANDED (top) to COLLAPSED (bottom)
            translateY.value = Math.max(SNAP_POINTS.EXPANDED, Math.min(translateY.value, SNAP_POINTS.COLLAPSED + 50));
        })
        .onEnd(() => {
            if (translateY.value < (SNAP_POINTS.COLLAPSED + SNAP_POINTS.EXPANDED) / 2) {
                translateY.value = withTiming(SNAP_POINTS.EXPANDED, { duration: 300 });
            } else {
                translateY.value = withTiming(SNAP_POINTS.COLLAPSED, { duration: 300 });
            }
        });

    const rBottomSheetStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
            height: height, // Full height available
            top: 0
        };
    });

    // Initial Load
    useEffect(() => {
        const loadInitialData = async () => {
            // Priority 1: Route params (freshly accepted)
            if (routeData) {
                const mech = routeData.mechanic_details;
                const reqId = routeData.job_id || routeData.request_id;

                // Construct structure
                const dataToSave = {
                    mechanic: mech,
                    jobDetails: routeData, // or fetch if needed
                    request_id: reqId,
                    user_location: paramLocation // Persist user location
                };

                setMechanic(mech);
                setRequestId(reqId);
                // Also initialize mechanic location if present
                if (mech.current_latitude && mech.current_longitude) {
                    setMechanicLocation({
                        latitude: parseFloat(mech.current_latitude),
                        longitude: parseFloat(mech.current_longitude)
                    });
                }
                if (paramLocation) {
                    setUserLocation(paramLocation);
                }

                await SecureStore.setItemAsync(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(dataToSave));
            } else {
                // Priority 2: Load from storage (restoring state)
                try {
                    const saved = await SecureStore.getItemAsync(ACTIVE_JOB_STORAGE_KEY);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        setMechanic(parsed.mechanic);
                        setRequestId(parsed.request_id);
                        if (parsed.mechanic?.current_latitude) {
                            setMechanicLocation({
                                latitude: parseFloat(parsed.mechanic.current_latitude),
                                longitude: parseFloat(parsed.mechanic.current_longitude)
                            });
                        }
                        if (parsed.user_location) {
                            setUserLocation(parsed.user_location);
                        }
                    }
                } catch (e) {
                    console.error("Failed to restore mechanic data", e);
                }
            }

            // Fallback: Load Form Data if userLocation still missing
            if (!paramLocation) {
                try {
                    const savedForm = await SecureStore.getItemAsync(FORM_STORAGE_KEY);
                    if (savedForm) {
                        const parsedForm = JSON.parse(savedForm);
                        setJobDetails(parsedForm);
                        if (parsedForm.latitude && parsedForm.longitude) {
                            setUserLocation({
                                latitude: parsedForm.latitude,
                                longitude: parsedForm.longitude
                            });
                        }
                    }
                } catch (e) {
                    console.error("Failed to load form data", e);
                }
            }
        };

        loadInitialData();
    }, [routeData]);

    // WebSocket Updates (kept same)
    useEffect(() => {
        if (!lastMessage || !requestId) return;

        // Mechanic Location Update
        if (lastMessage.type === 'mechanic_location_update' && String(lastMessage.request_id) === String(requestId)) {
            setMechanicLocation({
                latitude: lastMessage.latitude,
                longitude: lastMessage.longitude
            });
        }

        // Job Updates
        const msgReqId = String(lastMessage.request_id || lastMessage.job_id);
        const currentReqId = String(requestId);

        if (msgReqId === currentReqId) {
            // If the user originated the cancellation, we already handled it
            if (lastMessage.type === 'job_cancelled_notification' && lastMessage.message?.includes('User -')) {
                return;
            }

            switch (lastMessage.type) {
                case 'job_completed':
                    Alert.alert("Job Completed", lastMessage.message || "The service has been completed.");
                    clearAndExit(null);
                    break;
                case 'job_cancelled':
                case 'job_cancelled_notification':
                    // Mechanic or System cancelled
                    Alert.alert("Job Cancelled", lastMessage.message || "The request was cancelled.");
                    clearAndExit(null);
                    break;
                case 'no_mechanic_found':
                    Alert.alert("No Mechanic Found", lastMessage.message || "We could not find a mechanic.");
                    clearAndExit(null);
                    break;
            }
        }
    }, [lastMessage, requestId]);

    // Calculate ETA (kept same)
    useEffect(() => {
        if (userLocation && mechanicLocation) {
            const eta = calculateETA(userLocation, mechanicLocation);
            setEstimatedTime(eta);

            // Fit map updates with padding for bottom sheet
            if (mapRef.current) {
                mapRef.current.fitToCoordinates([userLocation, mechanicLocation], {
                    edgePadding: { top: 120, right: 50, bottom: height / 2, left: 50 },
                    animated: true,
                });
            }
        }
    }, [userLocation, mechanicLocation]);


    const clearAndExit = async (msg) => {
        if (msg) Alert.alert("Notice", msg);
        await SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
        await SecureStore.deleteItemAsync(FORM_STORAGE_KEY);
        navigation.navigate("Main");
    };

    const handleCallMechanic = () => {
        if (mechanic?.phone_number) {
            Linking.openURL(`tel:${mechanic.phone_number}`);
        } else {
            alert("Phone number not available");
        }
    };

    // Debug Navigation
    useEffect(() => {
        console.log("[MechanicFoundScreen] Mounted. Navigation Prop:", navigation ? "Present" : "Missing");
    }, []);

    const handleCancelConfirm = async () => {
        console.log("Attempting to cancel. RequestId:", requestId);
        console.log("Selected reason:", selectedReason);

        if (!selectedReason) {
            Alert.alert("Reason Required", "Please select a reason");
            return;
        }

        if (!requestId) {
            console.error("No Request ID found to cancel");
            alert("Error: No Request ID found. Try reloading.");
            return;
        }

        try {
            console.log(`Sending cancel request to: jobs/CancelServiceRequest/${requestId}/`);
            const response = await api.post(`jobs/CancelServiceRequest/${requestId}/`, {
                cancellation_reason: `User - ${selectedReason}`,
            });
            console.log("Cancel API Response:", response.data);

            if (socket?.readyState === WebSocket.OPEN) {
                console.log("Sending cancel_request via WebSocket");
                socket.send(JSON.stringify({ type: 'cancel_request', request_id: parseInt(requestId) }));
            } else {
                console.warn("WebSocket not open, cannot send socket message");
            }

            // Cleanup & Navigation
            await SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
            await SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

            console.log("Resetting navigation to Main...");
            if (navigation) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            } else {
                console.warn("Navigation prop missing, cannot reset");
            }

        } catch (error) {
            console.error("Cancellation Error Object:", error);
            if (error.response) {
                console.error("Cancellation Server Error Data:", error.response.data);
                console.error("Cancellation Server Error Status:", error.response.status);
                alert(`Failed: ${JSON.stringify(error.response.data)}`);
            } else {
                alert("Cancellation failed: " + error.message);
            }
        } finally {
            setCancelModalOpen(false);
        }
    };

    if (!mechanic || !userLocation) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#2563eb" />
                <Text className="mt-4 text-gray-500 font-medium">Synced with server...</Text>
                <TouchableOpacity onPress={() => navigation.navigate("Main")} className="mt-8 p-2">
                    <Text className="text-red-400">Cancel & Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <View className="flex-1 bg-white">
                {/* Map */}
                <MapView
                    ref={mapRef}
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    initialRegion={{
                        ...userLocation,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                >
                    {/* Route Line */}
                    {userLocation && mechanicLocation && (
                        <Polyline
                            coordinates={[userLocation, mechanicLocation]}
                            strokeColor="black"
                            strokeWidth={2}
                            lineDashPattern={[10, 10]}
                            geodesic={true}
                        />
                    )}

                    {/* User Marker */}
                    <Marker coordinate={userLocation}>
                        <View className="items-center justify-center">
                            <Image source={require('../../assets/logo.png')} style={{ width: 35, height: 35, borderRadius: 17.5, borderWidth: 3, borderColor: '#10b981' }} />
                        </View>
                    </Marker>

                    {/* Mechanic Marker */}
                    {mechanicLocation && (
                        <Marker coordinate={mechanicLocation}>
                            <View className="items-center justify-center">
                                {mechanic.Mechanic_profile_pic ? (
                                    <Image source={{ uri: mechanic.Mechanic_profile_pic }} style={{ width: 35, height: 35, borderRadius: 17.5, borderWidth: 3, borderColor: '#3b82f6' }} />
                                ) : (
                                    <View className="w-9 h-9 bg-blue-500 rounded-full border-2 border-white items-center justify-center">
                                        <Ionicons name="construct" color="white" size={20} />
                                    </View>
                                )}
                            </View>
                        </Marker>
                    )}
                </MapView>

                {/* Top Green Header */}
                <SafeAreaView className="absolute top-0 left-0 right-0 z-10 bg-green-600 shadow-md pb-4 pt-2">
                    <View className="px-4 flex-row items-center">
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            className="mr-2"
                        >
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </TouchableOpacity>

                        <View className="flex-1 items-center mr-8">
                            <Text className="text-green-100 text-xs font-bold uppercase tracking-wider mb-0.5">
                                Mechanic is on the way
                            </Text>
                            <Text className="text-white text-2xl font-extrabold">
                                {estimatedTime ? `Arriving in ${estimatedTime} mins` : 'Calculating ETA...'}
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>

                {/* Draggable Bottom Sheet */}
                <GestureDetector gesture={gesture}>
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                backgroundColor: 'white',
                                borderTopLeftRadius: 30,
                                borderTopRightRadius: 30,
                                shadowColor: "#000",
                                shadowOffset: {
                                    width: 0,
                                    height: -3,
                                },
                                shadowOpacity: 0.1,
                                shadowRadius: 5,
                                elevation: 10,
                                paddingTop: 10
                            },
                            rBottomSheetStyle
                        ]}
                    >
                        {/* Drag Handle */}
                        <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-6" />

                        <ScrollView
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 150 }}
                        >
                            {/* Mechanic Details */}
                            <View className="flex-row items-center gap-4 mb-6 mt-2">
                                <View className="w-16 h-16 rounded-full bg-gray-200 shadow-md border-2 border-gray-500 shadow-lg shadow-green-200 overflow-hidden">
                                    {mechanic.Mechanic_profile_pic ? (
                                        <Image source={{ uri: mechanic.Mechanic_profile_pic }} className="w-full h-full" />
                                    ) : (
                                        <VueAvatarInitials name={mechanic.first_name} />
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-bold text-gray-900">{mechanic.first_name} {mechanic.last_name}</Text>
                                    <Text className="text-gray-500 font-medium text-sm gap-2 flex-row items-center"><Feather name="shield" size={12} color="gray" />Verified Mechanic</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={handleCallMechanic}
                                    className="w-12 h-12 bg-white rounded-full border border-gray-400 items-center justify-center shadow-lg shadow-green-200"
                                >
                                    <Feather name="phone-call" size={15} color="green" />
                                </TouchableOpacity>
                            </View>

                            {/* Divider */}
                            <View className="h-px bg-gray-100 w-full mb-6" />

                            {/* Job Details (Mini) */}
                            <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                                <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Issue</Text>
                                <Text className="text-gray-900 font-bold">{jobDetails?.problem || 'Vehicle Breakdown'}</Text>
                                {jobDetails?.vehicleType && <Text className="text-gray-500 text-sm mt-1 capitalize">{jobDetails.vehicleType}</Text>}
                            </View>

                            {/* Ads Section */}
                            <Text className="text-xs font-bold text-gray-400 uppercase mb-3">Sponsored</Text>
                            <View className="mb-6 space-y-8">
                                {/* Pixel Class Ad */}
                                <View className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex-row items-center space-x-3">
                                    <View className="bg-purple-100 p-2 rounded-lg">
                                        <Ionicons name="book" size={24} color="#9333ea" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-gray-800">Pixel Class</Text>
                                        <Text className="text-xs text-gray-500">Download latest book now!</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => Linking.openURL('https://pixelclass.netlify.app')}
                                        className="bg-purple-600 px-3 py-1.5 rounded-lg"
                                    >
                                        <Text className="text-xs text-white font-bold">Download</Text>
                                    </TouchableOpacity>
                                </View>

                                <View className="bg-yellow-50 border border-yellow-100 p-4 rounded-2xl flex-row items-center space-x-3">
                                    <View className="bg-yellow-100 p-2 rounded-lg">
                                        <Ionicons name="car-sport" size={24} color="#eab308" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-gray-800">Castrol Engine Oil</Text>
                                        <Text className="text-xs text-gray-500">Get 20% off on your next service!</Text>
                                    </View>
                                    <Text className="text-xs bg-yellow-200 px-2 py-1 rounded text-yellow-800 font-bold">Ad</Text>
                                </View>

                                <View className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex-row items-center space-x-3">
                                    <View className="bg-blue-100 p-2 rounded-lg">
                                        <Ionicons name="shield-checkmark" size={24} color="#3b82f6" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-gray-800">Insurance Check</Text>
                                        <Text className="text-xs text-gray-500">Is your vehicle insurance up to date?</Text>
                                    </View>
                                    <Text className="text-xs bg-blue-200 px-2 py-1 rounded text-blue-800 font-bold">Ad</Text>
                                </View>
                            </View>

                            {/* Cancel Button */}
                            <TouchableOpacity
                                onPress={() => setCancelModalOpen(true)}
                                className="w-full py-4 rounded-xl mb-10  border border-red-100 bg-red-50 flex-row items-center justify-center space-x-2"
                            >
                                <Ionicons name="close-circle" size={20} color="#ef4444" />
                                <Text className="text-red-500 font-bold">Cancel Request</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>

                {/* Cancel Modal (kept same) */}
                <Modal
                    visible={isCancelModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCancelModalOpen(false)}
                >
                    <View className="flex-1 bg-black/50 justify-end">
                        <View className="bg-white rounded-t-3xl p-6 pb-12">
                            <Text className="text-xl font-bold text-gray-900 mb-4">Why are you cancelling?</Text>

                            {['Mechanic delayed', 'Changed my mind', 'Found help elsewhere', 'Other'].map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    onPress={() => setSelectedReason(reason)}
                                    className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border ${selectedReason === reason ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-transparent'
                                        }`}
                                >
                                    <Text className={`font-semibold ${selectedReason === reason ? 'text-red-600' : 'text-gray-700'}`}>
                                        {reason}
                                    </Text>
                                </TouchableOpacity>
                            ))}

                            <View className="flex-row space-x-4 mt-4">
                                <TouchableOpacity
                                    onPress={() => setCancelModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-100 rounded-xl items-center"
                                >
                                    <Text className="font-bold text-gray-700">Go Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleCancelConfirm}
                                    disabled={!selectedReason}
                                    className={`flex-1 py-4 rounded-xl items-center ${selectedReason ? 'bg-red-500 shadow-lg shadow-red-200' : 'bg-gray-300'
                                        }`}
                                >
                                    <Text className="font-bold text-white">Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </View>
    );
};

const VueAvatarInitials = ({ name }) => (
    <View className="w-full h-full items-center justify-center bg-gray-300">
        <Text className="text-xl font-bold text-gray-600">{name ? name[0] : 'M'}</Text>
    </View>
);

export default MechanicFoundScreen;
