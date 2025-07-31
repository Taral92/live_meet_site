import { AppBar, Toolbar, Typography, Box } from '@mui/material';
import { UserButton } from '@clerk/clerk-react';

const Navbar = () => {
  return (
    <AppBar position="static" sx={{ bgcolor: '#1f1f1f' }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" color="inherit">
          🟢 Taral's Room
        </Typography>
        <Box>
          <UserButton afterSignOutUrl="/" />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;