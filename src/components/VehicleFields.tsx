import { Field, SelectField } from './ui';
import type { DriveType, FuelType, TemplateId, Vehicle } from '../lib/types';
import { TEMPLATES } from '../data/catalog';

export const FUEL_LABEL: Record<FuelType, string> = { diesel: 'Diesel', benzin: 'Benzin', hybrid: 'Hybrid', elektro: 'Elektro', gas: 'Gas (LPG/CNG)' };
export const DRIVE_LABEL: Record<DriveType, string> = { front: 'Frontantrieb', heck: 'Heckantrieb', allrad: 'Allrad' };

export interface VehicleDraft {
  v: Vehicle;
  year: string;
  annual: string;
}

/** Formularfelder für ein Fahrzeug – herstellerunabhängig. */
export function VehicleFields({ d, set, showTemplate }: { d: VehicleDraft; set: (d: VehicleDraft) => void; showTemplate?: boolean }) {
  const sv = <K extends keyof Vehicle>(k: K, val: Vehicle[K]) => set({ ...d, v: { ...d.v, [k]: val } });
  return (
    <>
      <div className="section-header">Fahrzeug</div>
      <div className="group">
        <Field label="Name" value={d.v.name} onChange={(x) => sv('name', x)} placeholder="z. B. Familienauto" />
        <Field label="Marke" value={d.v.make} onChange={(x) => sv('make', x)} placeholder="z. B. VW, BMW, Toyota" />
        <Field label="Modell" value={d.v.model} onChange={(x) => sv('model', x)} placeholder="z. B. Golf VII" />
        <Field label="Baujahr" value={d.year} onChange={(x) => set({ ...d, year: x })} inputMode="numeric" placeholder="optional" />
        <Field label="Kennzeichen" value={d.v.plate} onChange={(x) => sv('plate', x.toUpperCase())} placeholder="optional" />
      </div>
      <div className="section-header">Technik</div>
      <div className="group">
        <SelectField<FuelType> label="Kraftstoff" value={d.v.fuel} onChange={(x) => sv('fuel', x)} options={(Object.keys(FUEL_LABEL) as FuelType[]).map((k) => ({ value: k, label: FUEL_LABEL[k] }))} />
        <SelectField<DriveType> label="Antrieb" value={d.v.drive} onChange={(x) => sv('drive', x)} options={(Object.keys(DRIVE_LABEL) as DriveType[]).map((k) => ({ value: k, label: DRIVE_LABEL[k] }))} />
        <Field label="Motorcode" value={d.v.engineCode} onChange={(x) => sv('engineCode', x.toUpperCase())} placeholder="optional" />
        <Field label="Getriebe-Code" value={d.v.gearboxCode} onChange={(x) => sv('gearboxCode', x.toUpperCase())} placeholder="optional" />
        <Field label="FIN" value={d.v.vin} onChange={(x) => sv('vin', x)} placeholder="optional, 17 Zeichen" />
        <Field label="Fahrleistung/Jahr" value={d.annual} onChange={(x) => set({ ...d, annual: x })} inputMode="numeric" unit="km" placeholder="geschätzt" />
      </div>
      {showTemplate && (
        <>
          <div className="section-header">Wartungsliste</div>
          <div className="group">
            <SelectField<TemplateId> label="Vorlage" value={d.v.template} onChange={(x) => sv('template', x)} options={TEMPLATES.map((t) => ({ value: t.id, label: t.name }))} />
          </div>
          <div className="section-footer">{TEMPLATES.find((t) => t.id === d.v.template)?.description} Positionen lassen sich später jederzeit ein- und ausblenden.</div>
        </>
      )}
    </>
  );
}

export function validateVehicleDraft(d: VehicleDraft): string | null {
  const y = d.year.trim() ? Number(d.year) : null;
  if (y !== null && (!Number.isInteger(y) || y < 1900 || y > new Date().getFullYear() + 1)) return 'Bitte ein plausibles Baujahr eingeben oder leer lassen.';
  const a = d.annual.trim() ? Number(d.annual.replace(/\./g, '')) : null;
  if (a !== null && (!Number.isFinite(a) || a < 0 || a > 300000)) return 'Bitte eine plausible Jahresfahrleistung eingeben oder leer lassen.';
  if (d.v.vin.trim() && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(d.v.vin.trim())) return 'Die FIN hat 17 Zeichen (ohne I, O, Q) – oder leer lassen.';
  return null;
}

export function draftToVehicle(d: VehicleDraft): Vehicle {
  return {
    ...d.v,
    name: d.v.name.trim() || [d.v.make, d.v.model].filter(Boolean).join(' ') || 'Mein Fahrzeug',
    make: d.v.make.trim(),
    model: d.v.model.trim(),
    vin: d.v.vin.trim().toUpperCase(),
    plate: d.v.plate.trim().toUpperCase(),
    year: d.year.trim() ? Number(d.year) : null,
    annualKm: d.annual.trim() ? Number(d.annual.replace(/\./g, '')) : null
  };
}

export const vehicleSubtitle = (v: Vehicle) => [[v.make, v.model].filter(Boolean).join(' '), v.engineCode, v.year ? String(v.year) : ''].filter(Boolean).join(' · ') || FUEL_LABEL[v.fuel];
