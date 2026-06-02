import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Alert, ScrollView, Image,
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
import { getApiErrorMessage } from '../../../src/utils/apiError';
import type { MedioPago } from '../../../src/types';

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
  subastaCat?: string;
  articulos?: {
    identificador: number;
    orden: number;
    descripcion: string;
    fotos: string[];
  }[];
}

// Medio de pago ofrecido al ganador (incluye monto disponible calculado por el backend).
interface MedioPagoOption extends MedioPago {
  montoDisponible: number;
}

// Item ganado: payload del evento 'you-won'.
interface WonItem {
  itemId: number;
  importe: number;
  comision: number;
  costoEnvio?: number;
  total?: number;
  medios?: MedioPagoOption[];
}

// Ack generico de los callbacks de socket.
interface SocketAck<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

// Respuesta del ack de 'join-auction'.
interface JoinAuctionData {
  canBid: boolean;
  reason: string | null;
  moneda?: string;
  currentBid?: {
    item: CurrentItem;
    bestBid?: { importe: number; postorNombre: string } | null;
  } | null;
}

// Payloads de eventos del servidor.
interface ItemSoldPayload {
  ganadorNombre: string;
  importe: number;
}

interface ItemPaymentCancelledPayload {
  bidId: number;
  bestBid?: number | null;
  bestBidder?: string | null;
  closeInMs?: number | null;
}

interface CancelPaymentData {
  bestBid?: number | null;
  bestBidder?: string | null;
}

// Estado de la conexion del socket en vivo.
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// Tiempo maximo de espera del ack de una puja antes de liberar el boton.
const BID_ACK_TIMEOUT_MS = 10000;

