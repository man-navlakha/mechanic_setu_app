import { Ionicons } from '@expo/vector-icons';
import { Dimensions, Image, Text, TouchableOpacity, View } from 'react-native';

const { width } = Dimensions.get('window');

export const ImageAdCard = ({ item }) => (
    <TouchableOpacity
        className="rounded-3xl shadow-lg overflow-hidden mb-4 relative"
        style={{ width: '100%', backgroundColor: item.bgColor }}
    >
        {/* Ads Badge */}
        <View className="absolute top-3 left-3 bg-white/90 px-3 py-1 rounded-full z-10 flex-row items-center">
            <View className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5" />
            <Text className="text-gray-600 font-bold text-xs">Ad</Text>
        </View>

        {/* Badge (Limited Offer, Price, etc) */}
        {item.badge && (
            <View
                className="absolute top-3 right-3 px-3 py-1.5 rounded-full z-10"
                style={{ backgroundColor: item.accentColor }}
            >
                <Text className="text-white font-black text-xs uppercase tracking-wider">
                    {item.badge}
                </Text>
            </View>
        )}

        {/* Content Container */}
        <View className="p-5">
            {/* Main Image */}
            <View className="items-center justify-center mb-4 mt-4">
                <Image
                    source={{ uri: item.image }}
                    style={{ width: 120, height: 120 }}
                    resizeMode="contain"
                />
            </View>

            {/* Text Content */}
            <View className="mb-4">
                <Text className="font-black text-xl mb-1" style={{ color: item.accentColor }}>
                    {item.title}
                </Text>
                <Text className="text-gray-700 font-bold text-base mb-2">
                    {item.subtitle}
                </Text>
                <Text className="text-gray-600 text-sm leading-5" numberOfLines={2}>
                    {item.description}
                </Text>
            </View>

            {/* CTA Button */}
            <TouchableOpacity
                className="py-3 px-6 rounded-xl flex-row items-center justify-center"
                style={{ backgroundColor: item.accentColor }}
            >
                <Text className="text-white font-bold text-sm mr-2">
                    {item.ctaText}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="white" />
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
);
