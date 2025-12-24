import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import './global.css';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { WebSocketProvider } from './src/context/WebSocketContext';

// Configure Reanimated to suppress strict mode warnings
configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
});

// Import Screens
import DashboardScreen from './src/screens/DashboardScreen';
import FindingMechanicScreen from './src/screens/FindingMechanicScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import LegalScreen from './src/screens/LegalScreen';
import LoginScreen from './src/screens/LoginScreen';
import MechanicFoundScreen from './src/screens/MechanicFoundScreen';
import OTPScreen from './src/screens/OTPScreen';
import ProcessFormScreen from './src/screens/ProcessFormScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import ServiceRequestScreen from './src/screens/ServiceRequestScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

const Navigation = () => {
    const { isAuthenticated } = useAuth();

    if (isAuthenticated === null) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-900">
                <ActivityIndicator size="large" color="#2563eb" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                {!isAuthenticated ? (
                    <>
                        <Stack.Screen name="Login" component={LoginScreen} />
                        <Stack.Screen name="Verify" component={OTPScreen} />
                        <Stack.Screen name="ProcessForm" component={ProcessFormScreen} />
                    </>
                ) : (
                    <>
                        <Stack.Screen name="Main" component={DashboardScreen} />
                        <Stack.Screen name="Profile" component={ProfileScreen} />
                        <Stack.Screen name="History" component={HistoryScreen} />
                        <Stack.Screen name="ServiceRequest" component={ServiceRequestScreen} />
                        <Stack.Screen name="FindingMechanic" component={FindingMechanicScreen} />
                        <Stack.Screen name="MechanicFound" component={MechanicFoundScreen} />
                        <Stack.Screen name="Settings" component={SettingsScreen} />
                        <Stack.Screen name="Legal" component={LegalScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
    return (
        <SafeAreaProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <AuthProvider>
                    <WebSocketProvider>
                        <Navigation />
                    </WebSocketProvider>
                </AuthProvider>
            </GestureHandlerRootView>
        </SafeAreaProvider>
    );
}
