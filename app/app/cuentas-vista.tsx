import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button, Input } from '../src/components';
import { colors, fontSizes, fonts, radius, shadows, spacing } from '../src/theme';
import api from '../src/services/api';
import { notify, confirmAction } from '../src/utils/notify';
import { getApiErrorMessage } from '../src/utils/apiError';

type CuentaVista = {
  identificador: number;
  banco: string;
  numeroCuenta: string;
  cbu: string | null;
  moneda: 'ARS' | 'USD';
  pais: number | null;
  activa: 'si' | 'no';
};

export default function CuentasVistaScreen() {
  const [cuentas, setCuentas] = useState<CuentaVista[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [banco, setBanco] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cbu, setCbu] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');

  const fetchCuentas = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/venta/cuentas');
      setCuentas(data.data || []);
    } catch {
      notify('Error', 'No se pudieron cargar las cuentas a la vista');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCuentas();
    }, [fetchCuentas]),
  );

  const resetForm = () => {
    setBanco('');
    setNumeroCuenta('');
    setCbu('');
    setMoneda('ARS');
  };

  const handleCreate = async () => {
    if (!banco.trim()) {
      notify('Error', 'Ingrese el banco');
      return;
    }
    if (!numeroCuenta.trim()) {
      notify('Error', 'Ingrese el numero de cuenta');
      return;
    }

    setSaving(true);
    try {
      await api.post('/venta/cuentas', {
        banco: banco.trim(),
        numeroCuenta: numeroCuenta.trim(),
        cbu: cbu.trim() || null,
        moneda,
      });
      notify('Listo', 'Cuenta a la vista declarada correctamente');
      resetForm();
      await fetchCuentas();
    } catch (err) {
      notify('Error', getApiErrorMessage(err, 'No se pudo declarar la cuenta'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    confirmAction(
      'Eliminar cuenta',
      'Esta cuenta dejara de estar disponible para recibir el dinero de tus ventas.',
      async () => {
        try {
          await api.delete(`/venta/cuentas/${id}`);
          await fetchCuentas();
        } catch (err) {
          notify('Error', getApiErrorMessage(err, 'No se pudo eliminar la cuenta'));
        }
      },
      'Eliminar',
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cuentas}
        keyExtractor={(item) => item.identificador.toString()}
        refreshing={loading}
        onRefresh={fetchCuentas}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Cuentas a la Vista</Text>
            <Text style={styles.subtitle}>
              Cuenta donde recibiras el dinero de tus ventas. Debe declararse antes de que tu bien entre en subasta.
            </Text>

            <View style={[styles.formCard, shadows.md]}>
              <Text style={styles.sectionTitle}>Declarar nueva cuenta</Text>

              <Input label="Banco" placeholder="Ej: Banco Nacion / Bank of America" value={banco} onChangeText={setBanco} />
              <Input label="Numero de cuenta" placeholder="Ingrese el numero de cuenta" value={numeroCuenta} onChangeText={setNumeroCuenta} />
              <Input label="CBU / IBAN (opcional)" placeholder="Para cuentas del exterior, ingrese el IBAN" value={cbu} onChangeText={setCbu} />

              <Text style={styles.fieldLabel}>Moneda</Text>
              <View style={styles.row}>
                <TouchableOpacity style={[styles.currencyChip, moneda === 'ARS' && styles.currencyChipActive]} onPress={() => setMoneda('ARS')}>
                  <Text style={[styles.currencyText, moneda === 'ARS' && styles.currencyTextActive]}>ARS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.currencyChip, moneda === 'USD' && styles.currencyChipActive]} onPress={() => setMoneda('USD')}>
                  <Text style={[styles.currencyText, moneda === 'USD' && styles.currencyTextActive]}>USD</Text>
                </TouchableOpacity>
              </View>

              <Button title="Declarar Cuenta" onPress={handleCreate} loading={saving} style={{ marginTop: spacing.sm }} />
            </View>

            <Text style={styles.sectionTitle}>Mis cuentas declaradas</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No hay cuentas a la vista declaradas</Text> : null}
        renderItem={({ item }) => (
          <View style={[styles.cuentaCard, shadows.sm]}>
            <View style={styles.cardHead}>
              <Text style={styles.cuentaTitle}>{item.banco}</Text>
              <Text style={styles.cuentaMoneda}>{item.moneda}</Text>
            </View>
            <Text style={styles.cuentaLine}>Cuenta: {item.numeroCuenta}</Text>
            {item.cbu ? <Text style={styles.cuentaLine}>CBU/IBAN: {item.cbu}</Text> : null}

            <Button
              title="Eliminar"
              variant="danger"
              size="sm"
              onPress={() => handleDelete(item.identificador)}
              style={{ marginTop: spacing.sm }}
            />
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
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 20 },
  formCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, flexWrap: 'wrap' },
  currencyChip: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.parchment },
  currencyChipActive: { backgroundColor: colors.auctionGold },
  currencyText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  currencyTextActive: { color: colors.ink },
  cuentaCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xs },
  cuentaTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  cuentaMoneda: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, textTransform: 'uppercase' },
  cuentaLine: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', fontFamily: fonts.body, color: colors.textMuted, marginTop: spacing.lg },
});
