
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    SafeAreaView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import Animated, { SlideInDown, SlideOutDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWebSocket } from '../context/WebSocketContext';
import api from '../utils/api';

const { width, height } = Dimensions.get('window');

const SNAP_POINTS = {
    COLLAPSED: height - 320,
    EXPANDED: height * 0.4,
};

const FindingMechanicScreen = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { requestId, latitude, longitude, vehicleType, problem } = route.params || {};

    const { socket, lastMessage } = useWebSocket();
    const [searchTime, setSearchTime] = useState(0);
    const [isCancelModalOpen, setCancelModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState('');

    const translateY = useSharedValue(SNAP_POINTS.COLLAPSED);
    const context = useSharedValue({ y: 0 });

    useEffect(() => {
        // Timer
        const interval = setInterval(() => setSearchTime(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        // Subscribe to job updates
        if (socket && socket.readyState === WebSocket.OPEN && requestId) {
            console.log(`[FindingMechanic] Subscribing to job ${requestId}`);
            socket.send(JSON.stringify({
                type: 'subscribe_to_request',
                request_id: parseInt(requestId)
            }));
        }
    }, [socket, requestId]);

    useEffect(() => {
        if (!lastMessage) return;

        // Check if screen is focused to prevent background navigation
        if (!navigation.isFocused()) {
            console.log("[FindingMechanic] Ignoring Msg (background):", lastMessage.type);
            return;
        }

        console.log("[FindingMechanic] Msg:", lastMessage);

        if (lastMessage.type === 'mechanic_accepted') {
            navigation.navigate("MechanicFound", {
                data: lastMessage,
                userLocation: { latitude, longitude }
            });
        } else if (lastMessage.type === 'no_mechanic_found') {
            alert('No mechanic found. Please try again later.');
            navigation.goBack();
        }

    }, [lastMessage]);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = event.translationY + context.value.y;
            translateY.value = Math.max(translateY.value, SNAP_POINTS.EXPANDED - 50);
        })
        .onEnd(() => {
            if (translateY.value < (SNAP_POINTS.COLLAPSED + SNAP_POINTS.EXPANDED) / 2) {
                translateY.value = withSpring(SNAP_POINTS.EXPANDED, { damping: 15 });
            } else {
                translateY.value = withSpring(SNAP_POINTS.COLLAPSED, { damping: 15 });
            }
        });

    const rBottomSheetStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    const handleCancelConfirm = async () => {
        if (!selectedReason) {
            alert("Please select a reason");
            return;
        }

        try {
            setCancelModalOpen(false);

            await api.post(`jobs/CancelServiceRequest/${requestId}/`, {
                cancellation_reason: selectedReason
            });

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
            alert("Failed to cancel. Try again.");
            setCancelModalOpen(true);
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaView className="flex-1 bg-white">
                <View className="flex-1">
                    {/* Map Background */}
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={{ flex: 1 }}
                        initialRegion={{
                            latitude: latitude || 23.0225,
                            longitude: longitude || 72.5714,
                            latitudeDelta: 0.01,
                            longitudeDelta: 0.01,
                        }}
                        customMapStyle={[
                            {
                                "featureType": "poi",
                                "elementType": "labels.text",
                                "stylers": [{ "visibility": "off" }]
                            }
                        ]}
                    >
                        <Marker coordinate={{ latitude: latitude || 23.0225, longitude: longitude || 72.5714 }}>
                            <View className="items-center justify-center">
                                <View className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white" />
                                <View className="w-12 h-12 bg-blue-500/20 rounded-full absolute" />
                            </View>
                        </Marker>
                    </MapView>

                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="absolute top-12 left-4 bg-white p-2 rounded-full shadow-md z-10"
                    >
                        <Ionicons name="arrow-back" size={24} color="black" />
                    </TouchableOpacity>

                    {/* Draggable Bottom Sheet */}
                    <GestureDetector gesture={gesture}>
                        <Animated.View
                            style={[
                                {
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    height: height,
                                    top: 0,
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

                            <View className="px-6">
                                {/* Pulsing Loader */}
                                <View className="items-center mb-6">
                                    <View className="border-4 border-blue-100 rounded-full p-1 mb-4">
                                        <View className="bg-blue-50 p-4 rounded-full">
                                            <View className="bg-blue-100 p-4 rounded-full animate-pulse">
                                                <Ionicons name="search" size={32} color="#3b82f6" />
                                            </View>
                                        </View>
                                    </View>

                                    <Text className="text-xl font-bold text-gray-900">Finding nearby mechanics...</Text>
                                    <Text className="text-gray-500 mt-1 text-center px-4 text-xs">
                                        We are notifying mechanics near your location. This usually takes 1-2 minutes.
                                    </Text>
                                </View>

                                {/* Timer & Request Details */}
                                <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl mb-6">
                                    <View className="flex-row items-center space-x-2">
                                        <Ionicons name="time-outline" size={20} color="#6b7280" />
                                        <Text className="text-gray-900 font-mono font-bold text-lg">{formatTime(searchTime)}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-xs text-gray-400 font-bold uppercase">Vehicle</Text>
                                        <Text className="text-gray-900 font-semibold capitlize">{vehicleType || 'Car'}</Text>
                                    </View>
                                </View>

                                {/* Cancel Button */}
                                <TouchableOpacity
                                    onPress={() => setCancelModalOpen(true)}
                                    className="w-full py-4 bg-red-50 rounded-xl items-center border border-red-100 active:bg-red-100 mb-8"
                                >
                                    <Text className="text-red-500 font-bold text-base">Cancel Request</Text>
                                </TouchableOpacity>

                                {/* ADS Section */}
                                <View className="pt-4 border-t border-gray-100">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-gray-900 font-bold text-base">Sponsored</Text>
                                        <Text className="text-gray-400 text-xs">Ad</Text>
                                    </View>

                                    <View className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex-row items-center space-x-4">
                                        <View className="w-16 h-16 bg-blue-100 rounded-lg items-center justify-center">
                                            <Ionicons name="car-sport" size={32} color="#2563eb" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-bold text-lg">Castrol Engine Oil</Text>
                                            <Text className="text-gray-500 text-xs leading-4">
                                                Get 20% off on your next oil change with our premium partners.
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                                    </View>

                                    <View className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex-row items-center space-x-4 mt-3">
                                        <View className="w-16 h-16 bg-yellow-100 rounded-lg items-center justify-center">
                                            <Ionicons name="shield-checkmark" size={32} color="#d97706" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className="text-gray-900 font-bold text-lg">Full Insurance</Text>
                                            <Text className="text-gray-500 text-xs leading-4">
                                                Protect your ride starting at just ₹99/month.
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                                    </View>
                                </View>

                            </View>
                        </Animated.View>
                    </GestureDetector>
                </View>

                {/* Cancel Modal */}
                <Modal
                    visible={isCancelModalOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCancelModalOpen(false)}
                >
                    <View className="flex-1 bg-black/50 justify-end">
                        <Animated.View
                            entering={SlideInDown}
                            exiting={SlideOutDown}
                            className="bg-white rounded-t-3xl p-6 pb-12"
                        >
                            <Text className="text-xl font-bold text-gray-900 mb-4">Why do you want to cancel?</Text>

                            {['Mechanic delayed', 'Changed my mind', 'Found help elsewhere', 'Other'].map((reason) => (
                                <TouchableOpacity
                                    key={reason}
                                    onPress={() => setSelectedReason(reason)}
                                    className={`flex-row items-center justify-between p-4 mb-3 rounded-xl border ${selectedReason === reason ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
                                        }`}
                                >
                                    <Text className={`font-semibold ${selectedReason === reason ? 'text-red-600' : 'text-gray-700'}`}>
                                        {reason}
                                    </Text>
                                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selectedReason === reason ? 'border-red-500' : 'border-gray-300'
                                        }`}>
                                        {selectedReason === reason && <View className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View className="flex-row space-x-4 mt-4">
                                <TouchableOpacity
                                    onPress={() => setCancelModalOpen(false)}
                                    className="flex-1 py-4 bg-gray-200 rounded-xl items-center"
                                >
                                    <Text className="font-bold text-gray-700">Don't Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleCancelConfirm}
                                    disabled={!selectedReason}
                                    className={`flex-1 py-4 rounded-xl items-center ${selectedReason ? 'bg-red-500 shadow-lg shadow-red-200' : 'bg-gray-300'
                                        }`}
                                >
                                    <Text className="font-bold text-white">Cancel Request</Text>
                                </TouchableOpacity>
                            </View>

                        </Animated.View>
                    </View>
                </Modal>

            </SafeAreaView>
        </GestureHandlerRootView>
    );
};

export default FindingMechanicScreen;
