import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../../src/theme';
import { useAuthStore } from '../../../src/store/authStore';
import countries from '../../../src/utils/countries';

export default function RegisterStep1Screen() {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [documento, setDocumento] = useState('');
  const [direccion, setDireccion] = useState('');
  const [numeroPais, setNumeroPais] = useState('');
  const [fotoFrente, setFotoFrente] = useState<string | null>(null);
  const [fotoDorso, setFotoDorso] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCountryList, setShowCountryList] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
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
    if (!nombre || !apellido || !documento || !direccion || !numeroPais || !fotoFrente || !fotoDorso) {
      setError('Complete todos los campos obligatorios');
      return;
    }
    setLoading(true);
    try {
      const id = await registerStep1({
        documento,
        nombre,
        apellido,
        direccion,
        numeroPais: parseInt(numeroPais, 10),
        fotoFrente,
        fotoDorso,
      });
      router.replace(`/(auth)/register/step2?identificador=${id}`);
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

      <Input label="Nombre" leftIcon="person-outline" placeholder="Juan" value={nombre} onChangeText={setNombre} />
      <Input label="Apellido" leftIcon="person-outline" placeholder="Perez" value={apellido} onChangeText={setApellido} />

      <Input label="Documento" leftIcon="card-outline" placeholder="12345678" value={documento} onChangeText={setDocumento} keyboardType="numeric" />

      <Input label="Domicilio Legal" leftIcon="home-outline" placeholder="Av. Siempreviva 742" value={direccion} onChangeText={setDireccion} />

      <Text style={styles.label}>País</Text>
      <TouchableOpacity style={styles.countrySelect} onPress={() => setShowCountryList((s) => !s)}>
        <Text style={styles.countryText}>{selectedCountry ? `${selectedCountry} (+${numeroPais})` : 'Seleccionar país'}</Text>
      </TouchableOpacity>

      {showCountryList ? (
        <ScrollView style={styles.countryList} nestedScrollEnabled>
          {countries.map((c) => (
            <TouchableOpacity
              key={c.code}
              style={styles.countryItem}
              onPress={() => {
                setSelectedCountry(c.name);
                setNumeroPais(c.callingCode);
                setShowCountryList(false);
              }}
            >
              <Text style={styles.countryItemText}>{`${c.name} (+${c.callingCode})`}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <Text style={styles.sectionTitle}>Foto del Documento</Text>

      <View style={styles.photoRow}>
        <Button title={fotoFrente ? 'Frente OK' : 'Subir Frente'} variant={fotoFrente ? 'secondary' : 'outline'} size="sm" onPress={() => pickImage('frente')} style={styles.photoBtn} />
        <Button title={fotoDorso ? 'Dorso OK' : 'Subir Dorso'} variant={fotoDorso ? 'secondary' : 'outline'} size="sm" onPress={() => pickImage('dorso')} style={styles.photoBtn} />
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
  label: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.sm },
  countrySelect: { padding: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 5, marginBottom: spacing.md },
  countryText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  countryList: { maxHeight: 200, borderWidth: 1, borderColor: colors.border, borderRadius: 5, marginBottom: spacing.md },
  countryItem: { padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  countryItemText: { fontFamily: fonts.body, fontSize: fontSizes.base },
});
