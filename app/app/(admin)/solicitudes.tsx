import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import adminApi from '../../src/services/adminApi';
import { getApiErrorMessage } from '../../src/utils/apiError';

interface Solicitud {
  identificador: number;
  cliente: number;
  clienteNombre: string;
  descripcion: string;
  estado: string;
  valorBase?: number;
  comisionPropuesta?: number;
  motivoRechazo?: string;
  aceptadoPorUsuario?: string;
  moneda?: string;
  origenLicito?: string;
}

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  en_inspeccion: 'En inspeccion',
  aceptada: 'Aceptada (esperando al usuario)',
  rechazada: 'Rechazada',
  devuelta: 'Devuelta',
};

export default function AdminSolicitudesScreen() {
  const [items, setItems] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [valorBase, setValorBase] = useState<Record<number, string>>({});
  const [comision, setComision] = useState<Record<number, string>>({});
  const [motivo, setMotivo] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/admin/venta/solicitudes');
      setItems(data.data);
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudieron cargar las solicitudes'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const inspeccionar = async (id: number) => {
    try {
      await adminApi.put(`/admin/venta/solicitudes/${id}/inspeccionar`);
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo inspeccionar'));
    }
  };

  const aceptar = async (id: number) => {
    const base = Number(valorBase[id]);
    if (!Number.isFinite(base) || base <= 0) {
      Alert.alert('Falta dato', 'Ingrese un precio base valido');
      return;
    }
    const com = comision[id] ? Number(comision[id]) : undefined;
    try {
      await adminApi.put(`/admin/venta/solicitudes/${id}/respuesta`, { acepta: 'si', valorBase: base, comision: com });
      Alert.alert('Listo', 'Solicitud aceptada con condiciones');
      load();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'No se pudo aceptar'));
    }
  };

  const rechazar = async (id: number) => {
    try {
      await adminApi.put(`/admin/venta/solicitudes/${id}/respuesta`, { acepta: 'no', motivoRechazo: motivo[id] || '' });
      Alert.alert('Listo', 'Solicitud rechazada');
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
      data={items}
      keyExtractor={(s) => String(s.identificador)}
      ListEmptyComponent={<Text style={styles.empty}>No hay solicitudes.</Text>}
      renderItem={({ item }) => {
        const accionable = item.estado === 'pendiente' || item.estado === 'en_inspeccion';
        return (
          <View style={styles.card}>
            <Text style={styles.nombre}>{item.descripcion}</Text>
            <Text style={styles.meta}>Cliente: {item.clienteNombre} · {item.moneda || 'ARS'}</Text>
            <Text style={styles.meta}>Origen licito declarado: {item.origenLicito === 'si' ? 'Si' : 'No'}</Text>
            <Text style={styles.estado}>{ESTADO_LABEL[item.estado] || item.estado}</Text>

            {item.estado === 'pendiente' ? (
              <Button title="Marcar en inspeccion" variant="outline" size="sm" onPress={() => inspeccionar(item.identificador)} />
            ) : null}

            {accionable ? (
              <View style={styles.form}>
                <Input label="Precio base" placeholder="10000" keyboardType="numeric"
                  value={valorBase[item.identificador] || ''}
                  onChangeText={(t) => setValorBase((s) => ({ ...s, [item.identificador]: t }))} />
                <Input label="Comision (opcional, 10% por defecto)" placeholder="1000" keyboardType="numeric"
                  value={comision[item.identificador] || ''}
                  onChangeText={(t) => setComision((s) => ({ ...s, [item.identificador]: t }))} />
                <Button title="Aceptar y definir condiciones" size="sm" onPress={() => aceptar(item.identificador)} />
                <Input label="Motivo de rechazo" placeholder="Motivo..."
                  value={motivo[item.identificador] || ''}
                  onChangeText={(t) => setMotivo((s) => ({ ...s, [item.identificador]: t }))} />
                <Button title="Rechazar" variant="danger" size="sm" onPress={() => rechazar(item.identificador)} />
              </View>
            ) : (
              <View>
                {item.valorBase ? <Text style={styles.meta}>Precio base: {item.valorBase} · Comision: {item.comisionPropuesta ?? '-'}</Text> : null}
                {item.motivoRechazo ? <Text style={styles.meta}>Motivo: {item.motivoRechazo}</Text> : null}
                {item.aceptadoPorUsuario ? <Text style={styles.meta}>Usuario {item.aceptadoPorUsuario === 'si' ? 'acepto' : 'rechazo'} las condiciones</Text> : null}
              </View>
            )}
          </View>
        );
      }}
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
  estado: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold, marginBottom: spacing.xs },
  form: { gap: spacing.xs, marginTop: spacing.sm },
});
