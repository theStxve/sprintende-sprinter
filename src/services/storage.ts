import { useEffect, useState } from 'react';

const PREFIX = 'sprinter.v2.';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    // Objekte mit Defaults zusammenführen, damit neue Felder nach Updates gesetzt sind
    if (fallback && typeof fallback === 'object' && !Array.isArray(fallback) && parsed && typeof parsed === 'object') {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* Speicher voll oder gesperrt – App funktioniert trotzdem */
  }
}

/** useState, der den Wert im Gerät speichert und beim nächsten Start wiederherstellt. */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [value, setValue] = useState<T>(() =>
    read(key, typeof initial === 'function' ? (initial as () => T)() : initial)
  );
  useEffect(() => {
    write(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
