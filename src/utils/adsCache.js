import api from './api';

let cachedAds = [];
let lastFetchTime = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export const getMapAds = async () => {
    const now = Date.now();

    // Return cached data if within duration
    if (cachedAds.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
        console.log("[AdsCache] Returning cached ads");
        return cachedAds;
    }

    try {
        console.log("[AdsCache] Fetching new ads from server");
        const res = await api.get('/core/map-ads/');
        if (Array.isArray(res.data)) {
            cachedAds = res.data;
            lastFetchTime = now;
            return cachedAds;
        }
    } catch (e) {
        console.log("Error fetching ads:", e);
        // Fallback: If network fails but we have data, return it even if expired
        if (cachedAds.length > 0) {
            console.log("[AdsCache] Network failed, returning stale cache");
            return cachedAds;
        }
    }
    return [];
};
