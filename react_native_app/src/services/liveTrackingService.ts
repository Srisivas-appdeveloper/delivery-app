import { Alert } from 'react-native';
import {
  calculateBearing,
  getTurnInstruction,
  normalizeHeading,
  RouteCoordinate,
  TrackingMode,
} from '../models/Order';
import { Store } from '../models/Store';
import { useOrderStore } from '../store/orderStore';
import { LocationService } from './locationService';
import { updateTrackingWidget } from './trackingWidget';

let liveWatchId: number | null = null;

function pushWidgetUpdate() {
  const { activeOrder } = useOrderStore.getState();
  if (!activeOrder) {
    return;
  }
  const latitude = activeOrder.currentLat ?? activeOrder.storeLat;
  const longitude = activeOrder.currentLng ?? activeOrder.storeLng;
  const targetBearing = calculateBearing(latitude, longitude, activeOrder.destinationLat, activeOrder.destinationLng);
  updateTrackingWidget({
    destination: activeOrder.storeName,
    distanceMeters: activeOrder.remainingDistanceMeters,
    etaMinutes: Math.max(1, Math.round(activeOrder.smoothedEtaMinutes || 1)),
    latitude,
    longitude,
    destinationLatitude: activeOrder.destinationLat,
    destinationLongitude: activeOrder.destinationLng,
    heading: activeOrder.currentHeading,
    turnInstruction: getTurnInstruction(activeOrder.currentHeading, targetBearing),
    isActive: true,
  });
}

export const liveTrackingService = {
  isRunning() {
    return liveWatchId != null;
  },

  stop() {
    if (liveWatchId != null) {
      LocationService.clearWatch(liveWatchId);
      liveWatchId = null;
    }
  },

  async startGpsWatch(): Promise<boolean> {
    const granted = await LocationService.requestPermissions();
    if (!granted) {
      Alert.alert('Location needed', 'Turn on location so tracking can follow your movement.');
      return false;
    }

    this.stop();
    liveWatchId = LocationService.watchLocation(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        const { activeOrder, setUserLocation, updateDriverLocation } = useOrderStore.getState();
        const targetHeading = activeOrder
          ? calculateBearing(latitude, longitude, activeOrder.destinationLat, activeOrder.destinationLng)
          : 0;
        const nextHeading = normalizeHeading(heading) ?? targetHeading;
        setUserLocation({ latitude, longitude });
        updateDriverLocation(latitude, longitude, nextHeading, speed ?? 1.3, accuracy ?? 4);
        pushWidgetUpdate();
      },
      (error) => {
        console.warn('[LiveTrackingService] GPS watch failed', error);
      },
    );
    pushWidgetUpdate();
    return true;
  },

  async startForStore(
    store: Store,
    mode: TrackingMode = 'walk',
    fallbackLocation?: RouteCoordinate,
  ): Promise<boolean> {
    const granted = await LocationService.requestPermissions();
    if (!granted) {
      Alert.alert('Location needed', 'Turn on location so tracking can follow your movement.');
      return false;
    }

    return new Promise((resolve) => {
      LocationService.getCurrentLocation(
        (position) => {
          const startLoc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const { setUserLocation, startStoreTracking, updateDriverLocation } = useOrderStore.getState();
          setUserLocation(startLoc);
          startStoreTracking(store, mode, startLoc);
          const targetHeading = calculateBearing(startLoc.latitude, startLoc.longitude, store.latitude, store.longitude);
          updateDriverLocation(
            startLoc.latitude,
            startLoc.longitude,
            normalizeHeading(position.coords.heading) ?? targetHeading,
            position.coords.speed ?? 1.3,
            position.coords.accuracy ?? 4,
          );
          this.startGpsWatch().then(resolve);
        },
        () => {
          const { userLocation, startStoreTracking } = useOrderStore.getState();
          startStoreTracking(store, mode, fallbackLocation ?? userLocation);
          this.startGpsWatch().then(resolve);
        },
      );
    });
  },
};
