import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Dimensions,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Badge, Skeleton, Button } from '../../src/components';
import { CategoryName } from '../../src/components/Badge';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../src/theme';
import api from '../../src/services/api';

const { width } = Dimensions.get('window');

interface ItemDetalle {
  identificador: number;
  precioBase?: number;
  comision?: number;
  subastado: string;
  productoId: number;
  descripcionCatalogo: string;
  descripcionCompleta: string;
  fechaProducto: string;
  duenioNombre: string;
  subastaId: number;
  subastaFecha: string;
  subastaHora: string;
  subastaCat: string;
  moneda: string;
  esObraDisenador?: string;
  nombreArtistaDisenador?: string;
  fechaObjeto?: string;
  historiaObjeto?: string;
  fotos: string[];
}

export default function ItemDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetalle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/subastas/items/${id}`);
        setItem(data.data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: true, title: 'Cargando...' }} />
        <Skeleton width={width} height={width * 0.75} borderRadius={0} />
        <View style={{ padding: spacing.lg }}>
          <Skeleton width="60%" height={28} />
          <Skeleton width="40%" height={24} style={{ marginTop: spacing.sm }} />
          <Skeleton width="100%" height={60} style={{ marginTop: spacing.md }} />
        </View>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centered}>
        <Stack.Screen options={{ headerShown: true, title: 'Error' }} />
        <Text style={styles.errorText}>Item no encontrado</Text>
      </View>
    );
  }

  const formatPrice = (price: number) =>
    `${item.moneda === 'USD' ? 'US$' : '$'} ${price.toLocaleString('es-AR')}`;

  const formatTime = (hora: string) => {
    if (!hora) return '--:--';
    if (/^\d{2}:\d{2}(:\d{2})?$/.test(hora)) return hora.slice(0, 5);
    const d = new Date(hora);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: `Pieza #${item.identificador}` }} />

      {/* Image gallery */}
      <View style={styles.gallery}>
        {item.fotos.length > 0 ? (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {item.fotos.map((foto, index) => (
              <Image key={index} source={{ uri: foto }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageCount}>Sin fotos disponibles</Text>
          </View>
        )}
      </View>

      <View style={styles.content}>
        {/* Title + Category */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.descripcionCatalogo}</Text>
          <Badge category={item.subastaCat as CategoryName} />
        </View>

        {/* Price */}
        {item.precioBase != null && (
          <View style={[styles.priceCard, shadows.sm]}>
            <Text style={styles.priceLabel}>Precio Base</Text>
            <Text style={styles.price}>{formatPrice(item.precioBase)}</Text>
            {item.comision != null && (
              <Text style={styles.comision}>Comision: {formatPrice(item.comision)}</Text>
            )}
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descripcion</Text>
          <Text style={styles.description}>{item.descripcionCompleta}</Text>
        </View>

        {item.esObraDisenador === 'si' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Obra / Diseniador</Text>
            {item.nombreArtistaDisenador && <DetailRow label="Autor" value={item.nombreArtistaDisenador} />}
            {item.fechaObjeto && <DetailRow label="Fecha obra" value={new Date(item.fechaObjeto).toLocaleDateString('es-AR')} />}
            {item.historiaObjeto && <DetailRow label="Historia" value={item.historiaObjeto} />}
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detalles</Text>
          <DetailRow label="Dueno" value={item.duenioNombre} />
          {item.fechaProducto && <DetailRow label="Fecha" value={new Date(item.fechaProducto).toLocaleDateString('es-AR')} />}
          <DetailRow label="Moneda" value={item.moneda || 'ARS'} />
          <DetailRow label="Estado" value={item.subastado === 'si' ? 'Vendido' : 'Disponible'} />
        </View>

        {/* Auction info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subasta</Text>
          <DetailRow label="Fecha" value={new Date(item.subastaFecha).toLocaleDateString('es-AR')} />
          <DetailRow label="Hora" value={formatTime(item.subastaHora)} />
        </View>
      </View>
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.ivory },
  errorText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.alertEmber },
  gallery: { width, aspectRatio: 4 / 3, backgroundColor: colors.parchment },
  galleryImage: { width, height: width * 0.75 },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageCount: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },
  content: { padding: spacing.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  title: { fontFamily: fonts.heading, fontSize: fontSizes.xl, color: colors.textPrimary, flex: 1 },
  priceCard: { backgroundColor: colors.parchment, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  priceLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  price: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], color: colors.auctionGold, marginTop: spacing.xs },
  comision: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.textPrimary, marginBottom: spacing.sm },
  description: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary, lineHeight: 25.6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  detailLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary },
  detailValue: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.textPrimary },
});
