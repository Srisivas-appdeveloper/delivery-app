import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useOrderStore } from '../store/orderStore';
import { AppColors, getStatusColor } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { TopGlassHeader } from '../components/TopGlassHeader';
import { StatusBadge } from '../components/StatusBadge';
import { LocationService } from '../services/locationService';

const STATUS_TRANSITIONS = ['assigned', 'preparing', 'picked_up', 'on_the_way', 'nearby', 'delivered'];
const SPEED_OPTIONS = [1, 2, 5];

export const DriverDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    activeOrder,
    wsStatus,
    isSimulating,
    simulationProgress,
    simulationSpeedMultiplier,
    startSimulation,
    pauseSimulation,
    resetSimulation,
    setSimulationSpeed,
    updateOrderStatus,
    updateDriverLocation,
  } = useOrderStore();

  const [isBroadcastingGps, setIsBroadcastingGps] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopGpsBroadcast();
    };
  }, []);

  const startGpsBroadcast = async () => {
    const hasPermission = await LocationService.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Location permission is required to stream real GPS coordinates.');
      return;
    }

    // Stop route simulation if running
    if (isSimulating) {
      pauseSimulation();
    }

    setIsBroadcastingGps(true);
    watchIdRef.current = LocationService.watchLocation(
      (position) => {
        const { latitude, longitude, heading, speed, accuracy } = position.coords;
        updateDriverLocation(
          latitude,
          longitude,
          heading ?? 0,
          speed ?? 0,
          accuracy ?? 4,
        );
      },
      (error) => {
        console.warn('GPS Watch Error:', error);
      },
    );
  };

  const stopGpsBroadcast = () => {
    if (watchIdRef.current !== null) {
      LocationService.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsBroadcastingGps(false);
  };

  const handleStatusChange = (newStatus: string) => {
    updateOrderStatus(newStatus);
  };

  const progressPercent = Math.round(simulationProgress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <TopGlassHeader
          title="Driver Console"
          subtitle={activeOrder ? `Active: #${activeOrder.id}` : 'No Active Order'}
          onBack={() => navigation.goBack()}
          wsStatus={wsStatus}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Order Card */}
        {activeOrder ? (
          <GlassCard style={styles.orderCard} highlight>
            <View style={styles.orderHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderTitle}>{activeOrder.storeName}</Text>
                <Text style={styles.orderDest}>📍 {activeOrder.destinationAddress}</Text>
              </View>
              <StatusBadge status={activeOrder.status} />
            </View>

            <View style={styles.divider} />

            <View style={styles.orderFooter}>
              <Text style={styles.customerName}>👤 {activeOrder.customerName}</Text>
              <Pressable
                style={styles.viewLiveBtn}
                onPress={() => navigation.navigate('LiveTracking')}
              >
                <Text style={styles.viewLiveText}>View Map Tracking →</Text>
              </Pressable>
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>Please select an order from the Home screen</Text>
          </GlassCard>
        )}

        {/* Real-time Route Driving Simulator */}
        <Text style={styles.sectionTitle}>ROUTE DRIVING SIMULATOR</Text>
        <GlassCard style={styles.simCard}>
          <View style={styles.simHeader}>
            <View>
              <Text style={styles.simTitle}>
                {isSimulating ? '🚗 Simulation In Progress' : '⏸️ Simulation Paused'}
              </Text>
              <Text style={styles.simSubtitle}>
                Simulates real turn-by-turn driving along delivery waypoints
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isSimulating ? AppColors.success : AppColors.warning },
              ]}
            />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
            <View style={styles.progressLabelRow}>
              <Text style={styles.progressLabel}>Pickup: {activeOrder?.storeName}</Text>
              <Text style={styles.progressPercentText}>{progressPercent}%</Text>
              <Text style={styles.progressLabel}>Customer Drop-off</Text>
            </View>
          </View>

          {/* Speed Multipliers */}
          <View style={styles.speedRow}>
            <Text style={styles.speedLabel}>SIM SPEED:</Text>
            <View style={styles.speedOptions}>
              {SPEED_OPTIONS.map((speed) => {
                const isSelected = simulationSpeedMultiplier === speed;
                return (
                  <Pressable
                    key={speed}
                    style={[styles.speedPill, isSelected && styles.speedPillActive]}
                    onPress={() => setSimulationSpeed(speed)}
                  >
                    <Text style={[styles.speedText, isSelected && styles.speedTextActive]}>
                      {speed}x
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Controls */}
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.actionBtn, isSimulating ? styles.pauseBtn : styles.playBtn]}
              onPress={() => (isSimulating ? pauseSimulation() : startSimulation())}
            >
              <Text style={styles.actionBtnText}>
                {isSimulating ? '⏸ Pause Route' : '▶ Drive Route'}
              </Text>
            </Pressable>

            <Pressable style={[styles.actionBtn, styles.resetBtn]} onPress={resetSimulation}>
              <Text style={styles.actionBtnText}>🔄 Reset to Store</Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* Real GPS Streaming Option */}
        <Text style={styles.sectionTitle}>DEVICE PHYSICAL GPS STREAMING</Text>
        <GlassCard style={styles.gpsCard}>
          <View style={styles.simHeader}>
            <View>
              <Text style={styles.simTitle}>
                {isBroadcastingGps ? '📡 Broadcasting Device GPS' : 'Physical GPS Streamer'}
              </Text>
              <Text style={styles.simSubtitle}>
                {isBroadcastingGps
                  ? 'Streaming actual phone hardware GPS to customers'
                  : 'Broadcast real location from device sensor'}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isBroadcastingGps ? AppColors.success : AppColors.textMuted },
              ]}
            />
          </View>

          <Pressable
            style={[
              styles.actionBtn,
              isBroadcastingGps ? styles.stopGpsBtn : styles.startGpsBtn,
              { marginTop: 10 },
            ]}
            onPress={isBroadcastingGps ? stopGpsBroadcast : startGpsBroadcast}
          >
            <Text style={styles.actionBtnText}>
              {isBroadcastingGps ? '⏹ Stop Device GPS' : '🛰️ Start Device GPS Broadcast'}
            </Text>
          </Pressable>
        </GlassCard>

        {/* Live Telemetry Display */}
        <Text style={styles.sectionTitle}>LIVE TELEMETRY READOUT</Text>
        <View style={styles.telemetryGrid}>
          <GlassCard style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>SPEED</Text>
            <Text style={styles.telemetryValue}>
              {Math.round((activeOrder?.currentSpeed || 0) * 3.6)}{' '}
              <Text style={styles.telemetryUnit}>km/h</Text>
            </Text>
          </GlassCard>

          <GlassCard style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>HEADING</Text>
            <Text style={styles.telemetryValue}>
              {Math.round(activeOrder?.currentHeading || 0)}°
            </Text>
          </GlassCard>

          <GlassCard style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>DISTANCE</Text>
            <Text style={styles.telemetryValue}>
              {((activeOrder?.remainingDistanceMeters || 0) / 1000).toFixed(1)}{' '}
              <Text style={styles.telemetryUnit}>km</Text>
            </Text>
          </GlassCard>
        </View>

        {/* Status Transition Pipeline */}
        <Text style={styles.sectionTitle}>ORDER STATUS CONTROLS</Text>
        <GlassCard style={styles.statusCard}>
          <Text style={styles.statusDesc}>Manually advance order lifecycle:</Text>
          <View style={styles.statusGrid}>
            {STATUS_TRANSITIONS.map((statusKey) => {
              const isCurrent = activeOrder?.status === statusKey;
              const color = getStatusColor(statusKey);

              return (
                <Pressable
                  key={statusKey}
                  style={[
                    styles.statusBtn,
                    {
                      borderColor: isCurrent ? color : `${color}40`,
                      backgroundColor: isCurrent ? `${color}30` : 'transparent',
                    },
                  ]}
                  onPress={() => handleStatusChange(statusKey)}
                >
                  <Text style={[styles.statusBtnText, { color: isCurrent ? color : AppColors.textSecondary }]}>
                    {statusKey.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  topHeader: {
    paddingTop: 44,
    backgroundColor: AppColors.glassSurface,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  orderCard: {
    marginBottom: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  orderDest: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.glassBorder,
    marginVertical: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  viewLiveBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  viewLiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: AppColors.textMuted,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  simCard: {
    marginBottom: 20,
  },
  simHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  simTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  simSubtitle: {
    fontSize: 11,
    color: AppColors.textMuted,
    marginTop: 2,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressContainer: {
    marginVertical: 10,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: AppColors.surfaceHighlight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: AppColors.primary,
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressLabel: {
    fontSize: 10,
    color: AppColors.textMuted,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.primary,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  speedLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
  },
  speedOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  speedPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: AppColors.surfaceHighlight,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  speedPillActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  speedText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textSecondary,
  },
  speedTextActive: {
    color: AppColors.background,
    fontWeight: '900',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  playBtn: {
    backgroundColor: AppColors.primary,
  },
  pauseBtn: {
    backgroundColor: AppColors.warning,
  },
  resetBtn: {
    backgroundColor: AppColors.surfaceHighlight,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
  },
  startGpsBtn: {
    backgroundColor: AppColors.secondary,
  },
  stopGpsBtn: {
    backgroundColor: AppColors.error,
  },
  actionBtnText: {
    fontWeight: '800',
    fontSize: 13,
    color: AppColors.textPrimary,
  },
  gpsCard: {
    marginBottom: 20,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  telemetryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: AppColors.primary,
  },
  telemetryUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.textSecondary,
  },
  statusCard: {
    marginBottom: 20,
  },
  statusDesc: {
    fontSize: 12,
    color: AppColors.textMuted,
    marginBottom: 10,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
