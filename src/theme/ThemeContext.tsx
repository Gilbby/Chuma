import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { lightColors, darkColors, ColorScheme } from "./theme";
import { storage } from '@/src/utils/storage';

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorScheme;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "chuma.theme.mode";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, "light");
      if (saved === "dark" || saved === "light") setModeState(saved);
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  };

  const toggle = () => setMode(mode === "light" ? "dark" : "light");

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === "light" ? lightColors : darkColors,
      toggle,
      setMode,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};
