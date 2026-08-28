import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable } from 'react-native';
import { useOrderStore } from '../store/orderStore';
import { wsService } from '../services/websocketClient';
import { AppColors } from '../constants/theme';
import { GlassCard } from '../components/GlassCard';
import { TopGlassHeader } from '../components/TopGlassHeader';
import { ApiConstants } from '../constants/apiConstants';

export const TrackingDebugScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { activeOrder, wsStatus, backendBaseUrl, setServerHost, telemetry } = useOrderStore();
  const [inputHost, setInputHost] = useState(backendBaseUrl);

  useEffect(() => {
    setInputHost(backendBaseUrl);
  }, [backendBaseUrl]);

  const handleApplyHost = () => {
    setServerHost(inputHost);
  };

  return (
    <View style={styles.container}>
      <View style={styles.topHeader}>
        <TopGlassHeader
          title="Telemetry Diagnostics"
          subtitle="Real-time Network & Socket Inspector"
          onBack={() => navigation.goBack()}
          wsStatus={wsStatus}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Network & Host Inspector */}
        <Text style={styles.sectionTitle}>SERVER & WEBSOCKET CONFIG</Text>
        <GlassCard style={styles.card} highlight>
          <Text style={styles.label}>CURRENT REST BASE URL</Text>
          <Text style={styles.value}>{ApiConstants.httpBaseUrl}</Text>

          <Text style={[styles.label, { marginTop: 12 }]}>CURRENT WEBSOCKET URL</Text>
          <Text style={styles.value}>
            {activeOrder ? ApiConstants.orderWs(activeOrder.id) : 'No Order Selected'}
          </Text>

          <View style={styles.divider} />

          <Text style={styles.label}>CHANGE BACKEND URL</Text>
          <View style={styles.hostInputRow}>
            <TextInput
              style={styles.hostInput}
              value={inputHost}
              onChangeText={setInputHost}
              placeholder="https://api.yourdomain.com"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.applyBtn} onPress={handleApplyHost}>
              <Text style={styles.applyBtnText}>Apply</Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* WebSocket Connection Telemetry */}
        <Text style={styles.sectionTitle}>SOCKET PERFORMANCE</Text>
        <GlassCard style={styles.card}>
          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Connection State</Text>
            <Text style={[styles.metricValue, { color: wsStatus === 'connected' ? AppColors.success : AppColors.error }]}>
              {wsStatus.toUpperCase()}
            </Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Messages Received</Text>
            <Text style={styles.metricValue}>{wsService.messagesReceivedCount}</Text>
          </View>

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>Last Message Time</Text>
            <Text style={styles.metricValue}>
              {wsService.lastMessageTime
                ? wsService.lastMessageTime.toLocaleTimeString()
                : 'None yet'}
            </Text>
          </View>
        </GlassCard>

        {/* Raw Live Telemetry Data */}
        <Text style={styles.sectionTitle}>LIVE TELEMETRY OBJECT</Text>
        <GlassCard style={styles.card}>
          <Text style={styles.codeText}>
            {JSON.stringify(
              {
                activeOrderId: activeOrder?.id,
                status: activeOrder?.status,
                currentCoords: {
                  lat: activeOrder?.currentLat,
                  lng: activeOrder?.currentLng,
                },
                heading: activeOrder?.currentHeading,
                speedKmh: Math.round((activeOrder?.currentSpeed || 0) * 3.6),
                accuracyMeters: activeOrder?.currentAccuracy,
                distanceRemainingKm: (
                  (activeOrder?.remainingDistanceMeters || 0) / 1000
                ).toFixed(2),
                smoothedEtaMinutes: activeOrder?.smoothedEtaMinutes?.toFixed(1),
                telemetrySnapshot: telemetry,
              },
              null,
              2,
            )}
          </Text>
        </GlassCard>

        {/* Last Raw Packet */}
        <Text style={styles.sectionTitle}>LAST RAW INCOMING PACKET</Text>
        <GlassCard style={styles.card}>
          <Text style={styles.codeText}>{wsService.lastRawResponse || 'None'}</Text>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    marginBottom: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: AppColors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: AppColors.glassBorder,
    marginVertical: 14,
  },
  hostInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  hostInput: {
    flex: 1,
    backgroundColor: AppColors.surface,
    borderColor: AppColors.glassBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: AppColors.textPrimary,
    fontSize: 13,
  },
  applyBtn: {
    backgroundColor: AppColors.primary,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyBtnText: {
    color: AppColors.background,
    fontWeight: '800',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metricLabel: {
    fontSize: 13,
    color: AppColors.textSecondary,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.textPrimary,
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: AppColors.secondary,
    lineHeight: 16,
  },
});
