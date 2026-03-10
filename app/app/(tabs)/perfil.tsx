import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button, Avatar, Badge } from '../../src/components';
import { CategoryName } from '../../src/components/Badge';
import { colors, fonts, fontSizes, spacing, shadows, radius } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

export default function PerfilScreen() {
  const { user, logout, isAuthenticated } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  if (!isAuthenticated || !user) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Mi Perfil</Text>
        <Text style={styles.subtitle}>Inicia sesion para ver tu perfil</Text>
        <Button
          title="Iniciar Sesion"
          onPress={() => router.push('/(auth)/login')}
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={styles.profileHeader}>
        <Avatar name={user.nombre} size="xl" />
        <Text style={styles.userName}>{user.nombre}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Badge category={user.categoria as CategoryName} style={{ marginTop: spacing.sm }} />
      </View>

      <View style={[styles.section, shadows.md]}>
        <Text style={styles.sectionTitle}>Datos de Cuenta</Text>
        <InfoRow label="Categoria" value={user.categoria} />
        <InfoRow label="Email" value={user.email} />
      </View>

      <Button
        title="Mis Estadisticas"
        variant="secondary"
        onPress={() => router.push('/estadisticas')}
        style={{ marginTop: spacing.md }}
      />

      <Button
        title="Notificaciones"
        variant="secondary"
        onPress={() => router.push('/notificaciones')}
        style={{ marginTop: spacing.sm }}
      />

      <Button
        title="Medios de Pago"
        variant="secondary"
        onPress={() => {/* TODO: navegar a medios de pago */}}
        style={{ marginTop: spacing.sm }}
      />

      <Button
        title="Cerrar Sesion"
        variant="danger"
        onPress={handleLogout}
        style={{ marginTop: spacing.md }}
      />
    </ScrollView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory, padding: spacing.lg },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.xs },
  profileHeader: { alignItems: 'center', marginBottom: spacing.xl },
  userName: { fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.textPrimary, marginTop: spacing.md },
  userEmail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  section: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  infoValue: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
});
