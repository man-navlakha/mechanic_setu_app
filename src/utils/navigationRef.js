import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
    if (navigationRef.isReady()) {
        try {
            navigationRef.navigate(name, params);
        } catch (e) {
            console.warn("Navigation failed (navigate):", e);
        }
    }
}

export function resetRoot(name) {
    if (navigationRef.isReady()) {
        try {
            navigationRef.reset({
                index: 0,
                routes: [{ name }],
            });
        } catch (e) {
            console.warn("Navigation failed (resetRoot):", e);
        }
    }
}