import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing, shadows, radius } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';

interface Estadisticas {
  subastasAsistidas: number;
  subastasGanadas: number;
  totalPujas: number;
  totalPujado: number;
  totalPagado: number;
  totalComisiones: number;
  totalPujadoARS: number;
  totalPujadoUSD: number;
  totalPagadoARS: number;
  totalPagadoUSD: number;
  totalComisionesARS: number;
  totalComisionesUSD: number;
  porCategoria: { categoria: string; cantidad: number }[];
  multas: { total: number; impagas: number };
}

export default function EstadisticasScreen() {
  const { isAuthenticated } = useAuthStore();
  const [data, setData] = useState<Estadisticas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    fetchEstadisticas();
  }, []);

  const fetchEstadisticas = async () => {
    try {
      const res = await api.get('/usuarios/estadisticas');
      setData(res.data.data);
    } catch (e) {
      console.error('Error fetching estadisticas:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.auctionGold} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se pudieron cargar las estadisticas</Text>
      </View>
    );
  }

  const formatCurrency = (amount: number, moneda: 'ARS' | 'USD') =>
    `${moneda === 'USD' ? 'US$' : '$'} ${Number(amount || 0).toFixed(2)}`;

  const totalPujadoARS = Number(data.totalPujadoARS ?? data.totalPujado ?? 0);
  const totalPujadoUSD = Number(data.totalPujadoUSD ?? 0);
  const totalPagadoARS = Number(data.totalPagadoARS ?? data.totalPagado ?? 0);
  const totalPagadoUSD = Number(data.totalPagadoUSD ?? 0);
  const totalComisionesARS = Number(data.totalComisionesARS ?? data.totalComisiones ?? 0);
  const totalComisionesUSD = Number(data.totalComisionesUSD ?? 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Mis Estadisticas</Text>

      <View style={styles.grid}>
        <StatCard icon="hammer" label="Subastas Asistidas" value={data.subastasAsistidas} />
        <StatCard icon="trophy" label="Subastas Ganadas" value={data.subastasGanadas} color={colors.auctionGold} />
        <StatCard icon="trending-up" label="Total Pujas" value={data.totalPujas} />
        <StatCard icon="cash" label="Total Pujado en Pesos" value={formatCurrency(totalPujadoARS, 'ARS')} />
        <StatCard icon="cash" label="Total Pujado en Dolares" value={formatCurrency(totalPujadoUSD, 'USD')} />
        <StatCard icon="card" label="Total Pagado en Pesos" value={formatCurrency(totalPagadoARS, 'ARS')} />
        <StatCard icon="card" label="Total Pagado en Dolares" value={formatCurrency(totalPagadoUSD, 'USD')} />
        <StatCard icon="receipt" label="Comisiones en Pesos" value={formatCurrency(totalComisionesARS, 'ARS')} />
        <StatCard icon="receipt" label="Comisiones en Dolares" value={formatCurrency(totalComisionesUSD, 'USD')} />
      </View>

      {data.porCategoria.length > 0 && (
        <View style={[styles.section, shadows.md]}>
          <Text style={styles.sectionTitle}>Por Categoria</Text>
          {data.porCategoria.map((c) => (
            <View key={c.categoria} style={styles.catRow}>
              <Text style={styles.catLabel}>{c.categoria}</Text>
              <Text style={styles.catValue}>{c.cantidad}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.section, shadows.md]}>
        <Text style={styles.sectionTitle}>Multas</Text>
        <View style={styles.catRow}>
          <Text style={styles.catLabel}>Total</Text>
          <Text style={styles.catValue}>{data.multas.total}</Text>
        </View>
        <View style={[styles.catRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.catLabel}>Impagas</Text>
          <Text style={[styles.catValue, data.multas.impagas > 0 && { color: colors.alertEmber }]}>
            {data.multas.impagas}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <View style={[styles.statCard, shadows.sm]}>
      <Ionicons name={icon as any} size={24} color={color || colors.auctionGold} />
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted },
  scroll: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    width: '48%' as any,
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.textPrimary, marginTop: spacing.xs },
  statLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  section: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.md },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  catLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  catValue: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
});
