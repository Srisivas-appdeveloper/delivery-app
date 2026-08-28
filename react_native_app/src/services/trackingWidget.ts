import { NativeModules, Platform } from 'react-native';

type TrackingWidgetModule = {
  updateTracking?: (
    destination: string,
    distanceMeters: number,
    etaMinutes: number,
    latitude: number,
    longitude: number,
    destinationLatitude: number,
    destinationLongitude: number,
    heading: number,
    turnInstruction: string,
    isActive: boolean,
    routeJson: string,
  ) => void;
  clearTracking?: () => void;
  saveTrackingState?: (json: string) => void;
  getTrackingState?: () => Promise<string | null>;
  updateNearbyPlaces?: (json: string) => void;
  getNearbyPlaces?: () => Promise<string | null>;
  saveBackendBaseUrl?: (url: string) => void;
  getBackendBaseUrl?: () => Promise<string | null>;
  saveLastCompletedTrip?: (json: string) => void;
  getLastCompletedTrip?: () => Promise<string | null>;
  getSelectedWidgetPlaceId?: () => Promise<string | null>;
  clearSelectedWidgetPlaceId?: () => void;
};

const nativeWidget = NativeModules.TrackingWidget as TrackingWidgetModule | undefined;

export function updateTrackingWidget(params: {
  destination: string;
  distanceMeters: number;
  etaMinutes: number;
  latitude: number;
  longitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  heading: number;
  turnInstruction: string;
  isActive: boolean;
  routeCoordinates?: Array<{ latitude: number; longitude: number }>;
}) {
  if (Platform.OS !== 'android' || typeof nativeWidget?.updateTracking !== 'function') {
    return;
  }
  nativeWidget.updateTracking(
    params.destination,
    params.distanceMeters,
    params.etaMinutes,
    params.latitude,
    params.longitude,
    params.destinationLatitude,
    params.destinationLongitude,
    params.heading,
    params.turnInstruction,
    params.isActive,
    JSON.stringify(params.routeCoordinates ?? []),
  );
}

export function clearTrackingWidget() {
  if (Platform.OS !== 'android' || typeof nativeWidget?.clearTracking !== 'function') {
    return;
  }
  nativeWidget.clearTracking();
}

export function saveTrackingState(json: string) {
  if (Platform.OS !== 'android' || typeof nativeWidget?.saveTrackingState !== 'function') {
    return;
  }
  nativeWidget.saveTrackingState(json);
}

export async function getTrackingState(): Promise<string | null> {
  if (Platform.OS !== 'android' || typeof nativeWidget?.getTrackingState !== 'function') {
    return null;
  }
  return nativeWidget.getTrackingState();
}

export function updateNearbyPlacesWidget(places: Array<{
  id: string;
  name: string;
  category: string;
  address: string;
  distanceMeters: number;
  latitude: number;
  longitude: number;
}>) {
  if (Platform.OS !== 'android' || typeof nativeWidget?.updateNearbyPlaces !== 'function') {
    return;
  }
  nativeWidget.updateNearbyPlaces(JSON.stringify(places));
}

export async function getNearbyPlacesWidgetJson(): Promise<string | null> {
  if (Platform.OS !== 'android' || typeof nativeWidget?.getNearbyPlaces !== 'function') {
    return null;
  }
  return nativeWidget.getNearbyPlaces();
}

export function saveBackendBaseUrl(url: string) {
  if (Platform.OS !== 'android' || typeof nativeWidget?.saveBackendBaseUrl !== 'function') {
    return;
  }
  nativeWidget.saveBackendBaseUrl(url);
}

export async function getBackendBaseUrl(): Promise<string | null> {
  if (Platform.OS !== 'android' || typeof nativeWidget?.getBackendBaseUrl !== 'function') {
    return null;
  }
  return nativeWidget.getBackendBaseUrl();
}

export function saveLastCompletedTrip(json: string) {
  if (Platform.OS !== 'android' || typeof nativeWidget?.saveLastCompletedTrip !== 'function') {
    return;
  }
  nativeWidget.saveLastCompletedTrip(json);
}

export async function getLastCompletedTrip(): Promise<string | null> {
  if (Platform.OS !== 'android' || typeof nativeWidget?.getLastCompletedTrip !== 'function') {
    return null;
  }
  return nativeWidget.getLastCompletedTrip();
}

export async function getSelectedWidgetPlaceId(): Promise<string | null> {
  if (Platform.OS !== 'android' || typeof nativeWidget?.getSelectedWidgetPlaceId !== 'function') {
    return null;
  }
  return nativeWidget.getSelectedWidgetPlaceId();
}

export function clearSelectedWidgetPlaceId() {
  if (Platform.OS !== 'android' || typeof nativeWidget?.clearSelectedWidgetPlaceId !== 'function') {
    return;
  }
  nativeWidget.clearSelectedWidgetPlaceId();
}
