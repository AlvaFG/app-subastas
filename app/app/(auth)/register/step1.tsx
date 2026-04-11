import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';

export default function RegisterStep1Screen() {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [direccion, setDireccion] = useState('');
  const [numeroPais, setNumeroPais] = useState('');
  const [fotoFrente, setFotoFrente] = useState<string | null>(null);
  const [fotoDorso, setFotoDorso] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const registerStep1 = useAuthStore((s) => s.registerStep1);

  const pickImage = async (side: 'frente' | 'dorso') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (side === 'frente') setFotoFrente(uri);
      else setFotoDorso(uri);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!nombre || !documento || !direccion || !numeroPais) {
      setError('Complete todos los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      const id = await registerStep1({
        documento,
        nombre,
        direccion,
        numeroPais: parseInt(numeroPais),
      });
      Alert.alert(
        'Registro enviado',
        'Sus datos seran verificados. Recibira un email cuando pueda completar el registro.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Registro - Etapa 1</Text>
      <Text style={styles.subtitle}>Datos personales</Text>

      <Input
        label="Nombre y Apellido"
        leftIcon="person-outline"
        placeholder="Juan Perez"
        value={nombre}
        onChangeText={setNombre}
      />
      <Input
        label="Documento"
        leftIcon="card-outline"
        placeholder="12345678"
        value={documento}
        onChangeText={setDocumento}
        keyboardType="numeric"
      />
      <Input
        label="Domicilio Legal"
        leftIcon="home-outline"
        placeholder="Av. Siempreviva 742"
        value={direccion}
        onChangeText={setDireccion}
      />
      <Input
        label="Pais (codigo)"
        leftIcon="globe-outline"
        placeholder="1"
        value={numeroPais}
        onChangeText={setNumeroPais}
        keyboardType="numeric"
      />

      <Text style={styles.sectionTitle}>Foto del Documento</Text>

      <View style={styles.photoRow}>
        <Button
          title={fotoFrente ? 'Frente OK' : 'Subir Frente'}
          variant={fotoFrente ? 'secondary' : 'outline'}
          size="sm"
          onPress={() => pickImage('frente')}
          style={styles.photoBtn}
        />
        <Button
          title={fotoDorso ? 'Dorso OK' : 'Subir Dorso'}
          variant={fotoDorso ? 'secondary' : 'outline'}
          size="sm"
          onPress={() => pickImage('dorso')}
          style={styles.photoBtn}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Enviar Registro" onPress={handleSubmit} loading={loading} size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  photoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  photoBtn: { flex: 1 },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginBottom: spacing.md, textAlign: 'center' },
});
