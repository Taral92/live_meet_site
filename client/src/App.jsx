import {
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import ChatPage from "./pages/ChatPage";

const ProtectedRoute = ({ children }) => {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl={window.location.origin + location.pathname} />;
  }

  return children;
};

const App = () => {
  return (
    <Routes>
      {/* Redirect root to /chat */}
      <Route path="/" element={<Navigate to="/chat" />} />

      {/* Protected /chat route */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />

      {/* Sign-in route for Clerk */}
      <Route
        path="/sign-in/*"
        element={<SignIn routing="path" path="/sign-in" />}
      />
    </Routes>
  );
};

export default App;