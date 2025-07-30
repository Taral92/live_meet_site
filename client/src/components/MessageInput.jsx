import { TextField, IconButton, Box } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';

const MessageInput = ({ message, setMessage, handleSend }) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box display="flex" alignItems="center" mt={2} px={2}>
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Type a message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        multiline
        maxRows={4}
        sx={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          flex: 1,
        }}
      />
      <IconButton onClick={handleSend} color="primary" sx={{ ml: 1 }}>
        <SendIcon />
      </IconButton>
    </Box>
  );
};

export default MessageInput;