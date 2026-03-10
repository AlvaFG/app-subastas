import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, fonts, radius } from '../theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  imageUrl?: string;
  name?: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 12,
  md: 14,
  lg: 20,
  xl: 28,
};

function getInitials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function Avatar({ imageUrl, name, size = 'md' }: AvatarProps) {
  const dim = sizeMap[size];

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={[styles.image, { width: dim, height: dim, borderRadius: dim / 2 }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dim, height: dim, borderRadius: dim / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    borderColor: colors.ivory,
  },
  fallback: {
    backgroundColor: 'rgba(201,168,76,0.20)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: fonts.bodyBold,
    color: colors.auctionGold,
  },
});
