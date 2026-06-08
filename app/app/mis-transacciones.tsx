import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, Stack } from 'expo-router';
import { colors, fontSizes, fonts, radius, shadows, spacing } from '../src/theme';
import api from '../src/services/api';
import { notify } from '../src/utils/notify';

type Compra = {
  identificador: number;
  importe: number;
  comision: number;
  costoEnvio: number | null;
  totalPagado: number;
  seguroComprador: string | null;
  modoEntrega: string | null;
  subasta: number;
  subastaFecha: string | null;
  moneda: 'ARS' | 'USD';
  productoId: number;
  descripcionCompleta: string;
  descripcionCatalogo: string | null;
  vendedorNombre: string | null;
};

type Venta = {
  identificador: number;
  importe: number;
  comision: number;
  totalRecibido: number;
  modoEntrega: string | null;
  subasta: number;
  subastaFecha: string | null;
  moneda: 'ARS' | 'USD';
  productoId: number;
  descripcionCompleta: string;
  descripcionCatalogo: string | null;
  compradorNombre: string | null;
};

const formatMoney = (value: number, currency: 'ARS' | 'USD') =>
  `${currency === 'USD' ? 'US$' : '$'} ${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

const formatFecha = (raw: string | null) =>
  raw ? new Date(raw).toLocaleDateString('es-AR') : '';

export default function MisTransaccionesScreen() {
  const [tab, setTab] = useState<'compras' | 'ventas'>('compras');
  const [compras, setCompras] = useState<Compra[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [comprasRes, ventasRes] = await Promise.all([
        api.get('/usuarios/mis-compras'),
        api.get('/usuarios/mis-ventas'),
      ]);
      setCompras(comprasRes.data.data || []);
      setVentas(ventasRes.data.data || []);
    } catch {
      notify('Error', 'No se pudieron cargar tus transacciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const tituloProducto = (item: Compra | Venta) =>
    item.descripcionCatalogo && item.descripcionCatalogo !== 'No Posee'
      ? item.descripcionCatalogo
      : item.descripcionCompleta;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: 'Mis Compras y Ventas' }} />

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'compras' && styles.tabActive]} onPress={() => setTab('compras')}>
          <Text style={[styles.tabText, tab === 'compras' && styles.tabTextActive]}>Compras ({compras.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'ventas' && styles.tabActive]} onPress={() => setTab('ventas')}>
          <Text style={[styles.tabText, tab === 'ventas' && styles.tabTextActive]}>Ventas ({ventas.length})</Text>
        </TouchableOpacity>
      </View>

      {tab === 'compras' ? (
        <FlatList
          data={compras}
          keyExtractor={(item) => `compra-${item.identificador}`}
          refreshing={loading}
          onRefresh={fetchData}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>Todavia no compraste ningun bien</Text> : null}
          renderItem={({ item }) => (
            <View style={[styles.card, shadows.sm]}>
              <Text style={styles.cardTitle} numberOfLines={2}>{tituloProducto(item)}</Text>
              <Text style={styles.cardMeta}>Subasta #{item.subasta} · {formatFecha(item.subastaFecha)}</Text>
              {item.vendedorNombre ? <Text style={styles.cardLine}>Vendedor: {item.vendedorNombre}</Text> : null}
              <View style={styles.divider} />
              <Row label="Precio" value={formatMoney(item.importe, item.moneda)} />
              {item.costoEnvio != null ? <Row label="Envio" value={formatMoney(item.costoEnvio, item.moneda)} /> : null}
              <Row label="Total pagado" value={formatMoney(item.totalPagado, item.moneda)} strong />
              {item.modoEntrega ? <Text style={styles.cardTag}>{item.modoEntrega === 'envio' ? 'Con envio' : 'Retiro en sede'}</Text> : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={ventas}
          keyExtractor={(item) => `venta-${item.identificador}`}
          refreshing={loading}
          onRefresh={fetchData}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={!loading ? <Text style={styles.empty}>Todavia no vendiste ningun bien</Text> : null}
          renderItem={({ item }) => (
            <View style={[styles.card, shadows.sm]}>
              <Text style={styles.cardTitle} numberOfLines={2}>{tituloProducto(item)}</Text>
              <Text style={styles.cardMeta}>Subasta #{item.subasta} · {formatFecha(item.subastaFecha)}</Text>
              {item.compradorNombre ? <Text style={styles.cardLine}>Comprador: {item.compradorNombre}</Text> : null}
              <View style={styles.divider} />
              <Row label="Precio de venta" value={formatMoney(item.importe, item.moneda)} />
              <Row label="Comision" value={`- ${formatMoney(item.comision, item.moneda)}`} />
              <Row label="Recibis" value={formatMoney(item.totalRecibido, item.moneda)} strong />
            </View>
          )}
        />
      )}
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && styles.rowStrong]}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowStrong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.parchment, alignItems: 'center' },
  tabActive: { backgroundColor: colors.auctionGold },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.ink },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  card: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md },
  cardTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  cardMeta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  cardLine: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  rowLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  rowValue: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textPrimary },
  rowStrong: { fontFamily: fonts.bodySemibold, color: colors.auctionGold },
  cardTag: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.sm, textTransform: 'uppercase' },
  empty: { textAlign: 'center', fontFamily: fonts.body, color: colors.textMuted, marginTop: spacing['2xl'] },
});
