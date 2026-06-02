import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing } from '../../src/theme';
import adminApi from '../../src/services/adminApi';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function AdminMultasScreen() {
  const [cliente, setCliente] = useState('');
  const [subasta, setSubasta] = useState('');
  const [item, setItem] = useState('');
  const [importe, setImporte] = useState('');
  const [loading, setLoading] = useState(false);

  const crear = async () => {
    const payload = {
      cliente: Number(cliente),
      subasta: Number(subasta),
      item: Number(item),
      importeOriginal: Number(importe),
    };
    if (![payload.cliente, payload.subasta, payload.item].every(Number.isInteger) || !(payload.importeOriginal > 0)) {
      Alert.alert('Datos invalidos', 'Complete cliente, subasta, item (enteros) e importe (> 0).');
      return;
    }
    setLoading(true);
    try {
      const { data } = await adminApi.post('/admin/multas', payload);
      Alert.alert('Multa aplicada', `Importe multa (10%): ${data.data.importeMulta} ${data.data.moneda}`);
      setCliente(''); setSubasta(''); setItem(''); setImporte('');
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo aplicar la multa'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.help}>Alta manual de multa por impago (10% del importe). Indique el cliente y el item de la subasta involucrada.</Text>
      <Input label="ID Cliente" placeholder="42" keyboardType="numeric" value={cliente} onChangeText={setCliente} />
      <Input label="ID Subasta" placeholder="3" keyboardType="numeric" value={subasta} onChangeText={setSubasta} />
      <Input label="ID Item" placeholder="7" keyboardType="numeric" value={item} onChangeText={setItem} />
      <Input label="Importe ofertado (base de la multa)" placeholder="15000" keyboardType="numeric" value={importe} onChangeText={setImporte} />
      <Button title="Aplicar multa" size="lg" loading={loading} onPress={crear} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.sm },
  help: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
});
