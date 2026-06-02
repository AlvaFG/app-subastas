import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert, FlatList, TouchableOpacity, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Badge, Modal } from '../../src/components';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../src/theme';
import api from '../../src/services/api';
import { useAuthStore } from '../../src/store/authStore';
import { getApiErrorMessage } from '../../src/utils/apiError';
import type { MedioPago } from '../../src/types';
import { router } from 'expo-router';

// Calidad de compresion para fotos tomadas con el ImagePicker (0-1).
// Valor bajo para reducir el peso del base64 enviado al backend.
const IMAGE_QUALITY = 0.45;

interface Solicitud {
  identificador: number;
  descripcion: string;
  estado: string;
  estadoSubasta: string | null;
  fechaSolicitud: string;
  valorBase: number | null;
  comisionPropuesta: number | null;
  motivoRechazo: string | null;
  aceptadoPorUsuario: string | null;
  depositoNombre: string | null;
  depositoDireccion: string | null;
  nroPoliza: string | null;
  tipoPoliza: string | null;
  importeSeguro: number | null;
  puedeActualizarPoliza: boolean;
  siguientePoliza?: {
    nroPoliza: string;
    tipoPoliza: string;
    importeSeguro: number;
    diferenciaSeguro: number;
  } | null;
}

interface FotoSeleccionada {
  uri: string;
  base64: string;
}

interface ArticuloSolicitud {
  id: string;
  descripcion: string;
  fotos: FotoSeleccionada[];
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
  const [articulos, setArticulos] = useState<ArticuloSolicitud[]>([
    { id: 'articulo-1', descripcion: '', fotos: [] },
  ]);
  const [loading, setLoading] = useState(false);

  // List state
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [medios, setMedios] = useState<MedioPago[]>([]);
  const [modalMediosVisible, setModalMediosVisible] = useState(false);
  const [selectedSolicitudForUpgrade, setSelectedSolicitudForUpgrade] = useState<number | null>(null);
  const [mediosLoading, setMediosLoading] = useState(false);

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

  const addArticulo = () => {
    setArticulos((prev) => [
      ...prev,
      { id: `articulo-${Date.now()}-${prev.length + 1}`, descripcion: '', fotos: [] },
    ]);
  };

  const updateArticulo = (articuloId: string, changes: Partial<ArticuloSolicitud>) => {
    setArticulos((prev) => prev.map((articulo) => (
      articulo.id === articuloId ? { ...articulo, ...changes } : articulo
    )));
  };

  const removeArticulo = (articuloId: string) => {
    setArticulos((prev) => (prev.length > 1 ? prev.filter((articulo) => articulo.id !== articuloId) : prev));
  };

