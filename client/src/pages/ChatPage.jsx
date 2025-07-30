import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Box } from '@mui/material';
import Navbar from '../components/Navbar';
import ChatBox from '../components/ChatBox';
import MessageInput from '../components/MessageInput';
import { useUser } from '@clerk/clerk-react';

const socket = io('http://localhost:3000');
const roomId = 'general';

const ChatPage = () => {
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);

  useEffect(() => {
    socket.emit('join', roomId);
    socket.on('chat-message', (data) => {
      setChat((prev) => [...prev, { username: data.username, message: data.message }]);
    });
    return () => socket.off('chat-message');
  }, []);

  const handleSend = () => {
    if (message.trim()) {
      socket.emit('chat-message', {
        roomId,
        message,
        username: user?.username || user?.firstName || 'Anonymous',
      });
      setMessage('');
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