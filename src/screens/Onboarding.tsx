import { useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Section } from '../components/ui';
import { Icon } from '../components/Icon';
import { emptyState, newVehicle } from '../data/initial';
import { buildItems } from '../data/catalog';
import type { AppState, Vehicle } from '../lib/types';
import { isValidISO } from '../lib/dates';
import { parseNum, uid } from '../lib/util';
import { VehicleFields, draftToVehicle, validateVehicleDraft, type VehicleDraft } from '../components/VehicleFields';
import appIcon from '../assets/icon.svg';
import wordmark from '../assets/wordmark-navy.svg';

type Known = { date: string; km: string };
const KNOWN: { keys: string[]; label: string; also: string[] }[] = [
  { keys: ['motoroel'], label: 'Letzter Motorölwechsel', also: ['oelfilter'] },
  { keys: ['zahnriemen'], label: 'Letzter Zahnriemenwechsel', also: [] },
  { keys: ['getriebeoel'], label: 'Letzter Getriebeölwechsel', also: [] },
  { keys: ['differential', 'hinterachsdiff'], label: 'Letzter Differentialölwechsel', also: [] },
  { keys: ['bremsfluessigkeit'], label: 'Letzter Bremsflüssigkeitswechsel', also: [] },
  { keys: ['hu'], label: 'Letzte Hauptuntersuchung (HU)', also: [] }
];

export interface WizardResult {
  vehicle: Vehicle;
  km: number | null;
  known: Record<string, Known>;
}

/** Wendet das Ergebnis des Assistenten auf den Zustand an (neues Fahrzeug inkl. bekannter Wartungen). */
export function applyWizard(s: AppState, r: WizardResult, today: string): AppState {
  const items = buildItems(r.vehicle);
  KNOWN.forEach((k) => {
    const v = r.known[k.label];
    if (!v || (!v.date && !v.km)) return;
    const lk = parseNum(v.km);
    const keys = [...k.keys, ...k.also];
    items.forEach((it) => {
      if (keys.includes(it.key)) {
        it.lastDate = v.date || null;
        it.lastKm = lk !== null && !Number.isNaN(lk) ? lk : null;
      }
    });
  });
  const mileage = r.km !== null ? [{ id: uid(), vehicleId: r.vehicle.id, date: today, km: r.km, note: 'Bei der Einrichtung erfasst', correction: false, createdAt: Date.now() }] : [];
  return { ...s, setupDone: true, vehicles: [...s.vehicles, r.vehicle], items: [...s.items, ...items], mileage: [...s.mileage, ...mileage], activeVehicleId: r.vehicle.id };
}

