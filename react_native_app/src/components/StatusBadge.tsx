import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getStatusColor, getStatusLabel } from '../constants/theme';

interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showDot = true }) => {
  const color = getStatusColor(status);
  const label = getStatusLabel(status);

  return (
    <View style={[styles.badge, { backgroundColor: `${color}18`, borderColor: `${color}40` }]}>
      {showDot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
