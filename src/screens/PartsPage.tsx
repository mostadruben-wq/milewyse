import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, Empty, Field, NavBar, SelectField, Sheet, TextArea, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORIES } from '../data/catalog';
import type { CategoryId, Part } from '../lib/types';
import { formatDate } from '../lib/dates';
import { fmtEur, fmtKm, parseNum, uid } from '../lib/util';

/** Persönliche Ersatzteil-Datenbank mit Suche nach Teilenummer, Hersteller und Bezeichnung. */
export function PartsPage() {
  const { state } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Part | 'new' | null>(null);
  const list = useMemo(() => {
    const n = q.trim().toLowerCase().replace(/[\s.\-/]/g, '');
    return [...state.parts]
      .filter((p) => !n || `${p.name}${p.manufacturer}${p.partNumber}${p.dealer}${p.notes}`.toLowerCase().replace(/[\s.\-/]/g, '').includes(n))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.parts, q]);

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" right={<button className="nav-btn icon-btn" aria-label="Ersatzteil hinzufügen" onClick={() => setEdit('new')}><Icon name="plus" size={20} stroke={2.4} /></button>} />
      <h1 className="large-title">Ersatzteile</h1>
      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Teilenummer, Hersteller, Bezeichnung" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Ersatzteile durchsuchen" />
      </div>
      {list.length === 0 ? (
        <Empty icon="tag" title={state.parts.length ? 'Keine Treffer' : 'Noch keine Ersatzteile'} text={state.parts.length ? 'Anderen Suchbegriff versuchen.' : 'Teile werden beim Scannen von Rechnungen erkannt oder hier manuell angelegt.'} />
      ) : (
        <div className="group">
          {list.map((p) => (
            <button key={p.id} className="row" onClick={() => setEdit(p)}>
              <div className="row-main">
                <div className="row-title">{p.name}</div>
                <div className="row-sub">
                  {[p.manufacturer, p.partNumber && `Nr. ${p.partNumber}`, p.installDate ? `eingebaut ${formatDate(p.installDate)}` : 'Einbau offen'].filter(Boolean).join(' · ')}
                </div>
              </div>
              <span className="row-value">{p.price !== null ? fmtEur(p.price) : ''}</span>
              <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" />
            </button>
          ))}
        </div>
      )}
      {edit && <PartSheet part={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function PartSheet({ part, onClose }: { part: Part | null; onClose: () => void }) {
  const { state, root, today, savePart, deletePart } = useStore();
  const nav = useNav();
  const [p, setP] = useState<Part>(
    part ?? { id: uid(), vehicleId: state.vehicle.id, name: '', manufacturer: '', partNumber: '', category: null, compatibility: '', installDate: null, installKm: null, price: null, dealer: '', link: '', recordId: null, documentId: null, notes: '', createdAt: Date.now() }
  );
  const [price, setPrice] = useState(p.price === null ? '' : String(p.price).replace('.', ','));
  const [km, setKm] = useState(p.installKm === null ? '' : String(p.installKm));
  const [err, setErr] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const s = <K extends keyof Part>(k: K, v: Part[K]) => setP((x) => ({ ...x, [k]: v }));
  const doc = root.documents.find((d) => d.id === p.documentId);
  const rec = root.records.find((r) => r.id === p.recordId);

  const save = () => {
    if (!p.name.trim()) return setErr('Bitte eine Bezeichnung eingeben.');
    const pr = parseNum(price);
    const k = parseNum(km);
    if (pr !== null && (Number.isNaN(pr) || pr < 0)) return setErr('Bitte einen gültigen Preis eingeben.');
    if (k !== null && (Number.isNaN(k) || k < 0 || !Number.isInteger(k))) return setErr('Bitte einen gültigen Kilometerstand eingeben.');
    if (p.link && !/^https?:\/\//i.test(p.link)) return setErr('Der Produktlink muss mit http:// oder https:// beginnen.');
    savePart({ ...p, name: p.name.trim(), price: pr, installKm: k });
    toast('Gespeichert');
    onClose();
  };

  return (
    <Sheet open title={part ? 'Ersatzteil' : 'Neues Ersatzteil'} onClose={onClose} right={<button className="nav-btn bold" onClick={save}>Sichern</button>}>
      <div className="group">
        <Field label="Bezeichnung" value={p.name} onChange={(x) => s('name', x)} />
        <Field label="Hersteller" value={p.manufacturer} onChange={(x) => s('manufacturer', x)} placeholder="unbekannt" />
        <Field label="Teilenummer" value={p.partNumber} onChange={(x) => s('partNumber', x)} placeholder="–" />
        <SelectField<string> label="Kategorie" value={p.category ?? ''} onChange={(x) => s('category', (x || null) as CategoryId | null)} options={[{ value: '', label: '–' }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.name }))]} />
        <Field label="Kompatibilität" value={p.compatibility} onChange={(x) => s('compatibility', x)} placeholder="z. B. Motor, Baujahr" />
      </div>
      <div className="section-header">Einbau & Kauf</div>
      <div className="group">
        <Field label="Einbaudatum" type="date" value={p.installDate ?? ''} onChange={(x) => s('installDate', x || null)} max={today} />
        <Field label="Kilometerstand" value={km} onChange={setKm} inputMode="numeric" unit="km" placeholder="–" />
        <Field label="Preis" value={price} onChange={setPrice} inputMode="decimal" unit="€" placeholder="–" />
        <Field label="Händler" value={p.dealer} onChange={(x) => s('dealer', x)} />
        <Field label="Produktlink" value={p.link} onChange={(x) => s('link', x)} placeholder="https://" type="url" />
        <TextArea label="Notizen" value={p.notes} onChange={(x) => s('notes', x)} />
      </div>
      {(doc || rec || p.link) && (
        <>
          <div className="section-header">Verknüpft</div>
          <div className="group">
            {doc && <button className="row" onClick={() => (onClose(), nav.push({ name: 'document', id: doc.id }))}><Icon name="doc" size={18} /><div className="row-main">{doc.title}</div></button>}
            {rec && <button className="row" onClick={() => (onClose(), nav.openRecord(rec.id))}><Icon name="clock" size={18} /><div className="row-main">{rec.title}{rec.km !== null ? ` · ${fmtKm(rec.km)}` : ''}</div></button>}
            {p.link && /^https?:\/\//i.test(p.link) && <a className="row action" href={p.link} target="_blank" rel="noopener noreferrer"><Icon name="link" size={18} /> Produktseite öffnen</a>}
          </div>
        </>
      )}
      {err && <div className="error-text">{err}</div>}
      {part && <button className="btn btn-danger btn-block mt-lg" onClick={() => setDel(true)}>Ersatzteil löschen</button>}
      <Confirm open={del} title="Ersatzteil löschen?" message="Der Eintrag wird entfernt. Belege und Historie bleiben erhalten." confirmLabel="Löschen" destructive onConfirm={() => (deletePart(p.id), onClose(), toast('Gelöscht'))} onClose={() => setDel(false)} />
    </Sheet>
  );
}
