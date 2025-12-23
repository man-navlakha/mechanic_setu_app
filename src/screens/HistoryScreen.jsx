
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const HistoryScreen = () => {
    const { checkAuth } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            await checkAuth(); // Optional sync
            const res = await api.get('/Profile/UserHistory/');
            const sorted = res.data?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) || [];
            setHistory(sorted);
        } catch (err) {
            console.error("History fetch error:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchHistory();
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
                        <Text className="text-gray-500 text-sm flex-1" numberOfLines={2}>{item.location}</Text>
                    </View>
                    {item.price && (
                        <Text className="text-gray-900 font-bold text-lg mt-2">₹{item.price}</Text>
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

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-4 border-b border-gray-100 bg-white z-10">
                <Text className="text-lg font-bold text-gray-900 text-center">Your Services</Text>
            </View>
            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {history.length > 0 ? history.map(renderHistoryItem) : (
                    <View className="items-center py-20">
                        <Ionicons name="documents-outline" size={48} color="#d1d5db" />
                        <Text className="text-gray-400 mt-4">No services found</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

export default HistoryScreen;
