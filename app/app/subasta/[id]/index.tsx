import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Card, CardSkeleton, Badge } from '../../../src/components';
import { CategoryName } from '../../../src/components/Badge';
import { colors, fonts, fontSizes, spacing } from '../../../src/theme';
import api from '../../../src/services/api';

interface CatalogoItem {
  identificador: number;
  precioBase?: number;
  comision?: number;
  subastado: string;
  productoId: number;
  descripcionCatalogo: string;
  descripcionCompleta: string;
  duenioNombre: string;
  catalogoDescripcion: string;
  fotoId: number | null;
  fotoData: string | null;
}

export default function CatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCatalogo = async () => {
    try {
      const { data } = await api.get(`/subastas/${id}/catalogo`);
      setItems(data.data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchCatalogo(); }, [id]);

  const onRefresh = () => { setRefreshing(true); fetchCatalogo(); };

  const renderItem = ({ item }: { item: CatalogoItem }) => (
    <Card
      title={item.descripcionCatalogo || 'Sin descripcion'}
      price={item.precioBase}
      description={item.descripcionCompleta}
      imageUrl={item.fotoData || undefined}
      onPress={() => router.push(`/item/${item.identificador}`)}
    />
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: true, title: `Catalogo #${id}` }} />

      {loading ? (
        <View style={styles.skeletons}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.identificador.toString()}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.auctionGold} />}
          ListEmptyComponent={
            <Text style={styles.empty}>Catalogo vacio</Text>
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <Text style={styles.count}>{items.length} piezas</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ivory },
  skeletons: { padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.md, paddingBottom: spacing['3xl'] },
  row: { gap: spacing.md, marginBottom: spacing.md },
  count: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textSecondary, marginBottom: spacing.md },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing['2xl'] },
});
