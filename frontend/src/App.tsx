import { Toaster } from "@/components/ui/toaster";
import BottomNavbar from "./components/BottomNavbar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChatPage from "./pages/ChatPage";
import ProfilePage from "./pages/ProfilePage";
import EscrowPage from "./pages/EscrowPage";
import WalletPage from "./pages/WalletPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminChatView from "./pages/AdminChatView";
import SettingsPage from "./pages/SettingsPage";
import ForgotPassword from "./pages/ForgotPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const MainContent = () => {
  const location = useLocation();
  const showNavbar = !["/login", "/register", "/", "/forgot-password"].includes(location.pathname);

  return (
    <div className={showNavbar ? "pb-16" : ""}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/:userId" element={<ProfilePage />} />
        <Route path="/escrow" element={<EscrowPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/chats/:chatId" element={<AdminChatView />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {showNavbar && <BottomNavbar />}
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MainContent />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
