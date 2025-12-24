import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { Dimensions, Image, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import ConnectionStatus from '../components/ConnectionStatus';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const { width, height } = Dimensions.get('window');

// Dynamic Snap Points
const SNAP_POINTS = {
    COLLAPSED: height * 0.75, // Lower on screen (showing less)
    EXPANDED: height * 0.4,   // Higher on screen (showing more)
};

const DashboardScreen = ({ navigation }) => {
    const { logout, profile } = useAuth();
    const userProfile = profile || {}; // Safety fallback

    const [recentHistory, setRecentHistory] = useState([]);

    const [activeJob, setActiveJob] = useState(null);

    // Animation Values
    const translateY = useSharedValue(SNAP_POINTS.COLLAPSED);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            checkActiveJob();
            getUserLocation();
        });

        fetchRecentHistory();
        checkActiveJob();
        getUserLocation();

        return unsubscribe;
    }, [navigation]);

    const getUserLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                console.log('Permission to access location was denied');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            setRegion({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
        } catch (err) {
            console.warn("Error getting location:", err);
        }
    };

    const checkActiveJob = async () => {
        try {
            const saved = await SecureStore.getItemAsync('mechanicAcceptedData'); // ACTIVE_JOB_STORAGE_KEY
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log("Found active job:", parsed.request_id);
                setActiveJob(parsed);
                // We no longer auto-navigate, just show the card
            } else {
                setActiveJob(null);
            }
        } catch (error) {
            console.error("Failed to check active job", error);
        }
    };

    const handleOpenActiveJob = () => {
        if (activeJob) {
            navigation.navigate("MechanicFound", {
                data: {
                    mechanic_details: activeJob.mechanic,
                    job_id: activeJob.request_id,
                },
                userLocation: activeJob.user_location
            });
        }
    };

    // ... history code ...

    const fetchRecentHistory = async () => {
        try {
            const res = await api.get('/Profile/UserHistory/');
            const sorted = res.data?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) || [];
            setRecentHistory(sorted.slice(0, 3));
        } catch (err) {
            console.error("Dashboard history fetch error:", err);
        }
    };

    // ... gestures ...
    // --- Bottom Sheet Gesture ---
    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = event.translationY + context.value.y;
            // Limit movement
            translateY.value = Math.max(translateY.value, SNAP_POINTS.EXPANDED - 50);
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
        };
    });

    // Default location (Fallback until permissions granted)
    const [region, setRegion] = useState({
        latitude: 23.0225,
        longitude: 72.5714,
        latitudeDelta: 0.1, // Zoomed out initially
        longitudeDelta: 0.1,
    });
    // This listener runs every time the Dashboard becomes visible again
    const unsubscribe = navigation.addListener('focus', () => {
        checkActiveJob(); // This will now find 'null' because you cleared the key
        getUserLocation();
    });
    const getStatusIcon = (type) => type === 'car' ? 'car-sport' : 'motorbike';

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

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <View className="flex-1 bg-white">
                <StatusBar barStyle="dark-content" />

                {/* Header - Transparent/Overlay */}
                <View className="absolute top-0 left-0 right-0 z-10">
                    <SafeAreaView className="bg-white/90 shadow-sm border-b border-gray-200">
                        <View className="px-4 py-3 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <Image
                                    source={require('../../assets/logo.png')}
                                    className="w-10 h-10"
                                    resizeMode="contain"
                                />
                                <Text className="text-xl font-bold text-gray-900 tracking-wide ml-2">Mechanic Setu</Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => navigation.navigate('Settings')}
                                className="p-2 bg-gray-100 rounded-full"
                            >
                                <Ionicons name="settings-outline" size={24} color="#374151" />
                            </TouchableOpacity>
                        </View>
                    </SafeAreaView>
                </View>

                {/* Map Background */}
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={{ flex: 1, width: '100%', height: '100%' }}
                    region={region}
                    customMapStyle={mapStyle}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                >
                </MapView>

                {/* Floating Connection Status */}
                <ConnectionStatus />

                {/* Draggable Bottom Sheet */}
                <GestureDetector gesture={gesture}>
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                height: height, // Content height
                                top: 0, // We offset using translateY
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

                        <View className="px-6 pb-20">
                            {/* User Profile Card */}
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Profile')}
                                className="flex-row items-center bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100"
                            >
                                {userProfile.profile_pic ? (
                                    <Image source={{ uri: userProfile.profile_pic }} className="w-12 h-12 rounded-full mr-4" />
                                ) : (
                                    <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-4">
                                        <Text className="text-xl font-bold text-blue-600">
                                            {userProfile.first_name ? userProfile.first_name[0] : 'U'}
                                        </Text>
                                    </View>
                                )}
                                <View className="flex-1">
                                    <Text className="text-lg font-bold text-gray-900">
                                        {userProfile.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}` : 'Welcome User'}
                                    </Text>
                                    <Text className="text-sm text-gray-500">{userProfile.email || 'No Email'}</Text>
                                </View>
                                <View className="bg-gray-200 p-2 rounded-full">
                                    <Ionicons name="arrow-forward" size={20} color="#4b5563" />
                                </View>
                            </TouchableOpacity>

                            {/* Active Job or Request Button */}
                            {activeJob ? (
                                <TouchableOpacity
                                    className="w-full p-4 rounded-xl bg-green-500 shadow-lg shadow-green-500/30 active:scale-95 transition-transform mb-8 items-center flex-row justify-between"
                                    onPress={handleOpenActiveJob}
                                >
                                    <View>
                                        <Text className="text-white font-bold text-lg">Active Service</Text>
                                        <Text className="text-green-100 text-sm">Mechanic {activeJob.mechanic?.first_name} is active</Text>
                                    </View>
                                    <View className="bg-white/20 p-2 rounded-full">
                                        <Ionicons name="navigate-circle" size={32} color="white" />
                                    </View>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    className="w-full py-4 rounded-xl bg-blue-500 shadow-lg shadow-blue-500/30 active:scale-95 transition-transform mb-8"
                                    onPress={() => navigation.navigate("ServiceRequest")}
                                >
                                    <LinearGradient
                                        colors={['#3b82f6', '#2563eb']}
                                        className="absolute inset-0 rounded-xl"
                                    />
                                    <Text className="text-white text-center font-bold text-lg tracking-wide">
                                        Request Now
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {/* Recent Activity Section */}
                            <View className="mb-4">
                                <Text className="text-lg font-bold text-gray-900 mb-4">Recent Activity</Text>
                                {recentHistory.length > 0 ? (
                                    recentHistory.map((item) => (
                                        <View key={item.id} className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-3 border border-gray-100">
                                            <View className="flex-row items-center space-x-3">
                                                <View className={`p-2 rounded-full ${item.status === 'COMPLETED' ? 'bg-green-100' : 'bg-gray-200'}`}>
                                                    {item.vehical_type === 'car' ? (
                                                        <Ionicons name="car-sport" size={18} color={item.status === 'COMPLETED' ? '#16a34a' : '#6b7280'} />
                                                    ) : (
                                                        <MaterialCommunityIcons name="motorbike" size={18} color={item.status === 'COMPLETED' ? '#16a34a' : '#6b7280'} />
                                                    )}
                                                </View>
                                                <View>
                                                    <Text className="text-gray-900 font-bold">{item.problem}</Text>
                                                    <Text className="text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</Text>
                                                </View>
                                            </View>
                                            <Text className={`text-xs font-bold ${item.status === 'COMPLETED' ? 'text-green-600' :
                                                item.status === 'CANCELLED' ? 'text-red-500' : 'text-gray-500'
                                                }`}>
                                                {item.status}
                                            </Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text className="text-gray-400 text-center italic">No recent activity.</Text>
                                )}
                            </View>
                        </View>
                    </Animated.View>
                </GestureDetector>
            </View>
        </GestureHandlerRootView>
    );
};

export default DashboardScreen;
