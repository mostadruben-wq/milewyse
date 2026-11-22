import type { DocumentMeta, ServiceRecord } from './types';

export interface DupCandidate {
  hash: string;
  invoiceNo: string | null;
  vendor: string | null;
  date: string | null;
  total: number | null;
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[^a-z0-9äöü]/g, '');

/** Prüft, ob ein Dokument wahrscheinlich schon vorhanden ist. Liefert Grund oder null. */
export function findDuplicate(c: DupCandidate, existing: Pick<DocumentMeta, 'id' | 'hash' | 'invoiceNo' | 'vendor' | 'date' | 'total' | 'title'>[]): { id: string; reason: string; title: string } | null {
  for (const d of existing) {
    if (c.hash && d.hash === c.hash) return { id: d.id, reason: 'identische Datei', title: d.title };
  }
  for (const d of existing) {
    if (c.invoiceNo && norm(d.invoiceNo) && norm(d.invoiceNo) === norm(c.invoiceNo)) {
      // Lange Rechnungsnummern sind praktisch eindeutig – auch wenn der Händlername (z. B. durch OCR) abweicht
      const sameVendor = !c.vendor || !d.vendor || norm(d.vendor).slice(0, 6) === norm(c.vendor).slice(0, 6) || norm(c.invoiceNo).length >= 8;
      if (sameVendor) return { id: d.id, reason: 'gleiche Rechnungsnummer', title: d.title };
    }
  }
  for (const d of existing) {
    if (c.date && d.date === c.date && c.total !== null && d.total !== null && Math.abs(d.total - c.total) < 0.01) return { id: d.id, reason: 'gleiches Datum und gleicher Betrag', title: d.title };
  }
  return null;
}

/** Gibt es bereits einen Historieneintrag am selben Tag für dieselbe Wartungsposition? */
export function findRecordDuplicate(vehicleId: string, date: string | null, itemIds: string[], records: ServiceRecord[]): ServiceRecord | null {
  if (!date || !itemIds.length) return null;
  return records.find((r) => r.vehicleId === vehicleId && r.date === date && r.itemIds.some((i) => itemIds.includes(i))) ?? null;
}

/** SHA-256 einer Datei (für Dubletten). */
export async function hashBlob(b: Blob): Promise<string> {
  try {
    const buf = await b.arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${b.size}-${b.type}`;
  }
}
