import { Ionicons } from '@expo/vector-icons';
import { Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import packageJson from '../../app.json'; // To get version if available, or hardcode
import { useAuth } from '../context/AuthContext';

const SettingsScreen = ({ navigation }) => {
    const { logout, profile } = useAuth();
    const appVersion = packageJson?.expo?.version || '1.0.0';

    const MenuItem = ({ icon, label, onPress, color = "#374151" }) => (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-3 border border-gray-100 active:bg-gray-100"
        >
            <View className="flex-row items-center space-x-3">
                <View className="bg-white p-2 rounded-full shadow-sm">
                    <Ionicons name={icon} size={20} color={color} />
                </View>
                <Text className="text-gray-700 font-medium text-base ml-3">{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className={`bg-white px-4 pb-4 border-b border-gray-200 ${Platform.OS === 'android' ? 'pt-12' : 'pt-4'}`}>
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="p-2 bg-gray-100 rounded-full mr-4"
                    >
                        <Ionicons name="arrow-back" size={24} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-2xl font-bold text-gray-900">Settings</Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>

                {/* Profile Section */}
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Account</Text>
                <MenuItem
                    icon="person"
                    label="My Profile"
                    onPress={() => navigation.navigate('Profile')}
                    color="#2563eb"
                />
                <MenuItem
                    icon="construct"
                    label="Request Service"
                    onPress={() => navigation.navigate('ServiceRequest')}
                    color="#f59e0b"
                />
                {/*  Previous Requests / History could go here too but user said "request now" specifically */}


                {/* Legal & About Section */}
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-4 ml-1">Legal & Support</Text>

                <MenuItem
                    icon="document-text"
                    label="Terms & Conditions"
                    onPress={() => navigation.navigate('Legal', { type: 'terms', title: 'Terms & Conditions' })}
                />
                <MenuItem
                    icon="shield-checkmark"
                    label="Privacy Policy"
                    onPress={() => navigation.navigate('Legal', { type: 'privacy', title: 'Privacy Policy' })}
                />
                <MenuItem
                    icon="information-circle"
                    label="About Us"
                    onPress={() => navigation.navigate('Legal', { type: 'about', title: 'About Us' })}
                />

                {/* App Actions */}
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-4 ml-1">App</Text>
                <TouchableOpacity
                    onPress={logout}
                    className="flex-row items-center justify-between p-4 bg-red-50 rounded-xl mb-3 border border-red-100 active:bg-red-100"
                >
                    <View className="flex-row items-center space-x-3">
                        <View className="bg-white p-2 rounded-full shadow-sm">
                            <Ionicons name="log-out" size={20} color="#dc2626" />
                        </View>
                        <Text className="text-red-600 font-medium text-base ml-3">Logout</Text>
                    </View>
                </TouchableOpacity>

                {/* Version Info */}
                <View className="items-center mt-6 mb-10">
                    <Text className="text-gray-400 text-sm">Version {appVersion}</Text>
                    <Text className="text-gray-300 text-xs mt-1">Mechanic Setu © 2025</Text>
                </View>

            </ScrollView>
        </View>
    );
};

export default SettingsScreen;