export default function LiveAuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subastaId = parseInt(id);
  const user = useAuthStore((s) => s.user);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [canBid, setCanBid] = useState(false);
  const [bidReason, setBidReason] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<CurrentItem | null>(null);
  const [bestBid, setBestBid] = useState<number>(0);
  const [bestBidder, setBestBidder] = useState<string>('');
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidInput, setBidInput] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [moneda, setMoneda] = useState('ARS');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [wonItem, setWonItem] = useState<WonItem | null>(null);
  const [selectedMedioPagoId, setSelectedMedioPagoId] = useState<number | null>(null);
  const [closingInMs, setClosingInMs] = useState<number | null>(null);
  const [currentCategory, setCurrentCategory] = useState<string>('comun');
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [minBid, setMinBid] = useState<number | null>(null);
  const [maxBid, setMaxBid] = useState<number | null>(null);

  // Timeout del ack de la puja en curso (A5-07): libera el boton si no llega confirmacion.
  const bidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connected = connectionStatus === 'connected';

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

    // A5-09: aplica el ack de join-auction, tolerando un ack ausente/undefined.
    const applyJoinAck = (response?: SocketAck<JoinAuctionData>) => {
      if (!mounted) return;
      if (!response) {
        Alert.alert('Error', 'No se recibio respuesta del servidor al unirse a la subasta.');
        return;
      }
      if (response.success && response.data) {
        const data = response.data;
        setConnectionStatus('connected');
        setCanBid(data.canBid);
        setBidReason(data.reason);
        setMoneda(data.moneda || 'ARS');
        if (data.currentBid) {
          const item = data.currentBid.item;
          setCurrentItem(item);
          setCurrentCategory(item.subastaCat || 'comun');
          if (data.currentBid.bestBid != null) {
            setBestBid(data.currentBid.bestBid.importe);
            setBestBidder(data.currentBid.bestBid.postorNombre);
          } else {
            setBestBid(item.precioBase);
          }
        }
      } else {
        Alert.alert('Error', response.error || 'No se pudo unir a la subasta');
      }
    };

    const joinAuction = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      socket.emit('join-auction', subastaId, applyJoinAck);
    };

    (async () => {
      try {
        const socket = await connectSocket();
        if (!mounted) return;

        setConnectionStatus(socket.connected ? 'connected' : 'connecting');

        // A5-01 + A5-08: estado de conexion del socket.
        socket.on('connect', () => {
          if (!mounted) return;
          setConnectionStatus('connected');
          // Re-sincroniza el estado de la subasta tras reconectar.
          joinAuction(socket);
        });

        socket.on('disconnect', () => {
          if (!mounted) return;
          setConnectionStatus('reconnecting');
        });

        socket.on('connect_error', () => {
          if (!mounted) return;
          setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'disconnected'));
        });

        joinAuction(socket);

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
            const newItem: CurrentItem = res.data.data;
            setCurrentItem(newItem);
            setCurrentCategory(newItem.subastaCat || 'comun');
            setBids([]);
            setBestBid(newItem.precioBase);
            setBestBidder('');
            setClosingInMs(null);
          } catch (err) {
            console.error('Error fetching new item:', err);
            setBids([]);
          }
        });

        socket.on('item-close-scheduled', (data: { itemId: number; closeInMs: number }) => {
          if (!mounted) return;
          setClosingInMs(data.closeInMs);
        });

        // Item sold
        socket.on('item-sold', (data: ItemSoldPayload) => {
          if (!mounted) return;
          Alert.alert('VENDIDO', `${data.ganadorNombre} gano por ${formatPrice(data.importe)}`);
        });

        // T606: No bids — company bought
        socket.on('item-no-bids', () => {
          if (!mounted) return;
          Alert.alert('Sin pujas', 'La empresa adquirio el item al precio base.');
        });

        // You won!
        socket.on('you-won', (data: WonItem) => {
          if (!mounted) return;
          setWonItem(data);
          setSelectedMedioPagoId(data?.medios?.[0]?.identificador ?? null);
          setShowPaymentModal(true);
        });

        socket.on('item-payment-cancelled', (data: ItemPaymentCancelledPayload) => {
          if (!mounted) return;
          setShowPaymentModal(false);
          setWonItem(null);
          setSelectedMedioPagoId(null);
          setBids((prev) => prev.filter((bid) => bid.bidId !== data.bidId));
          setBestBid(Number(data.bestBid != null ? data.bestBid : (currentItem?.precioBase ?? 0)));
          setBestBidder(data.bestBidder || '');
          setClosingInMs(data.closeInMs ?? null);
        });

        socket.on('auction-closed', () => {
          if (!mounted) return;
          setCanBid(false);
          setBidReason('La subasta ya fue cerrada');
          setClosingInMs(null);
          Alert.alert('Subasta cerrada', 'La subasta fue cerrada luego del pago final.');
        });

      } catch (error: unknown) {
        if (!mounted) return;
        setConnectionStatus('disconnected');
        const msg = getApiErrorMessage(error, 'No se pudo conectar a la subasta');
        Alert.alert('Error', msg);
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('leave-auction', subastaId);
        // A5-05: remover TODOS los listeners para evitar fugas y duplicados.
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('new-bid');
        socket.off('active-item-changed');
        socket.off('item-close-scheduled');
        socket.off('item-sold');
        socket.off('item-no-bids');
        socket.off('you-won');
        socket.off('item-payment-cancelled');
        socket.off('auction-closed');
      }
      disconnectSocket();
      // A5-07: limpiar el timeout pendiente de la puja para evitar fugas.
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
        bidTimeoutRef.current = null;
      }
    };
  }, [subastaId]);

  useEffect(() => {
    if (closingInMs == null) return;
    const timer = setInterval(() => {
      setClosingInMs((prev) => {
        if (prev == null) return null;
        if (prev <= 1000) return null;
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [closingInMs]);

  // Recalculate min/max bids whenever bestBid, item or category change
  useEffect(() => {
    if (!currentItem) {
      setMinBid(null);
      setMaxBid(null);
      return;
    }
    const base = Number(currentItem.precioBase || 0);
    const isHighCategory = currentCategory === 'oro' || currentCategory === 'platino';
    const min = Number((bestBid || 0) + (base * 0.01));
    const max = isHighCategory ? null : Number((bestBid || 0) + (base * 0.20));
    setMinBid(min);
    setMaxBid(max);
  }, [bestBid, currentItem, currentCategory]);

  const formatPrice = (price: number) =>
    `${moneda === 'USD' ? 'US$' : '$'} ${price.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const handleBid = () => {
    // A5-07 + REQ-10: no permitir una nueva puja hasta confirmar la anterior.
    if (isBidding) return;

    const importe = parseFloat(bidInput);
    if (isNaN(importe) || importe <= 0) {
      Alert.alert('Error', 'Ingrese un monto valido');
      return;
    }

    if (!currentItem) {
      Alert.alert('Error', 'No hay item activo');
      return;
    }

    const base = Number(currentItem.precioBase || 0);
    const isHighCategory = currentCategory === 'oro' || currentCategory === 'platino';
    if (importe <= bestBid) {
      Alert.alert('Puja rechazada', `La puja debe ser mayor a ${bestBid}`);
      return;
    }
    if (!isHighCategory) {
      const minValido = bestBid + (base * 0.01);
      const maxValido = bestBid + (base * 0.20);
      if (importe < minValido) {
        Alert.alert('Puja rechazada', `Puja minima: ${minValido.toFixed(2)}`);
        return;
      }
      if (importe > maxValido) {
        Alert.alert('Puja rechazada', `Puja maxima: ${maxValido.toFixed(2)}`);
        return;
      }
    }

    const socket = getSocket();
    if (!socket) {
      Alert.alert('Error', 'Sin conexion con la subasta');
      return;
    }

    // Bloquea el boton hasta recibir el ack (o hasta el timeout).
    setIsBidding(true);

    let acked = false;
    const clearBidTimeout = () => {
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
        bidTimeoutRef.current = null;
      }
    };

    // A5-07: si no llega el ack en N ms, liberar el boton y avisar.
    bidTimeoutRef.current = setTimeout(() => {
      if (acked) return;
      acked = true;
      setIsBidding(false);
      Alert.alert('Sin confirmacion', 'No se recibio confirmacion de la puja. Reintente.');
    }, BID_ACK_TIMEOUT_MS);

    socket.emit(
      'place-bid',
      { subastaId, itemId: currentItem.identificador, importe },
      (response?: SocketAck<unknown>) => {
        if (acked) return;
        acked = true;
        clearBidTimeout();
        setIsBidding(false);
        // A5-09: ack ausente -> error en vez de crash.
        if (!response) {
          Alert.alert('Error', 'No se recibio respuesta del servidor.');
          return;
        }
        if (response.success) {
          setBidInput('');
        } else {
          Alert.alert('Puja rechazada', response.error || 'No se pudo registrar la puja');
        }
      },
    );
  };

  const confirmPayment = () => {
    if (!wonItem?.itemId || !selectedMedioPagoId) {
      Alert.alert('Error', 'Seleccione un medio de pago');
      return;
    }
    const socket = getSocket();
    if (!socket) return;
    const total = wonItem.total ?? (wonItem.importe + wonItem.comision + (wonItem.costoEnvio ?? 0));
    socket.emit('confirm-payment', { itemId: wonItem.itemId, medioPagoId: selectedMedioPagoId }, (response?: SocketAck<unknown>) => {
      // A5-09: ack ausente -> error en vez de crash.
      if (!response) {
        Alert.alert('Error', 'No se recibio respuesta del servidor.');
        return;
      }
      if (response.success) {
        Alert.alert('Pago confirmado', `Total pagado: ${formatPrice(total)}`);
        setShowPaymentModal(false);
        setWonItem(null);
        return;
      }
      // A5-03 + A5-11: detectar la multa por el code del backend, no por substring,
      // y mostrar UN solo Alert (no ademas 'Pago rechazado').
      if (response.code === 'MULTA_APLICADA') {
        setShowPaymentModal(false);
        setWonItem(null);
        Alert.alert('Multa aplicada', response.error || 'Se aplico una multa por incumplimiento de pago.');
        return;
      }
      Alert.alert('Pago rechazado', response.error || 'No se pudo confirmar el pago');
    });
  };

  const performCancelPayment = () => {
    if (!wonItem?.itemId) {
      setShowPaymentModal(false);
      return;
    }
    const socket = getSocket();
    if (!socket) {
      setShowPaymentModal(false);
      return;
    }

    setCancellingPayment(true);
    socket.emit('cancel-payment', { itemId: wonItem.itemId }, (response?: SocketAck<CancelPaymentData>) => {
      setCancellingPayment(false);
      if (response?.success) {
        setShowPaymentModal(false);
        setWonItem(null);
        setSelectedMedioPagoId(null);
        // A5-04: tratar 0 como valor valido (no como ausencia).
        const nuevoBestBid = response.data?.bestBid;
        setBestBid(Number(nuevoBestBid != null ? nuevoBestBid : (currentItem?.precioBase ?? 0)));
        setBestBidder(response.data?.bestBidder || '');
      } else {
        Alert.alert('Error', response?.error || 'No se pudo cancelar el pago');
      }
    });
  };

  const cancelPayment = () => {
    if (!wonItem?.itemId) {
      setShowPaymentModal(false);
      return;
    }

    Alert.alert(
      'Cancelar compra',
      'Estas seguro que desea cancelar la compra y volver a la ultima oferta?',
      [
        { text: 'Seguir pagando', style: 'cancel' },
        { text: 'Cancelar compra', style: 'destructive', onPress: performCancelPayment },
      ],
    );
  };

  const renderBid = ({ item }: { item: Bid }) => (
    <View style={styles.bidRow}>
      <Text style={styles.bidName}>{item.postorNombre}</Text>
      <Text style={styles.bidAmount}>{formatPrice(item.importe)}</Text>
    </View>
  );

  // A5-01 + A5-08: descripcion clara del estado de conexion para la UI.
  const connectionLabel: Record<ConnectionStatus, string> = {
    connecting: 'Conectando a la subasta...',
    connected: 'Conectado en vivo',
    reconnecting: 'Conexion perdida. Reconectando...',
    disconnected: 'Sin conexion con la subasta',
  };
  const connectionDotStyle =
    connectionStatus === 'connected'
      ? styles.dotConnected
      : connectionStatus === 'reconnecting' || connectionStatus === 'connecting'
        ? styles.dotReconnecting
        : styles.dotDisconnected;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveIndicator, connectionDotStyle]} />
          <Text style={styles.headerTitle}>Subasta #{id}</Text>
        </View>
        <Text style={styles.headerMoneda}>{moneda}</Text>
      </View>

      {/* A5-01 + A5-08: estado de conexion del socket con mensaje claro */}
      {!connected && (
        <View
          style={[
            styles.connectionBanner,
            connectionStatus === 'disconnected' ? styles.connectionBannerError : styles.connectionBannerWarn,
          ]}
        >
          <Text style={styles.connectionBannerText}>{connectionLabel[connectionStatus]}</Text>
        </View>
      )}

      {/* Current item */}
      {currentItem ? (
        <View style={styles.itemSection}>
          <Text style={styles.itemTitle}>{currentItem.descripcionCatalogo}</Text>
          <Text style={styles.basePrice}>Base: {formatPrice(currentItem.precioBase)}</Text>

          {currentItem.articulos && currentItem.articulos.length > 0 && (
            <View style={styles.articleSection}>
              <Text style={styles.articleSectionTitle}>Articulos del lote</Text>
              {currentItem.articulos.map((articulo) => (
                <View key={articulo.identificador} style={styles.articleCard}>
                  <Text style={styles.articleTitle}>Articulo {articulo.orden}</Text>
                  <Text style={styles.articleDescription}>{articulo.descripcion}</Text>
                  {articulo.fotos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.articlePhotos}>
                      {articulo.fotos.map((foto, index) => (
                        <Image key={`${articulo.identificador}-${index}`} source={{ uri: foto }} style={styles.articleImage} resizeMode="cover" />
                      ))}
                    </ScrollView>
                  )}
                </View>
              ))}
            </View>
          )}

          <Animated.View style={[styles.priceContainer, shadows.glow, priceAnimStyle]}>
            <Text style={styles.priceLabel}>Mejor Oferta</Text>
            <Text style={styles.currentPrice}>{formatPrice(bestBid)}</Text>
            {bestBidder && <Text style={styles.bidderName}>{bestBidder}</Text>}
            {closingInMs != null && <Text style={styles.countdown}>Cierre en: {Math.ceil(closingInMs / 1000)}s</Text>}
            {currentItem && (
              <View style={styles.minMaxContainer}>
                <Text style={styles.minMaxLabel}>Puja mínima: {formatPrice(minBid ?? 0)}</Text>
                <Text style={styles.minMaxLabel}>Puja máxima: {maxBid != null ? formatPrice(maxBid) : 'Sin tope'}</Text>
              </View>
            )}
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
            loading={isBidding}
            disabled={!connected}
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
        onClose={cancelPayment}
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
            <View style={styles.wonDetail}>
              <Text style={styles.wonLabel}>Costo de envio</Text>
              <Text style={styles.wonValue}>{formatPrice(wonItem.costoEnvio || 0)}</Text>
            </View>
            <View style={styles.wonDetail}>
              <Text style={styles.wonLabel}>Total</Text>
              <Text style={styles.wonValue}>{formatPrice(wonItem.total || (wonItem.importe + wonItem.comision + (wonItem.costoEnvio || 0)))}</Text>
            </View>

            <Text style={[styles.wonLabel, { marginTop: spacing.md }]}>Seleccione medio de pago</Text>
            {Array.isArray(wonItem.medios) && wonItem.medios.map((m: MedioPagoOption) => (
              <Button
                key={m.identificador}
                title={`${m.descripcion} (${m.moneda}) - ${formatPrice(Number(m.montoDisponible || 0))}`}
                variant={selectedMedioPagoId === m.identificador ? 'primary' : 'outline'}
                onPress={() => setSelectedMedioPagoId(m.identificador)}
                size="sm"
                style={{ marginTop: spacing.xs }}
              />
            ))}
            <Button
              title="Confirmar Pago"
              onPress={confirmPayment}
              size="lg"
              disabled={cancellingPayment}
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
  dotConnected: { backgroundColor: colors.bidGreen },
  dotReconnecting: { backgroundColor: colors.auctionGold },
  dotDisconnected: { backgroundColor: colors.alertEmber },
  headerTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.lg, color: colors.ivory },
  headerMoneda: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },

  connectionBanner: { marginHorizontal: spacing.lg, marginBottom: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  connectionBannerWarn: { backgroundColor: colors.goldGlow },
  connectionBannerError: { backgroundColor: colors.alertEmber },
  connectionBannerText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.ivory },

  itemSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  itemTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.xl, color: colors.ivory },
  basePrice: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  articleSection: { marginTop: spacing.md },
  articleSectionTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted, marginBottom: spacing.sm },
  articleCard: { backgroundColor: colors.graphite, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  articleTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.ivory },
  articleDescription: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 21 },
  articlePhotos: { marginTop: spacing.sm },
  articleImage: { width: 120, height: 120, borderRadius: radius.md, marginRight: spacing.sm },

  priceContainer: { backgroundColor: colors.graphite, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
  priceLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },
  currentPrice: { fontFamily: fonts.display, fontSize: fontSizes.hero, color: colors.auctionGold, marginTop: spacing.xs },
  bidderName: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.steelBlue, marginTop: spacing.xs },
  countdown: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.alertEmber, marginTop: spacing.xs },

  minMaxContainer: { flexDirection: 'column', alignItems: 'center', marginTop: spacing.sm },
  minMaxLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },

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
