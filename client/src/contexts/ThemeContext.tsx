import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

// Standard hook that includes toggle function
export const useTheme = () => useContext(ThemeContext);

// Optimized hook for components that only need to read theme (reduces re-renders)
export const useThemeValue = () => {
  const { theme } = useContext(ThemeContext);
  return theme;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Check local storage for saved theme or default to light
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem("theme");
    return (savedTheme as Theme) || "light";
  });

  // Memoized toggle function to prevent unnecessary re-renders
  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  }, []);

  // Update the theme when it changes
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Disable transitions during initial load
    root.classList.add("theme-transitioning");
    
    // Use requestAnimationFrame to ensure smooth transition
    requestAnimationFrame(() => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      
      // Remove transitioning class after a short delay to enable smooth transitions
      setTimeout(() => {
        root.classList.remove("theme-transitioning");
      }, 50);
    });
    
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      theme,
      toggleTheme,
    }),
    [theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
