import {
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  RedirectToSignIn,
} from '@clerk/clerk-react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ChatPage from './pages/ChatPage';
import CreateMeeting from './pages/CreateMeeting';
import MeetingRoom from './pages/MeetingRoom';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isSignedIn) {
    return (
      <RedirectToSignIn redirectUrl={window.location.origin + location.pathname} />
    );
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/create-meeting" />} />
      <Route
        path="/create-meeting"
        element={
          <ProtectedRoute>
            <CreateMeeting />
          </ProtectedRoute>
        }
      />
      <Route
        path="/meeting/:roomId"
        element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:roomId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sign-in/*"
        element={<SignIn routing="path" path="/sign-in" />}
      />
      <Route path="*" element={<Navigate to="/create-meeting" />} />
    </Routes>
  );
};

export default App;
