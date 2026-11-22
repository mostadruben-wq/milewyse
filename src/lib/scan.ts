/**
 * Gemeinsame Scan-Pipeline für Einzelscan und Sammelimport:
 * Datei → Seiten → Text (PDF-Text oder OCR) → Auswertung → prüfbarer Entwurf → Speichern.
 */
import type { CategoryId, CostCategory, DocCategory, DocumentMeta, MaintenanceItem, ServiceRecord } from './types';
import { analyzeInvoice, type Confidence, type InvoiceAnalysis } from './invoice';
import { extractParts, suggestMaintenance } from './matcher';
import { applyFilter, canvasToBlob, detectDocument, fileToCanvas, fullQuad, thumbnail, warp, type Filter, type Quad } from './imageproc';
import { readPdf, recognize } from './ocr';
import { findDuplicate, findRecordDuplicate, hashBlob } from './duplicates';
import { uid } from './util';
import { resolveToGroup } from './groups';
import type { Vehicle } from './types';
import type { CompleteInput, ImportPayload } from './store';

export interface ScanPage {
  id: string;
  /** Originalbild (Foto) bzw. gerenderte PDF-Seite */
  source: HTMLCanvasElement;
  quad: Quad;
  filter: Filter;
  /** Ergebnis nach Zuschnitt/Filter */
  result: HTMLCanvasElement;
  thumb: string;
  /** eingebetteter PDF-Text (falls vorhanden) */
  pdfText?: string;
  fromPdf: boolean;
  /** bereits komprimiertes Ergebnis (Sammelimport spart so Arbeitsspeicher) */
  blob?: Blob;
}

/** Seiten nach der Erkennung verkleinern: Ergebnis als JPEG behalten, große Canvas-Flächen freigeben. */
export async function compactPages(pages: ScanPage[]): Promise<ScanPage[]> {
  const tiny = document.createElement('canvas');
  tiny.width = tiny.height = 1;
  const out: ScanPage[] = [];
  for (const p of pages) out.push({ ...p, blob: p.blob ?? (await canvasToBlob(p.result, 'image/jpeg', 0.8)), source: tiny, result: tiny });
  return out;
}

export function renderPage(p: Omit<ScanPage, 'result' | 'thumb'>): ScanPage {
  const isFull = p.quad.every((q, i) => q.x === fullQuad(p.source.width, p.source.height)[i].x && q.y === fullQuad(p.source.width, p.source.height)[i].y);
  const cropped = isFull ? p.source : warp(p.source, p.quad);
  const result = applyFilter(cropped, p.filter);
  return { ...p, result, thumb: thumbnail(result) };
}

/** Bild oder PDF in Seiten umwandeln. Fotos werden automatisch zugeschnitten, sofern ein Blatt erkannt wird. */
export async function fileToPages(file: File, autoCrop = true, onInfo?: (s: string) => void): Promise<ScanPage[]> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  if (isPdf) {
    const pages = await readPdf(file, (i, n) => onInfo?.(`PDF-Seite ${i} von ${n} wird gelesen …`));
    return pages.map((pg) => renderPage({ id: uid(), source: pg.canvas, quad: fullQuad(pg.canvas.width, pg.canvas.height), filter: 'original', pdfText: pg.text, fromPdf: true }));
  }
  if (!/^image\//.test(file.type) && !/\.(jpe?g|png|heic|heif|webp)$/i.test(file.name)) throw new Error(`„${file.name}“: Dateiformat nicht unterstützt. Bitte PDF, JPG oder PNG verwenden.`);
  const c = await fileToCanvas(file);
  const q = (autoCrop && detectDocument(c)) || fullQuad(c.width, c.height);
  return [renderPage({ id: uid(), source: c, quad: q, filter: 'dokument', fromPdf: false })];
}

export interface Recognized {
  text: string;
  source: 'pdf' | 'ocr' | 'keine';
  confidence: number | null;
}

/**
 * Bild für die Texterkennung aufbereiten: Tesseract arbeitet am besten bei ca. 300 dpi
 * (DIN-A4-Breite ≈ 2.400 px). Kleine Bilder werden hochskaliert, sehr große verkleinert.
 */
