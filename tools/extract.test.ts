import { it } from 'vitest';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { joinPdfItems } from '../src/lib/pdftext';
import { analyzeInvoice } from '../src/lib/invoice';
import { suggestMaintenance, extractParts } from '../src/lib/matcher';

/**
 * Entwicklerwerkzeug: wertet alle PDFs in INV_DIR aus und schreibt die Ergebnisse auf die Konsole.
 * Aufruf: INV_DIR=/pfad/zu/rechnungen npx vitest run tools/extract.test.ts
 */
const DIR = process.env.INV_DIR ?? '';
it.skipIf(!DIR || !existsSync(DIR))('extract', async () => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  mkdirSync(DIR + '/txt', { recursive: true });
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.pdf'))) {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(`${DIR}/${f}`)), isEvalSupported: false }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      pages.push(joinPdfItems((await p.getTextContent()).items as never));
    }
    const text = pages.join('\n');
    writeFileSync(`${DIR}/txt/${f}.txt`, text);
    const a = analyzeInvoice(text);
    const s = suggestMaintenance(a, text);
    const parts = extractParts(a);
    const fmt = (x: { value: unknown; confidence: string } | null) => (x ? `${x.value}${x.confidence === 'niedrig' ? '?' : ''}` : '—');
    console.log(`\n### ${f}\n type=${a.purchaseType} date=${fmt(a.date)} no=${fmt(a.invoiceNo)} vendor=${fmt(a.vendor)} total=${fmt(a.total)} vat=${fmt(a.vat)} km=${fmt(a.km)} plate=${fmt(a.plate)} vin=${fmt(a.vin)}\n sugg: ${s.map((x) => x.title).join(' | ')}\n parts(${parts.length}): ${parts.slice(0, 8).map((p) => `${p.manufacturer}/${p.partNumber}/${p.name.slice(0, 30)}/${p.price}`).join(' ; ')}`);
  }
}, 120000);
