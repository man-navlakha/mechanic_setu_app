
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const ProfileScreen = ({ navigation }) => {
    const { logout, profile: authUser, checkAuth } = useAuth();
    // Stores the full list from API
    const [allHistory, setAllHistory] = useState([]);
    // Stores the currently displayed list
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Pagination constants
    const ITEMS_PER_PAGE = 10;

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Refresh global auth user to get latest profile
            await checkAuth();
            // Fetch history locally
            await fetchHistory();
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Use authUser from context as the primary source of truth
    const userData = authUser || {};

    const fetchHistory = async () => {
        try {
            const res = await api.get('/Profile/UserHistory/');
            const fullList = res.data || [];

            // Sort by Date Descending (Newest first)
            // Assuming created_at is an ISO string
            fullList.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            setAllHistory(fullList);
            // Initial slice
            setHistory(fullList.slice(0, ITEMS_PER_PAGE));
        } catch (err) {
            console.error("History fetch error:", err);
        }
    };

    const loadMoreHistory = () => {
        const currentLength = history.length;
        const nextChunk = allHistory.slice(currentLength, currentLength + ITEMS_PER_PAGE);
        if (nextChunk.length > 0) {
            setHistory(prev => [...prev, ...nextChunk]);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchAllData();
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED': return 'bg-green-100 text-green-700 border-green-500';
            case 'CANCELLED': return 'bg-red-100 text-red-700 border-red-500';
            case 'EXPIRED': return 'bg-gray-100 text-gray-700 border-gray-500';
            default: return 'bg-gray-100 text-gray-700 border-gray-400';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const renderHistoryItem = (item) => {
        const statusStyle = getStatusColor(item.status);
        const isCompleted = item.status === 'COMPLETED';

        return (
            <View key={item.id} className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-row items-center space-x-2">
                        <View className={`p-2 rounded-full ${item.status === 'COMPLETED' ? 'bg-green-50' : 'bg-red-50'}`}>
                            {item.vehical_type === 'car' ? (
                                <Ionicons name="car-sport" size={20} color={item.status === 'COMPLETED' ? '#16a34a' : '#ef4444'} />
                            ) : (
                                <MaterialCommunityIcons name="motorbike" size={20} color={item.status === 'COMPLETED' ? '#16a34a' : '#ef4444'} />
                            )}
                        </View>
                        <View>
                            <Text className="text-gray-900 font-bold text-base">{item.problem}</Text>
                            <Text className="text-xs text-gray-400">{formatDate(item.created_at)}</Text>
                        </View>
                    </View>
                    <View className={`px-2 py-1 rounded-lg border ${statusStyle.split(' ')[2]} ${statusStyle.split(' ')[0]}`}>
                        <Text className={`text-xs font-bold ${statusStyle.split(' ')[1]}`}>{item.status}</Text>
                    </View>
                </View>

                <View className="mt-2 space-y-1">
                    <View className="flex-row items-start">
                        <Ionicons name="location-sharp" size={14} color="#9ca3af" style={{ marginTop: 2, marginRight: 4 }} />
                        <Text className="text-gray-500 text-sm flex-1" numberOfLines={2}>
                            {item.location}
                        </Text>
                    </View>

                    {item.price && (
                        <View className="flex-row items-center mt-2">
                            <Text className="text-gray-900 font-bold text-lg">₹{item.price}</Text>
                            <Text className="text-gray-400 text-xs ml-1"> paid</Text>
                        </View>
                    )}

                    {item.status === 'CANCELLED' && item.cancellation_reason && (
                        <Text className="text-red-400 text-xs mt-1 italic">
                            Reason: {item.cancellation_reason}
                        </Text>
                    )}
                </View>
            </View>
        );
    };

    if (loading && !refreshing) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <ActivityIndicator size="large" color="#000" />
            </SafeAreaView>
        );
    }

    const firstName = userData.first_name || "User";
    const lastName = userData.last_name || "";
    const email = userData.email || "No Email";
    const phone = userData.mobile_number || "No Phone";
    const initials = (firstName[0] + (lastName[0] || "")).toUpperCase();

    return (
        <SafeAreaView className="flex-1 bg-white">
            {/* Header */}
            <View className="flex-row items-center p-4 border-b border-gray-100 bg-white z-10">
                <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 absolute left-4 z-20">
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-lg font-bold text-gray-900">
                    My Profile
                </Text>
            </View>

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <View className="p-6 pb-0">
                    {/* Avatar Section */}
                    <View className="items-center mb-8">
                        <View className="w-28 h-28 rounded-full bg-gray-50 items-center justify-center mb-4 overflow-hidden border-4 border-white shadow-lg shadow-blue-100">
                            {userData.profile_pic ? (
                                <Image source={{ uri: userData.profile_pic }} className="w-full h-full" />
                            ) : (
                                <Text className="text-3xl font-bold text-gray-400">{initials}</Text>
                            )}
                        </View>
                        <Text className="text-2xl font-bold text-gray-900">{firstName} {lastName}</Text>
                        <Text className="text-gray-500 font-medium">{email}</Text>
                        <View className="mt-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
                            <Text className="text-blue-600 text-xs font-bold">{phone}</Text>
                        </View>
                    </View>

                    {/* Quick Stats or Separator */}
                    <View className="flex-row justify-between bg-gray-900 rounded-2xl p-6 mb-8 shadow-xl shadow-gray-300">
                        <View className="items-center flex-1 border-r border-gray-700">
                            <Text className="text-white text-2xl font-bold">{allHistory.filter(h => h.status === 'COMPLETED').length}</Text>
                            <Text className="text-gray-400 text-xs uppercase tracking-wider mt-1">Services</Text>
                        </View>
                        <View className="items-center flex-1">
                            <Text className="text-white text-2xl font-bold">{allHistory.length}</Text>
                            <Text className="text-gray-400 text-xs uppercase tracking-wider mt-1">Total</Text>
                        </View>
                    </View>

                    {/* History Section */}
                    <View className="mb-4">
                        <Text className="text-xl font-bold text-gray-900 mb-4">Service History</Text>
                        {history.length > 0 ? (
                            <>
                                {history.map(renderHistoryItem)}

                                {/* Load More Button */}
                                {history.length < allHistory.length && (
                                    <TouchableOpacity
                                        onPress={loadMoreHistory}
                                        className="py-3 bg-gray-100 rounded-xl items-center mt-2 active:bg-gray-200"
                                    >
                                        <Text className="text-gray-600 font-bold text-sm">Load More</Text>
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <View className="items-center py-10 bg-gray-50 rounded-xl border-dashed border-2 border-gray-200">
                                <Ionicons name="document-text-outline" size={40} color="#d1d5db" />
                                <Text className="text-gray-400 mt-2">No service history found</Text>
                            </View>
                        )}
                    </View>

                    {/* Actions */}
                    <View className="space-y-3 pt-4 border-t border-gray-100">
                        <TouchableOpacity
                            onPress={logout}
                            className="flex-row items-center justify-center py-4 bg-red-50 rounded-xl"
                        >
                            <Text className="text-red-500 font-bold text-lg">Logout</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default ProfileScreen;
