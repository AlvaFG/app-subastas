import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Button, Input } from '../../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../../src/theme';
import { validatePassword, PASSWORD_MIN_LENGTH } from '../../../src/utils/validators';
import { getApiErrorMessage } from '../../../src/utils/apiError';
import { useAuthStore } from '../../../src/store/authStore';

export default function RegisterStep2Screen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string }>();
  const token = typeof tokenParam === 'string' ? tokenParam : '';

  const [clave, setClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [completado, setCompletado] = useState(false);
  const registerStep2 = useAuthStore((s) => s.registerStep2);

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
      await registerStep2({ token, clave });
      // Feedback en pantalla (no Alert: no es confiable en web).
      setCompletado(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Error al completar registro'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Registro - Etapa 2</Text>
      <Text style={styles.subtitle}>Crea tu clave para completar el registro</Text>

      {completado ? (
        <>
          <Text style={styles.successTitle}>¡Registro completado!</Text>
          <Text style={styles.successText}>
            Tu clave fue creada con exito. Ya podes iniciar sesion con tu email y clave.
          </Text>
          <Button title="Ir al login" size="lg" onPress={() => router.replace('/(auth)/login')} />
        </>
      ) : !token ? (
        <>
          <Text style={styles.error}>
            Enlace invalido o incompleto. Abri el enlace del email de admision para completar
            tu registro.
          </Text>
          <View style={styles.linkRow}>
            <Link href="/(auth)/login" style={styles.link}>Volver al login</Link>
          </View>
        </>
      ) : (
        <>
          <Input
            label="Clave"
            leftIcon="lock-closed-outline"
            placeholder={`Minimo ${PASSWORD_MIN_LENGTH} caracteres`}
            value={clave}
            onChangeText={setClave}
            isPassword
          />
          <Input
            label="Confirmar Clave"
            leftIcon="lock-closed-outline"
            placeholder="Repita su clave"
            value={confirmarClave}
            onChangeText={setConfirmarClave}
            isPassword
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Completar Registro" onPress={handleSubmit} loading={loading} size="lg" />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  link: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },
  successTitle: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary, marginBottom: spacing.sm, textAlign: 'center' },
  successText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.lg, textAlign: 'center', lineHeight: 20 },
});
