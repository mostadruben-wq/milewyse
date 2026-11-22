import { useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Row, Section, SelectField, Sheet, TextArea, Toggle, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORIES, SOURCE_LABEL } from '../data/catalog';
import type { CategoryId, ItemKind, MaintenanceItem, SourceType } from '../lib/types';
import { isValidISO } from '../lib/dates';
import { parseNum, uid } from '../lib/util';

const SOURCES = (Object.keys(SOURCE_LABEL) as SourceType[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] }));
const str = (n: number | null) => (n === null ? '' : String(n));

export function ItemEditor({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, today, saveItem } = useStore();
  const existing = id ? state.items.find((i) => i.id === id) : undefined;
  const [it, setIt] = useState<MaintenanceItem>(
    existing ?? (() => {
      const key = 'custom-' + uid().slice(0, 8);
      return {
      id: `${state.vehicle.id}.${key}`,
      vehicleId: state.vehicle.id,
      key,
      name: '',
      category: 'motor',
      kind: 'wechsel',
      description: '',
      enabled: true,
      custom: true,
      lastDate: null,
      lastKm: null,
      intervalKm: null,
      intervalMonths: null,
      intervalSource: 'benutzer',
      warnKm: null,
      warnDays: null,
      parts: '',
      partNumbers: '',
      fluidSpec: '',
      fluidSpecSource: 'benutzer',
      capacity: '',
      capacitySource: 'benutzer',
      cost: null,
      notes: '',
      relatedIds: []
    };
    })()
  );
  const [f, setF] = useState({
    intervalKm: str(it.intervalKm),
    intervalMonths: str(it.intervalMonths),
    lastKm: str(it.lastKm),
    lastDate: it.lastDate ?? '',
    warnKm: str(it.warnKm),
    warnDays: str(it.warnDays),
    cost: it.cost === null ? '' : String(it.cost).replace('.', ',')
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MaintenanceItem>(k: K, v: MaintenanceItem[K]) => setIt((p) => ({ ...p, [k]: v }));
  const setFF = (k: keyof typeof f, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setError(null);
  };

  const intervalChanged = existing && (f.intervalKm !== str(existing.intervalKm) || f.intervalMonths !== str(existing.intervalMonths));

  const save = () => {
    if (!it.name.trim()) return setError('Bitte eine Bezeichnung eingeben.');
    const nums: Record<string, number | null> = {};
    for (const k of ['intervalKm', 'intervalMonths', 'lastKm', 'warnKm', 'warnDays', 'cost'] as const) {
      const n = parseNum(f[k]);
      if (n !== null && (Number.isNaN(n) || n < 0)) return setError('Bitte nur positive Zahlen eingeben.');
      if (n !== null && k !== 'cost' && !Number.isInteger(n)) return setError('Intervalle und Kilometer bitte als ganze Zahlen angeben.');
      nums[k] = n === 0 && (k === 'intervalKm' || k === 'intervalMonths') ? null : n;
    }
    if (f.lastDate && (!isValidISO(f.lastDate) || f.lastDate > today)) return setError('Das Datum der letzten Wartung ist ungültig oder liegt in der Zukunft.');
    let source = it.intervalSource;
    // Geänderte Intervalle gelten als eigener Wert, sofern nicht bewusst eine andere Quelle gewählt wurde
    if (intervalChanged && existing && source === existing.intervalSource && source !== 'vw') source = 'benutzer';
    saveItem({
      ...it,
      name: it.name.trim(),
      intervalKm: nums.intervalKm,
      intervalMonths: nums.intervalMonths,
      intervalSource: source,
      lastKm: nums.lastKm,
      lastDate: f.lastDate || null,
      warnKm: nums.warnKm,
      warnDays: nums.warnDays,
      cost: nums.cost
    });
    toast(existing ? 'Gespeichert' : 'Position angelegt');
    onClose();
  };

  return (
    <Sheet
      open
      title={existing ? 'Bearbeiten' : 'Neue Position'}
      onClose={onClose}
      right={
        <button className="nav-btn bold" onClick={save}>
          Sichern
        </button>
      }
    >
      <Section header="Allgemein">
        <div className="group">
          <Field label="Bezeichnung" value={it.name} onChange={(v) => set('name', v)} placeholder="z. B. Zusatzbatterie" />
          <SelectField<CategoryId> label="Kategorie" value={it.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c.id, label: c.name }))} />
          <SelectField<ItemKind>
            label="Art"
            value={it.kind}
            onChange={(v) => set('kind', v)}
            options={[
              { value: 'wechsel', label: 'Wechsel/Austausch' },
              { value: 'pruefung', label: 'Kontrolle' }
            ]}
          />
          <Row title="Aktiv" right={<Toggle label="Aktiv" checked={it.enabled} onChange={(v) => set('enabled', v)} />} />
        </div>
      </Section>

      <Section header="Intervall" footer="Es gilt die zuerst erreichte Grenze. Feld leer lassen, wenn es kein Intervall dieser Art gibt.">
        <div className="group">
          <Field label="Kilometer" value={f.intervalKm} onChange={(v) => setFF('intervalKm', v)} inputMode="numeric" unit="km" placeholder="–" />
          <Field label="Zeit" value={f.intervalMonths} onChange={(v) => setFF('intervalMonths', v)} inputMode="numeric" unit="Monate" placeholder="–" />
          <SelectField<SourceType> label="Quelle" value={it.intervalSource} onChange={(v) => set('intervalSource', v)} options={SOURCES} />
        </div>
        {it.intervalSource === 'vw' && <div className="hint">Nur wählen, wenn du den Wert selbst in VW-Unterlagen geprüft hast.</div>}
      </Section>

      <Section header="Letzte Wartung" footer="Unbekannt? Einfach leer lassen – die Position wird dann grau angezeigt.">
        <div className="group">
          <Field label="Datum" type="date" value={f.lastDate} onChange={(v) => setFF('lastDate', v)} max={today} />
          <Field label="Kilometerstand" value={f.lastKm} onChange={(v) => setFF('lastKm', v)} inputMode="numeric" unit="km" placeholder="unbekannt" />
          <Field label="Kosten" value={f.cost} onChange={(v) => setFF('cost', v)} inputMode="decimal" unit="€" placeholder="–" />
        </div>
      </Section>

      <Section header="Vorwarnung (optional)" footer={`Leer = globale Einstellung (${state.settings.warnKm.toLocaleString('de-DE')} km / ${state.settings.warnDays} Tage).`}>
        <div className="group">
          <Field label="Kilometer vorher" value={f.warnKm} onChange={(v) => setFF('warnKm', v)} inputMode="numeric" unit="km" placeholder="global" />
          <Field label="Tage vorher" value={f.warnDays} onChange={(v) => setFF('warnDays', v)} inputMode="numeric" unit="Tage" placeholder="global" />
        </div>
      </Section>

      <Section header="Betriebsstoffe & Teile">
        <div className="group">
          <Field label="Spezifikation" value={it.fluidSpec} onChange={(v) => set('fluidSpec', v)} placeholder="z. B. VW-Norm" />
          <SelectField<SourceType> label="Quelle Spez." value={it.fluidSpecSource} onChange={(v) => set('fluidSpecSource', v)} options={SOURCES} />
          <Field label="Füllmenge" value={it.capacity} onChange={(v) => set('capacity', v)} placeholder="nur verifiziert" />
          <SelectField<SourceType> label="Quelle Menge" value={it.capacitySource} onChange={(v) => set('capacitySource', v)} options={SOURCES} />
          <Field label="Ersatzteile" value={it.parts} onChange={(v) => set('parts', v)} placeholder="Hersteller, Bezeichnung" />
          <Field label="Teilenummern" value={it.partNumbers} onChange={(v) => set('partNumbers', v)} placeholder="–" />
        </div>
      </Section>

      <Section header="Text">
        <div className="group">
          <TextArea label="Beschreibung" value={it.description} onChange={(v) => set('description', v)} />
          <TextArea label="Notizen" value={it.notes} onChange={(v) => set('notes', v)} />
        </div>
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
    </Sheet>
  );
}
