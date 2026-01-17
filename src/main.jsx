import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import './index.css'

// Imports
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import ContractDetails from './pages/ContractDetails' // <--- FIX 1: Import the page
import RewardsShop from "./pages/dashboard/RewardShop";
import CreateContract from "./pages/admin/CreateContract";
import AllContracts from "./pages/admin/AllContracts";
import EditContract from "./pages/admin/EditContract";
import Leaderboard from "./pages/Leaderboard";
import AdminRoster from "./pages/admin/AdminRoster";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import NotificationLayer from "./components/NotificationLayer";
import AgentProfile from "./pages/AgentProfile";
// ----------------------------------------------------
// Protected Route Logic
// ----------------------------------------------------
const PrivateRoute = ({ children }) => {
  const { user, userData, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen flex items-center justify-center">Loading...</div>;

  if (!user) return <Navigate to="/login" state={{ from: location }} />;
  if (user && !userData) return <Navigate to="/onboarding" />;

  return children;
};

// ----------------------------------------------------
// The App
// ----------------------------------------------------
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
            <NotificationLayer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          
          <Route path="/dashboard" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />

          {/* FIX 2: Add the Route definition here */}
        <Route path="/contract/:id" element={
            <PrivateRoute>
              <ContractDetails />
            </PrivateRoute>
          } />
        <Route path="/shop" element={<RewardsShop />} />
        <Route path="/admin/create" element={<CreateContract />} />
          {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" />} />
        <Route path="/admin/contracts" element={<AllContracts />} />
        <Route path="/admin/edit/:id" element={<EditContract />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/admin/roster" element={<AdminRoster />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/profile" element={<AgentProfile />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>,
)