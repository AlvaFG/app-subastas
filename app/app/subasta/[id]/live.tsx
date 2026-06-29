import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
} from 'react-native-reanimated';
import { Button, Modal } from '../../../src/components';
import { colors, fonts, fontSizes, spacing, radius, shadows } from '../../../src/theme';
import { connectSocket, getSocket, disconnectSocket } from '../../../src/services/socket';
import { useAuthStore } from '../../../src/store/authStore';
import { getApiErrorMessage } from '../../../src/utils/apiError';
import { notify, confirmAction } from '../../../src/utils/notify';
import type { MedioPago } from '../../../src/types';

// Item de la subasta con su mejor oferta actual (quien va ganando y por cuanto).
interface AuctionItem {
  identificador: number;
  precioBase: number;
  descripcionCatalogo: string;
  subastado: string;
  bestBid: { importe: number; postorNombre: string; postorId?: number } | null;
  totalBids: number;
}

interface MedioPagoOption extends MedioPago {
  montoDisponible: number;
}

interface WonItem {
  itemId: number;
  importe: number;
  comision: number;
  costoEnvio?: number;
  total?: number;
  medios?: MedioPagoOption[];
}

interface SocketAck<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

const STATUS_OVERLAY_CONFIG: Record<ConnectionStatus, { title: string; subtitle: string; color: string }> = {
  connecting:    { title: 'Conectando...',   subtitle: 'Uniéndote a la subasta en vivo',              color: '#F5A623' },
  connected:     { title: 'Conectado',       subtitle: 'Estás en vivo',                                color: '#4CAF50' },
  reconnecting:  { title: 'Reconectando...', subtitle: 'Conexión perdida, reestableciendo enlace...',  color: '#F5A623' },
  disconnected:  { title: 'Sin conexión',    subtitle: 'No se puede conectar con la subasta',          color: '#E53935' },
};

const REASON_UI: Record<string, { title: string; color: string }> = {
  BLOCKED_INACTIVITY: { title: 'Cuenta bloqueada', color: colors.alertEmber },
  UNPAID_PENALTY: { title: 'Multa impaga', color: colors.alertEmber },
  REGISTRATION_INCOMPLETE: { title: 'Registro pendiente de admision', color: colors.steelBlue },
  CATEGORY_INSUFFICIENT: { title: 'Categoria insuficiente', color: colors.steelBlue },
  PAYMENT_METHOD_MISSING: { title: 'Sin medio de pago', color: colors.auctionGold },
  PAYMENT_METHOD_UNVERIFIED: { title: 'Medio sin verificar', color: colors.auctionGold },
};

interface JoinAuctionData {
  canBid: boolean;
  reason: string | null;
  reasonCode?: string | null;
  moneda?: string;
  categoria?: string;
  estado?: string;
  fin?: string | null;
  items?: AuctionItem[];
}

interface NewBidPayload {
  bidId: number;
  itemId: number;
  importe: number;
  postorId: number;
  postorNombre: string;
}

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

const BID_ACK_TIMEOUT_MS = 10000;

