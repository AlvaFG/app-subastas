import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import { useAdminStore } from '../../src/store/adminStore';

export default function AdminDashboard() {
  const { admin, logout } = useAdminStore();

  const onLogout = async () => {
    await logout();
    router.replace('/(admin)/login');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hello}>Hola{admin?.nombre ? `, ${admin.nombre}` : ''}</Text>
      <Text style={styles.role}>Rol: {admin?.rol || 'empleado'}</Text>

      <View style={styles.section}>
        <Button title="Clientes (admitir / categoria)" size="lg" onPress={() => router.push('/(admin)/clientes')} style={styles.btn} />
        <Button title="Verificar medios de pago" size="lg" onPress={() => router.push('/(admin)/medios')} style={styles.btn} />
        <Button title="Solicitudes de venta" size="lg" onPress={() => router.push('/(admin)/solicitudes')} style={styles.btn} />
        <Button title="Armar subasta (productos disponibles)" size="lg" onPress={() => router.push('/(admin)/subastas')} style={styles.btn} />
        <Button title="Aplicar multa" variant="secondary" size="lg" onPress={() => router.push('/(admin)/multas')} style={styles.btn} />
      </View>

      <Button title="Cerrar sesion" variant="ghost" onPress={onLogout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg },
  hello: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary },
  role: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  section: { gap: spacing.md, marginBottom: spacing.xl },
  btn: {},
});
