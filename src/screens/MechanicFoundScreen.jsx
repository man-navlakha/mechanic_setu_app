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
        // --- 1. Load Mechanic & Request Info ---
        if (routeData) {
            const mech = routeData.mechanic_details;
            const reqId = routeData.job_id || routeData.request_id;

            setMechanic(mech);
            setRequestId(reqId);
            
            if (mech.current_latitude) {
                setMechanicLocation({
                    latitude: parseFloat(mech.current_latitude),
                    longitude: parseFloat(mech.current_longitude)
                });
            }
            if (paramLocation) setUserLocation(paramLocation);

            // Save for persistence
            const dataToSave = {
                mechanic: mech,
                request_id: reqId,
                user_location: paramLocation
            };
            await SecureStore.setItemAsync(ACTIVE_JOB_STORAGE_KEY, JSON.stringify(dataToSave));
        } else {
            const saved = await SecureStore.getItemAsync(ACTIVE_JOB_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                setMechanic(parsed.mechanic);
                setRequestId(parsed.request_id);
                setUserLocation(parsed.user_location);
            }
        }

        // --- 2. Load Job Details (Problem/Vehicle) ---
        // REMOVED the "if (!paramLocation)" check so it always runs
        try {
            const savedForm = await SecureStore.getItemAsync(FORM_STORAGE_KEY);
            console.log("Fetched Form Data:", savedForm); // DEBUG LOG
            if (savedForm) {
                const parsedForm = JSON.parse(savedForm);
                setJobDetails(parsedForm);
                
                // Fallback location if userLocation is still null
                if (!userLocation && parsedForm.latitude) {
                    setUserLocation({
                        latitude: parsedForm.latitude,
                        longitude: parsedForm.longitude
                    });
                }
            }
        } catch (e) {
            console.error("Failed to load form data", e);
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
    const msgReqId = String(lastMessage.request_id || lastMessage.job_id);
    const currentReqId = String(requestId);

    if (msgReqId === currentReqId) {
        switch (lastMessage.type) {
            case 'job_completed':
                clearAndExit("The service has been completed.");
                break;
            case 'job_cancelled':
            case 'job_cancelled_notification':
                // This will catch the event after your API call
                clearAndExit("The request has been cancelled.");
                break;
            case 'no_mechanic_found':
                clearAndExit("We could not find a mechanic.");
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


    const clearAndExit = async (msg = null) => {
    try {
        if (msg) Alert.alert("Notice", msg);
        
        // Cleanup storage first
        await SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
        await SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

        // Use a small delay to ensure Modals/Alerts are dismissed
        setTimeout(() => {
            if (navigation && navigation.canGoBack?.() !== undefined) {
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Main' }],
                });
            }
        }, 100);
    } catch (err) {
        console.error("Exit Error:", err);
    }
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
    if (!selectedReason || !requestId) return;

    try {
        // 1. Notify the Backend
        await api.post(`jobs/CancelServiceRequest/${requestId}/`, {
            cancellation_reason: `User - ${selectedReason}`,
        });

        // 2. Notify via WebSocket
        if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ 
                type: 'cancel_request', 
                request_id: parseInt(requestId) 
            }));
        }

        // 3. Close modal
        setCancelModalOpen(false);

        // 4. IMPORTANT: Do NOT navigate here. 
        // The WebSocket useEffect below will see the 'job_cancelled' 
        // message and call clearAndExit() for you.
        
    } catch (error) {
        console.error("Cancellation Error:", error);
        Alert.alert("Error", "Failed to cancel request.");
        setCancelModalOpen(false);
    }
};
    
    console.log("Current State -> Mechanic:", !!mechanic, "JobDetails:", jobDetails);

 const mapStyle = [
        { "elementType": "geometry", "stylers": [{ "color": "#f5f7fa" }] },
        { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
        { "elementType": "labels.text.fill", "stylers": [{ "color": "#4a5568" }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f7fa" }] },
        { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#cbd5e0" }] },
        { "featureType": "administrative.land_parcel", "stylers": [{ "visibility": "off" }] },
        { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
        { "featureType": "poi.park", "stylers": [{ "visibility": "on" }] },
        { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e6f4ea" }] },
        { "featureType": "poi.park", "elementType": "geometry.fill", "stylers": [{ "color": "#b7e6c6" }] },
        { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
        { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#e2e8f0", "weight": 1 }] },
        { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#edf2f7" }] },
        { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#e2e8f0" }] },
        { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#cbd5e0", "weight": 1.5 }] },
        { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#a0aec0" }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] },
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#4299e1" }] },
        { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#2d3748" }] },
        { "featureType": "landscape.natural", "elementType": "geometry", "stylers": [{ "color": "#e6f4ea" }] },
        { "featureType": "landscape.natural.landcover", "elementType": "geometry", "stylers": [{ "color": "#c6f6d5" }] },
        { "featureType": "landscape.natural.terrain", "elementType": "geometry", "stylers": [{ "color": "#d4edda" }] }
    ];
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
                    customMapStyle={mapStyle}
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
                    <View className="px-4 flex-row items-center pb-3 pt-4 mb-2">
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
                    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 10, paddingTop: 10 }, rBottomSheetStyle]}>
                        <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-6" />
                        <View className="px-6 pb-10">
                            {/* Mechanic Details */}
                            <View className="flex-row items-center gap-4 mb-6">
                                <View className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-500 overflow-hidden">
                                    {mechanic.Mechanic_profile_pic ? <Image source={{ uri: mechanic.Mechanic_profile_pic }} className="w-full h-full" /> : <View className="w-full h-full bg-gray-300 items-center justify-center"><Text className="text-xl font-bold">{mechanic.first_name[0]}</Text></View>}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-lg font-bold text-gray-900">{mechanic.first_name} {mechanic.last_name}</Text>
                                    <Text className="text-gray-500 text-sm">Verified Mechanic</Text>
                                </View>
                                <TouchableOpacity onPress={handleCallMechanic} className="w-12 h-12 bg-white rounded-full border border-gray-400 items-center justify-center"><Feather name="phone-call" size={15} color="green" /></TouchableOpacity>
                            </View>

                            {/* Job Details Section (FIXED DISPLAY) */}
                            <View className="bg-gray-50 p-4 rounded-2xl mb-6">
                                <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Issue Reported</Text>
                                <Text className="text-gray-900 font-bold text-lg">{jobDetails?.problem || 'General Breakdown'}</Text>
                                {jobDetails?.vehicleType && <Text className="text-blue-600 font-medium mt-1 capitalize">{jobDetails.vehicleType}</Text>}
                            </View>

                            {/* Sponsored Ad */}
                            <View className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex-row items-center mb-6">
                                <Ionicons name="book" size={24} color="#9333ea" />
                                <View className="flex-1 ml-3">
                                    <Text className="font-bold text-gray-800">Pixel Class</Text>
                                    <Text className="text-xs text-gray-500">Download latest books now!</Text>
                                </View>
                                <TouchableOpacity onPress={() => Linking.openURL('https://pixelclass.netlify.app')} className="bg-purple-600 px-3 py-1.5 rounded-lg"><Text className="text-xs text-white font-bold">Download</Text></TouchableOpacity>
                            </View>

                            <TouchableOpacity onPress={() => setCancelModalOpen(true)} className="w-full py-4 rounded-xl bg-red-50 flex-row items-center justify-center border border-red-100"><Text className="text-red-500 font-bold">Cancel Request</Text></TouchableOpacity>
                        </View>
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
