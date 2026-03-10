import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, fonts, fontSizes, radius, spacing } from '../theme';

export type CategoryName = 'comun' | 'especial' | 'plata' | 'oro' | 'platino';

interface BadgeProps {
  category: CategoryName;
  style?: ViewStyle;
}

const categoryConfig: Record<CategoryName, { bg: string; text: string; border?: string }> = {
  comun: {
    bg: 'rgba(139,141,145,0.15)',
    text: colors.catComun,
  },
  especial: {
    bg: 'rgba(91,127,165,0.15)',
    text: colors.catEspecial,
  },
  plata: {
    bg: 'rgba(168,181,194,0.15)',
    text: colors.catPlata,
    border: colors.catPlata,
  },
  oro: {
    bg: 'rgba(201,168,76,0.10)',
    text: colors.catOro,
    border: colors.catOro,
  },
  platino: {
    bg: 'rgba(232,228,223,0.10)',
    text: colors.ink,
    border: colors.catPlatino,
  },
};

export function Badge({ category, style }: BadgeProps) {
  const config = categoryConfig[category];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: config.bg,
          borderColor: config.border || 'transparent',
          borderWidth: config.border ? 1 : 0,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: config.text }]}>
        {category.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
  },
});
