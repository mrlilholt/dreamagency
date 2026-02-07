import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";
import { THEME_CONFIG, resolveThemeId } from "../lib/themeConfig";

const ThemeContext = createContext({
  theme: THEME_CONFIG.agency,
  themeId: "agency"
});

export function ThemeProvider({ children }) {
  const { userData } = useAuth();
  const [classThemeId, setClassThemeId] = useState("agency");
  const directThemeValue = userData?.theme_id || userData?.theme;
  const directThemeId = useMemo(
    () => (directThemeValue ? resolveThemeId(directThemeValue) : null),
    [directThemeValue]
  );

  useEffect(() => {
    if (!userData?.class_id) return () => {};

    const unsubClass = onSnapshot(
      doc(db, "classes", userData.class_id),
      (snap) => {
        if (!snap.exists()) {
          setClassThemeId("agency");
          return;
        }
        const data = snap.data();
        const classThemeValue = data?.theme_id || data?.theme;
        const classTheme = classThemeValue ? resolveThemeId(classThemeValue) : "agency";
        setClassThemeId(classTheme);
      },
      (error) => {
        console.error("ThemeContext class listener failed:", error);
        setClassThemeId("agency");
      }
    );

    return () => unsubClass();
  }, [userData?.class_id]);

  const themeId = directThemeId || (userData?.class_id ? classThemeId : "agency");
  const theme = useMemo(() => THEME_CONFIG[themeId] || THEME_CONFIG.agency, [themeId]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.id);
  }, [theme.id]);

  return (
    <ThemeContext.Provider value={{ theme, themeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  return useContext(ThemeContext);
}
