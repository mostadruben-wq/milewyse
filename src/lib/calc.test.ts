import { describe, expect, it } from 'vitest';
import { computeDue, compareUrgency } from './maintenance';
import { averageRate, currentKm, daysUntilKm, validateMileage } from './mileage';
import { addMonths, daysBetween, relativeDays } from './dates';
import type { MaintenanceItem, MileageEntry } from './types';
import { buildItems } from '../data/catalog';

const settings = { warnKm: 1500, warnDays: 30 };

function item(p: Partial<MaintenanceItem>): MaintenanceItem {
  return { ...buildItems({ id: 'v', fuel: 'diesel', drive: 'allrad', template: 't4-syncro' })[0], ...p };
}

function entry(date: string, km: number, correction = false, i = 0): MileageEntry {
  return { id: date + km, vehicleId: 'v', date, km, note: correction ? 'Korrektur' : '', correction, createdAt: i };
}

describe('Datumsfunktionen', () => {
  it('addiert Monate mit Monatsende-Begrenzung', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-11-15', 3)).toBe('2025-02-15');
    expect(addMonths('2024-05-10', 24)).toBe('2026-05-10');
  });
  it('zählt Tage zwischen Daten', () => {
    expect(daysBetween('2024-01-01', '2024-12-31')).toBe(365);
    expect(daysBetween('2024-03-31', '2024-03-30')).toBe(-1);
  });
  it('formuliert relative Zeitangaben', () => {
    expect(relativeDays(0)).toBe('heute');
    expect(relativeDays(91)).toBe('in 3 Monaten');
    expect(relativeDays(-3)).toBe('vor 3 Tagen');
  });
});

describe('Wartungsfälligkeit', () => {
  it('rechnet das Beispiel aus dem Lastenheft korrekt', () => {
    const d = computeDue(item({ lastKm: 250000, intervalKm: 10000, intervalMonths: null }), 257500, '2025-06-01', settings);
    expect(d.nextKm).toBe(260000);
    expect(d.remainingKm).toBe(2500);
    expect(d.status).toBe('ok');
  });

  it('meldet „bald fällig“ innerhalb der Vorwarnschwelle', () => {
    const d = computeDue(item({ lastKm: 250000, intervalKm: 10000, intervalMonths: null }), 258600, '2025-06-01', settings);
    expect(d.remainingKm).toBe(1400);
    expect(d.status).toBe('soon');
  });

  it('meldet „überfällig“ bei erreichter oder überschrittener Grenze', () => {
    expect(computeDue(item({ lastKm: 250000, intervalKm: 10000, intervalMonths: null }), 260000, '2025-06-01', settings).status).toBe('overdue');
    expect(computeDue(item({ lastKm: 250000, intervalKm: 10000, intervalMonths: null }), 262000, '2025-06-01', settings).remainingKm).toBe(-2000);
  });

  it('wendet die zuerst erreichte Grenze an (Zeit vor Kilometer)', () => {
    const d = computeDue(
      item({ lastKm: 250000, lastDate: '2024-05-01', intervalKm: 10000, intervalMonths: 12 }),
      252000,
      '2025-06-01',
      settings
    );
    expect(d.nextDate).toBe('2025-05-01');
    expect(d.remainingKm).toBe(8000);
    expect(d.status).toBe('overdue');
    expect(d.decisive).toBe('date');
  });

  it('wählt bei gleichem Status die früher erreichte Grenze über die Fahrleistung', () => {
    const rate = { kmPerMonth: 1000, basis: 'log' as const, spanDays: 300, confidence: 'hoch' as const };
    const d = computeDue(
      item({ lastKm: 250000, lastDate: '2025-01-01', intervalKm: 10000, intervalMonths: 12 }),
      258000,
      '2025-03-01',
      settings,
      rate
    );
    // 2.000 km bei 1.000 km/Monat ≈ 61 Tage < 306 Tage bis Datum
    expect(d.decisive).toBe('km');
    expect(d.estimated).toBe(true);
    expect(d.estimatedDays).toBe(61);
  });

  it('respektiert individuelle Vorwarnschwellen', () => {
    const d = computeDue(item({ lastKm: 250000, intervalKm: 10000, intervalMonths: null, warnKm: 3000 }), 257500, '2025-06-01', settings);
    expect(d.status).toBe('soon');
  });

  it('meldet Zeitstatus „bald“ innerhalb der Tage-Schwelle', () => {
    const d = computeDue(item({ lastDate: '2024-06-20', lastKm: null, intervalKm: null, intervalMonths: 12 }), 257500, '2025-06-01', settings);
    expect(d.remainingDays).toBe(19);
    expect(d.status).toBe('soon');
  });

  it('kennzeichnet fehlende Historie und fehlende Intervalle als unbekannt', () => {
    expect(computeDue(item({ lastKm: null, lastDate: null }), 257500, '2025-06-01', settings)).toMatchObject({ status: 'unknown', unknownReason: 'noHistory' });
    expect(computeDue(item({ intervalKm: null, intervalMonths: null, lastKm: 1 }), 257500, '2025-06-01', settings)).toMatchObject({ status: 'unknown', unknownReason: 'noInterval' });
    expect(computeDue(item({ lastKm: 1000, lastDate: null, intervalMonths: null }), null, '2025-06-01', settings)).toMatchObject({ status: 'unknown', unknownReason: 'noMileage' });
  });

  it('rechnet mit der bekannten Dimension, wenn die andere fehlt', () => {
    const d = computeDue(item({ lastKm: null, lastDate: '2025-01-01', intervalKm: 10000, intervalMonths: 12 }), 257500, '2025-06-01', settings);
    expect(d.status).toBe('ok');
    expect(d.nextKm).toBeNull();
    expect(d.nextDate).toBe('2026-01-01');
  });

  it('gibt deaktivierte Positionen als inaktiv zurück', () => {
    expect(computeDue(item({ enabled: false, lastKm: 0 }), 257500, '2025-06-01', settings).status).toBe('inactive');
  });

  it('sortiert nach Dringlichkeit', () => {
    const over = computeDue(item({ lastKm: 240000, intervalKm: 10000, intervalMonths: null }), 257500, '2025-06-01', settings);
    const soon = computeDue(item({ lastKm: 248000, intervalKm: 10000, intervalMonths: null }), 257500, '2025-06-01', settings);
    const ok = computeDue(item({ lastKm: 255000, intervalKm: 10000, intervalMonths: null }), 257500, '2025-06-01', settings);
    const unk = computeDue(item({ lastKm: null, lastDate: null }), 257500, '2025-06-01', settings);
    expect([ok, unk, soon, over].sort(compareUrgency).map((d) => d.status)).toEqual(['overdue', 'soon', 'ok', 'unknown']);
  });
});

