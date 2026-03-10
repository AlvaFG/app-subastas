import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, fontSizes, radius, spacing, shadows, duration } from '../theme';
import { Badge, CategoryName } from './Badge';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface CardProps {
  title: string;
  price?: number;
  currency?: 'ARS' | 'USD';
  description?: string;
  imageUrl?: string;
  category?: CategoryName;
  onPress?: () => void;
}

export function Card({
  title,
  price,
  currency = 'ARS',
  description,
  imageUrl,
  category,
  onPress,
}: CardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(1.02, { duration: duration.normal });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: duration.normal });
  };

  const formattedPrice = price
    ? `${currency === 'USD' ? 'US$' : '$'} ${price.toLocaleString('es-AR')}`
    : null;

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
      style={[styles.container, shadows.md, animatedStyle]}
    >
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderText}>Sin imagen</Text>
          </View>
        )}
        {category && (
          <View style={styles.badgeWrapper}>
            <Badge category={category} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {formattedPrice && (
          <Text style={styles.price}>{formattedPrice}</Text>
        )}
        {description && (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        )}
      </View>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  imageWrapper: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.parchment,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  badgeWrapper: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: fontSizes.xl,
    color: colors.auctionGold,
    marginTop: spacing.xs,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
