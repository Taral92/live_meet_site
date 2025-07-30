import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const roomId = 'general'; // static room for this example

  useEffect(() => {
    // Join the room on mount
    socket.emit('join', roomId);

    // Listen for messages
    socket.on('chat-message', (data) => {
      setChat((prev) => [...prev, `${data.id}: ${data.message}`]);
    });

    return () => {
      socket.off('chat-message');
    };
  }, []);

  const handleSend = () => {
    if (message.trim()) {
      socket.emit('chat-message', {
        roomId,
        message,
      });
      setMessage('');
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>💬 Real-Time Room Chat</h2>
      <div style={{ border: '1px solid #ddd', padding: '10px', height: '300px', overflowY: 'auto' }}>
        {chat.map((msg, idx) => (
          <div key={idx} style={{ margin: '5px 0' }}>
            {msg}
          </div>
        ))}
      </div>
      <input
        type="text"
        value={message}
        placeholder="Type your message..."
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        style={{ marginTop: '10px', width: '80%' }}
      />
      <button onClick={handleSend} style={{ marginLeft: '10px' }}>Send</button>
    </div>
  );
}

export default App;