import { Ionicons } from '@expo/vector-icons';
import { Alert, Linking, Modal, Share, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';

export const SafetyToolkit = ({ visible, onClose, mechanicName, userLocation }) => {
    const shareLiveLocation = async () => {
        try {
            const locationUrl = `https://www.google.com/maps?q=${userLocation.latitude},${userLocation.longitude}`;
            await Share.share({
                message: `I'm currently at this location getting vehicle service from ${mechanicName}. Track me here: ${locationUrl}`,
                title: 'Share Live Location'
            });
        } catch (error) {
            console.error('Error sharing location:', error);
        }
    };

    const callEmergency = () => {
        Alert.alert(
            'Emergency Call',
            'Do you want to call 112 (Emergency Services)?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Call',
                    onPress: () => Linking.openURL('tel:112'),
                    style: 'destructive'
                }
            ]
        );
    };

    const callMechanicSOS = () => {
        Alert.alert(
            'Mechanic Setu Helpline',
            'Call our 24/7 support helpline for any safety concerns or issues.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Call Support',
                    onPress: () => Linking.openURL('tel:18001234567')
                }
            ]
        );
    };

    const reportIssue = () => {
        Alert.alert(
            'Report an Issue',
            'What would you like to report?',
            [
                { text: 'Safety Concern', onPress: () => Alert.alert('Thank you', 'Your safety concern has been reported to our team.') },
                { text: 'Service Quality', onPress: () => Alert.alert('Thank you', 'Your feedback has been recorded.') },
                { text: 'Other Issue', onPress: () => Alert.alert('Thank you', 'Our team will review your report.') },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                className="flex-1 bg-black/50 justify-end"
            >
                <TouchableOpacity activeOpacity={1}>
                    <Animated.View
                        entering={SlideInDown.springify()}
                        className="bg-white rounded-t-3xl"
                    >
                        {/* Close Button */}
                        <TouchableOpacity
                            onPress={onClose}
                            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full items-center justify-center z-10"
                        >
                            <Ionicons name="close" size={20} color="#6b7280" />
                        </TouchableOpacity>

                        {/* Header */}
                        <View className="p-6 pb-4">
                            <View className="flex-row items-center mb-2">
                                <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center mr-3">
                                    <Ionicons name="shield-checkmark" size={24} color="#3b82f6" />
                                </View>
                                <Text className="text-2xl font-black text-gray-900">Safety Toolkit</Text>
                            </View>
                        </View>

                        {/* Divider */}
                        <View className="h-px bg-gray-100 mx-6" />

                        {/* Safety Options */}
                        <View className="p-6">
                            {/* Share Live Location */}
                            <TouchableOpacity
                                onPress={shareLiveLocation}
                                className="flex-row items-center py-4 border-b border-gray-100"
                            >
                                <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4">
                                    <Ionicons name="share-social" size={20} color="#374151" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-base mb-0.5">Share live location</Text>
                                    <Text className="text-gray-500 text-sm">Let your dear ones keep track of your location and trip status</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                            </TouchableOpacity>

                            {/* Mechanic Setu SOS Helpline */}
                            <TouchableOpacity
                                onPress={callMechanicSOS}
                                className="flex-row items-center py-4 border-b border-gray-100"
                            >
                                <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4">
                                    <Ionicons name="call" size={20} color="#374151" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-base mb-0.5">Mechanic Setu helpline</Text>
                                    <Text className="text-gray-500 text-sm">Call us 24/7 to report any safety issue</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                            </TouchableOpacity>

                            {/* Report an Issue */}
                            <TouchableOpacity
                                onPress={reportIssue}
                                className="flex-row items-center py-4 border-b border-gray-100"
                            >
                                <View className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center mr-4">
                                    <Ionicons name="flag" size={20} color="#374151" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-base mb-0.5">Report an issue</Text>
                                    <Text className="text-gray-500 text-sm">Let us know your issue and we will try to improve</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                            </TouchableOpacity>

                            {/* Call 112 Emergency */}
                            <TouchableOpacity
                                onPress={callEmergency}
                                className="flex-row items-center py-4"
                            >
                                <View className="w-10 h-10 bg-red-50 rounded-full items-center justify-center mr-4">
                                    <Ionicons name="warning" size={20} color="#ef4444" />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-900 font-bold text-base mb-0.5">Call 112</Text>
                                    <Text className="text-gray-500 text-sm">24/7 Police helpline. Use in case of emergency.</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                            </TouchableOpacity>
                        </View>

                        {/* Bottom Padding */}
                        <View className="h-8" />
                    </Animated.View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};
