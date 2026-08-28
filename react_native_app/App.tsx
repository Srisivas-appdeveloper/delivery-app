import React, { useEffect } from 'react';
import { AppState, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppColors } from './src/constants/theme';
import { useOrderStore } from './src/store/orderStore';
import { liveTrackingService } from './src/services/liveTrackingService';

export default function App() {
  const clearTransientSelection = useOrderStore((state) => state.clearTransientSelection);
  const consumeSelectedWidgetPlaceId = useOrderStore((state) => state.consumeSelectedWidgetPlaceId);
  const restoreBackendConfig = useOrderStore((state) => state.restoreBackendConfig);
  const restoreCachedNearbyPlaces = useOrderStore((state) => state.restoreCachedNearbyPlaces);
  const restoreLastCompletedTrip = useOrderStore((state) => state.restoreLastCompletedTrip);
  const restorePersistedTracking = useOrderStore((state) => state.restorePersistedTracking);
  const resetNavigationSession = useOrderStore((state) => state.resetNavigationSession);

  useEffect(() => {
    restoreBackendConfig().finally(async () => {
      await restoreCachedNearbyPlaces();
      const restoredTracking = await restorePersistedTracking();
      if (!restoredTracking) {
        await restoreLastCompletedTrip();
        resetNavigationSession();
        return;
      }
      liveTrackingService.startGpsWatch().catch((error) => {
        console.warn('[App] Restored GPS tracking start skipped', error);
      });
    });
  }, [
    resetNavigationSession,
    restoreBackendConfig,
    restoreCachedNearbyPlaces,
    restoreLastCompletedTrip,
    restorePersistedTracking,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearTransientSelection();
        consumeSelectedWidgetPlaceId().catch((error) => {
          console.warn('[App] Widget place handoff skipped', error);
        });
      }
    });
    return () => {
      subscription.remove();
    };
  }, [clearTransientSelection, consumeSelectedWidgetPlaceId]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'right', 'left']}>
        <StatusBar barStyle="light-content" />
        <AppNavigator />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
});
