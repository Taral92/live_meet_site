import { Box, Typography, Paper } from '@mui/material';

const ChatBox = ({ chat }) => {
  return (
    <Box sx={{ p: 2, height: '75vh', overflowY: 'auto', bgcolor: '#181818' }}>
      {chat.map((entry, idx) => (
        <Paper
          key={idx}
          elevation={3}
          sx={{
            p: 2,
            my: 1,
            bgcolor: '#2a2a2a',
            color: 'white',
            maxWidth: '60%',
            borderLeft: '4px solid #03DAC6',
          }}
        >
          <Typography variant="subtitle2" color="#03DAC6">
            {entry.username}
          </Typography>
          <Typography>{entry.message}</Typography>
        </Paper>
      ))}
    </Box>
  );
};

export default ChatBox;