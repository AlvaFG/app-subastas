import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, fonts, fontSizes, radius, duration } from '../theme';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.auctionGold, text: colors.ink },
  secondary: { bg: colors.parchment, text: colors.textPrimary, border: colors.border },
  outline: { bg: 'transparent', text: colors.auctionGold, border: colors.auctionGold },
  ghost: { bg: 'transparent', text: colors.textSecondary },
  danger: { bg: colors.alertEmber, text: colors.ivory },
};

const sizeStyles: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: fontSizes.sm },
  md: { height: 48, paddingHorizontal: 24, fontSize: fontSizes.base },
  lg: { height: 56, paddingHorizontal: 32, fontSize: fontSizes.lg },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.97, { duration: duration.fast });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: duration.fast });
  };

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          height: s.height,
          paddingHorizontal: s.paddingHorizontal,
          borderColor: v.border || 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          opacity: disabled ? 0.5 : 1,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: v.text, fontSize: s.fontSize }]}>
          {title}
        </Text>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontFamily: fonts.bodySemibold,
  },
});
