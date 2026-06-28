import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Button, Input } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius } from '../../src/theme';
import adminApi from '../../src/services/adminApi';
import { getApiErrorMessage } from '../../src/utils/apiError';
import { notify } from '../../src/utils/notify';

interface ProductoDisponible {
  identificador: number;
  descripcionCatalogo: string;
  duenioNombre?: string;
  duenioApellido?: string;
  valorBase?: number;
  comisionPropuesta?: number;
  moneda?: string;
}

const CATEGORIAS = ['comun', 'especial', 'plata', 'oro', 'platino'] as const;

export default function AdminSubastasScreen() {
  const [productos, setProductos] = useState<ProductoDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [categoria, setCategoria] = useState<typeof CATEGORIAS[number]>('comun');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [fechaFin, setFechaFin] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.get('/admin/productos-disponibles');
      setProductos(data.data);
    } catch (err) {
      notify('Error', getApiErrorMessage(err, 'No se pudieron cargar los productos disponibles'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: number) => {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const crear = async () => {
    if (seleccion.size === 0) {
      notify('Falta seleccion', 'Elija al menos un producto para la subasta.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) {
      notify('Fecha invalida', 'Use el formato AAAA-MM-DD para la fecha de fin.');
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(horaFin)) {
      notify('Hora invalida', 'Use el formato HH:MM para la hora de fin.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await adminApi.post('/admin/subastas', {
        fechaFin,
        horaFin,
        categoria,
        moneda,
        ubicacion: ubicacion.trim() || undefined,
        productos: Array.from(seleccion),
      });
      notify('Subasta creada', `Subasta #${data.data.identificador} con ${data.data.items} item(s). Cierra el ${fechaFin} ${horaFin}.`);
      setSeleccion(new Set());
      setFechaFin(''); setHoraFin(''); setUbicacion('');
      load();
    } catch (err) {
      notify('Error', getApiErrorMessage(err, 'No se pudo crear la subasta'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <ActivityIndicator style={styles.loader} color={colors.auctionGold} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.help}>
        Arme una subasta eligiendo productos disponibles (ventas ya acordadas con el vendedor).
        La subasta abre de inmediato y cierra en la fecha/hora de fin que indique.
      </Text>

      <Text style={styles.sectionTitle}>Productos disponibles ({productos.length})</Text>
      {productos.length === 0 ? (
        <Text style={styles.empty}>No hay productos disponibles. Acepte solicitudes de venta primero.</Text>
      ) : (
        productos.map((p) => {
          const checked = seleccion.has(p.identificador);
          return (
            <Pressable key={p.identificador} onPress={() => toggle(p.identificador)} style={[styles.prod, checked && styles.prodChecked]}>
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.prodInfo}>
                <Text style={styles.prodTitle}>#{p.identificador} · {p.descripcionCatalogo}</Text>
                <Text style={styles.prodMeta}>
                  Dueño: {p.duenioNombre || '-'} {p.duenioApellido || ''} · Base: {p.valorBase ?? '-'} {p.moneda || 'ARS'}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      <Text style={styles.sectionTitle}>Categoria</Text>
      <View style={styles.chipRow}>
        {CATEGORIAS.map((c) => (
          <Button key={c} title={c} size="sm" variant={categoria === c ? 'primary' : 'outline'} onPress={() => setCategoria(c)} style={styles.chip} />
        ))}
      </View>

      <Text style={styles.sectionTitle}>Moneda</Text>
      <View style={styles.chipRow}>
        <Button title="ARS" size="sm" variant={moneda === 'ARS' ? 'primary' : 'outline'} onPress={() => setMoneda('ARS')} style={styles.chip} />
        <Button title="USD" size="sm" variant={moneda === 'USD' ? 'primary' : 'outline'} onPress={() => setMoneda('USD')} style={styles.chip} />
      </View>

      <Input label="Fecha de fin (AAAA-MM-DD)" placeholder="2026-06-28" value={fechaFin} onChangeText={setFechaFin} autoCapitalize="none" />
      <Input label="Hora de fin (HH:MM)" placeholder="15:00" value={horaFin} onChangeText={setHoraFin} autoCapitalize="none" />
      <Input label="Ubicacion (opcional)" placeholder="Centro de Remates" value={ubicacion} onChangeText={setUbicacion} />

      <Button title={`Crear subasta (${seleccion.size} item(s))`} size="lg" loading={submitting} onPress={crear} style={styles.submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing['2xl'] },
  loader: { flex: 1, backgroundColor: colors.ivory },
  help: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary, marginTop: spacing.md },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  prod: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  prodChecked: { borderColor: colors.auctionGold },
  checkbox: { width: 24, height: 24, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.auctionGold, borderColor: colors.auctionGold },
  checkMark: { color: colors.ink, fontSize: fontSizes.sm, fontFamily: fonts.bodySemibold },
  prodInfo: { flex: 1 },
  prodTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  prodMeta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { marginRight: spacing.xs },
  submit: { marginTop: spacing.lg },
});
