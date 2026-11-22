import type { DueInfo } from './maintenance';
import { formatDate, relativeDays } from './dates';
import { fmtKm } from './util';

/** Kurzer, verständlicher Text zur Fälligkeit einer Position. */
export function describeDue(d: DueInfo): string {
  if (d.status === 'inactive') return 'Deaktiviert';
  if (d.status === 'unknown') {
    if (d.unknownReason === 'noInterval') return 'Kein Intervall hinterlegt';
    if (d.unknownReason === 'noMileage') return 'Kilometerstand fehlt';
    return 'Letzte Wartung unbekannt';
  }
  const parts: string[] = [];
  if (d.decisive === 'km' && d.remainingKm !== null) {
    parts.push(d.remainingKm <= 0 ? `Überfällig seit ${fmtKm(-d.remainingKm)}` : `Noch ${fmtKm(d.remainingKm)}`);
    if (d.remainingKm > 0 && d.estimatedDays !== null) parts.push(`${d.estimated ? 'ca. ' : ''}${relativeDays(d.estimatedDays)}`);
  } else if (d.remainingDays !== null) {
    parts.push(d.remainingDays <= 0 ? `Überfällig seit ${formatDate(d.nextDate)}` : `Fällig ${relativeDays(d.remainingDays)}`);
    if (d.remainingKm !== null && d.remainingKm > 0) parts.push(`oder in ${fmtKm(d.remainingKm)}`);
  }
  return parts.join(' · ');
}
