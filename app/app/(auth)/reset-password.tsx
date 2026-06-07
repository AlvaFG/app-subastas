import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../../src/utils/validators';
import { getApiErrorMessage } from '../../src/utils/apiError';
import api from '../../src/services/api';

export default function ResetPasswordScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const token = typeof tokenParam === 'string' ? tokenParam : '';

  const [clave, setClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    setError('');
    if (!clave || !confirmarClave) {
      setError('Complete todos los campos');
      return;
    }
    const claveError = validatePassword(clave);
    if (claveError) {
      setError(claveError);
      return;
    }
    if (clave !== confirmarClave) {
      setError('Las claves no coinciden');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, clave });
      // Feedback en pantalla (no Alert: no es confiable en web).
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo restablecer la clave'));
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
          <Text style={styles.title}>Nueva clave</Text>
          <Text style={styles.subtitle}>Elegi una clave para tu cuenta</Text>
        </View>

        <View style={styles.form}>
          {done ? (
            <>
              <Text style={styles.successTitle}>Clave actualizada</Text>
              <Text style={styles.successText}>
                Ya podes iniciar sesion con tu nueva clave.
              </Text>
              <Button
                title="Ir al login"
                onPress={() => router.replace('/(auth)/login')}
                size="lg"
              />
            </>
          ) : !token ? (
            <>
              <Text style={styles.error}>
                Enlace invalido o incompleto. Solicita uno nuevo desde la opcion de recuperar clave.
              </Text>
              <View style={styles.linkRow}>
                <Link href="/(auth)/forgot-password" style={styles.link}>Pedir un nuevo enlace</Link>
              </View>
            </>
          ) : (
            <>
              <Input
                label="Nueva clave"
                leftIcon="lock-closed-outline"
                placeholder={`Minimo ${PASSWORD_MIN_LENGTH} caracteres`}
                value={clave}
                onChangeText={setClave}
                isPassword
              />
              <Input
                label="Confirmar clave"
                leftIcon="lock-closed-outline"
                placeholder="Repeti tu clave"
                value={confirmarClave}
                onChangeText={setConfirmarClave}
                isPassword
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button title="Restablecer clave" onPress={handleSubmit} loading={loading} size="lg" />

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
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  link: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },
  successTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  successText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 20 },
});
