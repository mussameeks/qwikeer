import { createContext, useEffect, useState } from "react";

export const DarkModeContext = createContext();

export const DarkModeProvider = ({ children }) => {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("darkMode") === "1"
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark-mode", darkMode);
    localStorage.setItem("darkMode", darkMode ? "1" : "0");
  }, [darkMode]);

  return (
    <DarkModeContext.Provider value={{ darkMode, toggle: () => setDarkMode(!darkMode) }}>
      {children}
    </DarkModeContext.Provider>
  );
};