function prepareForOcr(c: HTMLCanvasElement): HTMLCanvasElement {
  const target = 2400;
  const w = c.width;
  if (w >= 1900 && w <= 3200) return c;
  const s = target / w;
  const out = document.createElement('canvas');
  out.width = Math.round(w * s);
  out.height = Math.round(c.height * s);
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

/** Text je Seite: eingebetteter PDF-Text, sonst lokale OCR. */
export async function recognizePages(pages: ScanPage[], onProgress?: (frac: number, label: string) => void): Promise<Recognized> {
  const texts: string[] = [];
  const confs: number[] = [];
  let usedOcr = false;
  let usedPdf = false;
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const label = pages.length > 1 ? `Seite ${i + 1} von ${pages.length}` : 'Dokument';
    if (p.pdfText && p.pdfText.replace(/\s/g, '').length > 40) {
      texts.push(p.pdfText);
      usedPdf = true;
      onProgress?.((i + 1) / pages.length, `${label}: Text aus PDF übernommen`);
      continue;
    }
    const r = await recognize(prepareForOcr(p.result), (prog, status) => {
      const st = /loading|initializ/i.test(status) ? 'Texterkennung wird geladen …' : 'Text wird erkannt …';
      onProgress?.((i + (/recogniz/i.test(status) ? prog : 0)) / pages.length, `${label}: ${st}`);
    });
    texts.push(r.text);
    confs.push(r.confidence);
    usedOcr = true;
  }
  const text = texts.join('\n\n');
  return {
    text,
    source: usedOcr ? 'ocr' : usedPdf ? 'pdf' : 'keine',
    confidence: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null
  };
}

/* ---------- Entwurf zum Prüfen ---------- */

export interface DraftSuggestion {
  id: string;
  title: string;
  itemIds: string[];
  /** erkannte Arbeiten ohne passende Position beim Fahrzeug */
  unmatched: string[];
  category: CategoryId;
  type: 'wartung' | 'reparatur';
  amount: number | null;
  lines: string[];
  confidence: Confidence;
  accepted: boolean;
  date: string;
  km: string;
  duplicateOf: string | null;
}

export interface DraftPart {
  id: string;
  name: string;
  manufacturer: string;
  partNumber: string;
  price: number | null;
  accepted: boolean;
}

type FieldConf = Confidence | null;

export interface Draft {
  id: string;
  fileName: string;
  title: string;
  category: DocCategory;
  vehicleId: string;
  date: string;
  vendor: string;
  invoiceNo: string;
  total: string;
  vat: string;
  km: string;
  countCost: boolean;
  costCategory: CostCategory;
  conf: { date: FieldConf; vendor: FieldConf; invoiceNo: FieldConf; total: FieldConf; vat: FieldConf; km: FieldConf };
  purchaseType: InvoiceAnalysis['purchaseType'];
  plate: string | null;
  fluids: string[];
  suggestions: DraftSuggestion[];
  parts: DraftPart[];
  text: string;
  textSource: Recognized['source'];
  ocrConfidence: number | null;
  hash: string;
  duplicate: { id: string; reason: string; title: string } | null;
  include: boolean;
  notes: string;
}

const money = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toFixed(2).replace('.', ','));

