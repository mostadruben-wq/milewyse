import { useState } from 'react';
import { useStore } from '../lib/store';
import { Confirm, Field, Section, Segmented, SelectField, Sheet, TextArea, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORIES } from '../data/catalog';
import type { CategoryId, ServiceRecord } from '../lib/types';
import { isValidISO } from '../lib/dates';
import { fmtEur, parseNum, uid } from '../lib/util';

const money = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));

/** Historieneintrag anlegen (Reparatur) oder bearbeiten/löschen (Wartung & Reparatur). */
export function RecordSheet({ id, type, onClose }: { id: string | null; type: 'wartung' | 'reparatur'; onClose: () => void }) {
  const { state, root, today, km, saveRecord, deleteRecord, update } = useStore();
  const existing = id ? state.records.find((r) => r.id === id) : undefined;
  const [r, setR] = useState<ServiceRecord>(
    existing ?? {
      id: uid(),
      vehicleId: state.vehicle.id,
      documentId: null,
      date: today,
      km,
      title: '',
      category: 'motor',
      type,
      itemIds: [],
      description: '',
      doneBy: 'selbst',
      workshop: '',
      costParts: null,
      costLabor: null,
      notes: '',
      createdAt: Date.now()
    }
  );
  const [kmStr, setKmStr] = useState(r.km === null ? '' : String(r.km));
  const [parts, setParts] = useState(money(r.costParts));
  const [labor, setLabor] = useState(money(r.costLabor));
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = <K extends keyof ServiceRecord>(k: K, v: ServiceRecord[K]) => setR((p) => ({ ...p, [k]: v }));

  const save = () => {
    if (!r.title.trim()) return setError('Bitte einen Titel eingeben.');
    if (!isValidISO(r.date) || r.date > today) return setError('Bitte ein gültiges Datum (nicht in der Zukunft) wählen.');
    const k = parseNum(kmStr);
    if (k !== null && (Number.isNaN(k) || k < 0 || !Number.isInteger(k))) return setError('Bitte einen gültigen Kilometerstand eingeben.');
    const p = parseNum(parts);
    const l = parseNum(labor);
    if ([p, l].some((c) => c !== null && (Number.isNaN(c) || c < 0))) return setError('Bitte gültige Kosten eingeben.');
    const next = { ...r, title: r.title.trim(), km: k, costParts: p, costLabor: l };
    saveRecord(next);
    // Verknüpfte Wartungspositionen nachziehen, wenn Datum/km dieses Eintrags geändert wurden
    if (existing && existing.itemIds.length && (existing.date !== next.date || existing.km !== next.km)) {
      update((s) => ({
        ...s,
        items: s.items.map((i) => (existing.itemIds.includes(i.id) && i.lastDate === existing.date ? { ...i, lastDate: next.date, lastKm: next.km } : i))
      }));
    }
    toast('Gespeichert');
    onClose();
  };

  const linked = r.itemIds.map((i) => state.items.find((x) => x.id === i)?.name).filter(Boolean);
  const pN = parseNum(parts);
  const lN = parseNum(labor);
  const total = (pN && !Number.isNaN(pN) ? pN : 0) + (lN && !Number.isNaN(lN) ? lN : 0);

  return (
    <Sheet
      open
      title={existing ? (existing.type === 'wartung' ? 'Wartung' : 'Reparatur') : 'Reparatur dokumentieren'}
      onClose={onClose}
      right={
        <button className="nav-btn bold" onClick={save}>
          Sichern
        </button>
      }
    >
      <div style={{ margin: '4px 0 6px' }}>
        <Segmented
          label="Art"
          value={r.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'reparatur', label: 'Reparatur' },
            { value: 'wartung', label: 'Wartung' }
          ]}
        />
      </div>
      <Section header="Eintrag">
        <div className="group">
          <Field label="Titel" value={r.title} onChange={(v) => { set('title', v); setError(null); }} placeholder="z. B. Auspuff geschweißt" />
          <SelectField<CategoryId> label="Kategorie" value={r.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} />
          <Field label="Datum" type="date" value={r.date} onChange={(v) => set('date', v)} max={today} />
          <Field label="Kilometerstand" value={kmStr} onChange={setKmStr} inputMode="numeric" unit="km" placeholder="optional" />
        </div>
        {linked.length > 0 && <div className="hint">Verknüpfte Wartungspositionen: {linked.join(', ')}</div>}
        {r.documentId && <div className="hint">Mit Beleg verknüpft: „{root.documents.find((d) => d.id === r.documentId)?.title ?? 'gelöscht'}“. Die Kosten zählen über den Beleg.</div>}
      </Section>

      <Section header="Durchführung & Kosten">
        <div style={{ margin: '0 0 10px' }}>
          <Segmented
            label="Durchgeführt von"
            value={r.doneBy}
            onChange={(v) => set('doneBy', v)}
            options={[
              { value: 'selbst', label: 'Selbst' },
              { value: 'werkstatt', label: 'Werkstatt' }
            ]}
          />
        </div>
        <div className="group">
          {r.doneBy === 'werkstatt' && <Field label="Werkstatt" value={r.workshop} onChange={(v) => set('workshop', v)} placeholder="Name" />}
          <Field label="Teilekosten" value={parts} onChange={setParts} inputMode="decimal" unit="€" placeholder="0,00" />
          <Field label="Arbeitskosten" value={labor} onChange={setLabor} inputMode="decimal" unit="€" placeholder="0,00" />
          <div className="field">
            <label>Gesamt</label>
            <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtEur(total)}</span>
          </div>
        </div>
      </Section>

      <Section header="Details">
        <div className="group">
          <TextArea label="Beschreibung" value={r.description} onChange={(v) => set('description', v)} placeholder="Ursache, Arbeiten, Teile, Hersteller, Teilenummern …" />
          <TextArea label="Notizen" value={r.notes} onChange={(v) => set('notes', v)} />
        </div>
        <div className="hint">Rechnungen fügst du über „Dokument scannen“ hinzu und verknüpfst sie dort.</div>
      </Section>

      {error && (
        <div className="error-text" role="alert">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}
      <button className="btn btn-primary btn-block mt-lg" onClick={save}>
        Sichern
      </button>
      {existing && (
        <button className="btn btn-danger btn-block mt" onClick={() => setConfirmDel(true)}>
          Eintrag löschen
        </button>
      )}
      <Confirm
        open={confirmDel}
        title="Eintrag löschen?"
        message={existing?.itemIds.length ? 'Die betroffenen Wartungspositionen werden auf den vorherigen Historieneintrag zurückgesetzt.' : 'Dies kann nicht rückgängig gemacht werden.'}
        confirmLabel="Löschen"
        destructive
        onConfirm={() => {
          deleteRecord(r.id);
          toast('Gelöscht');
          onClose();
        }}
        onClose={() => setConfirmDel(false)}
      />
    </Sheet>
  );
}
