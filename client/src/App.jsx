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
    return (
      <RedirectToSignIn
        signInUrl={`/sign-in?redirect_url=${location.pathname}`}
      />
    );
  }

  return children;
};

const App = () => (
  <Routes>
    <Route path="/" element={<Navigate to="/chat" />} />
    <Route
      path="/chat"
      element={
        <ProtectedRoute>
          <ChatPage />
        </ProtectedRoute>
      }
    />
    <Route path="/sign-in" element={<SignIn />} />
  </Routes>
);

export default App;