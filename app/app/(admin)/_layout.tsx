import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAdminStore } from '../../src/store/adminStore';
import { colors } from '../../src/theme';

export default function AdminLayout() {
  const { isAdminAuth, loadAdmin } = useAdminStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  useEffect(() => {
    const onLogin = (segments as string[]).includes('login');
    if (!isAdminAuth && !onLogin) {
      router.replace('/(admin)/login');
    }
  }, [isAdminAuth, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: colors.auctionGold,
        headerStyle: { backgroundColor: colors.ink },
        headerTitleStyle: { color: colors.ivory },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ title: 'Panel Empresa' }} />
      <Stack.Screen name="clientes" options={{ title: 'Clientes' }} />
      <Stack.Screen name="medios" options={{ title: 'Medios de pago' }} />
      <Stack.Screen name="solicitudes" options={{ title: 'Solicitudes de venta' }} />
      <Stack.Screen name="multas" options={{ title: 'Multas' }} />
    </Stack>
  );
}
