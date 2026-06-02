import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: '',
        headerBackTitle: 'Volver',
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.auctionGold,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="register/step1" />
      <Stack.Screen name="register/step2" />
    </Stack>
  );
}