  const pickArticuloPhotos = async (articuloId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      base64: true,
      quality: IMAGE_QUALITY,
    });

    if (!result.canceled) {
      const newPhotos = result.assets
        .filter((asset) => !!asset.base64)
        .map((asset) => ({ uri: asset.uri, base64: asset.base64! }));

      setArticulos((prev) => prev.map((articulo) => (
        articulo.id === articuloId
          ? { ...articulo, fotos: [...articulo.fotos, ...newPhotos].slice(0, 12) }
          : articulo
      )));
    }
  };

  const formatMoney = (value: number) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(value);

  const formatMoneyWithCurrency = (value: number, currency: string) => new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ARS',
    maximumFractionDigits: 2,
  }).format(value);

  const handleSubmit = async () => {
    if (!descripcion) { Alert.alert('Error', 'Ingrese una descripcion del bien'); return; }
    if (articulos.length === 0) { Alert.alert('Error', 'Agregue al menos un articulo'); return; }
    if (articulos.some((articulo) => !articulo.descripcion.trim())) { Alert.alert('Error', 'Cada articulo debe tener descripcion'); return; }
    if (articulos.some((articulo) => articulo.fotos.length === 0)) { Alert.alert('Error', 'Cada articulo debe tener al menos una foto'); return; }
    const totalFotos = articulos.reduce((acumulado, articulo) => acumulado + articulo.fotos.length, 0);
    if (totalFotos < 6) { Alert.alert('Error', `Debe subir al menos 6 fotos en total (tiene ${totalFotos})`); return; }
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
        articulos: articulos.map((articulo) => ({
          descripcion: articulo.descripcion.trim(),
          fotos: articulo.fotos.map((foto) => foto.base64),
        })),
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
      setArticulos([{ id: 'articulo-1', descripcion: '', fotos: [] }]);
      setTab('mis');
      fetchSolicitudes();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Error al enviar solicitud'));
    } finally {
      setLoading(false);
    }
  };

  const handleRespuesta = async (id: number, acepta: string) => {
    try {
      await api.put(`/venta/solicitudes/${id}/respuesta`, { acepta });
      Alert.alert('Listo', acepta === 'si' ? 'Acepto las condiciones' : 'Rechazo las condiciones');
      fetchSolicitudes();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Error'));
    }
  };

  const handleUpgradePoliza = async (id: number, nextPoliza?: Solicitud['siguientePoliza']) => {
    const diferencia = nextPoliza?.diferenciaSeguro ?? 0;
    Alert.alert(
      'Aumentar poliza',
      `Se abonara la diferencia del premio: ${formatMoneyWithCurrency(diferencia, 'ARS')}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Elegir medio',
          onPress: async () => {
            try {
              // Abrir modal con medios de pago verificados y activos
              setSelectedSolicitudForUpgrade(id);
              setModalMediosVisible(true);
              setMediosLoading(true);
              const resp = await api.get('/medios-pago');
              setMedios(resp.data.data || []);
            } catch (err) {
              Alert.alert('Error', getApiErrorMessage(err, 'No se pudieron obtener medios de pago'));
            } finally {
              setMediosLoading(false);
            }
          },
        },
      ],
    );
  };

  const confirmUpgradeWithMedio = async (medioId: number) => {
    if (!selectedSolicitudForUpgrade) return;
    try {
      await api.post(`/venta/solicitudes/${selectedSolicitudForUpgrade}/poliza/upgrade`, { medioDePagoId: medioId });
      Alert.alert('Listo', 'La poliza fue actualizada');
      setModalMediosVisible(false);
      setSelectedSolicitudForUpgrade(null);
      fetchSolicitudes();
    } catch (err) {
      Alert.alert('Error', getApiErrorMessage(err, 'Error al actualizar la poliza'));
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
    <>
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

          {/* Articulos */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Articulos del lote</Text>
            <Button title="Agregar articulo" variant="outline" size="sm" onPress={addArticulo} />
          </View>

          {articulos.map((articulo, index) => (
            <View key={articulo.id} style={styles.articuloCard}>
              <View style={styles.articuloHeader}>
                <Text style={styles.articuloTitle}>Articulo {index + 1}</Text>
                <Button title="Eliminar" variant="ghost" size="sm" onPress={() => removeArticulo(articulo.id)} disabled={articulos.length === 1} />
              </View>

              <Input
                label="Descripcion del articulo"
                placeholder="Ej: Taza de porcelana con dorado"
                value={articulo.descripcion}
                onChangeText={(value) => updateArticulo(articulo.id, { descripcion: value })}
                multiline
              />

              <View style={styles.photoInfo}>
                <Text style={styles.photoCount}>{articulo.fotos.length} fotos</Text>
                <Button title="Agregar fotos" variant="outline" size="sm" onPress={() => pickArticuloPhotos(articulo.id)} />
              </View>

              {articulo.fotos.length > 0 && (
                <ScrollView horizontal style={styles.photoStrip}>
                  {articulo.fotos.map((foto, photoIndex) => (
                    <View key={`${articulo.id}-${photoIndex}`} style={styles.photoThumb}>
                      <Image source={{ uri: foto.uri }} style={styles.photoImage} />
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}

          <Text style={styles.helperText}>Cada articulo necesita su propia descripcion y al menos una foto. El precio base aplica al lote completo.</Text>

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

              {item.estadoSubasta && (
                <Text style={styles.detailText}>Estado subasta: {item.estadoSubasta.toUpperCase()}</Text>
              )}

              {item.depositoNombre && (
                <Text style={styles.detailText}>
                  Deposito: {item.depositoNombre}{item.depositoDireccion ? ` - ${item.depositoDireccion}` : ''}
                </Text>
              )}

              {item.nroPoliza && (
                <Text style={styles.detailText}>
                  Poliza: {item.nroPoliza}{item.tipoPoliza ? ` (${item.tipoPoliza})` : ''}
                  {item.importeSeguro ? ` - ${formatMoney(item.importeSeguro)}` : ''}
                </Text>
              )}

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

              {item.puedeActualizarPoliza && item.siguientePoliza && (
                <View style={styles.upgradeSection}>
                  <Text style={styles.upgradeText}>
                    Puede aumentar la cobertura a {item.siguientePoliza.nroPoliza} pagando {formatMoney(item.siguientePoliza.diferenciaSeguro)}
                  </Text>
                  <Button
                    title="Aumentar poliza"
                    size="sm"
                    variant="outline"
                    onPress={() => handleUpgradePoliza(item.identificador, item.siguientePoliza)}
                    style={{ marginTop: spacing.sm }}
                  />
                </View>
              )}
            </View>
          )}
        />
      )}
      </View>
      <MediosModal
        visible={modalMediosVisible}
        onClose={() => { setModalMediosVisible(false); setSelectedSolicitudForUpgrade(null); }}
        medios={medios}
        loading={mediosLoading}
        onSelect={confirmUpgradeWithMedio}
      />
    </>
  );
}

// Modal UI rendered outside main return to keep file organized
interface MediosModalProps {
  visible: boolean;
  onClose: () => void;
  medios: MedioPago[];
  loading: boolean;
  onSelect: (medioId: number) => void;
}

const MediosModal = ({ visible, onClose, medios, loading, onSelect }: MediosModalProps) => (
  <Modal visible={visible} onClose={onClose} title="Elegir medio de pago" variant="bottom">
    {loading ? (
      <Text style={modalStyles.message}>Cargando...</Text>
    ) : medios.length === 0 ? (
      <View style={modalStyles.emptyState}>
        <Text style={modalStyles.message}>No hay medios de pago verificados</Text>
        <Button
          title="Agregar medio de pago"
          onPress={() => { onClose(); router.push('/medios-pago'); }}
        />
      </View>
    ) : (
      <FlatList
        data={medios}
        keyExtractor={(m) => String(m.identificador)}
        style={modalStyles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={modalStyles.item}
            onPress={() => { onSelect(item.identificador); onClose(); }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessible
            accessibilityRole="button"
          >
            <View>
              <Text style={modalStyles.itemTitle}>{item.descripcion || item.tipo || `Medio ${item.identificador}`}</Text>
              <Text style={modalStyles.itemSubtitle}>{Number(item.montoDisponible || 0).toLocaleString()} {item.moneda}</Text>
            </View>
            <Text style={modalStyles.choose}>Seleccionar</Text>
          </TouchableOpacity>
        )}
      />
    )}
  </Modal>
);

const modalStyles = StyleSheet.create({
  // Acota la altura para que listas largas hagan scroll dentro del modal (no desborden el viewport).
  list: { maxHeight: 360 },
  message: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, marginBottom: spacing.md },
  emptyState: { alignItems: 'center' },
  item: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  itemSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  choose: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },
});

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
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  articuloCard: { backgroundColor: colors.parchment, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  articuloHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  articuloTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  helperText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 20 },
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
  detailText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: spacing.xs },
  rechazoText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginTop: spacing.sm },
  ofertaSection: { marginTop: spacing.md, backgroundColor: colors.parchment, borderRadius: radius.sm, padding: spacing.md },
  ofertaText: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
  ofertaButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  upgradeSection: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  upgradeText: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
});
