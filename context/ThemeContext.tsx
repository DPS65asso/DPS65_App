
import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'system' | 'light' | 'dark' | 'tactical';

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  isDark: boolean;
  isTactical: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
      if (typeof window !== 'undefined') {
          return (localStorage.getItem('dps65_theme_mode') as ThemeMode) || 'system';
      }
      return 'system';
  });

  const [systemIsDark, setSystemIsDark] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      return false;
  });

  useEffect(() => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setSystemIsDark(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
      setThemeModeState(mode);
      localStorage.setItem('dps65_theme_mode', mode);
  };

  const isTactical = themeMode === 'tactical';
  const isDark = isTactical || (themeMode === 'system' ? systemIsDark : themeMode === 'dark');

  // Application des classes CSS au Body
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Reset des classes (inkl. old ones for clean transition)
    root.classList.remove('light', 'dark', 'tactical', 'ultra-eco');

    if (isTactical) {
        root.classList.add('dark');
        root.classList.add('tactical');
    } else if (isDark) {
        root.classList.add('dark');
    } else {
        root.classList.add('light');
    }
  }, [isDark, isTactical]);

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDark, isTactical }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

