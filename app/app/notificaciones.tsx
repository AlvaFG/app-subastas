import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSizes, spacing, shadows, radius } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import api from '../src/services/api';

interface Notificacion {
  identificador: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: string;
  fecha: string;
}

export default function NotificacionesScreen() {
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    fetchNotificaciones();
  }, []);

  const fetchNotificaciones = async () => {
    try {
      const res = await api.get('/notificaciones');
      setItems(res.data.data);
    } catch (e) {
      console.error('Error fetching notificaciones:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotificaciones();
  }, []);

  const marcarLeida = async (id: number) => {
    try {
      await api.put(`/notificaciones/${id}/leer`);
      setItems((prev) => prev.map((n) => (n.identificador === id ? { ...n, leida: 'si' } : n)));
    } catch (e) {
      console.error('Error marking read:', e);
    }
  };

  const iconForType = (tipo: string) => {
    switch (tipo) {
      case 'ganador': return 'trophy';
      case 'multa': return 'warning';
      default: return 'notifications';
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.auctionGold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.identificador)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.auctionGold} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Sin notificaciones</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, shadows.sm, item.leida === 'no' && styles.cardUnread]}
            onPress={() => item.leida === 'no' && marcarLeida(item.identificador)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <Ionicons
                name={iconForType(item.tipo) as any}
                size={20}
                color={item.tipo === 'ganador' ? colors.auctionGold : item.tipo === 'multa' ? colors.error : colors.textSecondary}
              />
              <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
              {item.leida === 'no' && <View style={styles.dot} />}
            </View>
            <Text style={styles.cardMsg}>{item.mensaje}</Text>
            <Text style={styles.cardDate}>{new Date(item.fecha).toLocaleDateString('es-AR')}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory },
  container: { flex: 1, backgroundColor: colors.ivory, padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.lg },
  empty: { alignItems: 'center', marginTop: spacing['3xl'] },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.md },
  card: {
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.auctionGold },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  cardTitle: { flex: 1, fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.auctionGold },
  cardMsg: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  cardDate: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textAlign: 'right' },
});
