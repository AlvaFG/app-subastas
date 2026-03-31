import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
} from 'react-native-reanimated';
import { Button, Badge, Modal } from '../../../src/components';
import { CategoryName } from '../../../src/components/Badge';
import { colors, fonts, fontSizes, spacing, radius, shadows, duration } from '../../../src/theme';
import { connectSocket, getSocket, disconnectSocket } from '../../../src/services/socket';
import { useAuthStore } from '../../../src/store/authStore';
import api from '../../../src/services/api';

interface Bid {
  bidId: number;
  itemId: number;
  importe: number;
  postorNombre: string;
  timestamp: string;
}

interface CurrentItem {
  identificador: number;
  precioBase: number;
  descripcionCatalogo: string;
}

export default function LiveAuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subastaId = parseInt(id);
  const user = useAuthStore((s) => s.user);

  const [connected, setConnected] = useState(false);
  const [canBid, setCanBid] = useState(false);
  const [bidReason, setBidReason] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null);
  const [bestBid, setBestBid] = useState<number>(0);
  const [bestBidder, setBestBidder] = useState<string>('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidInput, setBidInput] = useState('');
  const [sending, setSending] = useState(false);
  const [moneda, setMoneda] = useState('ARS');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [wonItem, setWonItem] = useState<any>(null);

  // Animation for price pulse
  const priceScale = useSharedValue(1);
  const priceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: priceScale.value }],
  }));

  const pulseBid = useCallback(() => {
    priceScale.value = withSequence(
      withTiming(1.08, { duration: 200 }),
      withTiming(1, { duration: 300 }),
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const socket = await connectSocket();

        socket.emit('join-auction', subastaId, (response: any) => {
          if (!mounted) return;
          if (response.success) {
            setConnected(true);
            setCanBid(response.data.canBid);
            setBidReason(response.data.reason);
            setMoneda(response.data.moneda || 'ARS');
            if (response.data.currentBid) {
              setCurrentItem(response.data.currentBid.item);
              if (response.data.currentBid.bestBid) {
                setBestBid(response.data.currentBid.bestBid.importe);
                setBestBidder(response.data.currentBid.bestBid.postorNombre);
              } else {
                setBestBid(response.data.currentBid.item.precioBase);
              }
            }
          } else {
            Alert.alert('Error', response.error);
          }
        });

        // Listen for new bids
        socket.on('new-bid', (bid: Bid) => {
          if (!mounted) return;
          setBids((prev) => [bid, ...prev]);
          setBestBid(bid.importe);
          setBestBidder(bid.postorNombre);
          pulseBid();
        });

        // Listen for item changes
        socket.on('active-item-changed', async (data: { itemId: number }) => {
          if (!mounted) return;
          try {
            const res = await api.get(`/subastas/items/${data.itemId}`);
            const newItem = res.data.data;
            setCurrentItem(newItem);
            setBids([]);
            setBestBid(newItem.precioBase);
            setBestBidder('');
          } catch (err) {
            console.error('Error fetching new item:', err);
            setBids([]);
          }
        });

        // Item sold
        socket.on('item-sold', (data: any) => {
          if (!mounted) return;
          Alert.alert('VENDIDO', `${data.ganadorNombre} gano por ${formatPrice(data.importe)}`);
        });

        // T606: No bids — company bought
        socket.on('item-no-bids', (data: any) => {
          if (!mounted) return;
          Alert.alert('Sin pujas', 'La empresa adquirio el item al precio base.');
        });

        // You won!
        socket.on('you-won', (data: any) => {
          if (!mounted) return;
          setWonItem(data);
          setShowPaymentModal(true);
        });

      } catch (error) {
        Alert.alert('Error', 'No se pudo conectar a la subasta');
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('leave-auction', subastaId);
      }
      disconnectSocket();
    };
  }, [subastaId]);

  const formatPrice = (price: number) =>
    `${moneda === 'USD' ? 'US$' : '$'} ${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleBid = () => {
    const importe = parseFloat(bidInput);
    if (isNaN(importe) || importe <= 0) {
      Alert.alert('Error', 'Ingrese un monto valido');
      return;
    }

    setSending(true);
    const socket = getSocket();
    if (!socket) {
      setSending(false);
      return;
    }

    socket.emit('place-bid', { subastaId, itemId: currentItem?.identificador, importe }, (response: any) => {
      setSending(false);
      if (response.success) {
        setBidInput('');
      } else {
        Alert.alert('Puja rechazada', response.error);
      }
    });
  };

  const renderBid = ({ item }: { item: Bid }) => (
    <View style={styles.bidRow}>
      <Text style={styles.bidName}>{item.postorNombre}</Text>
      <Text style={styles.bidAmount}>{formatPrice(item.importe)}</Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveIndicator, connected && styles.liveActive]} />
          <Text style={styles.headerTitle}>Subasta #{id}</Text>
        </View>
        <Text style={styles.headerMoneda}>{moneda}</Text>
      </View>

      {/* Current item */}
      {currentItem ? (
        <View style={styles.itemSection}>
          <Text style={styles.itemTitle}>{currentItem.descripcionCatalogo}</Text>
          <Text style={styles.basePrice}>Base: {formatPrice(currentItem.precioBase)}</Text>

          <Animated.View style={[styles.priceContainer, shadows.glow, priceAnimStyle]}>
            <Text style={styles.priceLabel}>Mejor Oferta</Text>
            <Text style={styles.currentPrice}>{formatPrice(bestBid)}</Text>
            {bestBidder && <Text style={styles.bidderName}>{bestBidder}</Text>}
          </Animated.View>
        </View>
      ) : (
        <View style={styles.waiting}>
          <Text style={styles.waitingText}>Esperando inicio...</Text>
        </View>
      )}

      {/* Bid history */}
      <View style={styles.bidsSection}>
        <Text style={styles.bidsTitle}>Pujas ({bids.length})</Text>
        <FlatList
          data={bids}
          keyExtractor={(item) => item.bidId.toString()}
          renderItem={renderBid}
          style={styles.bidsList}
          ListEmptyComponent={
            <Text style={styles.noBids}>Sin pujas aun</Text>
          }
        />
      </View>

      {/* Bid input */}
      {canBid && currentItem ? (
        <View style={styles.bidBar}>
          <TextInput
            style={styles.bidInput}
            placeholder="Monto a pujar..."
            placeholderTextColor={colors.textMuted}
            value={bidInput}
            onChangeText={setBidInput}
            keyboardType="decimal-pad"
          />
          <Button
            title="Pujar"
            onPress={handleBid}
            loading={sending}
            size="md"
            style={styles.bidButton}
          />
        </View>
      ) : bidReason ? (
        <View style={styles.bidBarDisabled}>
          <Text style={styles.bidBarDisabledText}>{bidReason}</Text>
        </View>
      ) : null}

      {/* T408: Payment modal after winning */}
      <Modal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Felicitaciones!"
        variant="bottom"
      >
        <Text style={styles.wonText}>Ganaste la pieza!</Text>
        {wonItem && (
          <>
            <View style={styles.wonDetail}>
              <Text style={styles.wonLabel}>Importe pujado</Text>
              <Text style={styles.wonValue}>{formatPrice(wonItem.importe)}</Text>
            </View>
            <View style={styles.wonDetail}>
              <Text style={styles.wonLabel}>Comision</Text>
              <Text style={styles.wonValue}>{formatPrice(wonItem.comision)}</Text>
            </View>
            <Button
              title="Seleccionar Medio de Pago"
              onPress={() => {
                setShowPaymentModal(false);
                // TODO: navigate to payment selection
              }}
              size="lg"
              style={{ marginTop: spacing.md }}
            />
          </>
        )}
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing['2xl'], paddingBottom: spacing.md },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textMuted },
  liveActive: { backgroundColor: colors.alertEmber },
  headerTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.ivory },
  headerMoneda: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },

  itemSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  itemTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.xl, color: colors.ivory },
  basePrice: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },

  priceContainer: { backgroundColor: colors.graphite, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  priceLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },
  currentPrice: { fontFamily: fonts.display, fontSize: fontSizes.hero, color: colors.auctionGold, marginTop: spacing.xs },
  bidderName: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.steelBlue, marginTop: spacing.xs },

  waiting: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  waitingText: { fontFamily: fonts.body, fontSize: fontSizes.lg, color: colors.textMuted },

  bidsSection: { flex: 1, paddingHorizontal: spacing.lg },
  bidsTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.ivory, marginBottom: spacing.sm },
  bidsList: { flex: 1 },
  noBids: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },

  bidRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDark },
  bidName: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted },
  bidAmount: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.auctionGold },

  bidBar: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDark },
  bidInput: { flex: 1, height: 48, backgroundColor: colors.graphite, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.ivory },
  bidButton: { width: 100 },

  bidBarDisabled: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDark, alignItems: 'center' },
  bidBarDisabledText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber },

  wonText: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.auctionGold, textAlign: 'center', marginBottom: spacing.md },
  wonDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  wonLabel: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  wonValue: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.textPrimary },
});
