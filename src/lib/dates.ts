/** Datumshilfen auf Basis lokaler Kalendertage (ohne Zeitzonen-Fallstricke). */

const DAY = 86_400_000;

export function parseISO(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Monate addieren; der Tag wird auf das Monatsende begrenzt (31.01. + 1 Monat = 28./29.02.). */
export function addMonths(iso: string, months: number): string {
  const d = parseISO(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + months;
  const target = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return toISO(target);
}

export function addDays(iso: string, days: number): string {
  return toISO(new Date(parseISO(iso).getTime() + Math.round(days) * DAY));
}

/** Tage von a bis b (positiv, wenn b nach a liegt). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY);
}

export function isValidISO(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return toISO(parseISO(d)) === d;
}

const fmtDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export const formatDate = (iso: string | null) => (iso ? fmtDate.format(parseISO(iso)) : '–');
export const formatMonth = (iso: string) => fmtMonth.format(parseISO(iso));

/** Menschliche Beschreibung einer Zeitspanne in Tagen, z. B. „in ca. 3 Monaten“. */
export function relativeDays(days: number): string {
  const abs = Math.abs(days);
  let text: string;
  if (abs === 0) return 'heute';
  if (abs < 14) text = `${abs} ${abs === 1 ? 'Tag' : 'Tagen'}`;
  else if (abs < 60) text = `${Math.round(abs / 7)} Wochen`;
  else if (abs < 730) {
    const m = Math.round(abs / 30.44);
    text = `${m} ${m === 1 ? 'Monat' : 'Monaten'}`;
  } else {
    const y = Math.round((abs / 365.25) * 10) / 10;
    text = `${y.toLocaleString('de-DE')} Jahren`;
  }
  return days > 0 ? `in ${text}` : `vor ${text}`;
}
