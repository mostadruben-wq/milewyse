import type { MaintenanceItem, Settings, Status } from './types';
import { addMonths, daysBetween } from './dates';
import { daysUntilKm, type MileageRate } from './mileage';

export type UnknownReason = 'noInterval' | 'noHistory' | 'noMileage' | null;

export interface DueInfo {
  status: Status;
  unknownReason: UnknownReason;
  nextKm: number | null;
  nextDate: string | null;
  remainingKm: number | null;
  remainingDays: number | null;
  /** Welche Grenze maßgeblich ist („die zuerst erreichte Grenze gilt“) */
  decisive: 'km' | 'date' | null;
  /** Geschätzte Tage bis Fälligkeit (Kilometer über Fahrleistung umgerechnet bzw. Datum) */
  estimatedDays: number | null;
  estimated: boolean;
  /** Anteil des verbrauchten Intervalls (0..1+), für Fortschrittsbalken */
  progress: number | null;
}

const RANK: Record<Status, number> = { overdue: 4, soon: 3, ok: 2, unknown: 1, inactive: 0 };

export const STATUS_LABEL: Record<Status, string> = {
  ok: 'In Ordnung',
  soon: 'Bald fällig',
  overdue: 'Überfällig',
  unknown: 'Unbekannt',
  inactive: 'Deaktiviert'
};

/**
 * Berechnet Fälligkeit und Status einer Wartungsposition.
 * Beispiel: letzter Wechsel 250.000 km, Intervall 10.000 km, aktuell 257.500 km
 * → nächster Wechsel bei 260.000 km, Reststrecke 2.500 km.
 * Sind Kilometer- und Zeitintervall hinterlegt, gilt die zuerst erreichte Grenze.
 */
export function computeDue(
  item: MaintenanceItem,
  currentKm: number | null,
  today: string,
  settings: Pick<Settings, 'warnKm' | 'warnDays'>,
  rate: MileageRate | null = null
): DueInfo {
  const base: DueInfo = {
    status: 'unknown',
    unknownReason: null,
    nextKm: null,
    nextDate: null,
    remainingKm: null,
    remainingDays: null,
    decisive: null,
    estimatedDays: null,
    estimated: false,
    progress: null
  };
  if (!item.enabled) return { ...base, status: 'inactive' };

  const hasKmInterval = !!item.intervalKm && item.intervalKm > 0;
  const hasTimeInterval = !!item.intervalMonths && item.intervalMonths > 0;
  if (!hasKmInterval && !hasTimeInterval) return { ...base, unknownReason: 'noInterval' };

  const warnKm = item.warnKm ?? settings.warnKm;
  const warnDays = item.warnDays ?? settings.warnDays;

  let kmStatus: Status | null = null;
  let dateStatus: Status | null = null;
  const info = { ...base };
  const progresses: number[] = [];

  if (hasKmInterval && item.lastKm !== null && currentKm !== null) {
    info.nextKm = item.lastKm + item.intervalKm!;
    info.remainingKm = info.nextKm - currentKm;
    kmStatus = info.remainingKm <= 0 ? 'overdue' : info.remainingKm <= warnKm ? 'soon' : 'ok';
    progresses.push((currentKm - item.lastKm) / item.intervalKm!);
  }
  if (hasTimeInterval && item.lastDate) {
    info.nextDate = addMonths(item.lastDate, item.intervalMonths!);
    info.remainingDays = daysBetween(today, info.nextDate);
    dateStatus = info.remainingDays <= 0 ? 'overdue' : info.remainingDays <= warnDays ? 'soon' : 'ok';
    const total = daysBetween(item.lastDate, info.nextDate);
    if (total > 0) progresses.push(daysBetween(item.lastDate, today) / total);
  }

  if (!kmStatus && !dateStatus) {
    const noMileage = hasKmInterval && item.lastKm !== null && currentKm === null;
    return { ...base, unknownReason: noMileage ? 'noMileage' : 'noHistory' };
  }

  const kmDays = info.remainingKm !== null ? (info.remainingKm <= 0 ? 0 : daysUntilKm(info.remainingKm, rate)) : null;

  // Maßgebliche Grenze bestimmen
  if (kmStatus && dateStatus) {
    if (RANK[kmStatus] !== RANK[dateStatus]) {
      info.decisive = RANK[kmStatus] > RANK[dateStatus] ? 'km' : 'date';
    } else if (kmDays !== null) {
      info.decisive = kmDays < info.remainingDays! ? 'km' : 'date';
    } else {
      info.decisive = 'km';
    }
  } else {
    info.decisive = kmStatus ? 'km' : 'date';
  }

  info.status = RANK[kmStatus ?? 'unknown'] >= RANK[dateStatus ?? 'unknown'] ? kmStatus! : dateStatus!;

  if (info.decisive === 'date') {
    info.estimatedDays = info.remainingDays;
    info.estimated = false;
  } else {
    info.estimatedDays = kmDays;
    info.estimated = kmDays !== null;
    if (info.remainingDays !== null && kmDays !== null) info.estimatedDays = Math.min(kmDays, info.remainingDays);
  }
  info.progress = progresses.length ? Math.max(...progresses) : null;
  return info;
}

export function statusRank(s: Status) {
  return RANK[s];
}

/** Sortierung nach Dringlichkeit: überfällig → bald → ok (nach Restzeit) → unbekannt → inaktiv */
export function compareUrgency(a: DueInfo, b: DueInfo): number {
  if (RANK[a.status] !== RANK[b.status]) return RANK[b.status] - RANK[a.status];
  const da = a.estimatedDays ?? a.remainingDays ?? Number.POSITIVE_INFINITY;
  const db = b.estimatedDays ?? b.remainingDays ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return (a.remainingKm ?? Number.POSITIVE_INFINITY) - (b.remainingKm ?? Number.POSITIVE_INFINITY);
}

export interface StatusCounts {
  ok: number;
  soon: number;
  overdue: number;
  unknown: number;
  inactive: number;
  active: number;
}

export function countStatuses(dues: DueInfo[]): StatusCounts {
  const c: StatusCounts = { ok: 0, soon: 0, overdue: 0, unknown: 0, inactive: 0, active: 0 };
  dues.forEach((d) => {
    c[d.status]++;
    if (d.status !== 'inactive') c.active++;
  });
  return c;
}

/** Markiert eine Position als erledigt (setzt letzte Wartung auf Datum/Kilometer). */
export function markDone(item: MaintenanceItem, date: string, km: number | null): MaintenanceItem {
  return { ...item, lastDate: date, lastKm: km ?? item.lastKm };
}