export default function LiveAuctionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subastaId = parseInt(id);
  const user = useAuthStore((s) => s.user);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [canBid, setCanBid] = useState(false);
  const [bidReason, setBidReason] = useState<string | null>(null);
  const [bidReasonCode, setBidReasonCode] = useState<string | null>(null);
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [bidInput, setBidInput] = useState('');
  const [isBidding, setIsBidding] = useState(false);
  const [moneda, setMoneda] = useState('ARS');
  const [categoria, setCategoria] = useState('comun');
  const [finMs, setFinMs] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [ended, setEnded] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [wonItem, setWonItem] = useState<WonItem | null>(null);
  const [selectedMedioPagoId, setSelectedMedioPagoId] = useState<number | null>(null);
  const [modoEntrega, setModoEntrega] = useState<'envio' | 'retiro'>('envio');
  const [cancellingPayment, setCancellingPayment] = useState(false);

  const bidTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showStatusOverlay, setShowStatusOverlay] = useState(true);
  const connected = connectionStatus === 'connected';

  const priceScale = useSharedValue(1);
  const priceAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: priceScale.value }] }));
  const pulseBid = useCallback(() => {
    priceScale.value = withSequence(withTiming(1.08, { duration: 200 }), withTiming(1, { duration: 300 }));
  }, []);

  const formatPrice = (price: number) =>
    `${moneda === 'USD' ? 'US$' : '$'} ${Number(price || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;

  const selectedItem = items.find((it) => it.identificador === selectedId) || null;
  const isHighCategory = categoria === 'oro' || categoria === 'platino';

  // Tick del countdown cada segundo.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = finMs != null ? finMs - now : null;

  const formatRemaining = (ms: number): string => {
    if (ms <= 0) return 'Finalizada';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${sec}s`;
    return `${m}m ${sec}s`;
  };

  const finLabel = finMs != null ? new Date(finMs).toLocaleString('es-AR') : 'Sin cierre programado';

  // Min/max de puja para el item seleccionado (mismo criterio que el backend).
  const base = Number(selectedItem?.precioBase || 0);
  const currentBest = selectedItem?.bestBid ? Number(selectedItem.bestBid.importe) : base;
  const minBid = selectedItem ? currentBest + base * 0.01 : null;
  const maxBid = selectedItem && !isHighCategory ? currentBest + base * 0.20 : null;

  const applyNewBid = useCallback((payload: NewBidPayload) => {
    setItems((prev) => prev.map((it) =>
      it.identificador === payload.itemId
        ? { ...it, bestBid: { importe: payload.importe, postorNombre: payload.postorNombre, postorId: payload.postorId }, totalBids: it.totalBids + 1 }
        : it,
    ));
    pulseBid();
  }, [pulseBid]);

  const markItemSold = useCallback((itemId: number) => {
    setItems((prev) => prev.map((it) => it.identificador === itemId ? { ...it, subastado: 'si' } : it));
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyJoinAck = (response?: SocketAck<JoinAuctionData>) => {
      if (!mounted) return;
      if (!response) {
        notify('Error', 'No se recibio respuesta del servidor al unirse a la subasta.');
        return;
      }
      if (response.success && response.data) {
        const data = response.data;
        setConnectionStatus('connected');
        setCanBid(data.canBid);
        setBidReason(data.reason);
        setBidReasonCode(data.reasonCode ?? null);
        setMoneda(data.moneda || 'ARS');
        setCategoria(data.categoria || 'comun');
        setEnded(data.estado === 'cerrada');
        setFinMs(data.fin ? new Date(data.fin).getTime() : null);
        const list = data.items || [];
        setItems(list);
        setSelectedId((prev) => prev ?? (list.find((i) => i.subastado !== 'si')?.identificador ?? list[0]?.identificador ?? null));
      } else {
        notify('Error', response.error || 'No se pudo unir a la subasta');
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

        socket.on('connect', () => {
          if (!mounted) return;
          setConnectionStatus('connected');
          joinAuction(socket);
        });
        socket.on('disconnect', () => { if (mounted) setConnectionStatus('reconnecting'); });
        socket.on('connect_error', () => {
          if (!mounted) return;
          setConnectionStatus((prev) => (prev === 'connected' ? 'reconnecting' : 'disconnected'));
        });

        joinAuction(socket);

        socket.on('new-bid', (bid: NewBidPayload) => { if (mounted) applyNewBid(bid); });

        socket.on('item-closed', (data: { itemId: number; ganadorNombre?: string; importe?: number }) => {
          if (!mounted) return;
          markItemSold(data.itemId);
        });

        socket.on('item-sold', (data: { itemId: number; ganadorNombre: string; importe: number }) => {
          if (!mounted) return;
          markItemSold(data.itemId);
          notify('VENDIDO', `${data.ganadorNombre} gano por ${formatPrice(data.importe)}`);
        });

        socket.on('item-no-bids', (data: { itemId: number }) => {
          if (!mounted) return;
          markItemSold(data.itemId);
        });

        socket.on('item-payment-defaulted', (data: { itemId: number }) => {
          if (!mounted) return;
          markItemSold(data.itemId);
        });

        socket.on('you-won', (data: WonItem) => {
          if (!mounted) return;
          setWonItem(data);
          setSelectedMedioPagoId(data?.medios?.[0]?.identificador ?? null);
          setModoEntrega('envio');
          setShowPaymentModal(true);
        });

        socket.on('item-payment-cancelled', (data: { itemId: number; bestBid?: number | null; bestBidder?: string | null }) => {
          if (!mounted) return;
          setShowPaymentModal(false);
          setWonItem(null);
          setSelectedMedioPagoId(null);
          setItems((prev) => prev.map((it) => it.identificador === data.itemId
            ? { ...it, bestBid: data.bestBid != null ? { importe: data.bestBid, postorNombre: data.bestBidder || '' } : null }
            : it));
        });

        socket.on('auction-ended', () => {
          if (!mounted) return;
          setEnded(true);
          setCanBid(false);
          notify('Subasta finalizada', 'La subasta llego a su horario de cierre.');
        });

        socket.on('auction-closed', () => {
          if (!mounted) return;
          setEnded(true);
          setCanBid(false);
        });

      } catch (error: unknown) {
        if (!mounted) return;
        setConnectionStatus('disconnected');
        notify('Error', getApiErrorMessage(error, 'No se pudo conectar a la subasta'));
      }
    })();

    return () => {
      mounted = false;
      const socket = getSocket();
      if (socket) {
        socket.emit('leave-auction', subastaId);
        ['connect', 'disconnect', 'connect_error', 'new-bid', 'item-closed', 'item-sold',
          'item-no-bids', 'item-payment-defaulted', 'you-won', 'item-payment-cancelled',
          'auction-ended', 'auction-closed'].forEach((ev) => socket.off(ev));
      }
      disconnectSocket();
      if (bidTimeoutRef.current) {
        clearTimeout(bidTimeoutRef.current);
        bidTimeoutRef.current = null;
      }
    };
  }, [subastaId, applyNewBid, markItemSold]);

  useEffect(() => {
    if (overlayTimeoutRef.current) {
      clearTimeout(overlayTimeoutRef.current);
      overlayTimeoutRef.current = null;
    }
    setShowStatusOverlay(true);
    if (connectionStatus === 'connected') {
      overlayTimeoutRef.current = setTimeout(() => setShowStatusOverlay(false), 2000);
    }
    return () => {
      if (overlayTimeoutRef.current) {
        clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = null;
      }
    };
  }, [connectionStatus]);

  const handleBid = () => {
    if (isBidding || !selectedItem) return;
    const importe = parseFloat(bidInput);
    if (isNaN(importe) || importe <= 0) {
      notify('Error', 'Ingrese un monto valido');
      return;
    }
    if (importe <= currentBest) {
      notify('Puja rechazada', `La puja debe ser mayor a ${currentBest}`);
      return;
    }
    if (!isHighCategory && minBid != null && maxBid != null) {
      if (importe < minBid) { notify('Puja rechazada', `Puja minima: ${minBid.toFixed(2)}`); return; }
      if (importe > maxBid) { notify('Puja rechazada', `Puja maxima: ${maxBid.toFixed(2)}`); return; }
    }

    const socket = getSocket();
    if (!socket) { notify('Error', 'Sin conexion con la subasta'); return; }

    setIsBidding(true);
    let acked = false;
    const clearBidTimeout = () => {
      if (bidTimeoutRef.current) { clearTimeout(bidTimeoutRef.current); bidTimeoutRef.current = null; }
    };
    bidTimeoutRef.current = setTimeout(() => {
      if (acked) return;
      acked = true;
      setIsBidding(false);
      notify('Sin confirmacion', 'No se recibio confirmacion de la puja. Reintente.');
    }, BID_ACK_TIMEOUT_MS);

    socket.emit('place-bid', { subastaId, itemId: selectedItem.identificador, importe }, (response?: SocketAck<unknown>) => {
      if (acked) return;
      acked = true;
      clearBidTimeout();
      setIsBidding(false);
      if (!response) { notify('Error', 'No se recibio respuesta del servidor.'); return; }
      if (response.success) setBidInput('');
      else notify('Puja rechazada', response.error || 'No se pudo registrar la puja');
    });
  };

  const confirmPayment = () => {
    if (!wonItem?.itemId || !selectedMedioPagoId) { notify('Error', 'Seleccione un medio de pago'); return; }
    const socket = getSocket();
    if (!socket) return;
    const costoEnvioEfectivo = modoEntrega === 'retiro' ? 0 : (wonItem.costoEnvio ?? 0);
    const total = wonItem.importe + wonItem.comision + costoEnvioEfectivo;
    socket.emit('confirm-payment', { itemId: wonItem.itemId, medioPagoId: selectedMedioPagoId, modoEntrega }, (response?: SocketAck<unknown>) => {
      if (!response) { notify('Error', 'No se recibio respuesta del servidor.'); return; }
      if (response.success) {
        notify('Pago confirmado', `Total pagado: ${formatPrice(total)}`);
        setShowPaymentModal(false);
        setWonItem(null);
        return;
      }
      if (response.code === 'MULTA_APLICADA') {
        setShowPaymentModal(false);
        setWonItem(null);
        notify('Multa aplicada', response.error || 'Se aplico una multa por incumplimiento de pago.');
        return;
      }
      notify('Pago rechazado', response.error || 'No se pudo confirmar el pago');
    });
  };

  const performCancelPayment = () => {
    if (!wonItem?.itemId) { setShowPaymentModal(false); return; }
    const socket = getSocket();
    if (!socket) { setShowPaymentModal(false); return; }
    setCancellingPayment(true);
    socket.emit('cancel-payment', { itemId: wonItem.itemId }, (response?: SocketAck<unknown>) => {
      setCancellingPayment(false);
      if (response?.success) {
        setShowPaymentModal(false);
        setWonItem(null);
        setSelectedMedioPagoId(null);
      } else {
        notify('Error', response?.error || 'No se pudo cancelar el pago');
      }
    });
  };

  const cancelPayment = () => {
    if (!wonItem?.itemId) { setShowPaymentModal(false); return; }
    confirmAction(
      'Cancelar compra',
      'Estas seguro que desea cancelar la compra? El item se readjudicara al siguiente postor.',
      performCancelPayment,
      'Cancelar compra',
      'Seguir pagando',
    );
  };

  const connectionLabel: Record<ConnectionStatus, string> = {
    connecting: 'Conectando a la subasta...',
    connected: 'Conectado en vivo',
    reconnecting: 'Conexion perdida. Reconectando...',
    disconnected: 'Sin conexion con la subasta',
  };
  const connectionDotStyle =
    connectionStatus === 'connected' ? styles.dotConnected
      : connectionStatus === 'reconnecting' || connectionStatus === 'connecting' ? styles.dotReconnecting
        : styles.dotDisconnected;

  const renderItem = ({ item }: { item: AuctionItem }) => {
    const selected = item.identificador === selectedId;
    const vasGanando = item.bestBid?.postorId != null && item.bestBid.postorId === user?.id;
    return (
      <Pressable onPress={() => setSelectedId(item.identificador)} style={[styles.itemCard, selected && styles.itemCardSelected, item.subastado === 'si' && styles.itemCardSold]}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle} numberOfLines={1}>{item.descripcionCatalogo}</Text>
          {item.subastado === 'si' && <Text style={styles.soldTag}>VENDIDO</Text>}
        </View>
        <Text style={styles.itemBase}>Base: {formatPrice(item.precioBase)}</Text>
        {item.bestBid ? (
          <View style={styles.winnerRow}>
            <Text style={styles.winnerLabel}>Va ganando:</Text>
            <Text style={styles.winnerName}>{vasGanando ? 'Vos' : item.bestBid.postorNombre}</Text>
            <Text style={styles.winnerAmount}>{formatPrice(item.bestBid.importe)}</Text>
          </View>
        ) : (
          <Text style={styles.noBidsItem}>Sin ofertas aun</Text>
        )}
        <Text style={styles.bidCount}>{item.totalBids} puja(s)</Text>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.liveIndicator, connectionDotStyle]} />
          <Text style={styles.headerTitle}>Subasta #{id}</Text>
        </View>
        <Text style={styles.headerMoneda}>{moneda}</Text>
      </View>

      {!connected && (
        <View style={[styles.connectionBanner, connectionStatus === 'disconnected' ? styles.connectionBannerError : styles.connectionBannerWarn]}>
          <Text style={styles.connectionBannerText}>{connectionLabel[connectionStatus]}</Text>
        </View>
      )}

      {/* Countdown al cierre de la subasta */}
      <Animated.View style={[styles.finBanner, shadows.glow, priceAnimStyle]}>
        <Text style={styles.finLabel}>{ended ? 'Subasta finalizada' : 'Cierra en'}</Text>
        {!ended && remaining != null && (
          <Text style={styles.finCountdown}>{formatRemaining(remaining)}</Text>
        )}
        <Text style={styles.finDate}>{ended ? finLabel : `Fin: ${finLabel}`}</Text>
      </Animated.View>

      {/* Lista de items, cada uno con quien va ganando y por cuanto */}
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.identificador)}
        renderItem={renderItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>Esta subasta no tiene items.</Text>}
      />

      {/* Barra de puja para el item seleccionado */}
      {canBid && selectedItem && selectedItem.subastado !== 'si' && !ended ? (
        <View style={styles.bidBar}>
          <View style={styles.bidBarTop}>
            <Text style={styles.bidBarItem} numberOfLines={1}>Pujando: {selectedItem.descripcionCatalogo}</Text>
            <Text style={styles.bidBarLimits}>
              Min {formatPrice(minBid ?? 0)}{maxBid != null ? ` · Max ${formatPrice(maxBid)}` : ' · Sin tope'}
            </Text>
          </View>
          <View style={styles.bidBarRow}>
            <TextInput
              style={styles.bidInput}
              placeholder="Monto a pujar..."
              placeholderTextColor={colors.textMuted}
              value={bidInput}
              onChangeText={setBidInput}
              keyboardType="decimal-pad"
            />
            <Button title="Pujar" onPress={handleBid} loading={isBidding} disabled={!connected} size="md" style={styles.bidButton} />
          </View>
        </View>
      ) : bidReason && !ended ? (
        <View style={styles.bidBarDisabled}>
          {bidReasonCode && REASON_UI[bidReasonCode] ? (
            <View style={styles.reasonRow}>
              <View style={[styles.reasonDot, { backgroundColor: REASON_UI[bidReasonCode].color }]} />
              <Text style={[styles.reasonTitle, { color: REASON_UI[bidReasonCode].color }]}>{REASON_UI[bidReasonCode].title}</Text>
            </View>
          ) : null}
          <Text style={styles.bidBarDisabledText}>{bidReason}</Text>
        </View>
      ) : null}

      {/* Connection status overlay */}
      {showStatusOverlay && (
        <Pressable style={styles.statusOverlay} onPress={connectionStatus === 'connected' ? () => setShowStatusOverlay(false) : undefined}>
          <View style={[styles.statusCard, { borderColor: STATUS_OVERLAY_CONFIG[connectionStatus].color }]}>
            <View style={[styles.statusCircle, { backgroundColor: STATUS_OVERLAY_CONFIG[connectionStatus].color }]} />
            <Text style={[styles.statusTitle, { color: STATUS_OVERLAY_CONFIG[connectionStatus].color }]}>
              {STATUS_OVERLAY_CONFIG[connectionStatus].title}
            </Text>
            <Text style={styles.statusSubtitle}>{STATUS_OVERLAY_CONFIG[connectionStatus].subtitle}</Text>
            {connectionStatus === 'connected' && (
              <Text style={styles.statusDismiss}>Toca para cerrar</Text>
            )}
          </View>
        </Pressable>
      )}

      {/* Payment modal after winning */}
      <Modal visible={showPaymentModal} onClose={cancelPayment} title="Felicitaciones!" variant="bottom">
        <Text style={styles.wonText}>Ganaste la pieza!</Text>
        {wonItem && (
          <>
            <View style={styles.wonDetail}><Text style={styles.wonLabel}>Importe pujado</Text><Text style={styles.wonValue}>{formatPrice(wonItem.importe)}</Text></View>
            <View style={styles.wonDetail}><Text style={styles.wonLabel}>Comision</Text><Text style={styles.wonValue}>{formatPrice(wonItem.comision)}</Text></View>
            <Text style={[styles.wonLabel, { marginTop: spacing.sm }]}>Entrega</Text>
            <View style={styles.entregaRow}>
              <Button title="Envio (con seguro)" variant={modoEntrega === 'envio' ? 'primary' : 'outline'} size="sm" onPress={() => setModoEntrega('envio')} style={styles.flexBtn} />
              <Button title="Retiro (pierde seguro)" variant={modoEntrega === 'retiro' ? 'primary' : 'outline'} size="sm" onPress={() => setModoEntrega('retiro')} style={styles.flexBtn} />
            </View>
            <View style={styles.wonDetail}><Text style={styles.wonLabel}>Costo de envio</Text><Text style={styles.wonValue}>{formatPrice(modoEntrega === 'retiro' ? 0 : (wonItem.costoEnvio || 0))}</Text></View>
            {modoEntrega === 'retiro' ? <Text style={styles.seguroWarn}>Retiro personal: el bien pierde la cobertura del seguro.</Text> : null}
            <View style={styles.wonDetail}><Text style={styles.wonLabel}>Total</Text><Text style={styles.wonValue}>{formatPrice(wonItem.importe + wonItem.comision + (modoEntrega === 'retiro' ? 0 : (wonItem.costoEnvio || 0)))}</Text></View>

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
            <Button title="Confirmar Pago" onPress={confirmPayment} size="lg" disabled={cancellingPayment} style={{ marginTop: spacing.md }} />
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

  finBanner: { backgroundColor: colors.graphite, borderRadius: radius.lg, padding: spacing.lg, marginHorizontal: spacing.lg, marginBottom: spacing.md, alignItems: 'center' },
  finLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.textMuted },
  finCountdown: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], color: colors.auctionGold, marginTop: spacing.xs },
  finDate: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },

  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },

  itemCard: { backgroundColor: colors.graphite, borderRadius: radius.md, padding: spacing.md, borderWidth: 1.5, borderColor: 'transparent' },
  itemCardSelected: { borderColor: colors.auctionGold },
  itemCardSold: { opacity: 0.55 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemTitle: { fontFamily: fonts.headingSemibold, fontSize: fontSizes.base, color: colors.ivory, flex: 1 },
  soldTag: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.xs, color: colors.alertEmber, marginLeft: spacing.sm },
  itemBase: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs },
  winnerRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.xs },
  winnerLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted },
  winnerName: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.steelBlue },
  winnerAmount: { fontFamily: fonts.display, fontSize: fontSizes.lg, color: colors.auctionGold, marginLeft: 'auto' },
  noBidsItem: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  bidCount: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.xs },

  bidBar: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDark, gap: spacing.sm },
  bidBarTop: { gap: 2 },
  bidBarItem: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm, color: colors.ivory },
  bidBarLimits: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted },
  bidBarRow: { flexDirection: 'row', gap: spacing.sm },
  bidInput: { flex: 1, height: 48, backgroundColor: colors.graphite, borderRadius: radius.md, paddingHorizontal: spacing.md, fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.ivory },
  bidButton: { width: 100 },

  bidBarDisabled: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDark, alignItems: 'center', gap: spacing.xs },
  bidBarDisabledText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, textAlign: 'center' },
  reasonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  reasonDot: { width: 8, height: 8, borderRadius: 4 },
  reasonTitle: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.sm },

  wonText: { fontFamily: fonts.display, fontSize: fontSizes['2xl'], color: colors.auctionGold, textAlign: 'center', marginBottom: spacing.md },
  wonDetail: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  wonLabel: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textSecondary },
  wonValue: { fontFamily: fonts.bodySemibold, fontSize: fontSizes.base, color: colors.textPrimary },
  entregaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  flexBtn: { flex: 1 },
  seguroWarn: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.alertEmber, marginTop: spacing.xs },

  statusOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  statusCard: { backgroundColor: colors.graphite, borderRadius: radius.lg, borderWidth: 2, padding: spacing['2xl'], alignItems: 'center', marginHorizontal: spacing.xl, gap: spacing.md, minWidth: 260 },
  statusCircle: { width: 72, height: 72, borderRadius: 36 },
  statusTitle: { fontFamily: fonts.display, fontSize: fontSizes['3xl'], textAlign: 'center' },
  statusSubtitle: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.textMuted, textAlign: 'center' },
  statusDismiss: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textMuted, marginTop: spacing.sm },
});
