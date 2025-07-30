module.exports = function setupSocket(io) {
    io.on('connection', (socket) => {
      console.log(`✅ New user connected: ${socket.id} ${socket.username}`);
  
      socket.on('join', roomId => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
      });
  
      socket.on('chat-message', ({ roomId, message, username }) => {
        io.to(roomId).emit('chat-message',{
          id: socket.id,
          message,
          username,
        });
      });
  
      socket.on('disconnect', () => {
        console.log(`❌ User disconnected: ${socket.id}`);
      });
    });
  }

  