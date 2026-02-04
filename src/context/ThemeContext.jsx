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
  const [themeId, setThemeId] = useState("agency");

  useEffect(() => {
    let unsubClass;

    const directThemeValue = userData?.theme_id || userData?.theme;
    const directTheme = directThemeValue ? resolveThemeId(directThemeValue) : null;
    if (!userData?.class_id) {
      setThemeId(directTheme || "agency");
      return () => {};
    }

    unsubClass = onSnapshot(doc(db, "classes", userData.class_id), (snap) => {
      if (!snap.exists()) {
        setThemeId(directTheme);
        return;
      }
      const data = snap.data();
      const classThemeValue = data?.theme_id || data?.theme;
      const classTheme = classThemeValue ? resolveThemeId(classThemeValue) : "agency";
      setThemeId(directTheme || classTheme);
    });

    return () => {
      if (unsubClass) unsubClass();
    };
  }, [userData?.class_id, userData?.theme_id, userData?.theme]);

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

export function useTheme() {
  return useContext(ThemeContext);
}
