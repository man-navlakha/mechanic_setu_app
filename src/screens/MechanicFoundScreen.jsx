import { Ionicons } from '@expo/vector-icons';
import Feather from '@expo/vector-icons/Feather';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Linking,
    Text,
    TouchableOpacity, View
} from 'react-native';
import { Gesture, GestureDetector, ScrollView } from 'react-native-gesture-handler';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ImageAdCard } from '../components/ImageAdCard';
import { SafetyToolkit } from '../components/SafetyToolkit';
import { useWebSocket } from '../context/WebSocketContext';
import { getMapAds } from '../utils/adsCache';
import { navigate, resetRoot } from '../utils/navigationRef';
import { updateMechanicTrackingNotification } from '../utils/notifications';


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

const MechanicFoundScreen = ({ route }) => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const {
        data: routeData,
        userLocation: paramLocation,
        vehicleType: fallbackVehicle,
        problem: fallbackProblem
    } = route.params || {};

    const { socket, lastMessage } = useWebSocket();
    console.log(routeData)
    console.log(paramLocation)

    // State
    const [mechanic, setMechanic] = useState(null);
    const [jobDetails, setJobDetails] = useState(null);
    const [userLocation, setUserLocation] = useState(paramLocation || null);
    const [mechanicLocation, setMechanicLocation] = useState(null);
    const [estimatedTime, setEstimatedTime] = useState(null);
    const [requestId, setRequestId] = useState(null);

    // Ads State
    const [adsData, setAdsData] = useState([]);
    const [selectedAd, setSelectedAd] = useState(null);

    // FIX: Mounted Ref to prevent memory leaks/crashes
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    useEffect(() => {
        const loadAds = async () => {
            const ads = await getMapAds();
            setAdsData(ads);
        };
        loadAds();
    }, []);

    const [isJobCompleted, setIsJobCompleted] = useState(false);
    const [isJobCancelledState, setIsJobCancelledState] = useState(false);
    const [isMechanicArrived, setIsMechanicArrived] = useState(false);
    const [showSafetyToolkit, setShowSafetyToolkit] = useState(false);

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
            top: 0,
            marginBottom: 16
        };
    });

    // Animated style for Safety button to follow bottom sheet
    const rSafetyButtonStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value - 80 }], // 80px above bottom sheet
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
                if (savedForm) {
                    const parsedForm = JSON.parse(savedForm);
                    setJobDetails(parsedForm);
                } else if (fallbackVehicle || fallbackProblem) {
                    // Use navigation fallbacks if storage is empty
                    setJobDetails({
                        vehicleType: fallbackVehicle,
                        problem: fallbackProblem
                    });
                }
            } catch (e) {
                console.error("Failed to load form data", e);
            }
        };

        loadInitialData();
    }, [routeData]);
    // WebSocket Updates (kept same)
    useEffect(() => {
        if (!lastMessage || !requestId || !isFocused) return;

        // Mechanic Location Update
        if (lastMessage.type === 'mechanic_location_update' && String(lastMessage.request_id) === String(requestId)) {
            setMechanicLocation({
                latitude: lastMessage.latitude,
                longitude: lastMessage.longitude
            });
        }
        const msgReqId = String(lastMessage.request_id || lastMessage.job_id);
        const currentReqId = String(requestId);

        if (msgReqId === currentReqId && isMounted.current) {
            switch (lastMessage.type) {
                case 'job_completed':
                    // Show success screen instead of alert
                    setIsJobCompleted(true);

                    // Cleanup storage
                    SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
                    SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

                    // Navigate home after delay
                    setTimeout(() => {
                        if (isMounted.current) navigate('Main');
                    }, 4000);
                    break;
                case 'job_cancelled':
                case 'job_cancelled_notification':
                    // Show cancellation screen
                    setIsJobCancelledState(true);

                    // Cleanup storage
                    SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
                    SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

                    // Navigate home after delay
                    setTimeout(() => {
                        if (isMounted.current) navigate('Main');
                    }, 4000);
                    break;
                // case 'no_mechanic_found':
                //     // IGNORE: Spurious message from server after mechanic already found
                //     // clearAndExit("We could not find a mechanic.");
                //     break;
                case 'mechanic_arrived':
                    setIsMechanicArrived(true);
                    Alert.alert("Mechanic Arrived", "The mechanic has arrived at your location!");
                    break;
            }
        }
    }, [lastMessage, requestId, isFocused]);

    // Calculate ETA and update notification
    useEffect(() => {
        if (userLocation && mechanicLocation && mechanic) {
            const eta = calculateETA(userLocation, mechanicLocation);
            setEstimatedTime(eta);

            // Calculate distance
            const distance = getDistanceFromLatLonInKm(
                userLocation.latitude,
                userLocation.longitude,
                mechanicLocation.latitude,
                mechanicLocation.longitude
            );

            // Update live notification with new ETA
            updateMechanicTrackingNotification({
                mechanicName: `${mechanic.first_name} ${mechanic.last_name}`,
                estimatedTime: eta,
                distance: distance
            });

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
            await SecureStore.deleteItemAsync(ACTIVE_JOB_STORAGE_KEY);
            await SecureStore.deleteItemAsync(FORM_STORAGE_KEY);

            if (msg) {
                Alert.alert("Notice", msg, [
                    {
                        text: "OK",
                        onPress: () => resetRoot('Main') // Use resetRoot here
                    }
                ]);
            } else {
                resetRoot('Main'); // Use resetRoot here
            }
        } catch (err) {
            resetRoot('Main');
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

    // --- ADS DATA & RENDERER ---
    const RECOMMENDED_ADS = [
        {
            id: '1',
            type: 'image',
            title: 'Flat 20% OFF',
            subtitle: 'on Premium Car Servicing',
            description: 'Book comprehensive car service at your doorstep',
            bgColor: '#EEF2FF',
            accentColor: '#4F46E5',
            image: 'https://cdn-icons-png.flaticon.com/512/3097/3097136.png',
            ctaText: 'Book Service',
            badge: 'LIMITED OFFER'
        },
        {
            id: '2',
            type: 'image',
            title: 'Roadside Assistance',
            subtitle: '24/7 Emergency Support',
            description: 'Get instant help anywhere, anytime',
            bgColor: '#FEF3C7',
            accentColor: '#F59E0B',
            image: 'https://cdn-icons-png.flaticon.com/512/2917/2917995.png',
            ctaText: 'Subscribe Now',
            badge: '₹99/Year'
        },
        {
            id: '3',
            type: 'image',
            title: 'Castrol Engine Oil',
            subtitle: 'Magnatec Protection',
            description: 'Premium engine oil with 75% less engine wear',
            bgColor: '#D1FAE5',
            accentColor: '#059669',
            image: 'https://cdn-icons-png.flaticon.com/512/2917/2917242.png',
            ctaText: 'Shop Now',
            badge: 'From ₹499'
        },
        {
            id: '4',
            type: 'image',
            title: 'Tyre Replacement',
            subtitle: 'Top Brands Available',
            description: 'Get the best deals on premium tyres',
            bgColor: '#FEE2E2',
            accentColor: '#DC2626',
            image: 'https://cdn-icons-png.flaticon.com/512/3097/3097039.png',
            ctaText: 'View Offers',
            badge: 'Save Big'
        },
        {
            id: '5',
            type: 'image',
            title: 'Battery Check',
            subtitle: 'Free Inspection',
            description: 'Avoid unexpected breakdowns with battery testing',
            bgColor: '#DBEAFE',
            accentColor: '#2563EB',
            image: 'https://cdn-icons-png.flaticon.com/512/2917/2917439.png',
            ctaText: 'Book Now',
            badge: 'FREE'
        },
    ];

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
                <TouchableOpacity onPress={() => resetRoot("Main")} className="mt-8 p-2">
                    <Text className="text-red-400">Cancel & Home</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Success View for Completion
    const renderCompletionSuccess = () => (
        <Animated.View
            entering={FadeIn}
            className="absolute top-0 left-0 right-0 bottom-0 bg-white z-50 items-center justify-center px-6"
        >
            <Animated.View
                entering={ZoomIn.delay(200)}
                className="w-32 h-32 bg-green-600 rounded-full items-center justify-center mb-8 shadow-xl shadow-green-200"
            >
                <Ionicons name="checkmark" size={64} color="white" />
            </Animated.View>

            <Animated.Text
                entering={FadeIn.delay(400)}
                className="text-2xl font-black text-gray-900 mb-2 tracking-wider uppercase text-center"
            >
                Service Completed
            </Animated.Text>

            <Animated.Text
                entering={FadeIn.delay(600)}
                className="text-gray-500 font-medium text-center mb-8 text-base"
            >
                Hope you are safe now. Thank you for using Mechanic Setu!
            </Animated.Text>

            {mechanic && (
                <Animated.View
                    entering={FadeIn.delay(800)}
                    className="bg-gray-50 p-4 rounded-2xl w-full items-center border border-gray-100 mb-8"
                >
                    <Text className="text-xs font-bold text-gray-400 uppercase mb-2">Service Provided By</Text>
                    <Text className="text-gray-900 font-bold text-lg text-center leading-6">
                        {mechanic.first_name} {mechanic.last_name}
                    </Text>
                </Animated.View>
            )}

            <Animated.Text
                entering={FadeIn.delay(1000)}
                className="text-gray-400 font-bold uppercase tracking-widest text-xs"
            >
                Redirecting to Home...
            </Animated.Text>
        </Animated.View>
    );

    // Cancellation View
    const renderCancellationSuccess = () => (
        <Animated.View
            entering={FadeIn}
            className="absolute top-0 left-0 right-0 bottom-0 bg-white z-50 items-center justify-center px-6"
        >
            <Animated.View
                entering={ZoomIn.delay(200)}
                className="w-32 h-32 bg-red-100 rounded-full items-center justify-center mb-8"
            >
                <Ionicons name="close" size={64} color="#dc2626" />
            </Animated.View>

            <Animated.Text
                entering={FadeIn.delay(400)}
                className="text-2xl font-black text-gray-900 mb-2 tracking-wider uppercase text-center"
            >
                Request Cancelled
            </Animated.Text>

            <Animated.Text
                entering={FadeIn.delay(600)}
                className="text-gray-500 font-medium text-center mb-8 text-base"
            >
                Your service request has been cancelled.
            </Animated.Text>

            <Animated.Text
                entering={FadeIn.delay(800)}
                className="text-gray-400 font-bold uppercase tracking-widest text-xs"
            >
                Redirecting to Home...
            </Animated.Text>
        </Animated.View>
    );

    return (
        <View style={{ flex: 1 }}>
            {isJobCompleted && renderCompletionSuccess()}
            {isJobCancelledState && renderCancellationSuccess()}
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

                    {adsData.map((ad) => (
                        <Marker
                            key={`ad-${ad.id}`}
                            coordinate={{ latitude: ad.latitude, longitude: ad.longitude }}
                            onPress={() => setSelectedAd(ad)}
                        >
                            <View className="bg-white p-0.5 rounded-full border-2 border-amber-400 shadow-lg overflow-hidden" style={{ width: 36, height: 36 }}>
                                <Image
                                    source={{ uri: ad.logo }}
                                    className="w-full h-full rounded-full"
                                    resizeMode="cover"
                                />
                            </View>
                        </Marker>
                    ))}
                </MapView>



                {/* Top Green Header */}
                <View className={`absolute -top-8 left-0 right-0 z-10 ${isMechanicArrived ? 'bg-blue-600' : 'bg-green-600'} shadow-md pb-4 pt-2`}>
                    <View className="px-4 flex-row mt-14 items-center pb-3 pt-4 mb-2">
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            className="mr-2"
                        >
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </TouchableOpacity>

                        <View className="flex-1 items-center mr-8">
                            <Text className={isMechanicArrived ? 'text-blue-100 text-xs font-bold uppercase tracking-wider mb-0.5' : 'text-white text-xs font-bold uppercase tracking-wider mb-0.5'}>
                                {isMechanicArrived ? 'Status Update' : 'Mechanic is on the way'}
                            </Text>
                            <Text className="text-white text-2xl font-extrabold">
                                {isMechanicArrived
                                    ? "Mechanic Arrived"
                                    : (estimatedTime ? `Arriving in ${estimatedTime} mins` : 'Calculating ETA...')
                                }
                            </Text>
                        </View>
                    </View>
                </View>
                {/* Safety Button - Follows Bottom Sheet */}
                <Animated.View
                    style={[
                        { position: 'absolute', top: 0, right: 16, zIndex: 20 },
                        rSafetyButtonStyle
                    ]}
                >
                    <TouchableOpacity
                        onPress={() => setShowSafetyToolkit(true)}
                        className="bg-white rounded-full shadow-lg px-4 py-2 flex-row items-center"
                        style={{ elevation: 5 }}
                    >
                        <Ionicons name="shield-checkmark" size={18} color="#3b82f6" />
                        <Text className="text-blue-600 font-bold text-sm ml-1.5">Safety</Text>
                    </TouchableOpacity>
                </Animated.View>
                {/* Draggable Bottom Sheet */}
                <GestureDetector gesture={gesture}>
                    <Animated.View style={[{ position: 'absolute', left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 10, paddingTop: 10, marginBottom: 3 }, rBottomSheetStyle]}>
                        {/* Drag Handle */}
                        <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-2" />


                        <ScrollView>
                            <View className="px-6 pb-10 mb-52 ">
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

                                {/* Having an Issue Banner */}
                                <TouchableOpacity
                                    onPress={() => setShowSafetyToolkit(true)}
                                    className="bg-blue-50 rounded-2xl p-4 mb-6 flex-row items-center"
                                >
                                    <View className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center mr-3">
                                        <Ionicons name="headset" size={20} color="white" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-gray-900 font-bold text-base">Having an issue?</Text>
                                        <Text className="text-gray-500 text-sm">We're a tap away</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                                </TouchableOpacity>

                                {/* ADS CAROUSEL (Uber-style) */}
                                <View className="mb-6  ">

                                    <Text className="mr-6 text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Recommended for you</Text>
                                    <FlatList
                                        data={RECOMMENDED_ADS}
                                        renderItem={({ item }) => <ImageAdCard item={item} />}
                                        scrollEnabled={false}
                                        keyExtractor={(item) => item.id}
                                    />
                                </View>

                                <TouchableOpacity onPress={() => navigation.navigate('Cancellation', { requestId })} className="w-full py-4 rounded-xl bg-red-50 flex-row items-center justify-center border border-red-100 mb-36"><Text className="text-red-500 font-bold">Cancel Request</Text></TouchableOpacity>
                            </View>
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>


            </View>

            {/* Safety Toolkit Modal */}
            <SafetyToolkit
                visible={showSafetyToolkit}
                onClose={() => setShowSafetyToolkit(false)}
                mechanicName={mechanic ? `${mechanic.first_name} ${mechanic.last_name}` : 'your mechanic'}
                userLocation={userLocation}
            />
        </View >
    );
};

const VueAvatarInitials = ({ name }) => (
    <View className="w-full h-full items-center justify-center bg-gray-300">
        <Text className="text-xl font-bold text-gray-600">{name ? name[0] : 'M'}</Text>
    </View>
);

export default MechanicFoundScreen;
