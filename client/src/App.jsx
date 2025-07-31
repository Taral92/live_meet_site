import { useAuth } from '@clerk/clerk-react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignIn } from '@clerk/clerk-react';
import ChatPage from './pages/ChatPage';
import ProtectedRoute from './ProtectedRoute';

const App = () => {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          isLoaded && isSignedIn ? (
            <Navigate to="/chat" replace />
          ) : (
            <Navigate to="/sign-in" replace />
          )
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
    </Routes>
  );
};

export default App;