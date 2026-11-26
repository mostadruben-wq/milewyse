import { useCallback, useEffect, useMemo, useState } from 'react';
import wordmarkWhite from './assets/wordmark-white.svg';
import { useStore } from './lib/store';
import { NavCtx, type Nav, type Page, type StatusFilter, type Tab } from './nav';
import { Icon } from './components/Icon';
import { ActionSheet, ToastHost } from './components/ui';
import { Dashboard } from './screens/Dashboard';
import { MaintenanceList } from './screens/MaintenanceList';
import { ItemDetail } from './screens/ItemDetail';
import { History } from './screens/History';
import { Costs } from './screens/Costs';
import { More } from './screens/More';
import { MileagePage } from './screens/MileagePage';
import { VehiclePage } from './screens/VehiclePage';
import { SettingsPage } from './screens/SettingsPage';
import { BackupPage } from './screens/BackupPage';
import { SourcesPage } from './screens/SourcesPage';
import { Onboarding } from './screens/Onboarding';
import { MileageSheet } from './sheets/MileageSheet';
import { CompleteSheet } from './sheets/CompleteSheet';
import { ItemEditor } from './sheets/ItemEditor';
import { RecordSheet } from './sheets/RecordSheet';
import { ScanFlow } from './sheets/ScanFlow';
import { BulkImport } from './sheets/BulkImport';
import { Documents } from './screens/Documents';
import { DocumentDetail } from './screens/DocumentDetail';
import { PartsPage } from './screens/PartsPage';
import { VehiclesPage } from './screens/VehiclesPage';
import { IntervalsPage } from './screens/IntervalsPage';
import { AccountPage, RecoverySheet } from './screens/AccountPage';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'uebersicht', label: 'Übersicht', icon: 'home' },
  { id: 'wartung', label: 'Wartung', icon: 'wrench' },
  { id: 'historie', label: 'Historie', icon: 'clock' },
  { id: 'kosten', label: 'Kosten', icon: 'euro' },
  { id: 'mehr', label: 'Mehr', icon: 'more' }
];

