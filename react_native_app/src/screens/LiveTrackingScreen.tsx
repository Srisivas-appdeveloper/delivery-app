import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useOrderStore } from '../store/orderStore';
import { AppColors } from '../constants/theme';
import { liveTrackingService } from '../services/liveTrackingService';
import { DEMO_STORES } from '../models/Store';
import { getRoutePosition } from '../services/routeService';
import {
  calculateBearing,
  formatNavigationDistance,
  getRouteSegmentLabel,
  getTurnInstruction,
  headingDelta,
  isManeuverInstruction,
} from '../models/Order';
import {
  MapAccuracyCircle,
  MapPin,
  MapRoute,
  StadiaMap,
  type StadiaMapHandle,
} from '../components/StadiaMap';

export const LiveTrackingScreen: React.FC<{ navigation: any }> = () => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<StadiaMapHandle | null>(null);
  const [gpsOn, setGpsOn] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);

  const {
    activeOrder,
    lastCompletedOrder,
    selectedStore,
    userLocation,
    completeActiveTrip,
    isRerouting,
  } = useOrderStore();
  const displayOrder = activeOrder || lastCompletedOrder;
  const isCompletedRoute = !activeOrder && !!lastCompletedOrder;

  const hotel = useMemo(
    () =>
      selectedStore ||
      DEMO_STORES.find((item) => item.name === displayOrder?.storeName) ||
      null,
    [selectedStore, displayOrder?.storeName],
  );

  const riderLat = displayOrder?.currentLat ?? userLocation.latitude;
  const riderLng = displayOrder?.currentLng ?? userLocation.longitude;
  const destLat = displayOrder?.destinationLat;
  const destLng = displayOrder?.destinationLng;
  const remainingMeters = displayOrder?.remainingDistanceMeters ?? 0;
  const etaMinutes = Math.round(displayOrder?.smoothedEtaMinutes || 0);
  const routePoints = activeOrder?.routePoints || [];
  const traveledRoutePoints = displayOrder?.traveledRoutePoints || [];
  const currentHeading = displayOrder?.currentHeading ?? 0;
  const routeTarget = getRoutePosition(
    { latitude: riderLat, longitude: riderLng },
    routePoints,
  ).nextTarget;
  const targetBearing =
    destLat != null && destLng != null
      ? calculateBearing(
          riderLat,
          riderLng,
          routeTarget?.latitude ?? destLat,
          routeTarget?.longitude ?? destLng,
        )
      : currentHeading;
  const turnText = getTurnInstruction(currentHeading, targetBearing);
  const turnDegrees = Math.round(headingDelta(currentHeading, targetBearing));
  const distanceText = formatNavigationDistance(remainingMeters);
  const segmentLabel = getRouteSegmentLabel(remainingMeters, displayOrder?.trackingMode ?? 'walk');

  useEffect(() => {
    if (!activeOrder) {
      setGpsOn(false);
      return;
    }
    startGps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id]);

  useEffect(() => {
    if (!activeOrder || !followUser) {
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: riderLat,
        longitude: riderLng,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      },
      250,
    );
  }, [activeOrder, followUser, riderLat, riderLng]);

  useEffect(() => {
    if (!activeOrder || !isRerouting) {
      return;
    }
    setFollowUser(true);
    mapRef.current?.animateToRegion(
      {
        latitude: riderLat,
        longitude: riderLng,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      },
      180,
    );
  }, [activeOrder, isRerouting, riderLat, riderLng]);

  useEffect(() => {
    if (!isCompletedRoute || traveledRoutePoints.length < 2) {
      return;
    }
    mapRef.current?.fitToCoordinates(
      traveledRoutePoints,
      {
        edgePadding: { top: 90, right: 40, bottom: 260, left: 40 },
        animated: true,
      },
    );
  }, [isCompletedRoute, traveledRoutePoints]);

  useEffect(() => {
    if (!activeOrder || remainingMeters > 25) {
      return;
    }
    liveTrackingService.stop();
    setGpsOn(false);
    completeActiveTrip();
  }, [activeOrder, remainingMeters, completeActiveTrip]);

  const startGps = async () => {
    const started = await liveTrackingService.startGpsWatch();
    setGpsOn(started);
  };

  const stopGps = () => {
    liveTrackingService.stop();
    setGpsOn(false);
  };

  const recenterToCurrentLocation = () => {
    setFollowUser(true);
    mapRef.current?.animateToRegion(
      {
        latitude: riderLat,
        longitude: riderLng,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      },
      250,
    );
  };

  if (!displayOrder || destLat == null || destLng == null) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No live route</Text>
        <Text style={styles.emptyBody}>
          Nothing is in progress. Open Map, tap a place, then press Start.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StadiaMap
        ref={mapRef}
        style={styles.map}
        initialCenter={{ latitude: riderLat, longitude: riderLng }}
        initialZoom={14}
        onMapMoveEnd={(_, userInteraction) => {
          if (userInteraction) {
            setFollowUser(false);
          }
        }}
      >
        {traveledRoutePoints.length > 1 ? (
          <MapRoute id="track-traveled-route" coordinates={traveledRoutePoints} color="#22c55e" />
        ) : null}
        {!isCompletedRoute && routePoints.length > 1 ? (
          <MapRoute id="track-remaining-route" coordinates={routePoints} />
        ) : null}
        {!isCompletedRoute ? (
          <MapAccuracyCircle
            id="track-accuracy"
            center={{ latitude: riderLat, longitude: riderLng }}
            radiusMeters={Math.max(displayOrder.currentAccuracy || 8, 12)}
          />
        ) : null}
        <MapPin id="track-you" coordinate={{ latitude: riderLat, longitude: riderLng }}>
          <View style={[styles.userPin, { transform: [{ rotate: `${currentHeading}deg` }] }]}>
            <View style={styles.userPinArrow} />
            <View style={styles.userPinCore} />
          </View>
        </MapPin>
        {hotel ? (
          <MapPin id="track-hotel" coordinate={{ latitude: destLat, longitude: destLng }}>
            <View style={styles.hotelPinWrap}>
              <Image source={hotel.image} style={styles.hotelPinImage} resizeMode="cover" />
            </View>
          </MapPin>
        ) : null}
      </StadiaMap>

      <View style={[styles.topBar, { paddingTop: 8 }]}>
        <View style={styles.statusPill}>
          <View style={[styles.gpsDot, { backgroundColor: gpsOn ? AppColors.success : AppColors.warning }]} />
          <Text style={styles.statusText}>
            {isCompletedRoute
              ? 'Completed route'
              : gpsOn
                ? `Live GPS · ±${Math.round(displayOrder.currentAccuracy || 0)}m`
                : 'GPS paused'}
          </Text>
        </View>
        {!isCompletedRoute ? (
          <Pressable style={styles.actionBtn} onPress={gpsOn ? stopGps : startGps}>
            <Text style={styles.actionText}>{gpsOn ? 'Pause' : 'Resume'}</Text>
          </Pressable>
        ) : null}
      </View>

      {!followUser ? (
        <Pressable
          style={[
            styles.recenterBtn,
            { bottom: insets.bottom + (isSheetExpanded ? 340 : 190) },
          ]}
          onPress={recenterToCurrentLocation}
        >
          <Ionicons name="locate" size={24} color={AppColors.primary} />
        </Pressable>
      ) : null}

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.sheetHandleRow} onPress={() => setIsSheetExpanded((value) => !value)}>
          <View style={styles.sheetHandle} />
          <Ionicons
            name={isSheetExpanded ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={AppColors.primary}
            style={styles.sheetToggleIcon}
          />
        </Pressable>
        <View style={styles.sheetMainRow}>
          {hotel ? <Image source={hotel.image} style={styles.sheetImage} resizeMode="cover" /> : null}
          <View style={styles.sheetCopy}>
            <Text style={styles.sheetTitle}>{displayOrder.storeName}</Text>
            <Text style={styles.sheetAddress} numberOfLines={1}>
              {displayOrder.destinationAddress}
            </Text>
            <Text style={styles.sheetStats}>
              {isCompletedRoute
                ? `${traveledRoutePoints.length} GPS points saved`
                : isRerouting
                  ? 'Rerouting…'
                  : `${distanceText} remaining  ·  ${etaMinutes} min`}
            </Text>
          </View>
        </View>
        {isSheetExpanded && !isCompletedRoute ? (
          <View style={styles.sheetInstructionBlock}>
            <Text style={styles.maneuverLabel}>
              {isManeuverInstruction(turnText) ? 'Next move' : 'Current instruction'}
            </Text>
            <Text style={styles.maneuverText}>{turnText}</Text>
            <Text style={styles.maneuverSub}>
              {Math.abs(turnDegrees)}° {turnDegrees > 0 ? 'right' : turnDegrees < 0 ? 'left' : 'ahead'}
            </Text>
            {segmentLabel ? <Text style={styles.segmentInline}>{segmentLabel}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  empty: {
    flex: 1,
    backgroundColor: AppColors.background,
    padding: 24,
    justifyContent: 'center',
  },
  emptyTitle: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  emptyBody: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  actionBtn: {
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  actionText: {
    color: AppColors.primary,
    fontWeight: '800',
    fontSize: 13,
  },
  recenterBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 30,
    elevation: 12,
    backgroundColor: AppColors.glassSurface,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  recenterText: {
    color: AppColors.primary,
    fontSize: 13,
    fontWeight: '900',
  },
  maneuverLabel: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  maneuverText: {
    color: AppColors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  maneuverSub: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    backgroundColor: AppColors.glassCard,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorderHighlight,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppColors.textMuted,
    opacity: 0.8,
  },
  sheetToggleIcon: {
    marginTop: 4,
  },
  sheetMainRow: {
    flexDirection: 'row',
  },
  sheetImage: {
    width: 92,
    height: 92,
  },
  sheetCopy: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  sheetTitle: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  sheetAddress: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  sheetStats: {
    color: AppColors.primary,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 8,
  },
  userPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 229, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  userPinArrow: {
    position: 'absolute',
    top: -7,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: AppColors.primary,
  },
  userPinCore: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: AppColors.primary,
  },
  sheetInstructionBlock: {
    margin: 12,
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  segmentInline: {
    color: '#ffffff',
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 10,
  },
  hotelPinWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: AppColors.primary,
  },
  hotelPinImage: {
    width: 44,
    height: 44,
  },
});
