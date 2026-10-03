import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectSocket(): Socket | null {
  const token = localStorage.getItem('hera_token');
  if (!token) return null;

  if (socket?.connected) return socket;

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    timeout: 5000,
    autoConnect: true,
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
