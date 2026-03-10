import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { colors, radius, spacing, duration } from '../theme';

// Skeleton shimmer
interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width,
  height,
  borderRadius = radius.md,
  style,
}: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: duration.crawl }),
        withTiming(0, { duration: duration.crawl }),
      ),
      -1,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.4, 0.8]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.parchment,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Spinner
interface SpinnerProps {
  size?: number;
  color?: string;
}

export function Spinner({ size = 24, color = colors.auctionGold }: SpinnerProps) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 800 }), -1, false);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: 'transparent',
          borderTopColor: color,
          borderRightColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// Card skeleton (for catalog)
export function CardSkeleton() {
  return (
    <View style={skeletonStyles.card}>
      <Skeleton width="100%" height={180} borderRadius={radius.md} />
      <View style={skeletonStyles.content}>
        <Skeleton width="70%" height={18} borderRadius={radius.sm} />
        <Skeleton
          width="40%"
          height={22}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.xs }}
        />
        <Skeleton
          width="90%"
          height={14}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.xs }}
        />
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  content: {
    padding: spacing.md,
    gap: spacing.xs,
  },
});
