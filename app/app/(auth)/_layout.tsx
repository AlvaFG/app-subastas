import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerTitle: '', headerBackTitle: 'Volver' }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register/step1" />
      <Stack.Screen name="register/step2" />
    </Stack>
  );
}
