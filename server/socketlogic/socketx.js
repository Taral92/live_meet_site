module.exports = function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`User ${socket.id} connected`);

    // Join room and notify others
    socket.on("join-meeting", (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", { socketId: socket.id });
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    // Relay offer directly to the target peer
    socket.on("offer", ({ offer, target }, roomId) => {
      io.to(target).emit("offer", { offer, from: socket.id });
      console.log(`Offer from ${socket.id} sent to ${target} in room ${roomId}`);
    });

    // Relay answer directly to the target peer
    socket.on("answer", ({ answer, target }, roomId) => {
      io.to(target).emit("answer", { answer, from: socket.id });
      console.log(`Answer from ${socket.id} sent to ${target} in room ${roomId}`);
    });

    // Relay ICE candidate directly to the target peer
    socket.on("ice-candidate", ({ candidate, target }, roomId) => {
      io.to(target).emit("ice-candidate", { candidate, from: socket.id });
      console.log(`ICE candidate from ${socket.id} sent to ${target} in room ${roomId}`);
    });

    // Handle screen sharing start
    socket.on("screen-share-start", (roomId) => {
      socket.to(roomId).emit("peer-screen-share-start", { from: socket.id });
      console.log(`User ${socket.id} started screen sharing in room ${roomId}`);
    });

    // Handle screen sharing stop
    socket.on("screen-share-stop", (roomId) => {
      socket.to(roomId).emit("peer-screen-share-stop", { from: socket.id });
      console.log(`User ${socket.id} stopped screen sharing in room ${roomId}`);
    });

    // Handle chat messages
    socket.on("chat-message", (data) => {
      const { roomId, message, username } = data;
      if (roomId && message && username) {
        io.to(roomId).emit("chat-message", {
          message,
          username,
          timestamp: new Date().toISOString(),
        });
        console.log(`Chat message from ${username} in room ${roomId}: ${message}`);
      }
    });

    // Handle leaving room explicitly
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit("user-left", { socketId: socket.id });
      console.log(`User ${socket.id} left room ${roomId}`);
    });

    // Notify peers in the room when disconnecting
    socket.on("disconnecting", () => {
      const rooms = Array.from(socket.rooms).filter(r => r !== socket.id);
      rooms.forEach(roomId => {
        socket.to(roomId).emit("user-left", { socketId: socket.id });
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
      });
    });

    socket.on("disconnect", () => {
      console.log(`User ${socket.id} disconnected`);
    });
  });
};
