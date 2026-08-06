"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  mode: ThemeMode;
  highContrast: boolean;
  resolvedDark: boolean;
  setMode: (m: ThemeMode) => void;
  setHighContrast: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within Providers");
  return ctx;
}

function applyTheme(mode: ThemeMode, hc: boolean) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.contrast = hc ? "high" : "normal";
  return dark;
}

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  const [mode, setModeState] = useState<ThemeMode>("system");
  const [highContrast, setHcState] = useState(false);
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    // localStorage is unavailable during SSR, so stored preferences must be
    // applied post-mount; the single cascading render this causes is the
    // hydration-safe trade-off (the pre-hydration <head> script already set
    // the correct classes, so nothing visibly flashes).
    /* eslint-disable react-hooks/set-state-in-effect */
    const storedMode = (localStorage.getItem("fw-theme") as ThemeMode | null) ?? "system";
    const storedHc = localStorage.getItem("fw-contrast") === "high";
    setModeState(storedMode);
    setHcState(storedHc);
    setResolvedDark(applyTheme(storedMode, storedHc));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (mode === "system") setResolvedDark(applyTheme(mode, highContrast));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, highContrast]);

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      localStorage.setItem("fw-theme", m);
      setResolvedDark(applyTheme(m, highContrast));
    },
    [highContrast]
  );

  const setHighContrast = useCallback(
    (v: boolean) => {
      setHcState(v);
      localStorage.setItem("fw-contrast", v ? "high" : "normal");
      setResolvedDark(applyTheme(mode, v));
    },
    [mode]
  );

  const value = useMemo(
    () => ({ mode, highContrast, resolvedDark, setMode, setHighContrast }),
    [mode, highContrast, resolvedDark, setMode, setHighContrast]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </QueryClientProvider>
  );
}
