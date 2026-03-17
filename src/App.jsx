import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from "./context/ThemeContext";
import { EggProvider } from "./context/EggContext";
import NotificationLayer from "./components/NotificationLayer";
import InstallBanner from "./components/InstallBanner";

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import ContractDetails from "./pages/ContractDetails";
import SideHustleDetails from "./pages/SideHustleDetails";
import RewardsShop from "./pages/dashboard/RewardShop";
import CreateContract from "./pages/admin/CreateContract";
import AllContracts from "./pages/admin/AllContracts";
import EditContract from "./pages/admin/EditContract";
import Leaderboard from "./pages/Leaderboard";
import AdminRoster from "./pages/admin/AdminRoster";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminEggs from "./pages/admin/AdminEggs";
import AdminGenerate from "./pages/admin/AdminGenerate";
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
      return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// --- MAIN APP COMPONENT ---
function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <EggProvider>
            <NotificationLayer />
            <InstallBanner />
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
          <Route path="/side-hustle/:id" element={
            <PrivateRoute>
              <SideHustleDetails />
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
          <Route path="/admin/create" element={
            <PrivateRoute requireAdmin>
              <CreateContract />
            </PrivateRoute>
          } />
          <Route path="/admin/contracts" element={
            <PrivateRoute requireAdmin>
              <AllContracts />
            </PrivateRoute>
          } />
          <Route path="/admin/edit/:id" element={
            <PrivateRoute requireAdmin>
              <EditContract />
            </PrivateRoute>
          } />
          <Route path="/admin/roster" element={
            <PrivateRoute requireAdmin>
              <AdminRoster />
            </PrivateRoute>
          } />
          <Route path="/admin/analytics" element={
            <PrivateRoute requireAdmin>
              <AdminAnalytics />
            </PrivateRoute>
          } />
          <Route path="/admin/events" element={
            <PrivateRoute requireAdmin>
              <AdminEvents />
            </PrivateRoute>
          } />
          <Route path="/admin/generate" element={
            <PrivateRoute requireAdmin>
              <AdminGenerate />
            </PrivateRoute>
          } />
          <Route path="/admin/eggs" element={
            <PrivateRoute requireAdmin>
              <AdminEggs />
            </PrivateRoute>
          } />

          {/* FALLBACK */}
          <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </EggProvider>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
