import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, radius, spacing, shadows } from '../theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
  style?: ViewStyle;
}

export function Input({
  label,
  error,
  leftIcon,
  isPassword = false,
  style,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [secureVisible, setSecureVisible] = useState(!isPassword);

  const borderColor = error
    ? colors.alertEmber
    : focused
    ? colors.auctionGold
    : colors.border;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          { borderColor },
          focused && !error && shadows.sm,
        ]}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={colors.textMuted}
            style={styles.leftIcon}
          />
        )}
        <TextInput
          {...props}
          secureTextEntry={!secureVisible}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            leftIcon && { paddingLeft: 0 },
            isPassword && { paddingRight: 44 },
          ]}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setSecureVisible(!secureVisible)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={secureVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.ivory,
    paddingHorizontal: spacing.md,
  },
  leftIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    height: '100%',
  },
  eyeIcon: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.alertEmber,
    marginTop: spacing.xs,
  },
});
