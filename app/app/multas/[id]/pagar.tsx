import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../src/components';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../../src/theme';
import api from '../../../src/services/api';

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
  moneda: 'ARS' | 'USD';
  ultimosDigitos: string | null;
  internacional: string;
  montoDisponible: number;
  verificado: string;
  activo: string;
}

const formatMoney = (value: number, currency: 'ARS' | 'USD') => {
  const symbol = currency === 'USD' ? 'US$' : '$';
  return `${symbol} ${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const getTipoMedioPago = (tipo: string) => {
  switch (tipo) {
    case 'cuenta_bancaria': return 'Cuenta Bancaria';
    case 'tarjeta_credito': return 'Tarjeta de Crédito';
    case 'cheque_certificado': return 'Cheque Certificado';
    default: return tipo;
  }
};

export default function PagarMultaScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const multaId = useMemo(() => Number(id), [id]);

  const [multa, setMulta] = useState<Multa | null>(null);
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const loadData = useCallback(async () => {
    if (!Number.isFinite(multaId)) {
      Alert.alert('Error', 'Multa invalida');
      router.back();
      return;
    }

    setLoading(true);
    try {
      const [multaRes, mediosRes] = await Promise.all([
        api.get('/multas'),
        api.get('/medios-pago'),
      ]);

      const multaEncontrada = (multaRes.data.data || []).find((item: Multa) => item.identificador === multaId) || null;
      if (!multaEncontrada) {
        Alert.alert('Error', 'No se encontró la multa');
        router.back();
        return;
      }

      setMulta(multaEncontrada);
      const monedaMulta = multaEncontrada.moneda || 'ARS';
      const totalAdeudado = Number(multaEncontrada.importeOriginal || 0) + Number(multaEncontrada.importeMulta || 0);
      setMediosPago(
        (mediosRes.data.data || []).filter((medio: MedioPago) =>
          medio.verificado === 'si' &&
          medio.activo === 'si' &&
          medio.moneda === monedaMulta &&
          Number(medio.montoDisponible || 0) >= totalAdeudado,
        ),
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los datos del pago');
    } finally {
      setLoading(false);
    }
  }, [multaId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalAdeudado = useMemo(() => {
    if (!multa) return 0;
    return Number(multa.importeOriginal || 0) + Number(multa.importeMulta || 0);
  }, [multa]);

  const pagarConMedio = async (medioPagoId: number) => {
    if (!multa) return;
    setPaying(true);
    try {
      await api.put(`/multas/${multa.identificador}/pagar`, { medioPagoId });
      Alert.alert('Multa pagada', 'Ya puede volver a pujar en otra subasta.');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.error || 'No se pudo pagar la multa');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.auctionGold} />
      </View>
    );
  }

  if (!multa) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No se encontró la multa</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pagar multa</Text>
      <Text style={styles.subtitle}>Elegí un medio de pago compatible con la moneda de la multa.</Text>

      <View style={[styles.summaryCard, shadows.sm]}>
        <Text style={styles.summaryLabel}>Multa</Text>
        <Text style={styles.summaryValue}>{formatMoney(totalAdeudado, multa.moneda)}</Text>
        <Text style={styles.summaryDetail}>Oferta original: {formatMoney(Number(multa.importeOriginal || 0), multa.moneda)}</Text>
        <Text style={styles.summaryDetail}>Penalidad: {formatMoney(Number(multa.importeMulta || 0), multa.moneda)}</Text>
        <Text style={styles.summaryDetail}>Moneda: {multa.moneda}</Text>
      </View>

      {mediosPago.length === 0 ? (
        <View style={[styles.emptyCard, shadows.sm]}>
          <Ionicons name="wallet-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No hay medios de pago disponibles</Text>
          <Text style={styles.emptyText}>Necesitás un medio verificado, activo y con saldo suficiente en la misma moneda.</Text>
          <Button
            title="Ir a medios de pago"
            onPress={() => router.push('/medios-pago')}
            style={{ marginTop: spacing.md }}
          />
        </View>
      ) : (
        <View>
          <Text style={styles.sectionTitle}>Seleccionar medio</Text>
          <FlatList
            data={mediosPago}
            keyExtractor={(item) => String(item.identificador)}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.methodItem, shadows.sm]}
                onPress={() => pagarConMedio(item.identificador)}
                disabled={paying}
              >
                <View style={styles.methodInfo}>
                  <Text style={styles.methodType}>{getTipoMedioPago(item.tipo)}</Text>
                  <Text style={styles.methodDesc}>{item.descripcion}</Text>
                  <Text style={styles.methodExtra}>
                    {item.moneda === 'USD' ? 'US$' : '$'} {Number(item.montoDisponible || 0).toFixed(2)} disponible
                  </Text>
                  {item.ultimosDigitos ? <Text style={styles.methodExtra}>•••• {item.ultimosDigitos}</Text> : null}
                </View>
                <View style={styles.methodAction}>
                  {paying ? <ActivityIndicator size="small" color={colors.auctionGold} /> : <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      <View style={styles.footerHelp}>
        <Text style={styles.footerHelpText}>Si no ves tu medio de pago, revisá que esté verificado, activo y en la misma moneda.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory, padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.lg },
  summaryCard: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  summaryLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  summaryValue: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.auctionGold, marginBottom: spacing.sm },
  summaryDetail: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  methodItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  methodInfo: { flex: 1, paddingRight: spacing.md },
  methodType: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  methodDesc: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  methodExtra: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  methodAction: { width: 28, alignItems: 'flex-end' },
  emptyCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs, textAlign: 'center' },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm },
  footerHelp: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.parchment, borderRadius: radius.md },
  footerHelpText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, textAlign: 'center' },
});
