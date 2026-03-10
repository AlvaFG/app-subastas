import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';

export default function CatalogoTab() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Catalogo</Text>
      <Text style={styles.subtitle}>
        Selecciona una subasta desde la pantalla principal para ver su catalogo
      </Text>
      <Button
        title="Ver Subastas"
        variant="outline"
        onPress={() => router.push('/(tabs)')}
        style={{ marginTop: spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory, padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
