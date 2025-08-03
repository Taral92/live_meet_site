import { io } from "socket.io-client";
export const socket = io("https://live-meet-site.onrender.com", {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket'],
});