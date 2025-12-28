import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    FlatList,
    Modal,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, {
    SlideInDown,
    SlideOutDown,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../utils/api';

const { width, height } = Dimensions.get('window');

const SNAP_POINTS = {
    COLLAPSED: height - 420, // Adjusted for carousel
    EXPANDED: height * 0.4,
};

const mapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
    { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }] }
];

const FORM_STORAGE_KEY = 'punctureRequestFormData';


const FindingMechanicScreen = () => {
    const navigation = useNavigation();
    const { profile: authUser } = useAuth();
    const route = useRoute();
    const mapRef = useRef(null);
    const { requestId, latitude, longitude, vehicleType: paramVehicle, problem: paramProblem } = route.params || {};

    const [jobDetails, setJobDetails] = useState(null);
    const userData = authUser || {};



    // FIXED: Use a memoized coordinate to prevent the icon from "moving" during state re-renders
    const staticLocation = useMemo(() => ({
        latitude: latitude || 23.0225,
        longitude: longitude || 72.5714
    }), [latitude, longitude]);

    useEffect(() => {
        const loadJobDetails = async () => {
            try {
                const savedForm = await SecureStore.getItemAsync(FORM_STORAGE_KEY);
                if (savedForm) {
                    setJobDetails(JSON.parse(savedForm));
                }
            } catch (e) {
                console.error("Failed to load form data", e);
            }
        };
        loadJobDetails();
    }, []);
    // console.log(jobDetails)
    const { socket, lastMessage } = useWebSocket();

    useEffect(() => {
        if (!lastMessage || !navigation.isFocused()) return;

        console.log("[FindingMechanic] New Message:", lastMessage);
        const { type, service_request, message } = lastMessage;

        // 1. Handle Job Confirmation (Confirmation from server)
        if (type === 'new_job' && service_request) {
            // Ensure this is the job we are actually looking for
            if (service_request.id === parseInt(requestId)) {
                console.log("[FindingMechanic] Server confirmed job is live.");

                // Sync local state with official server data
                setJobDetails({
                    vehicleType: service_request.vehical_type,
                    problem: service_request.problem,
                    location: service_request.location,
                    id: service_request.id
                });

                // TRIGGER: Start your fake mechanic simulation now!
                // (Call the simulation function we discussed earlier)
                if (typeof startFakeMechanicSimulation === 'function') {
                    startFakeMechanicSimulation();
                }
            }
        }

        // 2. Mechanic Found - Proceed to next screen
        else if (lastMessage.type === 'mechanic_accepted') {
    navigation.navigate("MechanicFound", {
        data: lastMessage,
        userLocation: { latitude, longitude },
        // Pass these as a fallback
        vehicleType: jobDetails?.vehicleType || paramVehicle,
        problem: jobDetails?.problem || paramProblem
    });
}

        // 3. Error Cases: No Mechanic Found OR Job Expired
        else if (type === 'no_mechanic_found' || type === 'job_expired') {

            const alertTitle = type === 'job_expired' ? "Request Expired" : "Searching Failed";
            const alertMessage = message || "Please try again later.";

            Alert.alert(
                alertTitle,
                alertMessage,
                [
                    {
                        text: "Try Again",
                        onPress: () => {
                            navigation.goBack();
                        }
                    }
                ],
                { cancelable: false }
            );
        }
    }, [lastMessage]);
    const [searchTime, setSearchTime] = useState(0);
    const [isCancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState('');

    const translateY = useSharedValue(SNAP_POINTS.COLLAPSED);
    const context = useSharedValue({ y: 0 });
    const scanX = useSharedValue(-width);

    useEffect(() => {
        scanX.value = withRepeat(withTiming(width, { duration: 2000 }), -1, false);
        const interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const RECOMMENDED_ADS = [
        {
            id: '1',
            title: 'Castrol Magnatec',
            subtitle: '20% Off Engine Oil',
            description: 'Ensure a smooth ride with premium oil change.',
            icon: 'water',
            color: '#16a34a',
            price: 'From ₹499'
        },
        {
            id: '2',
            title: 'RSA Shield',
            subtitle: 'Roadside Assistance',
            description: 'Get 24/7 breakdown support for a year.',
            icon: 'shield-checkmark',
            color: '#2563eb',
            price: '₹99/year'
        },
        {
            id: '3',
            title: 'Pixel Class',
            subtitle: 'now Submit Assignment on time ',
            description: 'Comprehensive car service at your doorstep.',
            icon: 'book',
            color: '#dc2626',
            price: 'Download Now'
        },
        {
            id: '4',
            title: 'GoMechanic',
            subtitle: 'Full Service',
            description: 'Comprehensive car service at your doorstep.',
            icon: 'construct',
            color: '#740000ff',
            price: 'Save Time & Wallet'
        },
        {
            id: '5',
            title: 'GoMechanic',
            subtitle: 'Full Service',
            description: 'Comprehensive car service at your doorstep.',
            icon: 'construct',
            color: '#dc2626',
            price: 'Save ₹1000'
        },
    ];
    const handleCancelConfirm = async () => {
        if (!selectedReason) {
            Alert.alert("Selection Required", "Please select a reason");
            return;
        }

        try {
            setCancelModalOpen(false);

            // 1. Send cancellation request to backend
            await api.post(`jobs/CancelServiceRequest/${requestId}/`, {
                cancellation_reason: selectedReason
            });

            // 2. Notify via WebSocket if successful
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: 'job_cancelled',
                    job_id: requestId,
                    message: `Cancelled by user: ${selectedReason}`
                }));
            }

            console.log("Request Cancelled");
            navigation.popToTop();

        } catch (error) {
            console.error("Cancellation failed", error);

            // EXTRACT BACKEND ERROR MESSAGE
            // Check if error.response exists and contains the specific 'error' key from your API
            const errorMessage = error.response?.data?.error || "Failed to cancel. Try again.";

            // DISPLAY THE ERROR TO THE USER
            Alert.alert("Cancellation Error", errorMessage);

            // Re-open modal so user can see what happened or try again
            setCancelModalOpen(true);
        }
    };

    const renderAdItem = ({ item }) => (
        <TouchableOpacity
            className="bg-white rounded-2xl shadow-md border-2 border-gray-300/30 overflow-hidden mr-4 relative"
            style={{ width: width * 0.8 }}
        >
            {/* Ads Tab */}
            <View className="absolute top-0 left-0 bg-gray-400/30 px-3 py-1 rounded-br-lg">
                <Text className="text-gray-400 font-bold text-xs">Ads</Text>
            </View>

            {/* Top Icon Section */}
            <View className="flex-row items-center p-4 mt-4">
                <View
                    className="p-3 rounded-xl mr-3"
                    style={{ backgroundColor: item.color + '20' }}
                >
                    <Ionicons name={item.icon} size={28} color={item.color} />
                </View>
                <View className="flex-1">
                    <Text className="text-gray-900 font-bold text-base" numberOfLines={1}>
                        {item.title}
                    </Text>
                    <Text className="text-gray-500 text-sm" numberOfLines={1}>
                        {item.subtitle}
                    </Text>
                </View>
            </View>

            {/* Divider */}
            <View className="border-t border-gray-100" />

            {/* Bottom Price + Action */}
            <View className="flex-row items-center justify-between p-4">
                <Text className="text-blue-600 font-bold text-sm">{item.price}</Text>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </View>
        </TouchableOpacity>
    );


    const gesture = Gesture.Pan()
        .onStart(() => { context.value = { y: translateY.value }; })
        .onUpdate((event) => {
            translateY.value = Math.max(SNAP_POINTS.EXPANDED, event.translationY + context.value.y);
        })
        .onEnd(() => {
            if (translateY.value < (SNAP_POINTS.COLLAPSED + SNAP_POINTS.EXPANDED) / 2) {
                translateY.value = withSpring(SNAP_POINTS.EXPANDED);
            } else {
                translateY.value = withSpring(SNAP_POINTS.COLLAPSED);
            }
        });

    const rBottomSheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const rScanStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: scanX.value }],
    }));

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View className="flex-1 bg-white">
                <MapView
                    ref={mapRef} // Attach ref here
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1 }}
                    customMapStyle={mapStyle}
                    initialRegion={{
                        ...staticLocation,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                    }}
                >
                    {/* SONAR EFFECT MARKER */}
                    <Marker
                        coordinate={staticLocation}
                        flat
                        anchor={{ x: 0.5, y: 0.5 }}
                        onPress={() => {
                            if (mapRef.current) {
                                mapRef.current.animateToRegion({
                                    ...staticLocation,
                                    latitudeDelta: 0.005, // You can adjust zoom level here
                                    longitudeDelta: 0.005,
                                }, 2000); // Duration in milliseconds
                            }
                        }}
                    >
                        <View className="items-center justify-center">

                            {/* Static Black/Blue Icon */}

                            <View className="w-10 h-10 bg-black rounded-full border-[3px] border-white shadow-2xl items-center justify-center">
                                <Ionicons name="location" size={18} color="white" />
                            </View>
                            <Text>{userData.first_name} 🙋‍♂️</Text>
                        </View>
                    </Marker>
                </MapView>

                {/* Floating Navigation */}
                <SafeAreaView className="absolute top-4 left-4 z-20">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="bg-white w-10 h-10 rounded-full shadow-lg items-center justify-center border border-gray-100"
                    >
                        <Ionicons name="close" size={24} color="black" />
                    </TouchableOpacity>
                </SafeAreaView>

                {/* BOTTOM SHEET */}
                <GestureDetector gesture={gesture}>
                    <Animated.View style={[styles.bottomSheet, rBottomSheetStyle]}>
                        {/* Scanning Progress Bar */}
                        <View className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                            <Animated.View style={[styles.scanLine, rScanStyle]} />
                        </View>


                        <View className="pt-6 ">
                            <View className="px-6 flex gap-4 mb-6">
                                <View>
                                    <Text className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                        {jobDetails?.id ? "Job is Live!" : "Broadcasting..."}
                                    </Text>
                                    <Text className="text-gray-500 text-sm mt-1">
                                        {jobDetails?.id
                                            ? `Your request (ID: ${jobDetails.id}) is now visible to nearby mechanics.`
                                            : "Sending your request to the server..."}
                                    </Text>

                                    {/* Display the server-confirmed location */}
                                    {jobDetails?.location && (
                                        <View className="flex-row items-center bg-gray-50 p-3 rounded-xl mt-4">
                                            <Ionicons name="location" size={16} color="#3b82f6" />
                                            <Text className="ml-2 text-gray-600 text-xs flex-1" numberOfLines={1}>
                                                {jobDetails.location}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <View className="flex-row items-center bg-blue-50 self-start px-3 py-1.5 rounded-full border border-blue-100">
                                    <Ionicons name="time" size={14} color="#2563eb" />
                                    <Text className="ml-2 text-blue-600 font-semibold text-xs">
                                        Elapsed: {formatTime(searchTime)}
                                    </Text>
                                </View>

                            </View>



                            {/* ADS CAROUSEL (Uber-style) */}
                            <View className="mb-8">
                                <Text className="px-6 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recommended for you</Text>
                                <FlatList
                                    data={RECOMMENDED_ADS}
                                    renderItem={renderAdItem}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    snapToInterval={width * 0.8}
                                    decelerationRate="fast"
                                    contentContainerStyle={{ paddingHorizontal: 24 }}
                                    keyExtractor={(item) => item.id}
                                />

                            </View>

                            <View className="px-6 pb-10">
                                <TouchableOpacity
                                    onPress={() => setCancelModalOpen(true)}
                                    className="w-full bg-red-600 py-4 rounded-2xl items-center flex-row justify-center shadow-md active:opacity-80"
                                >
                                    <Ionicons name="close-circle" size={20} color="white" />
                                    <Text className="ml-2 text-white font-black text-base uppercase tracking-widest">
                                        Cancel Request
                                    </Text>
                                </TouchableOpacity>

                            </View>
                        </View>
                    </Animated.View>
                </GestureDetector>

                {/* CANCELLATION MODAL */}
                <Modal visible={isCancelModalOpen} transparent animationType="fade">
                    <View className="flex-1 bg-black/60 justify-end">
                        <Animated.View entering={SlideInDown} exiting={SlideOutDown} className="bg-white rounded-t-[32px] p-8 pb-12">
                            <Text className="text-2xl font-black text-gray-900 mb-2">Cancel Service?</Text>
                            <Text className="text-gray-500 mb-6">Please tell us why you want to cancel the request.</Text>

                            {['Mechanic delayed', 'Found help elsewhere', 'Incorrect details', 'Other'].map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    onPress={() => setSelectedReason(reason)}
                                    className={`flex-row items-center justify-between p-4 mb-3 rounded-2xl border ${selectedReason === reason ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100'}`}
                                >
                                    <Text className={`font-bold ${selectedReason === reason ? 'text-blue-600' : 'text-gray-700'}`}>{reason}</Text>
                                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selectedReason === reason ? 'border-blue-500' : 'border-gray-300'}`}>
                                        {selectedReason === reason && <View className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View className="flex-row space-x-3 mt-6">
                                <TouchableOpacity onPress={() => setCancelModalOpen(false)} className="flex-1 py-4 bg-gray-100 rounded-2xl items-center">
                                    <Text className="font-bold text-gray-700">Go Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCancelConfirm} disabled={!selectedReason} className={`flex-1 py-4 rounded-2xl items-center ${selectedReason ? 'bg-red-500' : 'bg-gray-200'}`}>
                                    <Text className="font-bold text-white">Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                </Modal>
            </View>
        </GestureHandlerRootView>
    );
};

const styles = StyleSheet.create({
    pulseRing: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#3b82f6',
        borderWidth: 1,
        borderColor: '#3b82f6'
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: height,
        top: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 25,
    },
    scanLine: {
        height: '100%',
        width: '40%',
        backgroundColor: '#3b82f6',
    }
});

export default FindingMechanicScreen;