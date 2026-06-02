import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { Button } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import adminApi from '../../src/services/adminApi';
import { getApiErrorMessage } from '../../src/utils/apiError';

const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'] as const;

interface Cliente {
  identificador: number;
  nombre: string;
  apellido?: string;
  documento: string;
  email?: string;
  admitido: string;
  categoria: string;
}

export default function AdminClientesScreen() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/admin/clientes', { params: { admitido: 'no' } });
      setClientes(data.data);
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudieron cargar los clientes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const admitir = async (id: number) => {
    const categoria = seleccion[id] || 'comun';
    try {
      await adminApi.patch(`/admin/clientes/${id}/admitir`, { admitido: 'si', categoria });
      Alert.alert('Listo', 'Cliente admitido');
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo admitir'));
    }
  };

  const rechazar = async (id: number) => {
    try {
      await adminApi.patch(`/admin/clientes/${id}/admitir`, { admitido: 'no' });
      Alert.alert('Listo', 'Cliente rechazado');
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo rechazar'));
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.auctionGold} />;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={clientes}
      keyExtractor={(c) => String(c.identificador)}
      ListEmptyComponent={<Text style={styles.empty}>No hay clientes pendientes de admision.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.nombre}>{item.nombre}{item.apellido ? ` ${item.apellido}` : ''}</Text>
          <Text style={styles.meta}>Doc: {item.documento}{item.email ? ` · ${item.email}` : ''}</Text>

          <Text style={styles.label}>Categoria a asignar:</Text>
          <View style={styles.catRow}>
            {CATEGORIAS.map((cat) => {
              const sel = (seleccion[item.identificador] || 'comun') === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, sel && styles.catChipSel]}
                  onPress={() => setSeleccion((s) => ({ ...s, [item.identificador]: cat }))}
                >
                  <Text style={[styles.catText, sel && styles.catTextSel]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button title="Admitir" size="sm" onPress={() => admitir(item.identificador)} style={styles.flex} />
            <Button title="Rechazar" variant="danger" size="sm" onPress={() => rechazar(item.identificador)} style={styles.flex} />
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
  card: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  nombre: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  label: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  catChip: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  catChipSel: { backgroundColor: colors.auctionGold, borderColor: colors.auctionGold },
  catText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  catTextSel: { color: colors.ink, fontFamily: fonts.bodySemibold },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
