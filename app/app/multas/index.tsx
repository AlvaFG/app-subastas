import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, Stack } from 'expo-router';
import { Button } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../src/theme';
import api from '../../src/services/api';
import { getApiErrorMessage } from '../../src/utils/apiError';
import { notify } from '../../src/utils/notify';

interface Multa {
  identificador: number;
  importeOriginal: number;
  importeMulta: number;
  pagada: string;
  fechaMulta: string;
  fechaLimite: string;
  derivadaJusticia: string;
  moneda: 'ARS' | 'USD';
}

const formatMoney = (value: number, currency: string) => {
  const symbol = currency === 'USD' ? 'US$' : '$';
  return `${symbol} ${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function MultasIndexScreen() {
  const [multas, setMultas] = useState<Multa[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/multas');
      setMultas(data.data);
    } catch (err) {
      notify('Error', getApiErrorMessage(err, 'No se pudieron cargar las multas'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const estadoTexto = (m: Multa) => {
    if (m.pagada === 'si') return 'Pagada';
    if (m.derivadaJusticia === 'si') return 'Derivada a justicia';
    return 'Impaga';
  };
  const estadoColor = (m: Multa) => {
    if (m.pagada === 'si') return colors.bidGreen;
    if (m.derivadaJusticia === 'si') return colors.alertEmber;
    return colors.auctionGold;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Mis Multas' }} />
      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.auctionGold} />
      ) : (
        <FlatList
          style={styles.container}
          contentContainerStyle={styles.content}
          data={multas}
          keyExtractor={(m) => String(m.identificador)}
          ListEmptyComponent={<Text style={styles.empty}>No tenes multas.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.card, shadows.sm]}>
              <View style={styles.row}>
                <Text style={styles.monto}>{formatMoney(item.importeMulta, item.moneda)}</Text>
                <View style={[styles.dot, { backgroundColor: estadoColor(item) }]} />
              </View>
              <Text style={styles.meta}>Oferta original: {formatMoney(item.importeOriginal, item.moneda)}</Text>
              <Text style={styles.meta}>Estado: {estadoTexto(item)}</Text>
              <Text style={styles.meta}>Vence: {new Date(item.fechaLimite).toLocaleString('es-AR')}</Text>
              {item.pagada === 'no' && item.derivadaJusticia === 'no' ? (
                <Button title="Pagar multa" size="sm" onPress={() => router.push(`/multas/${item.identificador}/pagar`)} style={styles.btn} />
              ) : null}
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.md },
  loader: { flex: 1, backgroundColor: colors.ivory },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xl },
  card: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monto: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.alertEmber },
  dot: { width: 10, height: 10, borderRadius: 5 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  btn: { marginTop: spacing.sm },
});
