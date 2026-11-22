import { createContext, useContext } from 'react';
import type { Status } from './lib/types';

export type Tab = 'uebersicht' | 'wartung' | 'historie' | 'kosten' | 'mehr';

export type Page =
  | { name: 'item'; id: string }
  | { name: 'mileage' }
  | { name: 'vehicle' }
  | { name: 'settings' }
  | { name: 'backup' }
  | { name: 'sources' }
  | { name: 'documents' }
  | { name: 'document'; id: string }
  | { name: 'parts' }
  | { name: 'vehicles' }
  | { name: 'intervals' }
  | { name: 'account' };

export type StatusFilter = Status | 'alle';

export interface Nav {
  tab: Tab;
  setTab: (t: Tab) => void;
  stack: Page[];
  push: (p: Page) => void;
  /** Öffnet eine Wartungsposition im Tab „Wartung“ (von überall aus) */
  openItem: (id: string) => void;
  /** Wechselt in einen Tab und öffnet dort direkt eine Seite */
  goTo: (tab: Tab, page: Page) => void;
  pop: () => void;
  filter: StatusFilter;
  setFilter: (f: StatusFilter) => void;
  openMileage: () => void;
  openComplete: (itemIds?: string[]) => void;
  openItemEditor: (id: string | null) => void;
  openRecord: (id: string | null, type?: 'wartung' | 'reparatur') => void;
  openQuick: () => void;
  openScan: () => void;
  openBulk: () => void;
}

export const NavCtx = createContext<Nav | null>(null);
export const useNav = () => {
  const n = useContext(NavCtx);
  if (!n) throw new Error('NavCtx fehlt');
  return n;
};
