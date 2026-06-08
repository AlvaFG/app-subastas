import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
  Barlow_700Bold,
  Barlow_800ExtraBold,
} from '@expo-google-fonts/barlow';
import { useAuthStore } from '../src/store/authStore';
import { colors, fonts } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_700Bold,
    Barlow_800ExtraBold,
  });

  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  // T209: Cargar usuario al iniciar
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // T209: Auth navigation guard
  useEffect(() => {
    if (isLoading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';
    // La capa administrativa tiene su propia sesion (token de empleado) y su propio
    // guard en (admin)/_layout. El guard de cliente la ignora para no expulsar al admin.
    const inAdminGroup = segments[0] === '(admin)';

    if (!isAuthenticated && !inAuthGroup && !inAdminGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, fontsLoaded, segments]);

  if (!fontsLoaded || isLoading) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.ivory },
          headerTintColor: colors.auctionGold,
          headerTitleStyle: { color: colors.textPrimary, fontFamily: fonts.headingSemibold },
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerBackTitle: 'Volver',
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="subasta/[id]" options={{ headerShown: true, title: 'Subasta' }} />
        <Stack.Screen name="item/[id]" options={{ headerShown: true, title: 'Detalle' }} />
      </Stack>
    </>
  );
}
