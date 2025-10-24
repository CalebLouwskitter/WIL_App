import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export type SosState = {
  active: boolean;
  name: string | null;
};

type SosContextType = {
  state: SosState;
  activate: (name: string | null | undefined) => void;
  clear: () => void;
};

const SosContext = createContext<SosContextType | undefined>(undefined);

export const SosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<SosState>({ active: false, name: null });

  const activate = useCallback((name: string | null | undefined) => {
    setState({ active: true, name: name ?? null });
  }, []);

  const clear = useCallback(() => {
    setState({ active: false, name: null });
  }, []);

  const value = useMemo(() => ({ state, activate, clear }), [state, activate, clear]);

  return <SosContext.Provider value={value}>{children}</SosContext.Provider>;
};

export function useSos() {
  const ctx = useContext(SosContext);
  if (!ctx) {
    throw new Error('useSos must be used within a SosProvider');
  }
  return ctx;
}
