import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert, FlatList, TouchableOpacity, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Badge } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../src/theme';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { router } from 'expo-router';

interface Solicitud {
  identificador: number;
  descripcion: string;
  estado: string;
  fechaSolicitud: string;
  valorBase: number | null;
  comisionPropuesta: number | null;
  motivoRechazo: string | null;
  aceptadoPorUsuario: string | null;
}

interface FotoSeleccionada {
  uri: string;
  base64: string;
}

export default function VenderScreen() {
  const { isAuthenticated } = useAuthStore();
  const [tab, setTab] = useState<'nueva' | 'mis'>('nueva');

  // Form state
  const [descripcion, setDescripcion] = useState('');
  const [datosHistoricos, setDatosHistoricos] = useState('');
  const [precioBase, setPrecioBase] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('ARS');
  const [horaSubasta, setHoraSubasta] = useState('10:00');
  const [esObraDisenador, setEsObraDisenador] = useState(false);
  const [nombreArtistaDisenador, setNombreArtistaDisenador] = useState('');
  const [fechaObjeto, setFechaObjeto] = useState('');
  const [historiaObjeto, setHistoriaObjeto] = useState('');
  const [declaracion, setDeclaracion] = useState(false);
  const [fotos, setFotos] = useState<FotoSeleccionada[]>([]);
  const [loading, setLoading] = useState(false);

  // List state
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  if (!isAuthenticated) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Vender un Articulo</Text>
        <Text style={styles.subtitle}>Inicia sesion para solicitar la venta de un bien</Text>
        <Button title="Iniciar Sesion" onPress={() => router.push('/(auth)/login')} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const fetchSolicitudes = async () => {
    setLoadingList(true);
    try {
      const { data } = await api.get('/venta/solicitudes');
      setSolicitudes(data.data);
    } catch { /* ignore */ }
    finally { setLoadingList(false); }
  };

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.45,
    });
    if (!result.canceled) {
      const newPhotos = result.assets
        .filter((a) => !!a.base64)
        .map((a) => ({ uri: a.uri, base64: a.base64! }));
      setFotos((prev) => [...prev, ...newPhotos].slice(0, 12));
    }
  };

  const handleSubmit = async () => {
    if (!descripcion) { Alert.alert('Error', 'Ingrese una descripcion del bien'); return; }
    if (fotos.length < 6) { Alert.alert('Error', `Debe subir al menos 6 fotos (tiene ${fotos.length})`); return; }
    if (!precioBase) { Alert.alert('Error', 'Ingrese un precio base'); return; }
    if (!/^\d{2}:\d{2}$/.test(horaSubasta)) { Alert.alert('Error', 'Ingrese una hora valida (HH:mm)'); return; }
    if (esObraDisenador && !nombreArtistaDisenador.trim()) { Alert.alert('Error', 'Ingrese nombre de artista/diseniador'); return; }
    if (!declaracion) { Alert.alert('Error', 'Debe declarar que el bien le pertenece'); return; }

    setLoading(true);
    try {
      await api.post('/venta/solicitudes', {
        descripcion,
        datosHistoricos: datosHistoricos || null,
        valorBase: parseFloat(precioBase),
        moneda,
        horaSubasta,
        esObraDisenador: esObraDisenador ? 'si' : 'no',
        nombreArtistaDisenador: esObraDisenador ? nombreArtistaDisenador : null,
        fechaObjeto: esObraDisenador ? (fechaObjeto || null) : null,
        historiaObjeto: esObraDisenador ? (historiaObjeto || null) : null,
        fotos: fotos.map((f) => f.base64),
        declaracionPropiedad: 'si',
      });
      Alert.alert('Solicitud enviada', 'La solicitud se aceptara automaticamente en 30 segundos.');
      setDescripcion('');
      setDatosHistoricos('');
      setPrecioBase('');
      setMoneda('ARS');
      setHoraSubasta('10:00');
      setEsObraDisenador(false);
      setNombreArtistaDisenador('');
      setFechaObjeto('');
      setHistoriaObjeto('');
      setDeclaracion(false);
      setFotos([]);
      setTab('mis');
      fetchSolicitudes();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleRespuesta = async (id: number, acepta: string) => {
    try {
      await api.put(`/venta/solicitudes/${id}/respuesta`, { acepta });
      Alert.alert('Listo', acepta === 'si' ? 'Acepto las condiciones' : 'Rechazo las condiciones');
      fetchSolicitudes();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Error');
    }
  };

  const estadoColor = (estado: string) => {
    switch (estado) {
      case 'pendiente': return colors.steelBlue;
      case 'aceptada': return colors.bidGreen;
      case 'rechazada': return colors.alertEmber;
      case 'devuelta': return colors.textMuted;
      default: return colors.textMuted;
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Vender un Articulo</Text>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'nueva' && styles.tabActive]}
          onPress={() => setTab('nueva')}
        >
          <Text style={[styles.tabText, tab === 'nueva' && styles.tabTextActive]}>Nueva Solicitud</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'mis' && styles.tabActive]}
          onPress={() => { setTab('mis'); fetchSolicitudes(); }}
        >
          <Text style={[styles.tabText, tab === 'mis' && styles.tabTextActive]}>Mis Solicitudes</Text>
        </TouchableOpacity>
      </View>

      {tab === 'nueva' ? (
        <ScrollView contentContainerStyle={styles.form}>
          <Input
            label="Descripcion del bien"
            placeholder="Ej: Juego de Te de porcelana, 18 piezas"
            value={descripcion}
            onChangeText={setDescripcion}
            multiline
          />
          <Input
            label="Datos historicos (opcional)"
            placeholder="Contexto, duenos anteriores, curiosidades..."
            value={datosHistoricos}
            onChangeText={setDatosHistoricos}
            multiline
          />
          <Input
            label="Precio base"
            placeholder="Ej: 5000"
            value={precioBase}
            onChangeText={setPrecioBase}
            keyboardType="decimal-pad"
          />

          <Text style={styles.sectionTitle}>Moneda de la subasta</Text>
          <View style={styles.currencyRow}>
            <TouchableOpacity
              style={[styles.currencyChip, moneda === 'ARS' && styles.currencyChipActive]}
              onPress={() => setMoneda('ARS')}
            >
              <Text style={[styles.currencyText, moneda === 'ARS' && styles.currencyTextActive]}>Pesos (ARS)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.currencyChip, moneda === 'USD' && styles.currencyChipActive]}
              onPress={() => setMoneda('USD')}
            >
              <Text style={[styles.currencyText, moneda === 'USD' && styles.currencyTextActive]}>Dolares (USD)</Text>
            </TouchableOpacity>
          </View>

          <Input
            label="Hora de la subasta (definida por el vendedor)"
            placeholder="HH:mm"
            value={horaSubasta}
            onChangeText={setHoraSubasta}
          />

          <View style={styles.declarationRow}>
            <Switch
              value={esObraDisenador}
              onValueChange={setEsObraDisenador}
              trackColor={{ true: colors.auctionGold, false: colors.border }}
              thumbColor={colors.ivory}
            />
            <Text style={styles.declarationText}>Es obra de arte u objeto de diseniador</Text>
          </View>

          {esObraDisenador && (
            <>
              <Input
                label="Nombre del artista/diseniador"
                placeholder="Ej: Xul Solar / Philippe Starck"
                value={nombreArtistaDisenador}
                onChangeText={setNombreArtistaDisenador}
              />
              <Input
                label="Fecha de la obra/objeto"
                placeholder="YYYY-MM-DD"
                value={fechaObjeto}
                onChangeText={setFechaObjeto}
              />
              <Input
                label="Historia del objeto"
                placeholder="Contexto, dueños anteriores, curiosidades..."
                value={historiaObjeto}
                onChangeText={setHistoriaObjeto}
                multiline
              />
            </>
          )}

          {/* Photos */}
          <Text style={styles.sectionTitle}>Fotos (minimo 6)</Text>
          <View style={styles.photoInfo}>
            <Text style={styles.photoCount}>{fotos.length} / 6 minimo</Text>
            <Button title="Agregar Fotos" variant="outline" size="sm" onPress={pickPhotos} />
          </View>
          {fotos.length > 0 && (
            <ScrollView horizontal style={styles.photoStrip}>
              {fotos.map((uri, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: uri.uri }} style={styles.photoImage} />
                </View>
              ))}
            </ScrollView>
          )}

          {/* T504: Declaration checkbox */}
          <View style={styles.declarationRow}>
            <Switch
              value={declaracion}
              onValueChange={setDeclaracion}
              trackColor={{ true: colors.auctionGold, false: colors.border }}
              thumbColor={colors.ivory}
            />
            <Text style={styles.declarationText}>
              Declaro que el bien me pertenece y no posee impedimento para su venta
            </Text>
          </View>

          <Button title="Enviar Solicitud" onPress={handleSubmit} loading={loading} size="lg" />
        </ScrollView>
      ) : (
        <FlatList
          data={solicitudes}
          keyExtractor={(item) => item.identificador.toString()}
          contentContainerStyle={styles.listContent}
          onRefresh={fetchSolicitudes}
          refreshing={loadingList}
          ListEmptyComponent={<Text style={styles.empty}>No tiene solicitudes</Text>}
          renderItem={({ item }) => (
            <View style={[styles.solicitudCard, shadows.md]}>
              <View style={styles.solicitudHeader}>
                <Text style={styles.solicitudDesc} numberOfLines={2}>{item.descripcion}</Text>
                <View style={[styles.estadoDot, { backgroundColor: estadoColor(item.estado) }]} />
              </View>
              <Text style={styles.solicitudEstado}>{item.estado.toUpperCase()}</Text>
              <Text style={styles.solicitudFecha}>
                {new Date(item.fechaSolicitud).toLocaleDateString('es-AR')}
              </Text>

              {item.estado === 'rechazada' && item.motivoRechazo && (
                <Text style={styles.rechazoText}>Motivo: {item.motivoRechazo}</Text>
              )}

              {item.estado === 'aceptada' && item.valorBase && !item.aceptadoPorUsuario && (
                <View style={styles.ofertaSection}>
                  <Text style={styles.ofertaText}>
                    Valor base: ${item.valorBase.toLocaleString('es-AR')}
                  </Text>
                  {item.comisionPropuesta && (
                    <Text style={styles.ofertaText}>
                      Comision: ${item.comisionPropuesta.toLocaleString('es-AR')}
                    </Text>
                  )}
                  <View style={styles.ofertaButtons}>
                    <Button title="Aceptar" size="sm" onPress={() => handleRespuesta(item.identificador, 'si')} style={{ flex: 1 }} />
                    <Button title="Rechazar" variant="danger" size="sm" onPress={() => handleRespuesta(item.identificador, 'no')} style={{ flex: 1 }} />
                  </View>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory, padding: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.textPrimary, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.parchment, alignItems: 'center' },
  tabActive: { backgroundColor: colors.auctionGold },
  tabText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  tabTextActive: { color: colors.ink },
  form: { padding: spacing.lg, paddingBottom: spacing['3xl'] },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginTop: spacing.md, marginBottom: spacing.sm },
  photoInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  photoCount: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  photoStrip: { marginBottom: spacing.lg },
  photoThumb: { width: 64, height: 64, borderRadius: radius.sm, backgroundColor: colors.parchment, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  photoImage: { width: '100%', height: '100%', borderRadius: radius.sm },
  photoThumbText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },
  currencyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  currencyChip: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: colors.parchment, alignItems: 'center' },
  currencyChipActive: { backgroundColor: colors.auctionGold },
  currencyText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  currencyTextActive: { color: colors.ink },
  declarationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg, backgroundColor: colors.parchment, padding: spacing.md, borderRadius: radius.md },
  declarationText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary, flex: 1 },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing['2xl'] },
  solicitudCard: { backgroundColor: colors.ivory, borderRadius: radius.md, padding: spacing.md },
  solicitudHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  solicitudDesc: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary, flex: 1 },
  estadoDot: { width: 10, height: 10, borderRadius: 5, marginLeft: spacing.sm, marginTop: 4 },
  solicitudEstado: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.textSecondary, marginTop: spacing.xs, letterSpacing: 0.5 },
  solicitudFecha: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  rechazoText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginTop: spacing.sm },
  ofertaSection: { marginTop: spacing.md, backgroundColor: colors.parchment, borderRadius: radius.sm, padding: spacing.md },
  ofertaText: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
  ofertaButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
