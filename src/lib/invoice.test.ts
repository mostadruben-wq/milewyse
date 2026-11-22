import { describe, expect, it } from 'vitest';
import { analyzeInvoice, datesIn, parseAmount } from './invoice';
import { extractParts, suggestMaintenance } from './matcher';
import { costEntries } from './costs';
import { findDuplicate, findRecordDuplicate } from './duplicates';
import { migrateV1 } from '../data/initial';
import type { DocumentMeta, ServiceRecord } from './types';

const OIL_INVOICE = `Autohaus Müller GmbH
Hauptstraße 12 · 70372 Stuttgart
Tel. 0711 123456

RECHNUNG
Rechnungs-Nr.: RE-2025-0815
Rechnungsdatum: 12.03.2025
Amtl. Kennzeichen: S-AB 1234
km-Stand: 245.000

Pos Bezeichnung Menge Preis
1 Motoröl 5W-40 VW 505 01 5,5 l 76,45
2 Ölfilter MANN HU 719/7 x 1 18,90
3 Ölwechsel Arbeitslohn 1 25,00

Summe netto 125,97
MwSt. 19 % 23,93
Gesamtbetrag 149,90 €
IBAN DE12 3456 7890 1234 5678 90`;

const MULTI_INVOICE = `Kfz-Meisterbetrieb Schrauber
Rechnung Nr. 4711
Datum 03.07.2024
Kilometerstand 128 300 km
Ölwechsel inkl. Motoröl 0W-30 89,00
Luftfiltereinsatz Bosch F 026 400 287 24,50
Bremsbeläge Vorderachse ATE 13.0460-2850.2 62,30
Bremsbeläge vorne ersetzen Arbeitszeit 48,00
Getriebeöl erneuern 75W-90 54,00
Zwischensumme 267,80
USt 19% 50,88
Rechnungsbetrag 318,68`;

describe('Zahlen und Daten (deutsche Formate)', () => {
  it('liest Beträge', () => {
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('149,90 €')).toBe(149.9);
    expect(parseAmount('149.90')).toBe(149.9);
    expect(parseAmount('12')).toBeNull();
  });
  it('liest Datumsangaben', () => {
    expect(datesIn('Datum: 12.03.2025')).toEqual(['2025-03-12']);
    expect(datesIn('vom 3.7.24')).toEqual(['2024-07-03']);
    expect(datesIn('am 5. März 2023')).toEqual(['2023-03-05']);
    expect(datesIn('31.02.2024')).toEqual([]);
  });
});

