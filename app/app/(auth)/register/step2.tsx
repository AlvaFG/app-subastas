import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { Button, Input } from '../../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';

export default function RegisterStep2Screen() {
  const [identificador, setIdentificador] = useState('');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [confirmarClave, setConfirmarClave] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const registerStep2 = useAuthStore((s) => s.registerStep2);

  const handleSubmit = async () => {
    setError('');
    if (!identificador || !email || !clave || !confirmarClave) {
      setError('Complete todos los campos');
      return;
    }
    if (clave.length < 6) {
      setError('La clave debe tener al menos 6 caracteres');
      return;
    }
    if (clave !== confirmarClave) {
      setError('Las claves no coinciden');
      return;
    }
    setLoading(true);
    try {
      await registerStep2({
        identificador: parseInt(identificador),
        email,
        clave,
      });
      Alert.alert(
        'Registro completado',
        'Ya puede iniciar sesion con su email y clave.',
        [{ text: 'Ir a Login', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al completar registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Registro - Etapa 2</Text>
      <Text style={styles.subtitle}>Complete su cuenta</Text>

      <Input
        label="Numero de identificador"
        leftIcon="finger-print-outline"
        placeholder="Recibido por email"
        value={identificador}
        onChangeText={setIdentificador}
        keyboardType="numeric"
      />
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
        placeholder="Minimo 6 caracteres"
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
});
