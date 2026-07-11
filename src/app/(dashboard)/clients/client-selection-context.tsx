"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface ClientSelectionContextValue {
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  isAllSelected: (ids: string[]) => boolean;
}

const ClientSelectionContext = createContext<ClientSelectionContextValue | null>(null);

/** Selection resets on navigation (pagination/filters are full page loads here) — no cross-page persistence needed. */
export function ClientSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(ids);
    });
  }, []);

  const isAllSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selected.has(id)),
    [selected]
  );

  const value = useMemo(
    () => ({ selected, toggle, toggleAll, isAllSelected }),
    [selected, toggle, toggleAll, isAllSelected]
  );

  return (
    <ClientSelectionContext.Provider value={value}>{children}</ClientSelectionContext.Provider>
  );
}

export function useClientSelection(): ClientSelectionContextValue {
  const ctx = useContext(ClientSelectionContext);
  if (!ctx) throw new Error("useClientSelection must be used within ClientSelectionProvider");
  return ctx;
}
