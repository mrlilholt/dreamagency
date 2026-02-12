import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, login } = useAuth();

  // If already logged in, kick them to the dashboard (we'll build this later)
  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      {/* Card Container */}
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center">
          <div className="mx-auto bg-white w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-lg overflow-hidden">
            <img src="/brand/xplabslogo.png" alt="XP Labs" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">XP Labs</h1>
          <p className="text-slate-400 mt-2 text-sm">Design • Research • Engineering • Art • Maker</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-semibold text-slate-800">Associate Login</h2>
            <p className="text-slate-500 mt-1">Sign in to access your contracts.</p>
          </div>

          <button
            onClick={login}
            className="w-full flex justify-center items-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-3 px-4 rounded-lg transition-all shadow-sm group"
          >
            {/* Google G Logo SVG */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span className="group-hover:text-indigo-600 transition-colors">Continue with Google</span>
          </button>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
          <p className="text-xs text-slate-400">Authorized Personnel Only</p>
        </div>
      </div>
    </div>
  );
}
