import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Store, getPlaceColor, getPlaceIcon } from '../models/Store';
import {
  calculateBearing,
  calculateHaversineDistance,
  formatNavigationDistance,
  generateRouteWaypoints,
  getRouteSegmentLabel,
  getTurnInstruction,
  headingDelta,
  isManeuverInstruction,
} from '../models/Order';
import { useOrderStore } from '../store/orderStore';
import { LocationService } from '../services/locationService';
import { liveTrackingService } from '../services/liveTrackingService';
import { fetchRoadRoutes, getRoutePosition, type RoadRoute } from '../services/routeService';
import { AppColors } from '../constants/theme';
import { getTabBarStyle } from '../navigation/tabBarStyle';
import {
  MapAccuracyCircle,
  MapPlacesLayer,
  MapPin,
  MapRoute,
  StadiaMap,
  type StadiaMapHandle,
} from '../components/StadiaMap';

type Props = {
  navigation: any;
  route: { params?: { hotelId?: string } };
};

export const ExploreMapScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<StadiaMapHandle | null>(null);
  const listScrollRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const panTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastReliableGpsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastPreviewRouteRef = useRef<{
    placeId: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const pendingWidgetFetchRef = useRef<string | null>(null);
  const isTrackingRef = useRef(false);
  const gpsWatchRef = useRef<number | null>(null);

  const {
    userLocation,
    setUserLocation,
    selectedStore,
    setSelectedStore,
    activeOrder,
    completeActiveTrip,
    nearbyPlaces,
    isFetchingPlaces,
    placesError,
    searchCenter,
    fetchNearbyPlaces,
    findNearbyPlace,
    pendingWidgetPlaceId,
    setPendingWidgetPlaceId,
    selectedTrackingMode,
    isRerouting,
  } = useOrderStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [gpsReady, setGpsReady] = useState(false);
  const [arrivedHotel, setArrivedHotel] = useState<Store | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [isSheetExpanded, setIsSheetExpanded] = useState(true);
  const [previewRoadRoutes, setPreviewRoadRoutes] = useState<RoadRoute[]>([]);
  const [isRoutingPreview, setIsRoutingPreview] = useState(false);

  const isReliableGpsUpdate = (latitude: number, longitude: number, accuracy?: number | null) => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (accuracy != null && accuracy > 100)) {
      return false;
    }
    const previous = lastReliableGpsRef.current;
    if (
      previous &&
      calculateHaversineDistance(previous.latitude, previous.longitude, latitude, longitude) > 1500
    ) {
      console.warn('[ExploreMap] Ignoring implausible GPS jump');
      return false;
    }
    lastReliableGpsRef.current = { latitude, longitude };
    return true;
  };

  const destination = isTracking ? selectedStore : null;
  isTrackingRef.current = isTracking;
  const riderLat = activeOrder?.currentLat ?? userLocation.latitude;
  const riderLng = activeOrder?.currentLng ?? userLocation.longitude;
  const remainingMeters = destination
    ? activeOrder?.remainingDistanceMeters ??
      Math.round(
        calculateHaversineDistance(
          riderLat,
          riderLng,
          destination.latitude,
          destination.longitude,
        ),
      )
    : 0;
  const etaMinutes = activeOrder?.smoothedEtaMinutes
    ? Math.max(1, Math.round(activeOrder.smoothedEtaMinutes))
    : Math.max(1, Math.round(remainingMeters / (1.3 * 60)));
  const activeRouteTarget =
    activeOrder
      ? getRoutePosition(
          { latitude: riderLat, longitude: riderLng },
          activeOrder.routePoints || [],
        ).nextTarget
      : null;
  const targetBearing = destination
    ? calculateBearing(
        riderLat,
        riderLng,
        activeRouteTarget?.latitude ?? destination.latitude,
        activeRouteTarget?.longitude ?? destination.longitude,
      )
    : activeOrder?.currentHeading ?? 0;
  const currentHeading = activeOrder?.currentHeading ?? targetBearing;
  const turnInstruction = getTurnInstruction(currentHeading, targetBearing);
  const turnDegrees = Math.round(headingDelta(currentHeading, targetBearing));
  const distanceText = formatNavigationDistance(remainingMeters);
  const segmentLabel = getRouteSegmentLabel(remainingMeters, activeOrder?.trackingMode ?? 'walk');
  const routePoints =
    isTracking && destination
      ? activeOrder?.routePoints ??
        generateRouteWaypoints(
          riderLat,
          riderLng,
          destination.latitude,
          destination.longitude,
          18,
        )
      : [];
  const traveledRoutePoints = isTracking ? activeOrder?.traveledRoutePoints ?? [] : [];
  const previewRoutePoints =
    !isTracking && selectedStore
      ? previewRoadRoutes[0]?.coordinates ??
        generateRouteWaypoints(
          riderLat,
          riderLng,
          selectedStore.latitude,
          selectedStore.longitude,
          18,
        )
      : [];
  const previewAlternateRoutes = !isTracking ? previewRoadRoutes.slice(1, 3) : [];

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: getTabBarStyle(insets.bottom, isFullscreen),
    });
  }, [isFullscreen, insets.bottom, navigation]);

  useEffect(() => {
    if (isTracking || !selectedStore) {
      setPreviewRoadRoutes([]);
      setIsRoutingPreview(false);
      return;
    }

    const lastPreviewRoute = lastPreviewRouteRef.current;
    if (
      lastPreviewRoute?.placeId === selectedStore.id &&
      calculateHaversineDistance(
        lastPreviewRoute.latitude,
        lastPreviewRoute.longitude,
        riderLat,
        riderLng,
      ) < 50
    ) {
      return;
    }

    lastPreviewRouteRef.current = {
      placeId: selectedStore.id,
      latitude: riderLat,
      longitude: riderLng,
    };

    let cancelled = false;
    setIsRoutingPreview(true);
    fetchRoadRoutes(
      { latitude: riderLat, longitude: riderLng },
      { latitude: selectedStore.latitude, longitude: selectedStore.longitude },
      selectedTrackingMode,
    ).then((routes) => {
      if (cancelled) {
        return;
      }
      setPreviewRoadRoutes(routes);
      setIsRoutingPreview(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    isTracking,
    riderLat,
    riderLng,
    selectedStore?.id,
    selectedStore?.latitude,
    selectedStore?.longitude,
    selectedTrackingMode,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const granted = await LocationService.requestPermissions();
      if (!granted || cancelled) {
        return;
      }
      LocationService.getCurrentLocation(
        (position) => {
          if (cancelled) {
            return;
          }
          const next = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (!isReliableGpsUpdate(next.latitude, next.longitude, position.coords.accuracy)) {
            return;
          }
          setUserLocation(next);
          setGpsReady(true);
          lastFetchRef.current = next;
          mapRef.current?.animateToRegion(
            {
              ...next,
              latitudeDelta: 0.018,
              longitudeDelta: 0.018,
            },
            500,
          );
          fetchNearbyPlaces(next.latitude, next.longitude);
          if (gpsWatchRef.current == null) {
            gpsWatchRef.current = LocationService.watchLocation((watchPos) => {
              const live = {
                latitude: watchPos.coords.latitude,
                longitude: watchPos.coords.longitude,
              };
              if (!isReliableGpsUpdate(live.latitude, live.longitude, watchPos.coords.accuracy)) {
                return;
              }
              setUserLocation(live);
              if (isTrackingRef.current) {
                return;
              }
              const previous = lastFetchRef.current;
              if (
                previous &&
                calculateHaversineDistance(
                  previous.latitude,
                  previous.longitude,
                  live.latitude,
                  live.longitude,
                ) < 900
              ) {
                return;
              }
              lastFetchRef.current = live;
              fetchNearbyPlaces(live.latitude, live.longitude);
            });
          }
        },
        () => {
          setGpsReady(false);
        },
      );
    })();

    return () => {
      cancelled = true;
      if (gpsWatchRef.current != null) {
        LocationService.clearWatch(gpsWatchRef.current);
        gpsWatchRef.current = null;
      }
    };
  }, [setUserLocation, fetchNearbyPlaces]);

  const requestNearby = (lat: number, lng: number, force = false) => {
    const previous = lastFetchRef.current;
    if (!force && previous) {
      const moved = calculateHaversineDistance(previous.latitude, previous.longitude, lat, lng);
      if (moved < 900) {
        return;
      }
    }
    lastFetchRef.current = { latitude: lat, longitude: lng };
    fetchNearbyPlaces(lat, lng);
  };

  const handleMapMoveEnd = (center: { latitude: number; longitude: number }, userInteraction: boolean) => {
    if (!userInteraction) {
      return;
    }
    if (isTracking) {
      setFollowUser(false);
      return;
    }
    if (panTimerRef.current) {
      clearTimeout(panTimerRef.current);
    }
    panTimerRef.current = setTimeout(() => {
      requestNearby(center.latitude, center.longitude);
    }, 700);
  };

  useEffect(() => {
    if (!isTracking || !followUser) {
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
  }, [followUser, isTracking, riderLat, riderLng]);

  useEffect(() => {
    if (!isTracking || !isRerouting) {
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
  }, [isRerouting, isTracking, riderLat, riderLng]);

  const expandMap = () => {
    setIsFullscreen(true);
  };

  const collapseMap = () => {
    setIsTracking(false);
    setFollowUser(true);
    setArrivedHotel(null);
    setIsFullscreen(false);
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

  const selectPlace = (place: Store) => {
    setArrivedHotel(null);
    setSelectedStore(place);
    setIsFullscreen(true);
    const placeIndex = nearbyPlaces.findIndex((item) => item.id === place.id);
    if (placeIndex >= 0) {
      listScrollRef.current?.scrollTo({
        y: Math.max(0, placeIndex * 250),
        animated: true,
      });
    }
    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      350,
    );
  };

  const startHotelTracking = async (hotel: Store) => {
    setArrivedHotel(null);
    setSelectedStore(hotel);
    setIsFullscreen(true);
    setIsTracking(true);
    setFollowUser(true);
    setIsSheetExpanded(true);
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.0035,
        longitudeDelta: 0.0035,
      },
      250,
    );

    const started = await liveTrackingService.startForStore(hotel, 'walk', userLocation);
    if (!started) {
      setIsTracking(false);
    }
  };

  useEffect(() => {
    if (!isTracking || !selectedStore || !activeOrder) {
      return;
    }
    if (remainingMeters > 25) {
      return;
    }
    liveTrackingService.stop();
    completeActiveTrip();
    setIsTracking(false);
    setArrivedHotel(selectedStore);
  }, [isTracking, remainingMeters, activeOrder, selectedStore, completeActiveTrip]);

  useEffect(() => {
    const hotelId = route.params?.hotelId;
    if (!hotelId) {
      return;
    }
    const hotel = findNearbyPlace(hotelId);
    if (hotel) {
      startHotelTracking(hotel);
      navigation.setParams({ hotelId: undefined });
    }
    // This is a one-shot navigation handoff; including the tracking callback
    // would retrigger it whenever its captured live-location values change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.hotelId]);

  useEffect(() => {
    if (!pendingWidgetPlaceId) {
      return;
    }
    const place = findNearbyPlace(pendingWidgetPlaceId);
    if (place) {
      pendingWidgetFetchRef.current = null;
      selectPlace(place);
      setPendingWidgetPlaceId(null);
      return;
    }
    if (!isFetchingPlaces && pendingWidgetFetchRef.current !== pendingWidgetPlaceId) {
      pendingWidgetFetchRef.current = pendingWidgetPlaceId;
      fetchNearbyPlaces(userLocation.latitude, userLocation.longitude);
    }
    // Widget handoff can arrive before JS nearbyPlaces is hydrated; refetch once
    // from the current location, then select the matching place when it appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWidgetPlaceId, nearbyPlaces.length, isFetchingPlaces, userLocation.latitude, userLocation.longitude]);

  const renderMap = (nested: boolean) => (
    <StadiaMap
      ref={mapRef}
      style={styles.map}
      initialCenter={userLocation}
      initialZoom={14.5}
      nestedScroll={nested}
        onPress={!isFullscreen ? expandMap : undefined}
      onMapMoveEnd={handleMapMoveEnd}
    >
      {isTracking && traveledRoutePoints.length > 1 ? (
        <MapRoute id="hotel-traveled-route" coordinates={traveledRoutePoints} color="#22c55e" />
      ) : null}

      {isTracking && routePoints.length > 1 ? (
        <MapRoute id="hotel-remaining-route" coordinates={routePoints} />
      ) : null}

      {!isTracking
        ? previewAlternateRoutes.map((roadRoute, index) => (
            <MapRoute
              key={`selected-place-alt-route-${index}`}
              id={`selected-place-alt-route-${index}`}
              coordinates={roadRoute.coordinates}
              color="#64748b"
            />
          ))
        : null}

      {!isTracking && previewRoutePoints.length > 1 ? (
        <MapRoute
          id="selected-place-route"
          coordinates={previewRoutePoints}
          color="#f97316"
        />
      ) : null}

      {!isTracking && searchCenter ? (
        <MapAccuracyCircle
          id="search-radius"
          center={searchCenter}
          radiusMeters={2000}
        />
      ) : null}

      {isTracking ? (
        <MapAccuracyCircle
          id="user-accuracy"
          center={{ latitude: riderLat, longitude: riderLng }}
          radiusMeters={Math.max(activeOrder?.currentAccuracy || 8, 12)}
        />
      ) : null}

      <MapPin id="you" coordinate={{ latitude: riderLat, longitude: riderLng }}>
        <View style={[styles.userPin, { transform: [{ rotate: `${activeOrder?.currentHeading ?? 0}deg` }] }]}>
          <View style={styles.userPinArrow} />
          <View style={styles.userPinCore} />
        </View>
      </MapPin>

      {!isTracking ? (
        <MapPlacesLayer
          id="nearby-places"
          places={nearbyPlaces}
          selectedId={selectedStore?.id}
          onPlacePress={(placeId) => {
            const place = findNearbyPlace(placeId);
            if (place) {
              selectPlace(place);
            }
          }}
        />
      ) : destination ? (
        <MapPin
          id="tracking-destination"
          coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
        >
          <View style={styles.destinationPin}>
            <View style={styles.destinationPinCore} />
          </View>
        </MapPin>
      ) : null}

      {!isTracking && selectedStore ? (
        <MapPin
          id="selected-place-photo"
          coordinate={{ latitude: selectedStore.latitude, longitude: selectedStore.longitude }}
          onPress={() => startHotelTracking(selectedStore)}
        >
          <View style={styles.selectedPlacePin}>
            <Image source={selectedStore.image} style={styles.selectedPlacePinImage} resizeMode="cover" />
          </View>
        </MapPin>
      ) : null}
    </StadiaMap>
  );

  if (isFullscreen) {
    return (
      <View style={styles.flex}>
        {renderMap(false)}

        <View style={[styles.fullHeader, { paddingTop: 8 }]}>
          <Pressable style={styles.headerBtn} onPress={collapseMap}>
            <Ionicons name="close" size={22} color={AppColors.textPrimary} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>
              {isTracking ? 'Live tracking' : 'Within 2 km'}
            </Text>
            <Text style={styles.headerSub}>
              {isFetchingPlaces
                ? 'Loading nearby places...'
                : placesError
                  ? placesError
                : gpsReady
                  ? `${nearbyPlaces.length} places near this location`
                  : 'Waiting for GPS lock'}
            </Text>
          </View>
        </View>

        {isTracking && !followUser ? (
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

        {arrivedHotel ? (
          <View style={[styles.trackCard, { paddingBottom: insets.bottom + 12 }]}>
            <Image source={arrivedHotel.image} style={styles.trackImage} />
            <View style={styles.trackCopy}>
              <Text style={styles.trackName}>Arrived</Text>
              <Text style={styles.trackMeta} numberOfLines={1}>
                {arrivedHotel.name}
              </Text>
              <Pressable style={styles.doneBtn} onPress={collapseMap}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          </View>
        ) : destination ? (
          <View style={[styles.trackSheet, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable style={styles.sheetHandleRow} onPress={() => setIsSheetExpanded((value) => !value)}>
              <View style={styles.sheetHandle} />
              <Ionicons
                name={isSheetExpanded ? 'chevron-down' : 'chevron-up'}
                size={20}
                color={AppColors.primary}
                style={styles.sheetToggleIcon}
              />
            </Pressable>
            <View style={styles.trackMainRow}>
              <Image source={destination.image} style={styles.trackImage} />
              <View style={styles.trackCopy}>
                <Text style={styles.trackName}>{destination.name}</Text>
                <Text style={styles.trackMeta} numberOfLines={1}>
                  {destination.address}
                </Text>
                <Text style={styles.trackStats}>
                  {isRerouting ? 'Rerouting…' : `${distanceText} remaining  ·  ${etaMinutes} min`}
                </Text>
              </View>
            </View>
            {isSheetExpanded ? (
              <View style={styles.sheetInstructionBlock}>
                <Text style={styles.maneuverLabel}>
                  {isManeuverInstruction(turnInstruction) ? 'Next move' : 'Current instruction'}
                </Text>
                <Text style={styles.maneuverText}>{turnInstruction}</Text>
                <Text style={styles.maneuverSub}>
                  {Math.abs(turnDegrees)}° {turnDegrees > 0 ? 'right' : turnDegrees < 0 ? 'left' : 'ahead'}
                </Text>
                {segmentLabel ? <Text style={styles.segmentInline}>{segmentLabel}</Text> : null}
              </View>
            ) : null}
          </View>
        ) : selectedStore ? (
          <View style={[styles.trackCard, { paddingBottom: insets.bottom + 12 }]}>
            <Image source={selectedStore.image} style={styles.trackImage} resizeMode="cover" />
            <View style={styles.trackCopy}>
              <Text style={styles.trackName}>{selectedStore.name}</Text>
              <Text style={styles.trackMeta} numberOfLines={1}>
                {selectedStore.category} · {selectedStore.address}
              </Text>
              <Pressable style={styles.directionBtn} onPress={() => startHotelTracking(selectedStore)}>
                <Text style={styles.directionBtnText}>Start</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.hintBar, { bottom: insets.bottom + 16 }]}>
            <Text style={styles.hintText}>Tap any place marker, then press Start</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: AppColors.background }]}>
      <View style={styles.compactHeader}>
        <Text style={styles.pageTitle}>Near you</Text>
        <Text style={styles.pageSub}>
          {isFetchingPlaces
            ? 'Finding places within 2 km...'
            : placesError
              ? placesError
            : `${nearbyPlaces.length} places within 2 km of your location`}
        </Text>
      </View>

      <View style={styles.compactMap}>
        {renderMap(true)}
        <Pressable style={styles.expandChip} onPress={expandMap}>
          <Text style={styles.expandChipText}>Full screen</Text>
        </Pressable>
      </View>

      <ScrollView ref={listScrollRef} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {nearbyPlaces.length === 0 && !isFetchingPlaces ? (
          <Text style={styles.pageSub}>
            {placesError || 'No places found within 2 km. Pan the map or wait for GPS.'}
          </Text>
        ) : null}
        {nearbyPlaces.map((hotel) => {
          const meters = Math.round(
            calculateHaversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              hotel.latitude,
              hotel.longitude,
            ),
          );
          const walkMins = Math.max(1, Math.round(meters / (1.3 * 60)));
          return (
            <Pressable
              key={hotel.id}
              onPress={() => selectPlace(hotel)}
            >
              <View style={styles.hotelCard}>
                <View style={styles.hotelImageContainer}>
                  <Image source={hotel.image} style={styles.hotelCardImage} resizeMode="cover" />
                  <View style={[styles.cardCategoryBadge, { backgroundColor: getPlaceColor(hotel) }]}>
                    <Text style={styles.cardCategoryText}>
                      {getPlaceIcon(hotel)} {hotel.category}
                    </Text>
                  </View>
                  <View style={styles.cardDistanceBadge}>
                    <Text style={styles.cardDistanceText}>🚶 {walkMins} min</Text>
                  </View>
                </View>
                <View style={styles.hotelCardCopy}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.hotelCardName} numberOfLines={1}>{hotel.name}</Text>
                    <Text style={styles.cardRatingText}>⭐ {hotel.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.hotelCardAddress} numberOfLines={1}>
                    {hotel.address}
                  </Text>
                  <View style={styles.cardFooterRow}>
                    <Text style={styles.hotelCardMeta}>
                      📍 {formatNavigationDistance(meters)} away
                    </Text>
                    <Text style={styles.viewDirectionLink}>
                      Start →
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  compactHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  pageTitle: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  pageSub: {
    color: AppColors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  compactMap: {
    height: 240,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  expandChip: {
    position: 'absolute',
    right: 10,
    top: 10,
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  expandChipText: {
    color: AppColors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  hotelCard: {
    backgroundColor: AppColors.glassCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  hotelImageContainer: {
    position: 'relative',
    width: '100%',
    height: 150,
    backgroundColor: AppColors.surface,
  },
  hotelCardImage: {
    width: '100%',
    height: 150,
    backgroundColor: AppColors.surface,
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: AppColors.primary,
  },
  cardCategoryText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  cardDistanceBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardDistanceText: {
    color: AppColors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  hotelCardCopy: {
    padding: 12,
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hotelCardName: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  cardRatingText: {
    color: AppColors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  hotelCardAddress: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  hotelCardMeta: {
    color: AppColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  viewDirectionLink: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  fullHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  headerBtn: {
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  headerBtnText: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  headerCopy: {
    flex: 1,
    backgroundColor: AppColors.glassSurface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  headerTitle: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  headerSub: {
    color: AppColors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  maneuverPopup: {
    position: 'absolute',
    top: 82,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: AppColors.primary,
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
  segmentBanner: {
    position: 'absolute',
    top: 178,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  segmentText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
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
  trackSheet: {
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
  trackMainRow: {
    flexDirection: 'row',
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
  trackCard: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: AppColors.glassCard,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorderHighlight,
  },
  trackImage: {
    width: 92,
    height: 92,
  },
  trackCopy: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  trackName: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  trackMeta: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  trackStats: {
    color: AppColors.primary,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 8,
  },
  directionBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  directionBtnText: {
    color: AppColors.background,
    fontWeight: '800',
    fontSize: 12,
  },
  doneBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: AppColors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  doneBtnText: {
    color: AppColors.background,
    fontWeight: '800',
    fontSize: 12,
  },
  hintBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: AppColors.glassSurface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  hintText: {
    color: AppColors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
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
  destinationPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(249, 115, 22, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f97316',
  },
  destinationPinCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f97316',
  },
  selectedPlacePin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: AppColors.primary,
    backgroundColor: AppColors.surface,
  },
  selectedPlacePinImage: {
    width: 48,
    height: 48,
  },
});
