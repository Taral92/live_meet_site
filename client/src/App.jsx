import {
  SignedIn,
  SignedOut,
  SignIn,
  useAuth,
  RedirectToSignIn,
} from "@clerk/clerk-react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ChatPage from "./pages/ChatPage";

// Optional: Custom redirect component (in case <Navigate> doesn't work well on deploy)
const RedirectPage = () => {
  const location = useLocation();

  useEffect(() => {
    window.location.replace("/chat");
  }, [location]);

  return null;
};

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
    {/* Option 1: React Router Navigate (may fail on Vercel SSR) */}
    {/* <Route path="/" element={<Navigate to="/chat" />} /> */}

    {/* ✅ Option 2: Safe redirect using useEffect */}
    <Route path="/" element={<RedirectPage />} />

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