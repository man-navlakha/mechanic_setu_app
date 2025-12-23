
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';

import DashboardScreen from './DashboardScreen';
import HistoryScreen from './HistoryScreen';
import ProfileScreen from './ProfileScreen';

const Tab = createBottomTabNavigator();

const MainTabs = () => {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarShowLabel: false,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: 25,
                    left: 20,
                    right: 20,
                    elevation: 5,
                    backgroundColor: '#ffffff',
                    borderRadius: 20,
                    height: 70,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 10,
                    borderTopWidth: 0,
                    ...styles.shadow,
                },
                tabBarActiveTintColor: '#16a34a', // Brand green
                tabBarInactiveTintColor: '#9ca3af', // Gray
            })}
        >
            <Tab.Screen
                name="Home"
                component={DashboardScreen}
                options={{
                    tabBarIcon: ({ focused, color, size }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: 0 }}>
                            <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} />
                            {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 4 }} />}
                        </View>
                    )
                }}
            />
            <Tab.Screen
                name="History"
                component={HistoryScreen}
                options={{
                    tabBarIcon: ({ focused, color, size }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: 0 }}>
                            <Ionicons name={focused ? "time" : "time-outline"} size={24} color={color} />
                            {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 4 }} />}
                        </View>
                    )
                }}
            />
            <Tab.Screen
                name="ProfileTab"
                component={ProfileScreen}
                options={{
                    tabBarIcon: ({ focused, color, size }) => (
                        <View style={{ alignItems: 'center', justifyContent: 'center', top: 0 }}>
                            <Ionicons name={focused ? "person" : "person-outline"} size={24} color={color} />
                            {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 4 }} />}
                        </View>
                    )
                }}
            />
        </Tab.Navigator>
    );
};

const styles = StyleSheet.create({
    shadow: {
        shadowColor: '#111827',
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.5,
        elevation: 5,
    }
});

export default MainTabs;