describe('Kilometerstand', () => {
  const log = [entry('2025-01-01', 250000), entry('2025-04-01', 253600), entry('2025-07-01', 257200)];

  it('liefert den jüngsten Stand', () => {
    expect(currentKm(log)).toBe(257200);
    expect(currentKm([])).toBeNull();
  });

  it('verhindert versehentliche Rücksprünge', () => {
    const r = validateMileage(log, { date: '2025-08-01', km: 257000, correction: false, note: '' }, '2025-08-02');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('rollback');
  });

  it('verhindert Widersprüche zu späteren Einträgen', () => {
    const r = validateMileage(log, { date: '2025-05-01', km: 258000, correction: false, note: '' }, '2025-08-02');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('future_conflict');
  });

  it('erlaubt dokumentierte Korrekturen nur mit Begründung', () => {
    expect(validateMileage(log, { date: '2025-08-01', km: 200000, correction: true, note: '' }, '2025-08-02').ok).toBe(false);
    expect(validateMileage(log, { date: '2025-08-01', km: 200000, correction: true, note: 'Tachotausch' }, '2025-08-02').ok).toBe(true);
  });

  it('lehnt ungültige Eingaben und Zukunftsdaten ab', () => {
    expect(validateMileage(log, { date: '2025-08-01', km: -5, correction: false, note: '' }, '2025-08-02').ok).toBe(false);
    expect(validateMileage(log, { date: '2025-08-01', km: 1.5, correction: false, note: '' }, '2025-08-02').ok).toBe(false);
    expect(validateMileage(log, { date: '2025-09-01', km: 260000, correction: false, note: '' }, '2025-08-02').ok).toBe(false);
  });

  it('berechnet die durchschnittliche Fahrleistung (≈ 1.200 km/Monat)', () => {
    const r = averageRate(log, '2025-07-01', null)!;
    expect(r.basis).toBe('log');
    // 7.200 km in 181 Tagen → ca. 1.211 km/Monat
    expect(Math.abs(r.kmPerMonth - 1200)).toBeLessThan(15);
  });

  it('prognostiziert die Fälligkeit: 3.600 km bei 1.200 km/Monat ≈ 3 Monate', () => {
    const r = averageRate(log, '2025-07-01', null)!;
    const days = daysUntilKm(3600, r)!;
    expect(Math.round(days / 30.4375)).toBe(3);
  });

  it('rechnet nach einer Korrektur nur ab der Korrektur', () => {
    const withCorr = [...log, entry('2025-07-15', 150000, true, 1), entry('2025-10-15', 153600, false, 2)];
    const r = averageRate(withCorr, '2025-10-15', null)!;
    expect(Math.round(r.kmPerMonth)).toBe(1191);
  });

  it('fällt auf die angegebene Jahresfahrleistung zurück', () => {
    const r = averageRate([entry('2025-07-01', 257200)], '2025-07-01', 15000)!;
    expect(r.basis).toBe('angabe');
    expect(r.kmPerMonth).toBe(1250);
    expect(averageRate([], '2025-07-01', null)).toBeNull();
  });
});