describe('Rechnungsauswertung', () => {
  const a = analyzeInvoice(OIL_INVOICE);
  it('erkennt Kopfdaten mit hoher Sicherheit', () => {
    expect(a.date).toMatchObject({ value: '2025-03-12', confidence: 'hoch' });
    expect(a.invoiceNo?.value).toBe('RE-2025-0815');
    expect(a.vendor).toMatchObject({ value: 'Autohaus Müller GmbH', confidence: 'hoch' });
    expect(a.total).toMatchObject({ value: 149.9, confidence: 'hoch' });
    expect(a.vat?.value).toBe(23.93);
    expect(a.vatRate).toBe(19);
    expect(a.km).toMatchObject({ value: 245000, confidence: 'hoch' });
    expect(a.plate?.value).toBe('S-AB 1234');
    expect(a.isInvoice).toBe(true);
  });
  it('erkennt Betriebsstoffe und Arbeitslohn', () => {
    expect(a.fluids).toContain('5W-40');
    expect(a.fluids.some((f) => f.startsWith('VW 505'))).toBe(true);
    expect(a.laborTotal).toBe(25);
  });
  it('schlägt „Motorölwechsel inkl. Ölfilter“ als einen Eintrag vor', () => {
    const s = suggestMaintenance(a);
    expect(s).toHaveLength(1);
    expect(s[0].title).toBe('Motorölwechsel inkl. Ölfilter');
    expect(s[0].keys.flat()).toEqual(expect.arrayContaining(['motoroel', 'oelfilter']));
  });
  it('erkennt Ersatzteile ohne Werte zu erfinden', () => {
    const p = extractParts(a);
    const filter = p.find((x) => /filter/i.test(x.name));
    expect(filter?.manufacturer).toBe('Mann');
    expect(filter?.partNumber).toContain('719');
    expect(filter?.price).toBe(18.9);
  });

  const m = analyzeInvoice(MULTI_INVOICE);
  it('liest Kilometer mit Leerzeichen-Tausendertrennung und Rechnungsbetrag', () => {
    expect(m.km?.value).toBe(128300);
    expect(m.total?.value).toBe(318.68);
    expect(m.date?.value).toBe('2024-07-03');
    expect(m.invoiceNo?.value).toBe('4711');
  });
  it('erzeugt getrennte Vorschläge für mehrere Arbeiten', () => {
    const titles = suggestMaintenance(m).map((x) => x.title);
    expect(titles).toEqual(expect.arrayContaining(['Motorölwechsel', 'Luftfilter', 'Bremsbeläge vorne', 'Getriebeöl']));
    expect(titles).toHaveLength(4);
  });
  it('markiert Werte ohne Beschriftung als unsicher', () => {
    const x = analyzeInvoice('Werkstatt Meier\n14.02.2023\nReifenwechsel 40,00\n60,00');
    expect(x.date?.confidence).toBe('niedrig');
    expect(x.total?.confidence).toBe('niedrig');
    expect(x.km).toBeNull();
  });
  it('erfindet nichts bei leerem Text', () => {
    const x = analyzeInvoice('');
    expect([x.date, x.total, x.km, x.vendor, x.invoiceNo]).toEqual([null, null, null, null, null]);
    expect(suggestMaintenance(x)).toEqual([]);
  });
  it('rät die Achse bei Bremsbelägen nicht', () => {
    const s = suggestMaintenance(analyzeInvoice('Bremsbeläge erneuert 80,00'));
    expect(s[0].confidence).toBe('niedrig');
    expect(s[0].title).toContain('Achse prüfen');
  });
});

const doc = (p: Partial<DocumentMeta>): DocumentMeta => ({
  id: 'd1', vehicleId: 'v', title: 'R', category: 'rechnung', date: '2025-03-12', vendor: 'Autohaus Müller', invoiceNo: 'RE-1', total: 149.9, vat: null, km: null, countCost: true, costCategory: 'wartung',
  text: '', textSource: 'ocr', ocrConfidence: null, fileIds: [], originalFileId: null, originalName: '', mime: '', thumb: null, hash: 'abc', pageCount: 1, recordIds: [], partIds: [], notes: '', createdAt: 0, ...p
});
const rec = (p: Partial<ServiceRecord>): ServiceRecord => ({
  id: 'r', vehicleId: 'v', date: '2025-03-12', km: null, title: 'x', category: 'motor', type: 'wartung', itemIds: [], description: '', doneBy: 'werkstatt', workshop: '', costParts: 100, costLabor: 49.9, notes: '', documentId: null, createdAt: 0, ...p
});

