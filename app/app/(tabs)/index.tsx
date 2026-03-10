import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Badge, CardSkeleton } from '../../src/components';
import { CategoryName } from '../../src/components/Badge';
import { colors, fonts, fontSizes, spacing, shadows, radius } from '../../src/theme';
import api from '../../src/services/api';

interface Subasta {
  identificador: number;
  fecha: string;
  hora: string;
  estado: string;
  ubicacion: string;
  categoria: string;
  moneda: string;
  totalItems: number;
  subastadorNombre: string;
}

const FILTERS = ['todas', 'abierta', 'cerrada'] as const;

export default function SubastasScreen() {
  const [subastas, setSubastas] = useState<Subasta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState<string>('todas');

  const fetchSubastas = useCallback(async () => {
    try {
      const params: any = { page: 1, limit: 50 };
      if (filtro !== 'todas') params.estado = filtro;
      const { data } = await api.get('/subastas', { params });
      setSubastas(data.data.subastas);
    } catch {
      // silently fail if not connected
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filtro]);

  useEffect(() => { fetchSubastas(); }, [fetchSubastas]);

  const onRefresh = () => { setRefreshing(true); fetchSubastas(); };

  const formatDate = (fecha: string) => {
    const d = new Date(fecha);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const renderSubasta = ({ item }: { item: Subasta }) => (
    <TouchableOpacity
      style={[styles.subastaCard, shadows.md]}
      activeOpacity={0.8}
      onPress={() => router.push(`/subasta/${item.identificador}`)}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.subastaDate}>{formatDate(item.fecha)}</Text>
          <Text style={styles.subastaTime}>{item.hora?.slice(0, 5)}</Text>
        </View>
        <View style={styles.cardHeaderRight}>
          <Badge category={item.categoria as CategoryName} />
          <View style={[styles.estadoBadge, item.estado === 'abierta' ? styles.estadoAbierta : styles.estadoCerrada]}>
            <Text style={[styles.estadoText, item.estado === 'abierta' ? styles.estadoTextAbierta : styles.estadoTextCerrada]}>
              {item.estado?.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {item.ubicacion && (
        <Text style={styles.ubicacion} numberOfLines={1}>{item.ubicacion}</Text>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.footerText}>
          {item.totalItems} items | {item.moneda || 'ARS'}
        </Text>
        {item.subastadorNombre && (
          <Text style={styles.footerText}>{item.subastadorNombre}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Subastas</Text>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filtro === f && styles.filterActive]}
            onPress={() => setFiltro(f)}
          >
            <Text style={[styles.filterText, filtro === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.skeletons}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={subastas}
          keyExtractor={(item) => item.identificador.toString()}
          renderItem={renderSubasta}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.auctionGold} />}
          ListEmptyComponent={
            <Text style={styles.empty}>No hay subastas disponibles</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.parchment },
  filterActive: { backgroundColor: colors.auctionGold },
  filterText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  filterTextActive: { color: colors.ink },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },
  skeletons: { padding: spacing.lg, gap: spacing.md },
  subastaCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardHeaderLeft: {},
  cardHeaderRight: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  subastaDate: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary },
  subastaTime: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  estadoBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  estadoAbierta: { backgroundColor: 'rgba(45,147,108,0.12)' },
  estadoCerrada: { backgroundColor: 'rgba(214,69,69,0.12)' },
  estadoText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs },
  estadoTextAbierta: { color: colors.bidGreen },
  estadoTextCerrada: { color: colors.alertEmber },
  ubicacion: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.sm },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  footerText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing['2xl'] },
});
