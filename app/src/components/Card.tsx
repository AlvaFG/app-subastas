import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, fontSizes, radius, spacing, shadows, duration } from '../theme';
import { Badge, CategoryName } from './Badge';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Card width: 2 columns with gaps and padding accounted for
const CARD_WIDTH = (SCREEN_WIDTH - spacing.md * 2 - spacing.md) / 2;
const IS_SMALL = CARD_WIDTH < 160;

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
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {formattedPrice}
          </Text>
        )}
        {description && !IS_SMALL && (
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        )}
        {description && IS_SMALL && (
          <Text style={styles.descriptionSmall} numberOfLines={1}>{description}</Text>
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
    flex: 1,
  },
  imageWrapper: {
    aspectRatio: 1,
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
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  badgeWrapper: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  },
  content: {
    padding: IS_SMALL ? spacing.sm : spacing.md,
    gap: 2,
  },
  title: {
    fontFamily: fonts.headingSemibold,
    fontSize: IS_SMALL ? fontSizes.sm : fontSizes.base,
    color: colors.textPrimary,
    lineHeight: IS_SMALL ? 18 : 22,
  },
  price: {
    fontFamily: fonts.display,
    fontSize: IS_SMALL ? fontSizes.base : fontSizes.xl,
    color: colors.auctionGold,
    marginTop: 2,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  descriptionSmall: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
