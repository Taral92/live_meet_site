module.exports = function setupSocketx(x) {
  x.on("connection", (socketx) => {
    socketx.on("join-meeting", (roomId) => {
      socketx.join(roomId);
      socketx.to(roomId).emit("user-joined", { socketId: socketx.id });
      console.log(`User ${socketx.id} joined room ${roomId}`);
    });

    socketx.on("offer", ({ roomId, offer }) => {
      socketx.to(roomId).emit("offer", { offer });
      console.log(`Offer sent to room ${roomId}`);
    });

    socketx.on("answer", ({ roomId, answer }) => {
      socketx.to(roomId).emit("answer", { answer });
      console.log(`Answer sent to room ${roomId}`);
    });

    socketx.on("ice-candidate", ({ roomId, candidate }) => {
      socketx.to(roomId).emit("ice-candidate", { candidate });
      console.log(`Ice candidate sent to room ${roomId}`);
    });

    socketx.on("disconnecting", () => {
      const rooms = Array.from(socketx.rooms).filter(r => r !== socketx.id);
      rooms.forEach(roomId => {
        socketx.to(roomId).emit("user-left", { socketId: socketx.id });
      });
    });
  });
};