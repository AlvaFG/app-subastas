import { io, Socket } from 'socket.io-client';
import * as storage from './storage';
import { API_URL } from './api';

function resolveSocketUrl(): string {
  return API_URL.replace(/\/api$/, '');
}

const SOCKET_URL = resolveSocketUrl();
console.info(`[socket] baseURL=${SOCKET_URL}`);

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await storage.getItemAsync('accessToken');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  return new Promise((resolve, reject) => {
    socket!.on('connect', () => resolve(socket!));
    socket!.on('connect_error', (err) => reject(err));
  });
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
