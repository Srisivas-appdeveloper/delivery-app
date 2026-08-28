import React from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Store, getPlaceColor, getPlaceIcon } from '../models/Store';
import { AppColors } from '../constants/theme';
import { useOrderStore } from '../store/orderStore';
import { calculateHaversineDistance, formatNavigationDistance } from '../models/Order';

export const HotelsListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    setSelectedStore,
    orders,
    userLocation,
    activeOrder,
    nearbyPlaces,
    isFetchingPlaces,
  } = useOrderStore();
  const completed = orders.filter((order) => order.status === 'delivered');

  const openHotel = (hotel: Store) => {
    setSelectedStore(hotel);
    navigation.getParent()?.navigate('HotelDetail', { hotelId: hotel.id });
  };

  const navigateToMap = (hotel: Store) => {
    setSelectedStore(hotel);
    navigation.navigate('Map', { hotelId: hotel.id });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Places</Text>
      <Text style={styles.subtitle}>
        {isFetchingPlaces
          ? 'Loading places within 2 km of your location...'
          : `Places within 2 km · ${nearbyPlaces.length} found`}
      </Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {activeOrder ? (
          <Pressable onPress={() => navigation.navigate('Track')}>
            <View style={styles.liveCard}>
              <Text style={styles.liveLabel}>In progress</Text>
              <Text style={styles.liveName}>{activeOrder.storeName}</Text>
              <Text style={styles.liveMeta}>
                {formatNavigationDistance(activeOrder.remainingDistanceMeters)} remaining
              </Text>
            </View>
          </Pressable>
        ) : null}

        {completed.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed visits</Text>
            {completed.map((visit) => (
              <View key={visit.id} style={styles.visitCard}>
                <View style={styles.visitCopy}>
                  <Text style={styles.name}>{visit.storeName}</Text>
                  <Text style={styles.address}>{visit.destinationAddress}</Text>
                  <Text style={styles.meta}>Completed</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyVisits}>No completed visits yet.</Text>
        )}

        <Text style={styles.sectionTitle}>Within 2 km</Text>
        {nearbyPlaces.length === 0 && !isFetchingPlaces ? (
          <Text style={styles.emptyVisits}>No places in this radius. Open Map and wait for GPS.</Text>
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
            <Pressable key={hotel.id} onPress={() => openHotel(hotel)}>
              <View style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image source={hotel.image} style={styles.image} resizeMode="cover" />
                  <View style={[styles.categoryBadge, { backgroundColor: getPlaceColor(hotel) }]}>
                    <Text style={styles.categoryBadgeText}>
                      {getPlaceIcon(hotel)} {hotel.category}
                    </Text>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceBadgeText}>🚶 {walkMins} min</Text>
                  </View>
                </View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={styles.name} numberOfLines={1}>{hotel.name}</Text>
                    <Text style={styles.rating}>⭐ {hotel.rating.toFixed(1)}</Text>
                  </View>
                  <Text style={styles.address} numberOfLines={1}>{hotel.address}</Text>
                  <View style={styles.footerRow}>
                    <Text style={styles.meta}>
                      📍 {formatNavigationDistance(meters)} away
                    </Text>
                    <Pressable onPress={() => navigateToMap(hotel)}>
                      <Text style={styles.navLink}>Start →</Text>
                    </Pressable>
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
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  subtitle: {
    color: AppColors.textMuted,
    fontSize: 13,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: AppColors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 8,
  },
  emptyVisits: {
    color: AppColors.textMuted,
    fontSize: 13,
  },
  liveCard: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  liveLabel: {
    color: AppColors.primary,
    fontWeight: '800',
    fontSize: 11,
  },
  liveName: {
    color: AppColors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 4,
  },
  liveMeta: {
    color: AppColors.textSecondary,
    marginTop: 4,
    fontSize: 13,
  },
  visitCard: {
    flexDirection: 'row',
    backgroundColor: AppColors.glassCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  visitCopy: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: AppColors.glassCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    height: 160,
    backgroundColor: AppColors.surface,
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: AppColors.surface,
  },
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  distanceBadge: {
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
  distanceBadgeText: {
    color: AppColors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  copy: {
    padding: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  rating: {
    color: AppColors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  address: {
    color: AppColors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: {
    color: AppColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  navLink: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
});
