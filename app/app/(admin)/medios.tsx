import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Button } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import adminApi from '../../src/services/adminApi';
import { getApiErrorMessage } from '../../src/utils/apiError';

interface Medio {
  identificador: number;
  cliente: number;
  clienteNombre: string;
  tipo: string;
  descripcion: string;
  banco?: string;
  moneda: string;
  internacional: string;
  montoCheque?: number;
  verificado: string;
}

export default function AdminMediosScreen() {
  const [medios, setMedios] = useState<Medio[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/admin/medios-pago', { params: { verificado: 'no' } });
      setMedios(data.data);
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudieron cargar los medios'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setVerificado = async (id: number, verificado: 'si' | 'no') => {
    try {
      await adminApi.put(`/admin/medios-pago/${id}/verificar`, { verificado });
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo actualizar'));
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.auctionGold} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={medios}
      keyExtractor={(m) => String(m.identificador)}
      ListEmptyComponent={<Text style={styles.empty}>No hay medios pendientes de verificacion.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.nombre}>{item.descripcion}</Text>
          <Text style={styles.meta}>{item.tipo} · {item.moneda}{item.internacional === 'si' ? ' · internacional' : ''}</Text>
          <Text style={styles.meta}>Cliente: {item.clienteNombre}{item.banco ? ` · ${item.banco}` : ''}</Text>
          <View style={styles.actions}>
            <Button title="Verificar" size="sm" onPress={() => setVerificado(item.identificador, 'si')} style={styles.flex} />
            <Button title="Rechazar" variant="danger" size="sm" onPress={() => setVerificado(item.identificador, 'no')} style={styles.flex} />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md },
  loader: { flex: 1, backgroundColor: colors.ivory },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  nombre: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
