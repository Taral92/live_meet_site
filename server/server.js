const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const setupSocket = require('./socketlogic/socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://your-frontend-domain.com', // Replace with your deployed frontend URL
    ],
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setupSocket(io);

server.listen(3000, () => {
  console.log('Server running on port 3000');
});