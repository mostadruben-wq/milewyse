/**
 * Regressionstests mit echten (anonymisierten) Rechnungen verschiedener Händler.
 * Erwartungswerte wurden manuell gegen die Original-PDFs geprüft.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyzeInvoice } from './invoice';
import { extractParts, suggestMaintenance } from './matcher';

const load = (n: string) => readFileSync(new URL(`./__fixtures__/${n}.txt`, import.meta.url), 'utf8');

const CASES: { file: string; date: string; no: string; vendor: string; total: number; vat: number; parts: number; suggest?: string[] }[] = [
  { file: 'bandel-kupplung', date: '2026-10-26', no: '2026-32334612', vendor: 'Bandel Automobiltechnik GmbH', total: 462.79, vat: 73.89, parts: 1, suggest: ['Kupplung'] },
  { file: 'bandel-zahnriemen', date: '2026-10-26', no: '2026-32324643', vendor: 'Bandel Automobiltechnik GmbH', total: 203.65, vat: 32.52, parts: 3, suggest: ['Zahnriemenwechsel inkl. Wasserpumpe', 'Thermostat'] },
  { file: 'netspares', date: '2026-11-02', no: '596754', vendor: 'NetSpares GmbH', total: 24.8, vat: 3.96, parts: 2 },
  { file: 'gtv-van', date: '2025-04-07', no: 'INV843197', vendor: 'gtv-van.com', total: 1472, vat: 245.33, parts: 2 },
  { file: 'cleverlog', date: '2025-12-29', no: 'DESIPDCL25/12/070339', vendor: 'Cleverlog-Autoteile GmbH', total: 23.04, vat: 3.68, parts: 1, suggest: [] },
  { file: 'atp', date: '2026-11-16', no: '110-2635035987', vendor: 'ATP Autoteile GmbH', total: 66.64, vat: 10.64, parts: 1, suggest: ['Getriebelager'] },
  { file: 'bus-ok', date: '2026-11-09', no: 'RE294278', vendor: 'Kuntze Erben GbR', total: 13.15, vat: 2.1, parts: 2 },
  { file: 'ssc', date: '2025-02-07', no: '28519', vendor: 'SSC Busparts', total: 419, vat: 66.9, parts: 1, suggest: [] },
  { file: 'bus-scheune', date: '2026-11-05', no: '112026388560RG', vendor: 'Bus-Scheune GmbH & Co. KG', total: 140.22, vat: 22.39, parts: 1 }
];

describe('Echte Rechnungen (anonymisiert)', () => {
  for (const c of CASES) {
    it(c.file, () => {
      const a = analyzeInvoice(load(c.file));
      expect(a.date?.value).toBe(c.date);
      expect(a.invoiceNo?.value).toBe(c.no);
      expect(a.vendor?.value).toBe(c.vendor);
      expect(a.total?.value).toBe(c.total);
      expect(a.total?.confidence).toBe('hoch');
      expect(a.vat?.value).toBe(c.vat);
      expect(a.purchaseType).toBe('teilekauf');
      expect(a.km).toBeNull(); // Teilekäufe enthalten keinen Kilometerstand – nichts erfinden
      expect(extractParts(a)).toHaveLength(c.parts);
      if (c.suggest) expect(suggestMaintenance(a).map((s) => s.title)).toEqual(c.suggest);
    });
  }
  it('übernimmt Hersteller und Teilenummer aus der Artikelspalte', () => {
    const p = extractParts(analyzeInvoice(load('bandel-zahnriemen')));
    expect(p[0]).toMatchObject({ manufacturer: 'INA', partNumber: '11162024', price: 152.68 });
    const c = extractParts(analyzeInvoice(load('cleverlog')));
    expect(c[0]).toMatchObject({ manufacturer: 'Thermotec', partNumber: 'KTT070002', price: 16.09 });
  });
  it('verwendet nur anonymisierte Kundendaten', () => {
    for (const c of CASES) expect(load(c.file)).toMatch(/Max Mustermann/);
  });
});
