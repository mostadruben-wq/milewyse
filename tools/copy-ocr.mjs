// Kopiert Texterkennung (Tesseract), deutsche Sprachdaten und den PDF-Worker aus node_modules nach public/ocr.
// Läuft automatisch vor dev/build – die großen Dateien müssen so nicht im Repository liegen.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const out = 'public/ocr/';
mkdirSync(out, { recursive: true });
const copy = (from, to) => copyFileSync(from, out + to);
copy('node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js');
copy('node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js');
copy('node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js');
copy('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs');
const lang = out + 'deu.traineddata';
if (!existsSync(lang)) writeFileSync(lang, gunzipSync(readFileSync('node_modules/@tesseract.js-data/deu/4.0.0_best_int/deu.traineddata.gz')));
console.log('OCR-Dateien bereit');
