import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useOrderStore } from '../store/orderStore';
import { AppColors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  MapPin,
  MapRoute,
  StadiaMap,
  type StadiaMapHandle,
} from '../components/StadiaMap';
import { DEMO_STORES, Store } from '../models/Store';
import { Order, TrackingMode, generateRouteWaypoints, calculateHaversineDistance } from '../models/Order';

export const HomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    orders,
    activeOrder,
    isLoading,
    fetchOrders,
    selectOrder,
    backendBaseUrl,
    setServerHost,
    createNewOrder,
    userLocation,
    setUserLocation,
    selectedStore: selectedStoreFromStore,
    setSelectedStore,
    selectedTrackingMode,
    setSelectedTrackingMode,
    syncUserGpsLocation,
    startStoreTracking,
  } = useOrderStore();
  const selectedStore = selectedStoreFromStore ?? DEMO_STORES[0];

  const mapRef = useRef<StadiaMapHandle | null>(null);
  const [hostModalVisible, setHostModalVisible] = useState(false);
  const [inputHost, setInputHost] = useState(backendBaseUrl);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    setInputHost(backendBaseUrl);
  }, [backendBaseUrl]);

  // New Order Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newStoreName, setNewStoreName] = useState('Fresh Harvest Organic Market');
  const [newCustomerName, setNewCustomerName] = useState('Rahul Menon');
  const [newAddress, setNewAddress] = useState('108 Brookefields Road, RS Puram');
  const [newItems, setNewItems] = useState('1x Artisanal Cold Brew, 2x Butter Pastry');

  // Preview route coordinates between user and selected store
  const previewRoute = generateRouteWaypoints(
    userLocation.latitude,
    userLocation.longitude,
    selectedStore.latitude,
    selectedStore.longitude,
    20,
  );

  const directDistMeters = Math.round(
    calculateHaversineDistance(
      userLocation.latitude,
      userLocation.longitude,
      selectedStore.latitude,
      selectedStore.longitude,
    ),
  );

  const walkingEtaMins = Math.max(1, Math.round(directDistMeters / (1.3 * 60)));
  const bikeEtaMins = Math.max(1, Math.round(directDistMeters / (7.0 * 60)));

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Fit map to user and selected store
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.fitToCoordinates(
        [
          { latitude: userLocation.latitude, longitude: userLocation.longitude },
          { latitude: selectedStore.latitude, longitude: selectedStore.longitude },
        ],
        {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: true,
        },
      );
    }
  }, [selectedStore.id, selectedStore.latitude, selectedStore.longitude, userLocation.latitude, userLocation.longitude]);

  const handleSelectStore = (store: Store) => {
    setSelectedStore(store);
  };

  const handleLocateMe = async () => {
    setIsLocating(true);
    const success = await syncUserGpsLocation();
    setIsLocating(false);
    if (!success) {
      Alert.alert(
        'GPS Notice',
        'Could not obtain precise GPS lock. Using default city coordinates for simulation.',
      );
    }
  };

  const handleStartTracking = (mode: TrackingMode = selectedTrackingMode) => {
    startStoreTracking(selectedStore, mode, userLocation);
    navigation.navigate('LiveTracking');
  };

  const handleSaveHost = () => {
    setServerHost(inputHost);
    setHostModalVisible(false);
  };

  const handleSelectExistingOrder = (order: Order) => {
    selectOrder(order.id);
    navigation.navigate('LiveTracking');
  };

  const handleCreateOrder = () => {
    if (!newStoreName.trim() || !newCustomerName.trim() || !newAddress.trim()) {
      return;
    }

    const itemsList = newItems
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean);

    createNewOrder({
      storeName: newStoreName.trim(),
      customerName: newCustomerName.trim(),
      destinationAddress: newAddress.trim(),
      orderItems: itemsList.length > 0 ? itemsList : ['1x Gourmet Delivery Box'],
      totalAmount: `₹${Math.floor(250 + Math.random() * 600)}`,
      storeLat: 11.0168 + (Math.random() - 0.5) * 0.01,
      storeLng: 76.9558 + (Math.random() - 0.5) * 0.01,
      destinationLat: 11.025 + (Math.random() - 0.5) * 0.015,
      destinationLng: 76.968 + (Math.random() - 0.5) * 0.015,
    });

    setCreateModalVisible(false);
    navigation.navigate('LiveTracking');
  };

  return (
    <View style={styles.container}>
      {/* Header Banner */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>⚡ RAPID TRACK</Text>
          <Text style={styles.headerSubtitle}>Real-Time Live Location & Navigation</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.locateBtn} onPress={handleLocateMe} disabled={isLocating}>
            {isLocating ? (
              <ActivityIndicator size="small" color={AppColors.primary} />
            ) : (
              <Text style={styles.locateEmoji}>🎯</Text>
            )}
          </Pressable>
          <Pressable style={styles.newOrderBtn} onPress={() => setCreateModalVisible(true)}>
            <Text style={styles.newOrderBtnText}>+ Custom</Text>
          </Pressable>
          <Pressable style={styles.settingsBtn} onPress={() => setHostModalVisible(true)}>
            <Text style={styles.settingsEmoji}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Interactive Near Me Map Section */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>EXPLORE NEARBY STORES & PLACES</Text>
          <Text style={styles.hintBadge}>Tap pin · long-press to move start</Text>
        </View>

        <View style={styles.mapContainer}>
          <StadiaMap
            ref={mapRef}
            style={styles.map}
            initialCenter={userLocation}
            initialZoom={13}
            nestedScroll
            onLongPress={setUserLocation}
          >
            <MapRoute id="home-preview-route" coordinates={previewRoute} />

            <MapPin id="user-start" coordinate={userLocation}>
              <View style={styles.userMarker}>
                <Text style={styles.markerEmoji}>📍</Text>
              </View>
            </MapPin>

            {DEMO_STORES.map((store) => {
              const isSelected = selectedStore.id === store.id;
              return (
                <MapPin
                  key={store.id}
                  id={`store-${store.id}`}
                  coordinate={{ latitude: store.latitude, longitude: store.longitude }}
                  onPress={() => handleSelectStore(store)}
                >
                  <View style={[styles.storeMarker, isSelected && styles.selectedStoreMarker]}>
                    <Image source={store.image} style={styles.storeMarkerImage} />
                  </View>
                </MapPin>
              );
            })}
          </StadiaMap>
        </View>

        {/* Selected Store Routing Card */}
        <GlassCard style={styles.routeActionCard} highlight>
          <View style={styles.routeTopRow}>
            <View style={styles.storeIconWrap}>
              <Image source={selectedStore.image} style={styles.storeIconImage} />
            </View>
            <View style={styles.routeStoreInfo}>
              <Text style={styles.routeStoreTitle}>{selectedStore.name}</Text>
              <Text style={styles.routeStoreCategory}>{selectedStore.category}</Text>
              <Text style={styles.routeStoreAddress} numberOfLines={1}>
                {selectedStore.address}
              </Text>
            </View>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingText}>⭐ {selectedStore.rating}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Mode Switcher: Walk / Bike / Drive */}
          <View style={styles.modeRow}>
            <Pressable
              style={[
                styles.modePill,
                selectedTrackingMode === 'walk' && styles.modePillActive,
              ]}
              onPress={() => setSelectedTrackingMode('walk')}
            >
              <Text style={styles.modeEmoji}>🚶</Text>
              <View>
                <Text
                  style={[
                    styles.modeLabel,
                    selectedTrackingMode === 'walk' && styles.modeLabelActive,
                  ]}
                >
                  Walk
                </Text>
                <Text style={styles.modeEta}>{walkingEtaMins} min</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.modePill,
                selectedTrackingMode === 'bike' && styles.modePillActive,
              ]}
              onPress={() => setSelectedTrackingMode('bike')}
            >
              <Text style={styles.modeEmoji}>🛵</Text>
              <View>
                <Text
                  style={[
                    styles.modeLabel,
                    selectedTrackingMode === 'bike' && styles.modeLabelActive,
                  ]}
                >
                  Rapido / Bike
                </Text>
                <Text style={styles.modeEta}>{bikeEtaMins} min</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.modePill,
                selectedTrackingMode === 'drive' && styles.modePillActive,
              ]}
              onPress={() => setSelectedTrackingMode('drive')}
            >
              <Text style={styles.modeEmoji}>🚗</Text>
              <View>
                <Text
                  style={[
                    styles.modeLabel,
                    selectedTrackingMode === 'drive' && styles.modeLabelActive,
                  ]}
                >
                  Drive
                </Text>
                <Text style={styles.modeEta}>{Math.max(1, Math.round(bikeEtaMins * 0.8))} min</Text>
              </View>
            </Pressable>
          </View>

          {/* Start Tracking Button */}
          <Pressable
            style={({ pressed }) => [styles.startTrackingBtn, pressed && styles.pressed]}
            onPress={() => handleStartTracking()}
          >
            <Text style={styles.startTrackingBtnText}>
              🚀 Start Live {selectedTrackingMode === 'walk' ? 'Walking' : 'Navigation'} ({directDistMeters}m)
            </Text>
          </Pressable>
        </GlassCard>

        {/* Quick Launch Action Cards */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>TRACKING MODES & CONTROLS</Text>
        <View style={styles.actionGrid}>
          {/* Customer Live Tracking Mode */}
          <Pressable
            style={({ pressed }) => [styles.actionCardWrapper, pressed && styles.pressed]}
            onPress={() => navigation.navigate('LiveTracking')}
          >
            <GlassCard style={styles.actionCard} highlight>
              <Text style={styles.actionIcon}>🗺️</Text>
              <Text style={styles.actionTitle}>Customer Tracking</Text>
              <Text style={styles.actionDesc}>Live vehicle map, route polyline & dynamic ETA</Text>
            </GlassCard>
          </Pressable>

          {/* Driver Dashboard Mode */}
          <Pressable
            style={({ pressed }) => [styles.actionCardWrapper, pressed && styles.pressed]}
            onPress={() => navigation.navigate('DriverDashboard')}
          >
            <GlassCard style={styles.actionCard}>
              <Text style={styles.actionIcon}>🛵</Text>
              <Text style={styles.actionTitle}>Driver Simulator</Text>
              <Text style={styles.actionDesc}>Simulate driving route or stream real device GPS</Text>
            </GlassCard>
          </Pressable>
        </View>

        {/* Debug Console Link */}
        <Pressable
          style={({ pressed }) => [styles.debugLink, pressed && styles.pressed]}
          onPress={() => navigation.navigate('TrackingDebug')}
        >
          <GlassCard style={styles.debugCard}>
            <View style={styles.debugRow}>
              <Text style={styles.debugText}>🛠️ Telemetry & WebSocket Debug Console</Text>
              <Text style={styles.arrowText}>→</Text>
            </View>
          </GlassCard>
        </Pressable>

        {/* Active Deliveries List */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionHeader}>ACTIVE DELIVERIES & SESSIONS ({orders.length})</Text>
          <Pressable onPress={() => fetchOrders()}>
            <Text style={styles.refreshText}>🔄 Sync</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator color={AppColors.primary} size="large" style={styles.loader} />
        ) : (
          orders.map((item) => {
            const isSelected = activeOrder?.id === item.id;
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => pressed && styles.pressed}
                onPress={() => handleSelectExistingOrder(item)}
              >
                <GlassCard style={[styles.orderCard, isSelected && styles.selectedOrderCard]}>
                  <View style={styles.orderTopRow}>
                    <View>
                      <Text style={styles.orderId}>{item.id}</Text>
                      <Text style={styles.storeName}>{item.storeName}</Text>
                    </View>
                    <StatusBadge status={item.status} />
                  </View>

                  <View style={styles.orderDivider} />

                  <View style={styles.orderBottomRow}>
                    <Text style={styles.customerName}>
                      {item.trackingMode === 'walk' ? '🚶 Walking' : '🛵 Rider'}: {item.driverName}
                    </Text>
                    <Text style={styles.etaText}>
                      ⏱️ {Math.round(item.smoothedEtaMinutes || 0)} min ETA
                    </Text>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })
        )}

        {/* Nearby Stores Showcase */}
        <Text style={[styles.sectionHeader, { marginTop: 24 }]}>ALL NEARBY PARTNER STORES</Text>
        {DEMO_STORES.map((store) => {
          const isSelected = selectedStore.id === store.id;
          return (
            <Pressable key={store.id} onPress={() => handleSelectStore(store)}>
              <GlassCard style={[styles.storeCard, isSelected && styles.selectedStoreCard]}>
                <View style={styles.storeRow}>
                  <View style={styles.storeIconContainer}>
                    <Image source={store.image} style={styles.storeListImage} />
                  </View>
                  <View style={styles.storeInfo}>
                    <View style={styles.titleRow}>
                      <Text style={styles.storeTitle}>{store.name}</Text>
                      {store.tag && <Text style={styles.tagText}>{store.tag}</Text>}
                    </View>
                    <Text style={styles.storeCategory}>{store.category}</Text>
                    <Text style={styles.storeAddress}>{store.address}</Text>
                  </View>
                  <View style={styles.storeBadge}>
                    <Text style={styles.storeRating}>⭐ {store.rating}</Text>
                    <Text style={styles.storeDistance}>{store.distanceKm} km</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Create Custom Order Modal */}
      <Modal visible={createModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.modalCard} highlight>
            <Text style={styles.modalTitle}>📦 Create Delivery Order</Text>
            <Text style={styles.modalDesc}>Add a new real-time delivery order to track:</Text>

            <Text style={styles.inputLabel}>STORE / RESTAURANT NAME</Text>
            <TextInput
              style={styles.hostInput}
              value={newStoreName}
              onChangeText={setNewStoreName}
              placeholder="e.g. Italian Crust Pizza"
              placeholderTextColor={AppColors.textMuted}
            />

            <Text style={styles.inputLabel}>CUSTOMER NAME</Text>
            <TextInput
              style={styles.hostInput}
              value={newCustomerName}
              onChangeText={setNewCustomerName}
              placeholder="e.g. Ananya Patel"
              placeholderTextColor={AppColors.textMuted}
            />

            <Text style={styles.inputLabel}>DELIVERY ADDRESS</Text>
            <TextInput
              style={styles.hostInput}
              value={newAddress}
              onChangeText={setNewAddress}
              placeholder="e.g. 12 Green Glen Layout"
              placeholderTextColor={AppColors.textMuted}
            />

            <Text style={styles.inputLabel}>ITEMS (COMMA SEPARATED)</Text>
            <TextInput
              style={styles.hostInput}
              value={newItems}
              onChangeText={setNewItems}
              placeholder="e.g. 1x Cold Brew, 2x Cookies"
              placeholderTextColor={AppColors.textMuted}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setCreateModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleCreateOrder}>
                <Text style={styles.saveText}>🚀 Start Delivery</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Host Configuration Modal */}
      <Modal visible={hostModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <GlassCard style={styles.modalCard} highlight>
            <Text style={styles.modalTitle}>Configure Backend Host</Text>
            <Text style={styles.modalDesc}>
              Connect to your FastAPI backend:
              {'\n'}• Release/public: https://api.yourdomain.com
              {'\n'}• Same Wi‑Fi test: http://192.168.1.X:8000
            </Text>

            <TextInput
              style={styles.hostInput}
              value={inputHost}
              onChangeText={setInputHost}
              placeholder="https://api.yourdomain.com"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setHostModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.saveBtn]} onPress={handleSaveHost}>
                <Text style={styles.saveText}>Save & Connect</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: AppColors.glassBorder,
    backgroundColor: AppColors.glassSurface,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: AppColors.primary,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 11,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locateBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  locateEmoji: {
    fontSize: 16,
  },
  newOrderBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newOrderBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: AppColors.background,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  settingsEmoji: {
    fontSize: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hintBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: AppColors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mapContainer: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: AppColors.glassBorder,
    marginBottom: 12,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  userMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surfaceHighlight,
    borderWidth: 2,
    borderColor: AppColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: AppColors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  storeMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AppColors.surface,
    borderWidth: 1.5,
    borderColor: AppColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  selectedStoreMarker: {
    borderColor: AppColors.secondary,
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    transform: [{ scale: 1.15 }],
  },
  markerEmoji: {
    fontSize: 16,
  },
  storeMarkerImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  storeMarkerEmoji: {
    fontSize: 18,
  },
  routeActionCard: {
    padding: 14,
    marginBottom: 16,
  },
  routeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  storeIconImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  storeIconLarge: {
    fontSize: 22,
  },
  routeStoreInfo: {
    flex: 1,
  },
  routeStoreTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  routeStoreCategory: {
    fontSize: 11,
    color: AppColors.textMuted,
    marginTop: 1,
  },
  routeStoreAddress: {
    fontSize: 10,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  ratingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: AppColors.surfaceHighlight,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.warning,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.glassBorder,
    marginVertical: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: AppColors.surfaceHighlight,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
    gap: 6,
  },
  modePillActive: {
    borderColor: AppColors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  modeEmoji: {
    fontSize: 16,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  modeLabelActive: {
    color: AppColors.primary,
    fontWeight: '800',
  },
  modeEta: {
    fontSize: 9,
    color: AppColors.textMuted,
    marginTop: 1,
  },
  startTrackingBtn: {
    backgroundColor: AppColors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  startTrackingBtnText: {
    color: AppColors.background,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionCardWrapper: {
    flex: 1,
  },
  actionCard: {
    padding: 14,
    alignItems: 'flex-start',
    height: 120,
    justifyContent: 'space-between',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  actionDesc: {
    fontSize: 10,
    color: AppColors.textMuted,
    lineHeight: 14,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
  debugLink: {
    marginBottom: 10,
  },
  debugCard: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  debugText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.secondary,
  },
  arrowText: {
    fontSize: 15,
    color: AppColors.secondary,
  },
  loader: {
    marginVertical: 20,
  },
  orderCard: {
    marginBottom: 10,
  },
  selectedOrderCard: {
    borderColor: AppColors.primary,
    borderWidth: 1.5,
  },
  orderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '800',
    color: AppColors.primary,
  },
  storeName: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  orderDivider: {
    height: 1,
    backgroundColor: AppColors.glassBorder,
    marginVertical: 8,
  },
  orderBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 12,
    color: AppColors.textPrimary,
    fontWeight: '600',
  },
  etaText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.warning,
  },
  storeCard: {
    marginBottom: 8,
  },
  selectedStoreCard: {
    borderColor: AppColors.primary,
    borderWidth: 1.5,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: AppColors.surfaceHighlight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  storeListImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  storeIconEmoji: {
    fontSize: 18,
  },
  storeInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.textPrimary,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.secondary,
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  storeCategory: {
    fontSize: 11,
    color: AppColors.textMuted,
    marginTop: 1,
  },
  storeAddress: {
    fontSize: 10,
    color: AppColors.textMuted,
    marginTop: 2,
  },
  storeBadge: {
    alignItems: 'flex-end',
    marginLeft: 6,
  },
  storeRating: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.warning,
  },
  storeDistance: {
    fontSize: 10,
    color: AppColors.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.textPrimary,
    marginBottom: 6,
  },
  modalDesc: {
    fontSize: 12,
    color: AppColors.textMuted,
    lineHeight: 16,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  hostInput: {
    backgroundColor: AppColors.surface,
    borderColor: AppColors.glassBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: AppColors.textPrimary,
    fontSize: 13,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: AppColors.surfaceHighlight,
  },
  saveBtn: {
    backgroundColor: AppColors.primary,
  },
  cancelText: {
    color: AppColors.textSecondary,
    fontWeight: '700',
  },
  saveText: {
    color: AppColors.background,
    fontWeight: '900',
  },
});
