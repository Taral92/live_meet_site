import React, { useEffect, useState } from "react";
import { socket } from "../socket";

const ChatBox = ({ roomId }) => {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("chat", ({ message }) => {
      setMessages((prev) => [...prev, message]);
    });
    return () => socket.off("chat");
  }, []);

  const send = () => {
    socket.emit("chat", { roomId, message: msg });
    setMessages((prev) => [...prev, msg]);
    setMsg("");
  };

  return (
    <div className="mt-4">
      <div className="border p-2 h-40 overflow-y-auto bg-white mb-2">
        {messages.map((m, i) => (
          <div key={i}>{m}</div>
        ))}
      </div>
      <input
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        className="border p-1 mr-2"
        placeholder="Type a message"
      />
      <button onClick={send} className="bg-green-500 text-white px-2 py-1 rounded">
        Send
      </button>
    </div>
  );
};

export default ChatBox;
