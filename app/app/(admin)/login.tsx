import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import { useAdminStore } from '../../src/store/adminStore';
import { isValidEmail } from '../../src/utils/validators';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, loadAdmin } = useAdminStore();

  useEffect(() => {
    loadAdmin().then((ok) => {
      if (ok) router.replace('/(admin)');
    });
  }, [loadAdmin]);

  const handleLogin = async () => {
    setError('');
    if (!email || !clave) {
      setError('Complete todos los campos');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Ingrese un email valido');
      return;
    }
    setLoading(true);
    try {
      await login(email, clave);
      router.replace('/(admin)');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al iniciar sesion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Panel Empresa</Text>
          <Text style={styles.subtitle}>Acceso para empleados</Text>
        </View>
        <View style={styles.form}>
          <Input label="Email" leftIcon="mail-outline" placeholder="admin@subastas.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Input label="Clave" leftIcon="lock-closed-outline" placeholder="Tu clave" value={clave} onChangeText={setClave} isPassword />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Ingresar" onPress={handleLogin} loading={loading} size="lg" />
          <Button title="Volver" variant="ghost" onPress={() => router.replace('/(auth)/login')} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing['2xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], color: colors.auctionGold },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.sm },
  form: { backgroundColor: colors.ivory, borderRadius: 16, padding: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
});