export function buildDraft(opts: {
  rec: Recognized;
  fileName: string;
  hash: string;
  vehicleId: string;
  items: MaintenanceItem[];
  records: ServiceRecord[];
  documents: DocumentMeta[];
  today: string;
  vehicles?: Vehicle[];
}): Draft {
  const veh = opts.vehicles?.find((v) => v.id === opts.vehicleId);
  const a = analyzeInvoice(opts.rec.text);
  // Texterkennung kann Firmenlogos und kleine Schrift nicht sicher lesen → Händler immer prüfen lassen
  if (opts.rec.source === 'ocr' && a.vendor) a.vendor = { ...a.vendor, confidence: 'niedrig' };
  const date = a.date?.value ?? opts.today;
  const isShop = a.purchaseType === 'teilekauf';
  const suggestions: DraftSuggestion[] = suggestMaintenance(a, opts.rec.text).map((s) => {
    const itemIds: string[] = [];
    const unmatched: string[] = [];
    s.keys.forEach((alts, i) => {
      const it = opts.items.find((x) => x.vehicleId === opts.vehicleId && alts.includes(x.key) && x.enabled) ?? opts.items.find((x) => x.vehicleId === opts.vehicleId && alts.includes(x.key));
      if (it) {
        const id = resolveToGroup(it.id, opts.items, veh);
        if (!itemIds.includes(id)) itemIds.push(id);
      } else unmatched.push(s.labels[i]);
    });
    const dup = findRecordDuplicate(opts.vehicleId, a.date?.value ?? null, itemIds, opts.records);
    return {
      id: uid(),
      title: s.title,
      itemIds,
      unmatched,
      category: s.category,
      type: s.type,
      amount: s.amount,
      lines: s.lines,
      confidence: s.confidence,
      // Teilekäufe: Einbau ist unbekannt → nur auf ausdrückliche Bestätigung
      accepted: !isShop && s.confidence === 'hoch' && !dup && !!a.date,
      date,
      km: a.km ? String(a.km.value) : '',
      duplicateOf: dup?.id ?? null
    };
  });
  const parts: DraftPart[] = extractParts(a).map((p) => ({ id: uid(), name: p.name, manufacturer: p.manufacturer, partNumber: p.partNumber, price: p.price, accepted: true }));
  const duplicate = findDuplicate({ hash: opts.hash, invoiceNo: a.invoiceNo?.value ?? null, vendor: a.vendor?.value ?? null, date: a.date?.value ?? null, total: a.total?.value ?? null }, opts.documents);
  const vendor = a.vendor?.value ?? '';
  const title = a.isInvoice ? `Rechnung${vendor ? ' ' + vendor : ''}`.slice(0, 80) : opts.fileName.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) || 'Dokument';
  return {
    id: uid(),
    fileName: opts.fileName,
    title,
    category: a.isInvoice ? (a.purchaseType === 'werkstatt' ? 'werkstattbeleg' : 'rechnung') : 'sonstiges',
    vehicleId: opts.vehicleId,
    date: a.date?.value ?? '',
    vendor,
    invoiceNo: a.invoiceNo?.value ?? '',
    total: money(a.total?.value),
    vat: money(a.vat?.value),
    km: a.km ? String(a.km.value) : '',
    countCost: a.isInvoice && !!a.total,
    costCategory: isShop ? 'ersatzteile' : suggestions.some((s) => s.itemIds.some((id) => id.endsWith('.hu'))) ? 'tuev' : 'wartung',
    conf: { date: a.date?.confidence ?? null, vendor: a.vendor?.confidence ?? null, invoiceNo: a.invoiceNo?.confidence ?? null, total: a.total?.confidence ?? null, vat: a.vat?.confidence ?? null, km: a.km?.confidence ?? null },
    purchaseType: a.purchaseType,
    plate: a.plate?.value ?? null,
    fluids: a.fluids,
    suggestions,
    parts,
    text: opts.rec.text,
    textSource: opts.rec.source,
    ocrConfidence: opts.rec.confidence,
    hash: opts.hash,
    duplicate,
    include: !duplicate,
    notes: ''
  };
}

const num = (s: string): number | null => {
  const t = s.trim().replace(/\s|€/g, '');
  if (!t) return null;
  const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};
