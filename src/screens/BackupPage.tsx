import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, IconTile, NavBar, Row, Section, Toggle, toast } from '../components/ui';
import { downloadFile } from '../lib/util';
import { categoryName, SOURCE_LABEL } from '../data/catalog';
import { STATUS_LABEL } from '../lib/maintenance';

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function BackupPage() {
  const store = useStore();
  const { state, mode, dues, today } = store;
  const nav = useNav();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmSample, setConfirmSample] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [withFiles, setWithFiles] = useState(true);
  const [confirmDocs, setConfirmDocs] = useState(false);
  const exportJSON = async () => {
    const json = await store.exportData(withFiles);
    downloadFile(`milewyse-backup-${today}.json`, json);
    toast('Backup erstellt');
  };

  const exportCSV = () => {
    const head = ['Bezeichnung', 'Kategorie', 'Status', 'Aktiv', 'Letztes Datum', 'Letzter km', 'Intervall km', 'Intervall Monate', 'Quelle', 'Nächste Fälligkeit km', 'Nächste Fälligkeit Datum', 'Restkilometer', 'Spezifikation', 'Füllmenge', 'Teilenummern', 'Notizen'];
    const rows = state.items.map((i) => {
      const d = dues[i.id];
      return [i.name, categoryName(i.category), STATUS_LABEL[d.status], i.enabled ? 'ja' : 'nein', i.lastDate, i.lastKm, i.intervalKm, i.intervalMonths, SOURCE_LABEL[i.intervalSource], d.nextKm, d.nextDate, d.remainingKm, i.fluidSpec, i.capacity, i.partNumbers, i.notes];
    });
    const csv = '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
    downloadFile(`wartung-${state.vehicle.name.replace(/[^\w-]+/g, '_')}-${today}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV exportiert');
  };

  const exportMileageCSV = () => {
    const rows = [...state.mileage].sort((a, b) => (a.date < b.date ? -1 : 1)).map((m) => [m.date, m.km, m.correction ? 'ja' : 'nein', m.note.trim()]);
    const csv = '﻿' + [['Datum', 'Kilometerstand', 'Korrektur', 'Notiz'], ...rows].map((r) => r.map(csvCell).join(';')).join('\n');
    downloadFile(`kilometer-${state.vehicle.name.replace(/[^\w-]+/g, '_')}-${today}.csv`, csv, 'text/csv;charset=utf-8');
    toast('CSV exportiert');
  };

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" title="Datensicherung" />
      <h1 className="large-title">Datensicherung</h1>

      <div className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <IconTile name="shield" color={mode === 'memory' ? '#ff3b30' : '#2D62F2'} size={44} />
        <div className="small">
          <b style={{ fontSize: 16 }}>{mode === 'memory' ? 'Nur temporär gespeichert' : 'Lokal auf diesem Gerät gespeichert'}</b>
          <div className="muted">
            {mode === 'indexeddb' && 'IndexedDB · keine Registrierung, keine Cloud.'}
            {mode === 'localstorage' && 'localStorage (Fallback) · Speicher ist begrenzt.'}
            {mode === 'memory' && 'Dieser Browser erlaubt keine dauerhafte Speicherung. Bitte regelmäßig ein Backup exportieren.'}
          </div>
        </div>
      </div>

      <Section header="Backup" footer="Regelmäßig exportieren und z. B. in iCloud Drive ablegen. Auf dem iPhone können Browserdaten bei längerer Nichtnutzung gelöscht werden, wenn die App nicht zum Home-Bildschirm hinzugefügt ist.">
        <div className="group">
          <Row title="Dokumente einschließen" sub="Originale und Scans im Backup (größere Datei)" right={<Toggle label="Dokumente einschließen" checked={withFiles} onChange={setWithFiles} />} />
          <Row icon={<IconTile name="download" color="#2D62F2" />} title="Backup exportieren (JSON)" onClick={exportJSON} chevron={false} />
          <Row icon={<IconTile name="upload" color="#5E9EA6" />} title="Backup wiederherstellen" onClick={() => fileRef.current?.click()} chevron={false} />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setPending(await f.text());
          }}
        />
        {msg && <div className={msg.ok ? 'hint' : 'error-text'} role="status">{msg.text}</div>}
      </Section>

      <Section header="Export für Tabellen">
        <div className="group">
          <Row icon={<IconTile name="list" color="#2D62F2" />} title="Wartungsübersicht (CSV)" onClick={exportCSV} chevron={false} />
          <Row icon={<IconTile name="gauge" color="#2D62F2" />} title="Kilometerstände (CSV)" onClick={exportMileageCSV} chevron={false} />
        </div>
      </Section>

      <Section header="Daten verwalten">
        <div className="group">
          <Row icon={<IconTile name="sparkle" color="#E63946" />} title="Beispieldaten laden" sub="Ersetzt alle aktuellen Daten" onClick={() => setConfirmSample(true)} chevron={false} />
          <button className="row destructive" onClick={() => setConfirmDocs(true)}>
            Alle Dokumente löschen
          </button>
          <button className="row destructive" onClick={() => setConfirmReset(true)}>
            Alle Daten löschen
          </button>
        </div>
      </Section>

      <Confirm
        open={!!pending}
        title="Backup wiederherstellen?"
        message="Alle aktuellen Daten werden durch den Inhalt der Datei ersetzt. Tipp: Vorher ein aktuelles Backup exportieren."
        confirmLabel="Wiederherstellen"
        destructive
        onConfirm={async () => {
          const r = await store.importData(pending!);
          setMsg({ ok: r.ok, text: r.message });
          if (r.ok) toast('Wiederhergestellt');
        }}
        onClose={() => setPending(null)}
      />
      <Confirm open={confirmSample} title="Beispieldaten laden?" message="Alle aktuellen Daten werden durch Beispieldaten ersetzt." confirmLabel="Beispieldaten laden" destructive onConfirm={() => { store.loadSample(); toast('Beispieldaten geladen'); }} onClose={() => setConfirmSample(false)} />
      <Confirm open={confirmDocs} title="Alle Dokumente löschen?" message="Alle gescannten und importierten Dokumente samt Originaldateien werden endgültig gelöscht. Historie und Ersatzteile bleiben, ihre Kosten zählen danach einzeln." confirmLabel="Dokumente löschen" destructive onConfirm={async () => { await store.deleteAllDocuments(); toast('Dokumente gelöscht'); }} onClose={() => setConfirmDocs(false)} />
      <Confirm open={confirmReset} title="Alle Daten löschen?" message="Alle Fahrzeuge, Wartungen, Kilometerstände, Historie, Ersatzteile und Dokumente werden unwiderruflich gelöscht." confirmLabel="Endgültig löschen" destructive onConfirm={() => store.resetAll()} onClose={() => setConfirmReset(false)} />
    </>
  );
}