/** Einrichtungsassistent für ein Fahrzeug. Alles ist überspringbar. */
export function VehicleWizard({ onDone, onCancel }: { onDone: (r: WizardResult) => void; onCancel: () => void }) {
  const { today } = useStore();
  const [step, setStep] = useState(1);
  const [d, setD] = useState<VehicleDraft>({ v: newVehicle({ name: '' }), year: '', annual: '' });
  const [km, setKm] = useState('');
  const [known, setKnown] = useState<Record<string, Known>>({});
  const [error, setError] = useState<string | null>(null);
  const setK = (label: string, k: Partial<Known>) => setKnown((p) => ({ ...p, [label]: { ...(p[label] ?? { date: '', km: '' }), ...k } }));
  const veh = draftToVehicle(d);
  const available = new Set(buildItems(veh).map((i) => i.key));
  const knownList = KNOWN.filter((k) => k.keys.some((x) => available.has(x)));

  const validate = (): string | null => {
    if (step === 1) return validateVehicleDraft(d);
    if (step === 2) {
      const k = parseNum(km);
      if (k !== null && (Number.isNaN(k) || k < 0 || !Number.isInteger(k))) return 'Bitte einen gültigen Kilometerstand eingeben oder leer lassen.';
    }
    if (step === 3) {
      const cur = parseNum(km);
      for (const k of knownList) {
        const v = known[k.label];
        if (!v) continue;
        if (v.date && (!isValidISO(v.date) || v.date > today)) return `${k.label}: Datum ungültig oder in der Zukunft.`;
        const n = parseNum(v.km);
        if (n !== null && (Number.isNaN(n) || n < 0 || !Number.isInteger(n))) return `${k.label}: Kilometerstand ungültig.`;
        if (n !== null && cur !== null && !Number.isNaN(cur) && n > cur) return `${k.label}: liegt über dem aktuellen Kilometerstand.`;
      }
    }
    return null;
  };

  const finish = () => {
    const k = parseNum(km);
    onDone({ vehicle: veh, km: k !== null && !Number.isNaN(k) ? k : null, known });
  };
  const next = () => {
    const e = validate();
    if (e) return setError(e);
    setError(null);
    if (step < 3) setStep(step + 1);
    else finish();
  };

  const titles = ['', 'Fahrzeug', 'Kilometerstand', 'Bekannte Wartungen'];
  const subs = ['', 'Alles optional – später jederzeit änderbar.', 'Grundlage für Fälligkeiten und Prognosen.', 'Unbekanntes einfach leer lassen. Die Position bleibt grau, bis du sie ergänzt.'];

  return (
    <div className="onb">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="nav-btn glass-btn icon-btn" aria-label="Zurück" onClick={() => (step === 1 ? onCancel() : (setError(null), setStep(step - 1)))}>
          <Icon name="back" size={20} stroke={2.4} />
        </button>
        <button className="nav-btn glass-btn" onClick={() => (step < 3 ? (validateVehicleDraft(d) ? setError(validateVehicleDraft(d)) : setStep(step + 1)) : finish())}>
          Überspringen
        </button>
      </div>
      <div className="stepper" style={{ marginTop: 16 }} aria-label={`Schritt ${step} von 3`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <h1 className="large-title" style={{ marginBottom: 4 }}>{titles[step]}</h1>
      <p className="muted" style={{ margin: '0 2px 4px' }}>{subs[step]}</p>

      {step === 1 && <VehicleFields d={d} set={setD} showTemplate />}
      {step === 2 && (
        <Section header="Heute">
          <div className="group">
            <Field label="Kilometerstand" value={km} onChange={setKm} inputMode="numeric" unit="km" placeholder="z. B. 125000" />
          </div>
        </Section>
      )}
      {step === 3 &&
        knownList.map((k) => (
          <Section key={k.label} header={k.label}>
            <div className="group">
              <Field label="Datum" type="date" value={known[k.label]?.date ?? ''} onChange={(v) => setK(k.label, { date: v })} max={today} />
              <Field label="Kilometerstand" value={known[k.label]?.km ?? ''} onChange={(v) => setK(k.label, { km: v })} inputMode="numeric" unit="km" placeholder="unbekannt" />
            </div>
          </Section>
        ))}

      {error && (
        <div className="error-text" role="alert">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}
      <div className="onb-actions">
        <button className="btn btn-primary btn-block" onClick={next}>
          {step < 3 ? 'Weiter' : 'Fertig'}
        </button>
      </div>
    </div>
  );
}

/** Erster Start: Willkommen + Assistent. */
export function Onboarding() {
  const { update, loadSample, today } = useStore();
  const [wizard, setWizard] = useState(false);

  if (wizard)
    return (
      <VehicleWizard
        onCancel={() => setWizard(false)}
        onDone={(r) =>
          update(() => {
            const base = emptyState();
            return applyWizard({ ...base, vehicles: [], items: [] }, r, today);
          })
        }
      />
    );

  return (
    <div className="onb">
      <div className="onb-hero">
        <img className="app-icon" src={appIcon} alt="" />
        <h1 style={{ margin: '0 0 10px' }}><img src={wordmark} alt="Milewyse" style={{ height: 40, display: 'block', margin: '0 auto' }} /></h1>
        <p>Wartung, Historie und Belege – für jedes Fahrzeug.</p>
      </div>
      {[
        ['wrench', 'Wartung im Blick', 'Fälligkeiten nach Kilometer und Zeit, passend zu Kraftstoff und Antrieb.'],
        ['camera', 'Belege scannen', 'Rechnungen fotografieren – Texterkennung direkt auf dem Gerät.'],
        ['shield', 'Privat & offline', 'Keine Registrierung. Alle Daten bleiben auf deinem Gerät.']
      ].map(([icon, t, s]) => (
        <div className="feature" key={t}>
          <span className="icon-tile" style={{ width: 40, height: 40, borderRadius: 10 }}>
            <Icon name={icon} size={22} />
          </span>
          <div>
            <b>{t}</b>
            <span>{s}</span>
          </div>
        </div>
      ))}
      <div className="onb-actions">
        <button className="btn btn-primary btn-block" onClick={() => setWizard(true)}>
          Fahrzeug einrichten
        </button>
        <button className="btn btn-plain btn-block" onClick={loadSample}>
          Mit Beispieldaten ansehen
        </button>
      </div>
    </div>
  );
}
