import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { AppColors } from '../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  highlight?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style, highlight = false }) => {
  return (
    <View
      style={[
        styles.card,
        highlight && styles.highlightBorder,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.glassCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppColors.glassBorder,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  highlightBorder: {
    borderColor: AppColors.glassBorderHighlight,
  },
});