import { toggleGroup, isHidden, expandIds, resolveToGroup } from './groups';
import { applyComplete } from './store';
import { emptyState, newVehicle } from '../data/initial';

describe('Zahnriemen-Set (optional)', () => {
  const make = () => {
    const s = emptyState();
    const v = newVehicle({ id: 'v1', template: 't4-syncro', fuel: 'diesel', drive: 'allrad' });
    const items = buildItems(v).map((i) => (i.key === 'zahnriemen' ? { ...i, lastDate: '2023-05-01', lastKm: 200000, intervalKm: 90000, intervalMonths: 60 } : i));
    return { ...s, vehicles: [v], activeVehicleId: 'v1', items };
  };
  it('fasst vier Positionen zu einer zusammen und übernimmt Intervall und Stand', () => {
    const s = toggleGroup(make(), 'v1', 'zahnriemen_set', true);
    const v = s.vehicles[0];
    const set = s.items.find((i) => i.id === 'v1.zahnriemen_set')!;
    expect(set).toMatchObject({ name: 'Zahnriemen-Set', intervalKm: 90000, lastKm: 200000, enabled: true });
    const visible = s.items.filter((i) => !isHidden(i, v)).map((i) => i.key);
    expect(visible).toContain('zahnriemen_set');
    expect(visible).not.toContain('zahnriemen');
    expect(visible).not.toContain('wasserpumpe');
    expect(visible).not.toContain('umlenkrollen');
    expect(visible).not.toContain('zahnriemenspanner');
  });
  it('schreibt beim Eintragen alle Einzelpositionen mit fort', () => {
    const s = toggleGroup(make(), 'v1', 'zahnriemen_set', true);
    expect(expandIds(['v1.zahnriemen_set'], s.items)).toHaveLength(5);
    const r = applyComplete(s, { itemIds: ['v1.zahnriemen_set'], date: '2026-10-01', km: 290000, title: 'Zahnriemen-Set', description: '', doneBy: 'werkstatt', workshop: '', costParts: null, costLabor: null, notes: '', vehicleId: 'v1' }).state;
    for (const k of ['zahnriemen_set', 'zahnriemen', 'zahnriemenspanner', 'umlenkrollen', 'wasserpumpe']) expect(r.items.find((i) => i.id === `v1.${k}`)?.lastKm).toBe(290000);
  });
  it('ordnet erkannte Einzelteile dem aktiven Set zu', () => {
    const s = toggleGroup(make(), 'v1', 'zahnriemen_set', true);
    expect(resolveToGroup('v1.wasserpumpe', s.items, s.vehicles[0])).toBe('v1.zahnriemen_set');
    expect(resolveToGroup('v1.wasserpumpe', make().items, make().vehicles[0])).toBe('v1.wasserpumpe');
  });
  it('gibt beim Ausschalten keine Daten verloren', () => {
    let s = toggleGroup(make(), 'v1', 'zahnriemen_set', true);
    s = applyComplete(s, { itemIds: ['v1.zahnriemen_set'], date: '2026-10-01', km: 290000, title: 'Set', description: '', doneBy: 'selbst', workshop: '', costParts: null, costLabor: null, notes: '', vehicleId: 'v1' }).state;
    s = toggleGroup(s, 'v1', 'zahnriemen_set', false);
    const v = s.vehicles[0];
    expect(s.items.find((i) => i.id === 'v1.zahnriemen_set') && isHidden(s.items.find((i) => i.id === 'v1.zahnriemen_set')!, v)).toBe(true);
    expect(s.items.find((i) => i.id === 'v1.wasserpumpe')).toMatchObject({ lastKm: 290000, lastDate: '2026-10-01' });
  });
});
