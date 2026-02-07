import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { CLASS_CODES, INITIAL_STATS } from "../lib/gameConfig";
import { doc, setDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Terminal, ArrowRight, AlertCircle } from "lucide-react";

export default function Onboarding() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState([]);
  const { user } = useAuth(); // The Google User

  useEffect(() => {
    const loadClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        const classList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAvailableClasses(classList);
      } catch (error) {
        console.error("Failed to load classes:", error);
      }
    };
    loadClasses();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const upperCode = code.toUpperCase().trim();
    const classFromDirectory = availableClasses.find((cls) => cls.code === upperCode);
    const selectedClass = classFromDirectory || CLASS_CODES[upperCode];

    // 1. Validate Code
    if (!selectedClass) {
      setError("Invalid Agency Code. Please check the whiteboard.");
      setLoading(false);
      return;
    }

    // 2. Create the User Profile in Firestore
    try {
      const userRef = doc(db, "users", user.uid);
      
      const isAdmin = selectedClass.role === "admin";

      await setDoc(userRef, {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        class_id: selectedClass.id,
        division: selectedClass.division || null,
        divisions: isAdmin ? ["LS", "MS", "US"] : [],
        role: selectedClass.role || "associate", // Default to associate unless it's the Admin code
        ...INITIAL_STATS,
        joinedAt: serverTimestamp()
      });

      // 3. Send them to work
      // We force a page reload so the AuthContext grabs the new data fresh
      window.location.href = "/dashboard"; 

    } catch (err) {
      console.error(err);
      setError("Database Error: Could not sign contract.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-xl shadow-2xl overflow-hidden border border-slate-700">
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="bg-indigo-500/20 p-4 rounded-full">
              <Terminal className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-white text-center mb-2">Agency Onboarding</h2>
          <p className="text-slate-400 text-center mb-8">Enter your Division Code to initialize your workstation.</p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-500 mb-1 uppercase tracking-wider">Access Code</label>
              <input 
                type="text" 
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. DREAM8"
                className="w-full bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none font-mono text-lg tracking-widest uppercase placeholder:text-slate-600"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button 
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Initializing..." : "Sign Contract"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
        
        <div className="bg-slate-900/50 p-4 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-500">Logged in as {user?.email}</p>
        </div>
      </div>
    </div>
  );
}
