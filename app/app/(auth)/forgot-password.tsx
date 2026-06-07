import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import { isValidEmail } from '../../src/utils/validators';
import { getApiErrorMessage } from '../../src/utils/apiError';
import api from '../../src/services/api';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!email) {
      setError('Ingrese su email');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Ingrese un email valido');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      // El backend siempre responde OK (anti-enumeracion): mostramos un mensaje
      // generico sin revelar si el email existe.
      setSent(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo procesar la solicitud'));
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
          <Text style={styles.title}>Recuperar clave</Text>
          <Text style={styles.subtitle}>Te enviamos un enlace por email</Text>
        </View>

        <View style={styles.form}>
          {sent ? (
            <>
              <Text style={styles.successTitle}>Revisa tu correo</Text>
              <Text style={styles.successText}>
                Si el email esta registrado, te enviamos un enlace para restablecer la clave.
                Revisa tu bandeja de entrada (y la carpeta de spam). El enlace vence en 30 minutos.
              </Text>
              <Button
                title="Volver al login"
                onPress={() => router.replace('/(auth)/login')}
                size="lg"
              />
            </>
          ) : (
            <>
              <Text style={styles.help}>
                Ingresa el email de tu cuenta y te enviaremos un enlace para crear una nueva clave.
              </Text>
              <Input
                label="Email"
                leftIcon="mail-outline"
                placeholder="tu@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Enviar enlace" onPress={handleSubmit} loading={loading} size="lg" />

              <View style={styles.linkRow}>
                <Link href="/(auth)/login" style={styles.link}>Volver al login</Link>
              </View>
            </>
          )}
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
  help: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  link: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },
  successTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  successText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 20 },
});
