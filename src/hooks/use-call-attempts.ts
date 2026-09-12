import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "kylio-call-attempts";

function readAll(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/**
 * "Nedovolal se" tap counter, kept in localStorage only — this is a per-device
 * memory aid for the caller ("did I already try this one, how many times"),
 * not shared team data, so it doesn't need a backing DB column.
 */
export function useCallAttempts() {
  const [attempts, setAttempts] = useState<Record<string, number>>({});

  useEffect(() => {
    setAttempts(readAll());
  }, []);

  const bump = useCallback((leadId: string) => {
    setAttempts((prev) => {
      const next = { ...prev, [leadId]: (prev[leadId] ?? 0) + 1 };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable (private mode) — counter just won't persist.
      }
      return next;
    });
  }, []);

  const clear = useCallback((leadId: string) => {
    setAttempts((prev) => {
      if (!(leadId in prev)) return prev;
      const next = { ...prev };
      delete next[leadId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable (private mode) — counter just won't persist.
      }
      return next;
    });
  }, []);

  return { attempts, bump, clear };
}