describe('Kosten ohne Doppelbuchung', () => {
  it('zählt Rechnungsbetrag einmal, auch bei mehreren verknüpften Einträgen', () => {
    const e = costEntries({ documents: [doc({})], records: [rec({ id: 'a', documentId: 'd1' }), rec({ id: 'b', documentId: 'd1' }), rec({ id: 'c', documentId: null, costParts: 10, costLabor: null })] });
    expect(e.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(159.9);
  });
  it('zählt Einträge normal, wenn das Dokument keine Kosten bucht', () => {
    const e = costEntries({ documents: [doc({ countCost: false })], records: [rec({ documentId: 'd1' })] });
    expect(e.reduce((s, x) => s + x.amount, 0)).toBeCloseTo(149.9);
  });
});

describe('Dublettenerkennung', () => {
  const existing = [doc({})];
  it('erkennt identische Dateien, Rechnungsnummern und Datum+Betrag', () => {
    expect(findDuplicate({ hash: 'abc', invoiceNo: null, vendor: null, date: null, total: null }, existing)?.reason).toBe('identische Datei');
    expect(findDuplicate({ hash: 'x', invoiceNo: 're 1', vendor: 'Autohaus Müller GmbH', date: null, total: null }, existing)?.reason).toBe('gleiche Rechnungsnummer');
    expect(findDuplicate({ hash: 'x', invoiceNo: null, vendor: null, date: '2025-03-12', total: 149.9 }, existing)?.reason).toBe('gleiches Datum und gleicher Betrag');
    expect(findDuplicate({ hash: 'x', invoiceNo: null, vendor: null, date: '2025-03-13', total: 149.9 }, existing)).toBeNull();
  });
  it('findet vorhandene Historieneinträge', () => {
    expect(findRecordDuplicate('v', '2025-03-12', ['v.motoroel'], [rec({ itemIds: ['v.motoroel'] })])).not.toBeNull();
    expect(findRecordDuplicate('v', '2025-03-12', ['v.luftfilter'], [rec({ itemIds: ['v.motoroel'] })])).toBeNull();
  });
});

describe('Migration Version 1 → 2', () => {
  it('übernimmt alle Daten verlustfrei', () => {
    const old = {
      schemaVersion: 1, setupDone: true, isSample: false,
      vehicle: { name: 'Mein T4', model: 'VW T4', engineCode: 'AXL', drive: 'Syncro 4x4', year: 2001, plate: 'S-X 1', vin: '', gearboxCode: '', annualKm: 12000, photo: null },
      items: [{ id: 'motoroel', name: 'Motoröl', relatedIds: ['oelfilter'], lastKm: 250000, custom: false }, { id: 'oelfilter', name: 'Ölfilter', relatedIds: [], custom: false }],
      mileage: [{ id: 'm', date: '2025-01-01', km: 250000, note: '', correction: false, createdAt: 0 }],
      records: [{ id: 'r', date: '2025-01-01', km: 250000, title: 'Öl', itemIds: ['motoroel'] }],
      settings: { warnKm: 2000, warnDays: 20, theme: 'dark' }
    };
    const s = migrateV1(old);
    const vid = s.vehicles[0].id;
    expect(s.schemaVersion).toBe(2);
    expect(s.vehicles[0]).toMatchObject({ name: 'Mein T4', make: 'VW', model: 'T4', year: 2001, template: 't4-syncro', drive: 'allrad', annualKm: 12000 });
    expect(s.items[0]).toMatchObject({ id: `${vid}.motoroel`, key: 'motoroel', lastKm: 250000, relatedIds: [`${vid}.oelfilter`] });
    expect(s.records[0].itemIds).toEqual([`${vid}.motoroel`]);
    expect(s.mileage[0].vehicleId).toBe(vid);
    expect(s.settings).toMatchObject({ warnKm: 2000, theme: 'dark' });
  });
});

describe('Plausibilität bei OCR-Fehlern', () => {
  it('korrigiert einen falsch gelesenen Gesamtbetrag anhand der MwSt. und markiert ihn als unsicher', () => {
    const a = analyzeInvoice('Rechnung\nTeil A 152,68\nTeil B 50,97\nincl. MwSt. 19,00 % von 171,13 32,52\nEndsumme EUR 152,68\nBetrag 203,65');
    expect(a.total).toMatchObject({ value: 203.65, confidence: 'niedrig' });
  });
  it('entfernt Logo-Artefakte vor dem Firmennamen', () => {
    expect(analyzeInvoice('£ AUTOMOBILTECHNIK GMBH\nRechnung').vendor?.value).toBe('AUTOMOBILTECHNIK GMBH');
  });
});
