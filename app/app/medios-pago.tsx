import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Input } from '../src/components';
import { colors, fontSizes, fonts, radius, shadows, spacing } from '../src/theme';
import api from '../src/services/api';

type TipoMedio = 'cuenta_bancaria' | 'tarjeta_credito' | 'cheque_certificado';

type MedioPago = {
  identificador: number;
  tipo: TipoMedio;
  descripcion: string;
  banco: string | null;
  numeroCuenta: string | null;
  cbu: string | null;
  moneda: 'ARS' | 'USD';
  ultimosDigitos: string | null;
  internacional: 'si' | 'no';
  montoCheque: number | null;
  montoDisponible: number | null;
  verificado: 'si' | 'no';
  activo: 'si' | 'no';
};

const TIPOS: { value: TipoMedio; label: string }[] = [
  { value: 'cuenta_bancaria', label: 'Cuenta Bancaria' },
  { value: 'tarjeta_credito', label: 'Tarjeta de Credito' },
  { value: 'cheque_certificado', label: 'Cheque Certificado' },
];

export default function MediosPagoScreen() {
  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [tipo, setTipo] = useState<TipoMedio>('cuenta_bancaria');
  const [descripcion, setDescripcion] = useState('');
  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cbu, setCbu] = useState('');
  const [ultimosDigitos, setUltimosDigitos] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [internacional, setInternacional] = useState<'si' | 'no'>('no');
  const [monto, setMonto] = useState('');
  const [editingMedioId, setEditingMedioId] = useState<number | null>(null);

  const totalBalanceARS = useMemo(
    () => medios.filter(m => m.moneda === 'ARS').reduce((acc, m) => acc + Number(m.montoDisponible || 0), 0),
    [medios],
  );

  const totalBalanceUSD = useMemo(
    () => medios.filter(m => m.moneda === 'USD').reduce((acc, m) => acc + Number(m.montoDisponible || 0), 0),
    [medios],
  );

  const fetchMedios = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/medios-pago');
      setMedios(data.data || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los medios de pago');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMedios();
    }, [fetchMedios]),
  );

  const resetForm = () => {
    setTipo('cuenta_bancaria');
    setDescripcion('');
    setBanco('');
    setNumeroCuenta('');
    setCbu('');
    setUltimosDigitos('');
    setMoneda('ARS');
    setInternacional('no');
    setMonto('');
  };

  const handleCreate = async () => {
    if (!descripcion.trim()) {
      Alert.alert('Error', 'Ingrese una descripcion');
      return;
    }

    setSaving(true);
    try {
      // Si estamos editando, es solo para agregar fondos a un medio existente
      if (editingMedioId !== null) {
        const montoNumerico = monto ? parseFloat(monto) : 0;
        if (montoNumerico <= 0) {
          Alert.alert('Error', 'El monto debe ser mayor a 0');
          return;
        }
        await api.put(`/medios-pago/${editingMedioId}/saldo`, { monto: montoNumerico });
        Alert.alert('Listo', 'Saldo agregado correctamente');
        setEditingMedioId(null);
      } else {
        // Crear nuevo medio de pago
        await api.post('/medios-pago', {
          tipo,
          descripcion,
          banco: banco || null,
          numeroCuenta: numeroCuenta || null,
          cbu: cbu || null,
          moneda,
          ultimosDigitos: ultimosDigitos || null,
          internacional,
          montoDisponible: monto ? parseFloat(monto) : 0,
        });
        Alert.alert('Listo', 'Medio de pago agregado y saldo actualizado');
      }
      resetForm();
      await fetchMedios();
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'No se pudo completar la operación');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/medios-pago/${id}`);
      await fetchMedios();
    } catch {
      Alert.alert('Error', 'No se pudo eliminar el medio de pago');
    }
  };

  const handleAgregarFondos = (medioPago: MedioPago) => {
    setEditingMedioId(medioPago.identificador);
    setDescripcion(medioPago.descripcion);
    setMonto('');
  };

  const formatMoney = (value: number, currency: 'ARS' | 'USD') =>
    `${currency === 'USD' ? 'US$' : '$'} ${value.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  return (
    <View style={styles.container}>
      <FlatList
        data={medios}
        keyExtractor={(item) => item.identificador.toString()}
        refreshing={loading}
        onRefresh={fetchMedios}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Medios de Pago</Text>
            <Text style={styles.subtitle}>Simulador de fondos para subasta</Text>

            <View style={[styles.balanceCard, shadows.sm]}>
              <Text style={styles.balanceLabel}>Balance ARS</Text>
              <Text style={styles.balanceValue}>$ {totalBalanceARS.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={[styles.balanceCard, shadows.sm]}>
              <Text style={styles.balanceLabel}>Balance USD</Text>
              <Text style={styles.balanceValue}>US$ {totalBalanceUSD.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</Text>
            </View>

            <View style={[styles.formCard, shadows.md]}>
              <Text style={styles.sectionTitle}>
                {editingMedioId !== null ? 'Agregar Fondos' : 'Registrar nuevo medio'}
              </Text>

              {editingMedioId === null ? (
                <>
                  <Text style={styles.fieldLabel}>Tipo</Text>
                  <View style={styles.row}>
                    {TIPOS.map((t) => (
                      <TouchableOpacity
                        key={t.value}
                        style={[styles.chip, tipo === t.value && styles.chipActive]}
                        onPress={() => setTipo(t.value)}
                      >
                        <Text style={[styles.chipText, tipo === t.value && styles.chipTextActive]}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Input label="Descripcion" placeholder="Ej: Tarjeta principal / Cuenta ahorro" value={descripcion} onChangeText={setDescripcion} />
                  <Input label="Banco (simulado)" placeholder="Ej: Banco Nación / Bank of America" value={banco} onChangeText={setBanco} />
                  <Input label="Numero de cuenta/tarjeta (simulado)" placeholder="Ingrese cualquier numero" value={numeroCuenta} onChangeText={setNumeroCuenta} />
                  <Input label="CBU / IBAN (simulado)" placeholder="Ingrese cualquier dato" value={cbu} onChangeText={setCbu} />

                  {tipo === 'tarjeta_credito' && (
                    <Input label="Ultimos 4 digitos" placeholder="1234" value={ultimosDigitos} onChangeText={setUltimosDigitos} keyboardType="numeric" />
                  )}

                  <Text style={styles.fieldLabel}>Moneda</Text>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.currencyChip, moneda === 'ARS' && styles.currencyChipActive]} onPress={() => setMoneda('ARS')}>
                      <Text style={[styles.currencyText, moneda === 'ARS' && styles.currencyTextActive]}>ARS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.currencyChip, moneda === 'USD' && styles.currencyChipActive]} onPress={() => setMoneda('USD')}>
                      <Text style={[styles.currencyText, moneda === 'USD' && styles.currencyTextActive]}>USD</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Internacional</Text>
                  <View style={styles.row}>
                    <TouchableOpacity style={[styles.currencyChip, internacional === 'no' && styles.currencyChipActive]} onPress={() => setInternacional('no')}>
                      <Text style={[styles.currencyText, internacional === 'no' && styles.currencyTextActive]}>No</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.currencyChip, internacional === 'si' && styles.currencyChipActive]} onPress={() => setInternacional('si')}>
                      <Text style={[styles.currencyText, internacional === 'si' && styles.currencyTextActive]}>Si</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={styles.medioLine}>Medio: {descripcion}</Text>
                  <Text style={styles.fieldLabel}>Agregar fondos</Text>
                </View>
              )}

              <Input label="Fondos a ingresar" placeholder="Ej: 150000" value={monto} onChangeText={setMonto} keyboardType="decimal-pad" />

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  title={editingMedioId !== null ? 'Agregar' : 'Agregar Medio'}
                  onPress={handleCreate}
                  loading={saving}
                  style={{ flex: 1 }}
                />
                {editingMedioId !== null && (
                  <Button
                    title="Cancelar"
                    variant="outline"
                    onPress={() => {
                      setEditingMedioId(null);
                      resetForm();
                    }}
                    style={{ flex: 1 }}
                  />
                )}
              </View>
            </View>

            <Text style={styles.sectionTitle}>Mis medios registrados</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No hay medios de pago cargados</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.medioCard, shadows.sm]}>
            <View style={styles.cardHead}>
              <Text style={styles.medioTitle}>{item.descripcion}</Text>
              <Text style={styles.medioType}>{item.tipo.replace('_', ' ')}</Text>
            </View>
            <Text style={styles.medioLine}>Banco: {item.banco || 'N/A'}</Text>
            <Text style={styles.medioLine}>Moneda: {item.moneda}</Text>
            <Text style={styles.medioLine}>Disponible: {formatMoney(Number(item.montoDisponible || 0), item.moneda || 'ARS')}</Text>
            <Text style={styles.medioLine}>Estado: {item.verificado === 'si' ? 'Verificado' : 'Pendiente'}</Text>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <Button
                title="Agregar Fondos"
                variant="primary"
                size="sm"
                onPress={() => handleAgregarFondos(item)}
                style={{ flex: 1 }}
              />
              <Button
                title="Eliminar"
                variant="danger"
                size="sm"
                onPress={() => handleDelete(item.identificador)}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  listContent: { padding: spacing.lg, paddingBottom: spacing['3xl'], gap: spacing.md },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  balanceCard: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  balanceLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  balanceValue: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.auctionGold, marginTop: spacing.xs },
  formCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.parchment },
  chipActive: { backgroundColor: colors.auctionGold },
  chipText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  chipTextActive: { color: colors.ink },
  currencyChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.parchment },
  currencyChipActive: { backgroundColor: colors.auctionGold },
  currencyText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  currencyTextActive: { color: colors.ink },
  medioCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  medioTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  medioType: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase' },
  medioLine: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: fonts.body, color: colors.textMuted, marginTop: spacing.lg },
});