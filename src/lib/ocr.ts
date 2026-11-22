/**
 * Texterkennung lokal im Browser (Tesseract.js, WebAssembly) und PDF-Verarbeitung (pdf.js).
 * Alle Sprachdaten und Programmteile werden aus dem eigenen App-Ordner /ocr geladen –
 * keine Übertragung an Dritte, nach dem ersten Laden auch offline nutzbar.
 */
import type { Worker } from 'tesseract.js';
import { joinPdfItems } from './pdftext';

const base = () => new URL('./ocr/', document.baseURI).href;

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: number, status: string) => void) | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      await ensureLanguageData();
      const w = await createWorker('deu', 1, {
        workerPath: base() + 'worker.min.js',
        corePath: base(),
        langPath: base().replace(/\/$/, ''),
        gzip: false,
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => progressCb?.(m.progress, m.status)
      });
      await w.setParameters({ preserve_interword_spaces: '1' } as never);
      return w;
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

/**
 * Deutsche Sprachdaten bereitstellen. Normalfall: Tesseract lädt ./ocr/deu.traineddata selbst
 * und legt sie in seinem IndexedDB-Cache ab. Liefert der Host diese Datei nicht aus (z. B. Vorschau),
 * wird sie aus einem JavaScript-Modul (Base64) gelesen und direkt in Tesseracts Cache geschrieben.
 */
async function ensureLanguageData(): Promise<void> {
  try {
    const r = await fetch(base() + 'deu.traineddata', { method: 'HEAD' });
    if (r.ok) return;
  } catch {
    /* Fallback unten */
  }
  if (await cacheHas('./deu.traineddata')) return;
  const mod = await import(/* @vite-ignore */ base() + 'deu-traineddata.js');
  const bin = atob(mod.default as string);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  await cachePut('./deu.traineddata', data);
}

// Tesseract.js nutzt idb-keyval: Datenbank „keyval-store“, Objektspeicher „keyval“
function keyvalDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('keyval-store');
    r.onupgradeneeded = () => r.result.createObjectStore('keyval');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function cacheHas(key: string): Promise<boolean> {
  try {
    const db = await keyvalDb();
    return await new Promise((res) => {
      const q = db.transaction('keyval').objectStore('keyval').count(key);
      q.onsuccess = () => res(q.result > 0);
      q.onerror = () => res(false);
    });
  } catch {
    return false;
  }
}
async function cachePut(key: string, val: Uint8Array): Promise<void> {
  const db = await keyvalDb();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction('keyval', 'readwrite');
    tx.objectStore('keyval').put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export interface OcrResult {
  text: string;
  confidence: number; // 0..100
}

export async function recognize(image: HTMLCanvasElement | Blob, onProgress?: (p: number, status: string) => void): Promise<OcrResult> {
  progressCb = onProgress ?? null;
  try {
    const w = await getWorker();
    const r = await w.recognize(image as never);
    return { text: r.data.text, confidence: r.data.confidence };
  } catch (e) {
    throw new Error(`Texterkennung fehlgeschlagen: ${(e as Error).message || e}. Bitte erneut versuchen oder Werte manuell eintragen.`);
  } finally {
    progressCb = null;
  }
}

/* ---------- PDF ---------- */

export interface PdfPage {
  text: string;
  canvas: HTMLCanvasElement;
}

export async function readPdf(file: Blob, onPage?: (i: number, n: number) => void, maxPages = 30): Promise<PdfPage[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = base() + 'pdf.worker.min.mjs';
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) {
    const msg = (e as Error).name === 'PasswordException' ? 'Das PDF ist passwortgeschützt.' : 'Das PDF konnte nicht gelesen werden.';
    throw new Error(msg);
  }
  const n = Math.min(doc.numPages, maxPages);
  const pages: PdfPage[] = [];
  for (let i = 1; i <= n; i++) {
    onPage?.(i, n);
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const text = joinPdfItems(tc.items as { str: string; transform: number[] }[]);
    // Seiten mit eingebettetem Text genügen 1,5-fach; gescannte Seiten brauchen für die OCR mehr Auflösung
    const vp = page.getViewport({ scale: text.replace(/\s/g, '').length > 40 ? 1.5 : 2.2 });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    pages.push({ text, canvas });
  }
  return pages;
}
