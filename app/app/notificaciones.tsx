import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal } from 'react-native';
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

interface MedioPago {
  identificador: number;
  tipo: string;
  descripcion: string;
  banco: string | null;
  numeroCuenta: string | null;
  cbu: string | null;
  moneda: 'ARS' | 'USD';
  ultimosDigitos: string | null;
  internacional: string;
  montoCheque: number | null;
  montoDisponible: number;
  verificado: string;
  activo: string;
}

export default function NotificacionesScreen() {
  const { isAuthenticated } = useAuthStore();
  const [items, setItems] = useState<Notificacion[]>([]);
  const [multas, setMultas] = useState<Multa[]>([]);
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [selectingPaymentMethod, setSelectingPaymentMethod] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
      return;
    }
    fetchNotificaciones();
    fetchMultas();
    fetchMediosPago();
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

  const fetchMultas = async () => {
    try {
      const res = await api.get('/multas');
      setMultas(res.data.data || []);
    } catch (e) {
      console.error('Error fetching multas:', e);
    }
  };

  const fetchMediosPago = async () => {
    try {
      const res = await api.get('/medios-pago');
      setMediosPago(res.data.data || []);
    } catch (e) {
      console.error('Error fetching medios de pago:', e);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([fetchNotificaciones(), fetchMultas(), fetchMediosPago()]);
  }, []);

  const marcarLeida = async (id: number) => {
    try {
      await api.put(`/notificaciones/${id}/leer`);
      setItems((prev) => prev.map((n) => (n.identificador === id ? { ...n, leida: 'si' } : n)));
    } catch (e) {
      console.error('Error marking read:', e);
    }
  };

  const pagarMulta = async (multaId: number, medioPagoId: number) => {
    try {
      setPayingId(multaId);
      await api.put(`/multas/${multaId}/pagar`, { medioPagoId });
      Alert.alert('Multa pagada', 'Ya puede volver a pujar en otra subasta.');
      setSelectingPaymentMethod(null);
      await Promise.all([fetchNotificaciones(), fetchMultas(), fetchMediosPago()]);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'No se pudo pagar la multa');
    } finally {
      setPayingId(null);
    }
  };

  const multasImpagas = multas.filter((multa) => multa.pagada === 'no');

  const getMediosPagoConSaldoSuficiente = (multaId: number): MedioPago[] => {
    const multa = multas.find((m) => m.identificador === multaId);
    if (!multa) return [];
    const importeMulta = Number(multa.importeMulta || 0);
    const monedaMulta = multa.moneda || 'ARS';
    return mediosPago.filter(
      (medio) =>
        Number(medio.montoDisponible || 0) >= importeMulta &&
        (medio.moneda === monedaMulta || medio.internacional === 'si')
    );
  };

  const getTipoMedioPago = (tipo: string) => {
    switch (tipo) {
      case 'cuenta_bancaria': return 'Cuenta Bancaria';
      case 'tarjeta_credito': return 'Tarjeta de Crédito';
      case 'cheque_certificado': return 'Cheque Certificado';
      default: return tipo;
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
      {multasImpagas.length > 0 && (
        <View style={styles.penaltyBanner}>
          <Text style={styles.penaltyTitle}>Tenes multas impagas</Text>
          <Text style={styles.penaltyText}>
            Pagalas para volver a participar en otras subastas.
          </Text>
          <TouchableOpacity
            style={styles.penaltyButton}
            onPress={() => setSelectingPaymentMethod(multasImpagas[0].identificador)}
            disabled={payingId === multasImpagas[0].identificador}
          >
            <Text style={styles.penaltyButtonText}>
              {payingId === multasImpagas[0].identificador
                ? 'Procesando...'
                : `Pagar multa ${multasImpagas[0].moneda === 'USD' ? 'US$' : '$'}${Number(multasImpagas[0].importeMulta || 0).toFixed(2)}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
                color={item.tipo === 'ganador' ? colors.auctionGold : item.tipo === 'multa' ? colors.alertEmber : colors.textSecondary}
              />
              <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
              {item.leida === 'no' && <View style={styles.dot} />}
            </View>
            <Text style={styles.cardMsg}>{item.mensaje}</Text>
            <Text style={styles.cardDate}>{new Date(item.fecha).toLocaleDateString('es-AR')}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Modal para seleccionar método de pago */}
      {selectingPaymentMethod !== null && (
        <Modal
          transparent
          animationType="fade"
          visible={true}
          onRequestClose={() => setSelectingPaymentMethod(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, shadows.lg]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Seleccionar método de pago</Text>
                <TouchableOpacity onPress={() => setSelectingPaymentMethod(null)}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>
                Multa: {(() => {
                  const m = multas.find((mm) => mm.identificador === selectingPaymentMethod);
                  const moneda = m?.moneda === 'USD' ? 'US$' : '$';
                  return `${moneda}${Number(m?.importeMulta || 0).toFixed(2)}`;
                })()}
              </Text>

              {getMediosPagoConSaldoSuficiente(selectingPaymentMethod).length === 0 ? (
                <View style={styles.noMethodsContainer}>
                  <Ionicons name="alert-circle-outline" size={48} color={colors.alertEmber} />
                  <Text style={styles.noMethodsText}>No tienes medios de pago con saldo suficiente</Text>
                </View>
              ) : (
                <FlatList
                  data={getMediosPagoConSaldoSuficiente(selectingPaymentMethod)}
                  keyExtractor={(item) => String(item.identificador)}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.methodItem, shadows.sm]}
                      onPress={() => pagarMulta(selectingPaymentMethod, item.identificador)}
                      disabled={payingId !== null}
                    >
                      <View style={styles.methodInfo}>
                        <Text style={styles.methodType}>{getTipoMedioPago(item.tipo)}</Text>
                        <Text style={styles.methodDesc}>{item.descripcion}</Text>
                        <Text style={styles.methodExtra}>
                          {item.moneda === 'USD' ? 'US$' : '$'} {item.internacional === 'si' ? '• Internacional' : '• Local'}
                        </Text>
                        {item.ultimosDigitos && (
                          <Text style={styles.methodExtra}>•••• {item.ultimosDigitos}</Text>
                        )}
                      </View>
                      <View style={styles.methodBalance}>
                        <Text style={styles.balanceLabel}>
                          {item.moneda === 'USD' ? 'US$' : '$'} {Number(item.montoDisponible || 0).toFixed(2)}
                        </Text>
                        {payingId === selectingPaymentMethod ? (
                          <ActivityIndicator size="small" color={colors.auctionGold} />
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  )}
                />
              )}

              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setSelectingPaymentMethod(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
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
  penaltyBanner: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  penaltyTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.ivory },
  penaltyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.ivory, marginTop: spacing.xs, marginBottom: spacing.sm },
  penaltyButton: {
    backgroundColor: colors.alertEmber,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  penaltyButtonText: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.ivory },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.ivory,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontFamily: fonts.headingSemibold,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
  },
  modalLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  
  // Payment methods list
  noMethodsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  noMethodsText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  methodItem: {
    backgroundColor: colors.ivory,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
  },
  methodType: {
    fontFamily: fonts.headingSemibold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  methodDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  methodExtra: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
  },
  methodBalance: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  balanceLabel: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSizes.base,
    color: colors.auctionGold,
    marginBottom: spacing.xs,
  },
  
  // Modal buttons
  modalCancelButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: fonts.bodySemibold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },
});