const kmNum = (s: string): number | null => {
  const t = s.trim().replace(/[.\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
};

export function validateDraft(d: Draft, today: string): string | null {
  if (!d.title.trim()) return 'Bitte einen Titel für das Dokument eingeben.';
  if (d.date && (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || d.date > today)) return 'Das Rechnungsdatum ist ungültig oder liegt in der Zukunft.';
  for (const [k, v] of [['Gesamtbetrag', d.total], ['MwSt.', d.vat]] as const) if (Number.isNaN(num(v))) return `${k}: bitte als Zahl eingeben (z. B. 149,90).`;
  if (Number.isNaN(kmNum(d.km))) return 'Kilometerstand: bitte als ganze Zahl eingeben.';
  if (d.countCost && num(d.total) === null) return 'Für die Kostenübersicht wird ein Gesamtbetrag benötigt – oder „In Kosten zählen“ ausschalten.';
  for (const s of d.suggestions.filter((x) => x.accepted)) {
    if (!s.date || s.date > today) return `„${s.title}“: Bitte ein gültiges Datum angeben.`;
    if (Number.isNaN(kmNum(s.km))) return `„${s.title}“: Kilometerstand ungültig.`;
    if (!s.title.trim()) return 'Ein Wartungsvorschlag hat keinen Titel.';
  }
  return null;
}

/** Entwurf + Seiten → Speichernutzlast (Dokument, Dateien, bestätigte Einträge, Teile). */
export async function draftToPayload(d: Draft, pages: ScanPage[], original: File | null): Promise<{ payload: ImportPayload; files: { id: string; blob: Blob }[] }> {
  const files: { id: string; blob: Blob }[] = [];
  const fileIds: string[] = [];
  for (const p of pages) {
    const id = uid();
    files.push({ id, blob: p.blob ?? (await canvasToBlob(p.result, 'image/jpeg', 0.82)) });
    fileIds.push(id);
  }
  let originalFileId: string | null = null;
  if (original && (original.type === 'application/pdf' || /\.pdf$/i.test(original.name))) {
    originalFileId = uid();
    files.push({ id: originalFileId, blob: original });
  }
  const total = num(d.total);
  const doc: DocumentMeta = {
    id: d.id,
    vehicleId: d.vehicleId || null,
    title: d.title.trim(),
    category: d.category,
    date: d.date || null,
    vendor: d.vendor.trim(),
    invoiceNo: d.invoiceNo.trim(),
    total: total ?? null,
    vat: num(d.vat) ?? null,
    km: kmNum(d.km) ?? null,
    countCost: d.countCost && total !== null,
    costCategory: d.costCategory,
    text: d.text,
    textSource: d.textSource,
    ocrConfidence: d.ocrConfidence,
    fileIds,
    originalFileId,
    originalName: original?.name ?? 'Scan',
    mime: original?.type || 'image/jpeg',
    thumb: pages[0]?.thumb ?? null,
    hash: d.hash,
    pageCount: pages.length,
    recordIds: [],
    partIds: [],
    notes: d.notes,
    createdAt: Date.now()
  };
  const shop = d.purchaseType === 'teilekauf';
  const records: CompleteInput[] = d.suggestions
    .filter((s) => s.accepted)
    .map((s) => ({
      itemIds: s.itemIds,
      date: s.date,
      km: kmNum(s.km),
      title: s.title.trim(),
      description: [s.lines.join('\n'), s.unmatched.length ? `Ohne passende Wartungsposition: ${s.unmatched.join(', ')}` : ''].filter(Boolean).join('\n'),
      doneBy: shop ? 'selbst' : 'werkstatt',
      workshop: shop ? '' : d.vendor.trim(),
      costParts: s.amount,
      costLabor: null,
      notes: `Aus Beleg: ${d.title.trim()}`,
      type: s.type,
      category: s.category
    }));
  const parts = d.parts
    .filter((p) => p.accepted)
    .map((p) => ({
      vehicleId: d.vehicleId,
      name: p.name,
      manufacturer: p.manufacturer,
      partNumber: p.partNumber,
      category: null,
      compatibility: '',
      installDate: shop ? null : d.date || null,
      installKm: shop ? null : kmNum(d.km),
      price: p.price,
      dealer: d.vendor.trim(),
      link: '',
      notes: d.purchaseType === 'teilekauf' ? `Gekauft am ${d.date ? d.date.split('-').reverse().join('.') : 'unbekannt'} – Einbaudatum noch nicht erfasst` : ''
    }));
  return { payload: { doc, records, parts }, files };
}

export async function fileHash(file: Blob): Promise<string> {
  return hashBlob(file);
}
