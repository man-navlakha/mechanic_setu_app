
import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useWebSocket } from '../context/WebSocketContext';

const { width, height } = Dimensions.get('window');

const ConnectionStatus = () => {
    const { connectionStatus } = useWebSocket();

    const translateX = useSharedValue(width - 120); // Initial X position
    const translateY = useSharedValue(height - 220); // Initial Y position
    const context = useSharedValue({ x: 0, y: 0 });

    const dragGesture = Gesture.Pan()
        .onStart(() => {
            context.value = { x: translateX.value, y: translateY.value };
        })
        .onUpdate((event) => {
            translateX.value = event.translationX + context.value.x;
            translateY.value = event.translationY + context.value.y;
        })
        .onEnd(() => {
            // Optional: Snap to edge
            if (translateX.value > width / 2) {
                translateX.value = withSpring(width - 150, { damping: 15 });
            } else {
                translateX.value = withSpring(20, { damping: 15 });
            }
        });

    const rStyle = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value }
            ],
        };
    });

    let iconName, statusText, colorClass, bgColorClass;

    switch (connectionStatus) {
        case 'connected':
            iconName = "wifi";
            statusText = "Connected";
            colorClass = "text-green-600";
            bgColorClass = "bg-green-50 border-green-200";
            break;
        case 'connecting':
            iconName = "time";
            statusText = "Connecting...";
            colorClass = "text-yellow-600";
            bgColorClass = "bg-yellow-50 border-yellow-200";
            break;
        default:
            iconName = "wifi-outline"; // or wifi-off if available in set
            statusText = "Disconnected";
            colorClass = "text-red-600";
            bgColorClass = "bg-red-50 border-red-200";
            break;
    }

    // Only render if you want it visible always, or conditionally
    return (
        <GestureDetector gesture={dragGesture}>
            <Animated.View
                style={[
                    { position: 'absolute', zIndex: 100 },
                    rStyle
                ]}
            >
                <View className={`flex-row items-center px-4 py-2 rounded-full border shadow-sm ${bgColorClass}`}>
                    <Ionicons name={iconName} size={16} className={`mr-2 ${colorClass}`} style={{ marginRight: 6 }} color={connectionStatus === 'connected' ? '#16a34a' : connectionStatus === 'connecting' ? '#ca8a04' : '#dc2626'} />
                    <Text className={`text-xs font-bold ${colorClass}`}>
                        {statusText}
                    </Text>
                </View>
            </Animated.View>
        </GestureDetector>
    );
};

export default ConnectionStatus;
