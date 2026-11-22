import type { AppState, CostCategory, DocumentMeta, ServiceRecord } from './types';

export interface CostEntry {
  date: string;
  amount: number;
  category: CostCategory;
  title: string;
  source: 'record' | 'document';
  id: string;
  vehicleId: string | null;
}

/**
 * Kostenbuchungen ohne Doppelzählung:
 * - Ein Dokument mit Betrag (countCost) zählt genau einmal mit seinem Gesamtbetrag.
 * - Historieneinträge, die mit einem solchen Dokument verknüpft sind, zählen NICHT zusätzlich.
 * - Historieneinträge ohne Dokument zählen mit Teile- + Arbeitskosten.
 */
export function costEntries(s: Pick<AppState, 'records' | 'documents'>, vehicleId?: string): CostEntry[] {
  const counted = new Set(s.documents.filter((d) => d.countCost && d.total !== null).map((d) => d.id));
  const out: CostEntry[] = [];
  s.documents.forEach((d: DocumentMeta) => {
    if (!counted.has(d.id) || !d.date) return;
    if (vehicleId && d.vehicleId !== vehicleId) return;
    out.push({ date: d.date, amount: d.total!, category: d.costCategory, title: d.title, source: 'document', id: d.id, vehicleId: d.vehicleId });
  });
  s.records.forEach((r: ServiceRecord) => {
    if (vehicleId && r.vehicleId !== vehicleId) return;
    if (r.documentId && counted.has(r.documentId)) return;
    const amount = (r.costParts ?? 0) + (r.costLabor ?? 0);
    if (!amount) return;
    out.push({ date: r.date, amount, category: r.type === 'reparatur' ? 'reparatur' : 'wartung', title: r.title, source: 'record', id: r.id, vehicleId: r.vehicleId });
  });
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const COST_LABEL: Record<CostCategory, string> = {
  wartung: 'Wartung',
  reparatur: 'Reparaturen',
  ersatzteile: 'Ersatzteile',
  kraftstoff: 'Kraftstoff',
  versicherung: 'Versicherung',
  steuer: 'Kfz-Steuer',
  tuev: 'TÜV',
  umbauten: 'Umbauten',
  sonstiges: 'Sonstiges'
};
