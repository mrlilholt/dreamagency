import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, provider } from "../lib/firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // The Google User object
  const [userData, setUserData] = useState(null); // The Database data (XP, Role, Class)
  const [loading, setLoading] = useState(true);

  // 1. Listen for Google Sign In
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      
      if (currentUser) {
        setUser(currentUser);
        // 2. If they sign in, check our Database for their profile
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          // They have an account! Load their XP, Role, etc.
          setUserData(userSnap.data());
        } else {
          // They are new! We will handle this in the UI (redirect to Onboarding)
          setUserData(null);
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Helper functions to use throughout the app
  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  const value = {
    user,       // Google Auth info
    userData,   // Our Game info
    loading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// A hook to let us use this easily in any component
export function useAuth() {
  return useContext(AuthContext);
}