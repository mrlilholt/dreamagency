import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from "./context/ThemeContext";
import NotificationLayer from "./components/NotificationLayer";

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ContractDetails from "./pages/ContractDetails";
import RewardsShop from "./pages/dashboard/RewardShop";
import CreateContract from "./pages/admin/CreateContract";
import AllContracts from "./pages/admin/AllContracts";
import EditContract from "./pages/admin/EditContract";
import Leaderboard from "./pages/Leaderboard";
import AdminRoster from "./pages/admin/AdminRoster";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AgentProfile from "./pages/AgentProfile";
import ProcessPage from "./pages/ProcessPage"; // <--- NEW
import ClientsPage from "./pages/ClientsPage";
import CaseStudyDetail from "./pages/CaseStudyDetail";

// --- Private Route Component ---
const PrivateRoute = ({ children, requireAdmin = false }) => {
  const { user, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} />;
  
  // If user is logged in but has no profile data yet, force onboarding
  if (user && !userData && location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" />;
  }

  // Simple Admin Check (Expand this logic as needed)
  if (requireAdmin && userData?.role !== 'admin') {
      // return <Navigate to="/dashboard" />; // Optional: Kick non-admins out
  }

  return children;
};

// --- MAIN APP COMPONENT ---
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <NotificationLayer />
          <Routes>
          
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/process" element={<ProcessPage />} /> 
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/work/:id" element={<CaseStudyDetail />} />
          {/* STUDENT ROUTES */}
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/contract/:id" element={
            <PrivateRoute>
              <ContractDetails />
            </PrivateRoute>
          } />
          <Route path="/shop" element={
            <PrivateRoute>
              <RewardsShop />
            </PrivateRoute>
          } />
          <Route path="/leaderboard" element={
            <PrivateRoute>
              <Leaderboard />
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <AgentProfile />
            </PrivateRoute>
          } />

          {/* ADMIN ROUTES */}
          <Route path="/admin/create" element={<CreateContract />} />
          <Route path="/admin/contracts" element={<AllContracts />} />
          <Route path="/admin/edit/:id" element={<EditContract />} />
          <Route path="/admin/roster" element={<AdminRoster />} />
          <Route path="/admin/analytics" element={<AdminAnalytics />} />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
