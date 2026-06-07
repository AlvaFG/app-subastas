import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';
import { isValidEmail } from '../../src/utils/validators';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const handleLogin = async () => {
    setError('');
    if (!email || !clave) {
      setError('Complete todos los campos');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Ingrese un email valido (debe incluir @)');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), clave);
      router.replace('/(tabs)');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al iniciar sesion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Subastas</Text>
          <Text style={styles.subtitle}>Inicia sesion para participar</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email"
            leftIcon="mail-outline"
            placeholder="tu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="Clave"
            leftIcon="lock-closed-outline"
            placeholder="Tu clave"
            value={clave}
            onChangeText={setClave}
            isPassword
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Iniciar Sesion" onPress={handleLogin} loading={loading} size="lg" />

          <View style={styles.linkRow}>
            <Link href="/(auth)/forgot-password" style={styles.link}>Olvidaste tu clave?</Link>
          </View>
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>No tenes cuenta? </Text>
            <Link href="/(auth)/register/step1" style={styles.link}>Registrate</Link>
          </View>
          <View style={styles.linkRow}>
            <Link href="/(admin)/login" style={styles.linkMuted}>Acceso empleados</Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  header: { alignItems: 'center', marginBottom: spacing['2xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes.hero, color: colors.auctionGold },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.sm },
  form: { backgroundColor: colors.ivory, borderRadius: 16, padding: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  linkText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  link: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },
  linkMuted: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.sm, textDecorationLine: 'underline' },
});
