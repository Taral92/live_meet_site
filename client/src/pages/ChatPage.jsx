import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Box } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Navbar from '../components/Navbar';
import ChatBox from '../components/ChatBox';
import MessageInput from '../components/MessageInput';

const ChatPage = () => {
  const { roomId } = useParams();
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const socketRef = useRef(null);

  const backendUrl = 'http://localhost:3000';

  useEffect(() => {
    socketRef.current = io(backendUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log(`Socket connected: ${socketRef.current.id}`);
      socketRef.current.emit('join', roomId);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current.on('chat-message', (data) => {
      console.log('Received chat message:', data);
      setChat((prev) => [...prev, { username: data.username, message: data.message }]);
    });

    return () => {
      socketRef.current.off('chat-message');
      socketRef.current.disconnect();
    };
  }, [roomId]);

  const handleSend = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', {
        roomId,
        message,
        username: user?.username || user?.firstName || 'Anonymous',
      });
      setMessage('');
      console.log('Sent chat message');
    }
  };

  return (
    <Box sx={{ height: '100vh', bgcolor: '#121212', color: 'white' }}>
      <Navbar />
      <ChatBox chat={chat} />
      <MessageInput message={message} setMessage={setMessage} handleSend={handleSend} />
    </Box>
  );
};

export default ChatPage;