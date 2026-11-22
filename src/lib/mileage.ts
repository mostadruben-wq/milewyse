import type { MileageEntry } from './types';
import { addDays, daysBetween } from './dates';

export const DAYS_PER_MONTH = 30.4375;

export function sortEntries(entries: MileageEntry[]): MileageEntry[] {
  return [...entries].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
}

/** Aktueller Kilometerstand = jüngster Eintrag (Korrekturen eingeschlossen). */
export function currentKm(entries: MileageEntry[]): number | null {
  if (!entries.length) return null;
  const s = sortEntries(entries);
  return s[s.length - 1].km;
}

export function latestEntry(entries: MileageEntry[]): MileageEntry | null {
  if (!entries.length) return null;
  const s = sortEntries(entries);
  return s[s.length - 1];
}

export type ValidationResult = { ok: true } | { ok: false; code: 'invalid' | 'rollback' | 'future_conflict' | 'reason_missing' | 'implausible'; message: string };

const nf = (n: number) => n.toLocaleString('de-DE');

/**
 * Prüft einen neuen Kilometerstand.
 * - Normale Einträge dürfen nicht unter dem letzten Stand (bis zum gleichen Datum) liegen
 *   und nicht über einem späteren Eintrag.
 * - Korrekturen sind ausdrücklich erlaubt, brauchen aber eine Begründung.
 */
export function validateMileage(
  entries: MileageEntry[],
  input: { date: string; km: number; correction: boolean; note: string },
  today: string
): ValidationResult {
  if (!Number.isFinite(input.km) || input.km < 0 || !Number.isInteger(input.km)) {
    return { ok: false, code: 'invalid', message: 'Bitte einen gültigen Kilometerstand in ganzen Kilometern eingeben.' };
  }
  if (input.km > 2_000_000) {
    return { ok: false, code: 'implausible', message: 'Dieser Kilometerstand wirkt unplausibel hoch. Bitte prüfen.' };
  }
  if (input.date > today) {
    return { ok: false, code: 'invalid', message: 'Das Datum darf nicht in der Zukunft liegen.' };
  }
  if (input.correction) {
    if (input.note.trim().length < 3) {
      return { ok: false, code: 'reason_missing', message: 'Bitte die Korrektur kurz begründen (z. B. „Tippfehler“ oder „Tachotausch“).' };
    }
    return { ok: true };
  }
  const sorted = sortEntries(entries);
  const before = sorted.filter((e) => e.date <= input.date);
  const after = sorted.filter((e) => e.date > input.date);
  const prev = before[before.length - 1];
  if (prev && input.km < prev.km) {
    return {
      ok: false,
      code: 'rollback',
      message: `Der Wert liegt unter dem bisherigen Stand von ${nf(prev.km)} km. Falls das gewollt ist, als Korrektur mit Begründung speichern.`
    };
  }
  const next = after[0];
  if (next && input.km > next.km) {
    return {
      ok: false,
      code: 'future_conflict',
      message: `Für den ${next.date.split('-').reverse().join('.')} ist bereits ein niedrigerer Stand (${nf(next.km)} km) gespeichert.`
    };
  }
  return { ok: true };
}

export interface MileageRate {
  kmPerMonth: number;
  /** 'log' = aus Einträgen berechnet, 'angabe' = aus jährlicher Fahrleistung */
  basis: 'log' | 'angabe';
  /** Grundlage in Tagen (nur bei 'log') */
  spanDays: number;
  confidence: 'hoch' | 'mittel' | 'niedrig';
}

/**
 * Durchschnittliche Fahrleistung.
 * Nutzt bevorzugt die Einträge der letzten 12 Monate (plus den letzten Eintrag davor als Anker).
 * Liegt eine Korrektur im Zeitraum, wird erst ab der letzten Korrektur gerechnet,
 * damit der Sprung das Ergebnis nicht verfälscht.
 * Fallback: jährliche Fahrleistung aus dem Fahrzeugprofil.
 */
export function averageRate(entries: MileageEntry[], today: string, annualKm: number | null): MileageRate | null {
  let s = sortEntries(entries);
  const lastCorr = s.map((e) => e.correction).lastIndexOf(true);
  if (lastCorr >= 0) s = s.slice(lastCorr);

  const windowStart = addDays(today, -365);
  const inWindow = s.filter((e) => e.date >= windowStart);
  const anchor = [...s].reverse().find((e) => e.date < windowStart);
  const series = anchor ? [anchor, ...inWindow] : inWindow;

  if (series.length >= 2) {
    const first = series[0];
    const last = series[series.length - 1];
    const span = daysBetween(first.date, last.date);
    const delta = last.km - first.km;
    if (span >= 14 && delta >= 0) {
      return {
        kmPerMonth: (delta / span) * DAYS_PER_MONTH,
        basis: 'log',
        spanDays: span,
        confidence: span >= 180 ? 'hoch' : span >= 60 ? 'mittel' : 'niedrig'
      };
    }
  }
  if (annualKm && annualKm > 0) {
    return { kmPerMonth: annualKm / 12, basis: 'angabe', spanDays: 0, confidence: 'niedrig' };
  }
  return null;
}

/** Geschätzte Tage, bis eine Reststrecke gefahren ist. */
export function daysUntilKm(remainingKm: number, rate: MileageRate | null): number | null {
  if (!rate || rate.kmPerMonth <= 0) return null;
  return Math.max(0, Math.round((remainingKm / rate.kmPerMonth) * DAYS_PER_MONTH));
}
