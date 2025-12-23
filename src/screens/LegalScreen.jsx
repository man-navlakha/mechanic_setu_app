import { Ionicons } from '@expo/vector-icons';
import { Platform, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';

const LegalScreen = ({ navigation, route }) => {
    const { type, title } = route.params || {};

    const getContent = (type) => {
        switch (type) {
            case 'terms':
                return (
                    <View>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Welcome to Mechanic Setu. By using our app, you agree to the following terms and conditions...
                        </Text>
                        <Text className="font-bold text-gray-800 mb-2">1. Service Usage</Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            You agree to use the service for lawful purposes only. Mechanic Setu connects users with mechanics...
                        </Text>
                        <Text className="font-bold text-gray-800 mb-2">2. User Responsibility</Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Users are responsible for their vehicle and personal safety. Mechanic Setu is a platform facilitator...
                        </Text>
                        {/* Add more dummy content or real content if available */}
                    </View>
                );
            case 'privacy':
                return (
                    <View>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your information.
                        </Text>
                        <Text className="font-bold text-gray-800 mb-2">Data Collection</Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            We collect location data to connect you with nearby mechanics. We also collect contact information for account management.
                        </Text>
                        <Text className="font-bold text-gray-800 mb-2">Data Security</Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            We implement security measures to ensure your data is safe...
                        </Text>
                    </View>
                );
            case 'about':
                return (
                    <View>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Mechanic Setu is dedicated to helping vehicle owners find reliable mechanics quickly and efficiently.
                        </Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Our mission is to bridge the gap between stranded drivers and skilled mechanics, ensuring help is always within reach.
                        </Text>
                        <Text className="font-bold text-gray-800 mb-2">Contact Us</Text>
                        <Text className="text-gray-600 mb-4 leading-6">
                            Email: support@mechanicsetu.com{'\n'}
                            Phone: +91 12345 67890
                        </Text>
                    </View>
                );
            default:
                return <Text className="text-gray-500">Content not available.</Text>;
        }
    };

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
                    <Text className="text-xl font-bold text-gray-900 flex-1" numberOfLines={1}>
                        {title || 'Legal Information'}
                    </Text>
                </View>
            </View>

            <ScrollView className="flex-1 px-5 py-6" showsVerticalScrollIndicator={false}>
                {getContent(type)}
                <View className="h-10" />
            </ScrollView>
        </View>
    );
};

export default LegalScreen;