export default function App() {
  const store = useStore();
  const { state, ready } = store;
  const [tab, setTabState] = useState<Tab>('uebersicht');
  const [stacks, setStacks] = useState<Record<Tab, Page[]>>({ uebersicht: [], wartung: [], historie: [], kosten: [], mehr: [] });
  const [filter, setFilter] = useState<StatusFilter>('alle');
  const [mileageOpen, setMileageOpen] = useState(false);
  const [complete, setComplete] = useState<string[] | null>(null);
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [record, setRecord] = useState<{ id: string | null; type: 'wartung' | 'reparatur' } | null>(null);
  const [quick, setQuick] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  // Startbildschirm: kurz zeigen, dann sanft ausblenden (nicht länger als nötig)
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => setSplashDone(true), 450);
    return () => clearTimeout(t);
  }, [ready]);
  const [scan, setScan] = useState(false);
  const [bulk, setBulk] = useState(false);

  // Theme anwenden (Auto folgt dem System)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = state.settings.theme === 'auto' ? (mq.matches ? 'dark' : 'light') : state.settings.theme;
      document.documentElement.dataset.theme = t;
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', t === 'dark' ? '#000000' : '#f2f2f7'));
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.settings.theme]);

  const setTab = useCallback(
    (t: Tab) => {
      if (t === tab) setStacks((s) => ({ ...s, [t]: [] })); // erneutes Tippen → zurück zur Wurzel
      setTabState(t);
      window.scrollTo({ top: 0 });
    },
    [tab]
  );

  const nav: Nav = useMemo(
    () => ({
      tab,
      setTab,
      stack: stacks[tab],
      push: (p) => {
        setStacks((s) => ({ ...s, [tab]: [...s[tab], p] }));
        window.scrollTo({ top: 0 });
      },
      openItem: (id) => {
        setStacks((s) => ({ ...s, wartung: [{ name: 'item', id }] }));
        setTabState('wartung');
        window.scrollTo({ top: 0 });
      },
      goTo: (t, p) => {
        setStacks((s) => ({ ...s, [t]: [p] }));
        setTabState(t);
        window.scrollTo({ top: 0 });
      },
      pop: () => setStacks((s) => ({ ...s, [tab]: s[tab].slice(0, -1) })),
      filter,
      setFilter,
      openMileage: () => setMileageOpen(true),
      openComplete: (ids) => setComplete(ids ?? []),
      openItemEditor: (id) => setEditor({ id }),
      openRecord: (id, type = 'reparatur') => setRecord({ id, type }),
      openQuick: () => setQuick(true),
      openScan: () => setScan(true),
      openBulk: () => setBulk(true)
    }),
    [tab, setTab, stacks, filter]
  );

  if (!ready || !splashDone) return <Splash fading={ready} />;
  if (!state.setupDone) return <Onboarding />;

  const top = stacks[tab][stacks[tab].length - 1];
  let content: JSX.Element;
  if (top) {
    switch (top.name) {
      case 'item':
        content = <ItemDetail id={top.id} />;
        break;
      case 'mileage':
        content = <MileagePage />;
        break;
      case 'vehicle':
        content = <VehiclePage key={top.id ?? "active"} id={top.id} />;
        break;
      case 'settings':
        content = <SettingsPage />;
        break;
      case 'backup':
        content = <BackupPage />;
        break;
      case 'sources':
        content = <SourcesPage />;
        break;
      case 'documents':
        content = <Documents />;
        break;
      case 'document':
        content = <DocumentDetail id={top.id} />;
        break;
      case 'parts':
        content = <PartsPage />;
        break;
      case 'vehicles':
        content = <VehiclesPage />;
        break;
      case 'intervals':
        content = <IntervalsPage />;
        break;
      case 'account':
        content = <AccountPage />;
        break;
    }
  } else {
    content = { uebersicht: <Dashboard />, wartung: <MaintenanceList />, historie: <History />, kosten: <Costs />, mehr: <More /> }[tab];
  }

  return (
    <NavCtx.Provider value={nav}>
      <div className="app">
        <main key={tab + stacks[tab].length} className={`screen ${top ? 'page' : ''}`}>
          {content}
        </main>

        <nav className="tabbar" aria-label="Hauptnavigation">
          <div className="tabbar-inner">
            {TABS.slice(0, 2).map((t) => (
              <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
            <button className="tab-pill" aria-label="Neuer Eintrag" onClick={() => setQuick(true)}>
              <Icon name="plus" size={20} stroke={2.2} />
              Neu
            </button>
            {TABS.slice(2).map((t) => (
              <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
        </nav>

        <ActionSheet
          open={quick}
          onClose={() => setQuick(false)}
          title="Neuer Eintrag"
          actions={[
            { label: 'Dokument scannen', icon: 'scan', color: '', onClick: () => setScan(true), hint: 'Rechnung fotografieren oder PDF hochladen' },
            { label: 'Kilometerstand aktualisieren', icon: 'gauge', color: '', onClick: () => setMileageOpen(true) },
            { label: 'Wartung eintragen', icon: 'wrench', color: '', onClick: () => setComplete([]) },
            { label: 'Reparatur dokumentieren', icon: 'hammer', color: '', onClick: () => setRecord({ id: null, type: 'reparatur' }) },
            { label: 'Alte Rechnungen importieren', icon: 'archive', color: '', onClick: () => setBulk(true), hint: 'Mehrere Belege auf einmal' }
          ]}
        />
        <MileageSheet open={mileageOpen} onClose={() => setMileageOpen(false)} />
        {complete && <CompleteSheet initialIds={complete} onClose={() => setComplete(null)} />}
        {editor && <ItemEditor id={editor.id} onClose={() => setEditor(null)} />}
        {record && <RecordSheet id={record.id} type={record.type} onClose={() => setRecord(null)} />}
        {scan && <ScanFlow onClose={() => setScan(false)} />}
        {bulk && <BulkImport onClose={() => setBulk(false)} />}
        <RecoverySheet />
        <ToastHost />
      </div>
    </NavCtx.Provider>
  );
}

function TabButton({ t, active, onClick }: { t: { id: Tab; label: string; icon: string }; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab ${active ? 'active' : ''}`} aria-label={t.label} title={t.label} aria-current={active ? 'page' : undefined} onClick={onClick}>
      <Icon name={t.icon} size={21} stroke={active ? 2.1 : 1.8} />
    </button>
  );
}

function Splash({ fading }: { fading: boolean }) {
  return (
    <div className={`splash ${fading ? 'out' : ''}`} aria-busy="true" aria-label="Milewyse wird geladen">
      <img src={wordmarkWhite} alt="Milewyse" />
    </div>
  );
}
