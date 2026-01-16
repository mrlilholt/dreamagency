import { useAuth } from "../context/AuthContext";
import AdminDashboard from "./dashboard/AdminDashboard";
import StudentDashboard from "./dashboard/StudentDashboard";

export default function Dashboard() {
  const { userData } = useAuth();

  // If role is admin, show the CEO view
  if (userData?.role === 'admin') {
    return <AdminDashboard />;
  }

  // Otherwise, show the Student view
  return <StudentDashboard />;
}