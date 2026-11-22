import type { AppState, MaintenanceItem, MileageEntry, ServiceRecord, Vehicle } from '../lib/types';
import { buildItems } from './catalog';
import { addDays, todayISO } from '../lib/dates';
import { uid } from '../lib/util';

export function newVehicle(p: Partial<Vehicle> = {}): Vehicle {
  return {
    id: uid(),
    name: 'Mein Fahrzeug',
    make: '',
    model: '',
    engineCode: '',
    fuel: 'diesel',
    drive: 'front',
    template: 'generic',
    year: null,
    plate: '',
    vin: '',
    gearboxCode: '',
    annualKm: null,
    photo: null,
    ...p
  };
}

export function emptyState(): AppState {
  const v = newVehicle();
  return {
    schemaVersion: 2,
    setupDone: false,
    isSample: false,
    activeVehicleId: v.id,
    vehicles: [v],
    items: buildItems(v),
    mileage: [],
    records: [],
    parts: [],
    documents: [],
    settings: { warnKm: 1500, warnDays: 30, theme: 'light' }
  };
}

/** Migration von Version 1 (ein Fahrzeug, T4-spezifisch) auf Version 2. Es gehen keine Daten verloren. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateV1(old: any): AppState {
  const vid = uid();
  const ov = old.vehicle ?? {};
  const vehicle = newVehicle({
    id: vid,
    name: ov.name || 'Mein T4 Syncro',
    make: 'VW',
    model: (ov.model || 'T4').replace(/^VW\s*/i, ''),
    engineCode: ov.engineCode || 'AXL',
    fuel: 'diesel',
    drive: 'allrad',
    template: 't4-syncro',
    year: ov.year ?? null,
    plate: ov.plate ?? '',
    vin: ov.vin ?? '',
    gearboxCode: ov.gearboxCode ?? '',
    annualKm: ov.annualKm ?? null,
    photo: ov.photo ?? null
  });
  const idMap = (id: string) => `${vid}.${id}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: MaintenanceItem[] = (old.items ?? []).map((i: any) => ({ ...i, id: idMap(i.id), key: i.custom ? i.id : i.id, vehicleId: vid, relatedIds: (i.relatedIds ?? []).map(idMap) }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mileage: MileageEntry[] = (old.mileage ?? []).map((m: any) => ({ ...m, vehicleId: vid }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records: ServiceRecord[] = (old.records ?? []).map((r: any) => ({ ...r, vehicleId: vid, documentId: null, itemIds: (r.itemIds ?? []).map(idMap) }));
  return {
    schemaVersion: 2,
    setupDone: old.setupDone ?? true,
    isSample: old.isSample ?? false,
    activeVehicleId: vid,
    vehicles: [vehicle],
    items,
    mileage,
    records,
    parts: [],
    documents: [],
    settings: { warnKm: 1500, warnDays: 30, ...(old.settings ?? {}), theme: old.settings?.theme && old.settings.theme !== 'auto' ? old.settings.theme : 'light' }
  };
}

/**
 * BEISPIELDATEN – eindeutig gekennzeichnet (isSample = true, Banner in der App).
 * Werte sind frei gewählt und bilden KEIN echtes Fahrzeug ab.
 */
export function sampleState(now = new Date()): AppState {
  const today = todayISO(now);
  const s = emptyState();
  s.setupDone = true;
  s.isSample = true;
  const v = newVehicle({ name: 'T4 Syncro (Beispiel)', make: 'VW', model: 'T4', engineCode: 'AXL', fuel: 'diesel', drive: 'allrad', template: 't4-syncro', year: 2001, plate: 'S-XY 2001', annualKm: 14000 });
  const v2 = newVehicle({ name: 'Golf (Beispiel)', make: 'VW', model: 'Golf VII', engineCode: '', fuel: 'benzin', drive: 'front', template: 'generic', year: 2016, plate: 'S-AB 123', annualKm: 9000 });
  s.vehicles = [v, v2];
  s.activeVehicleId = v.id;
  s.items = [...buildItems(v), ...buildItems(v2)];

  const mk = (vid: string, days: number[], kms: number[]) =>
    days.map<MileageEntry>((d, i) => ({ id: uid(), vehicleId: vid, date: addDays(today, d), km: kms[i], note: '', correction: false, createdAt: i }));
  s.mileage = [
    ...mk(v.id, [-540, -450, -365, -300, -240, -180, -120, -75, -30, 0], [236300, 239800, 243100, 245600, 247900, 250000, 252400, 254200, 255900, 257500]),
    ...mk(v2.id, [-400, -200, -10], [81200, 85900, 90700])
  ];

  const set = (vid: string, key: string, daysAgo: number, atKm: number | null, extra: Partial<MaintenanceItem> = {}) => {
    const it = s.items.find((x) => x.id === `${vid}.${key}`);
    if (!it) return;
    it.lastDate = addDays(today, -daysAgo);
    it.lastKm = atKm;
    Object.assign(it, extra);
  };
  set(v.id, 'motoroel', 180, 250000, { intervalKm: 10000 });
  set(v.id, 'oelfilter', 180, 250000, { intervalKm: 10000 });
  set(v.id, 'luftfilter', 540, 236300);
  set(v.id, 'kraftstofffilter', 700, 229000);
  for (const k of ['zahnriemen', 'zahnriemenspanner', 'wasserpumpe']) set(v.id, k, 900, 221000, { intervalKm: 90000, intervalMonths: 60, intervalSource: 'benutzer' });
  set(v.id, 'bremsfluessigkeit', 700, 229000);
  set(v.id, 'belaege_vorne', 340, 244000);
  set(v.id, 'scheiben_vorne', 340, 244000);
  set(v.id, 'rost', 380, 242800);
  set(v.id, 'unterboden', 380, 242800);
  set(v.id, 'reifen', 160, 250600);
  set(v.id, 'hu', 690, 229500);
  set(v.id, 'visco', 350, 243500);
  set(v2.id, 'motoroel', 300, 84000);
  set(v2.id, 'oelfilter', 300, 84000);
  set(v2.id, 'hu', 500, 82000);

  const rec = (vid: string, daysAgo: number, atKm: number, title: string, keys: string[], cat: ServiceRecord['category'], parts: number | null, labor: number | null, doneBy: ServiceRecord['doneBy'], workshop = ''): ServiceRecord => ({
    id: uid(),
    vehicleId: vid,
    date: addDays(today, -daysAgo),
    km: atKm,
    title,
    category: cat,
    type: 'wartung',
    itemIds: keys.map((k) => `${vid}.${k}`),
    description: '',
    doneBy,
    workshop,
    costParts: parts,
    costLabor: labor,
    notes: 'Beispieldaten',
    documentId: null,
    createdAt: daysAgo
  });
  s.records = [
    rec(v.id, 180, 250000, 'Ölwechsel mit Filter', ['motoroel', 'oelfilter'], 'motor', 89, null, 'selbst'),
    rec(v.id, 340, 244000, 'Bremsbeläge und -scheiben vorne', ['belaege_vorne', 'scheiben_vorne'], 'bremsen', 210, 120, 'werkstatt', 'Beispiel-Werkstatt'),
    rec(v.id, 380, 242800, 'Jährliche Rost- und Unterbodenkontrolle', ['rost', 'unterboden'], 'karosserie', null, null, 'selbst'),
    rec(v.id, 900, 221000, 'Zahnriemen mit Spanner und Wasserpumpe', ['zahnriemen', 'zahnriemenspanner', 'wasserpumpe'], 'motor', 420, 380, 'werkstatt', 'Beispiel-Werkstatt'),
    rec(v2.id, 300, 84000, 'Inspektion mit Ölwechsel', ['motoroel', 'oelfilter'], 'motor', 95, 85, 'werkstatt', 'Beispiel-Autohaus')
  ];
  return s;
}
