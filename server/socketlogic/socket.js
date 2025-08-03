module.exports = function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`✅ New user connected: ${socket.id}`);

    socket.on('join-meeting', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-joined', { socketId: socket.id });
      console.log(`🎥 User ${socket.id} joined meeting room ${roomId}`);
    });

    socket.on('join', (roomId) => {
      socket.join(roomId);
      console.log(`💬 User ${socket.id} joined chat room ${roomId}`);
    });

    socket.on('chat-message', ({ roomId, message, username }) => {
      io.to(roomId).emit('chat-message', {
        id: socket.id,
        message,
        username,
      });
      console.log(`Chat message in room ${roomId}: ${username}: ${message}`);
    });

    socket.on('offer', ({ offer, target }, roomId) => {
      io.to(target).emit('offer', { offer, from: socket.id });
      console.log(`Offer sent from ${socket.id} to ${target}`);
    });

    socket.on('answer', ({ answer, target }, roomId) => {
      io.to(target).emit('answer', { answer, from: socket.id });
      console.log(`Answer sent from ${socket.id} to ${target}`);
    });

    socket.on('ice-candidate', ({ candidate, target }, roomId) => {
      io.to(target).emit('ice-candidate', { candidate, from: socket.id });
      console.log(`ICE candidate sent from ${socket.id} to ${target}`);
    });

    socket.on('leave-room', (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user-left', { socketId: socket.id });
      console.log(`👋 User ${socket.id} left room ${roomId}`);
    });

    socket.on('disconnecting', () => {
      const rooms = Array.from(socket.rooms).filter((r) => r !== socket.id);
      rooms.forEach((roomId) => {
        socket.to(roomId).emit('user-left', { socketId: socket.id });
        console.log(`👋 User ${socket.id} is leaving room ${roomId}`);
      });
    });

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.id}`);
    });
  });
};