import { Platform, PermissionsAndroid } from 'react-native';
import Geolocation, { GeoPosition, GeoError } from 'react-native-geolocation-service';

export class LocationService {
  public static async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'This delivery app needs access to your location for real-time tracking.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          return false;
        }
        if (Platform.Version >= 33) {
          await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        }
        return true;
      } catch (err) {
        console.warn('[LocationService] Permission error:', err);
        return false;
      }
    }
    return true;
  }

  public static getCurrentLocation(
    onSuccess: (position: GeoPosition) => void,
    onError: (error: GeoError) => void,
  ) {
    Geolocation.getCurrentPosition(
      onSuccess,
      onError,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
      },
    );
  }

  public static watchLocation(
    onLocation: (position: GeoPosition) => void,
    onError?: (error: GeoError) => void,
  ): number {
    return Geolocation.watchPosition(
      onLocation,
      onError || ((err) => console.warn('[LocationService] Watch error:', err)),
      {
        enableHighAccuracy: true,
        distanceFilter: 0,
        interval: 750,
        fastestInterval: 250,
        showLocationDialog: true,
        forceRequestLocation: true,
        accuracy: {
          android: 'high',
          ios: 'bestForNavigation',
        },
      },
    );
  }

  public static clearWatch(watchId: number) {
    Geolocation.clearWatch(watchId);
  }
}
