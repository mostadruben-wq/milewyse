/**
 * Bildverarbeitung für den Dokumentenscanner – vollständig lokal im Browser.
 * - Automatische Dokumentenerkennung (helles Blatt vor dunklerem Hintergrund, Otsu-Schwelle + größte Fläche)
 * - Perspektivkorrektur über Homographie
 * - Bildoptimierung (Graustufen / Dokumentfilter mit Kontrastspreizung)
 */

export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt]; // oben-links, oben-rechts, unten-rechts, unten-links

export async function fileToCanvas(file: Blob, maxSide = 2600): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap | HTMLImageElement;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    bmp = await new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('Bild konnte nicht geladen werden. Unterstützt werden JPG, PNG und HEIC (auf dem iPhone).'));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = bmp.width;
  const h = bmp.height;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  if ('close' in bmp) bmp.close();
  return c;
}

export function fullQuad(w: number, h: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h }
  ];
}

/** Versucht, die Blattkanten zu finden. Liefert null, wenn kein klares Dokument erkennbar ist. */
export function detectDocument(src: HTMLCanvasElement): Quad | null {
  const S = 360;
  const scale = S / Math.max(src.width, src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const gray = new Uint8Array(w * h);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < w * h; i++) {
    const g = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    gray[i] = g;
    hist[g]++;
  }
  // Otsu-Schwelle
  const total = w * h;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  // größte zusammenhängende helle Fläche (4er-Nachbarschaft, iterative Flutfüllung)
  const label = new Int32Array(w * h).fill(-1);
  let bestArea = 0, bestLabel = -1, cur = 0;
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== -1 || gray[i] <= thr) continue;
    let area = 0;
    stack.push(i);
    label[i] = cur;
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w, y = (p / w) | 0;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && label[q] === -1 && gray[q] > thr) { label[q] = cur; stack.push(q); }
    }
    if (area > bestArea) { bestArea = area; bestLabel = cur; }
    cur++;
  }
  if (bestArea < total * 0.18 || bestArea > total * 0.97) return null;
  // Ecken: Extrempunkte von x+y und x−y
  let tl = { v: Infinity, x: 0, y: 0 }, br = { v: -Infinity, x: 0, y: 0 }, tr = { v: -Infinity, x: 0, y: 0 }, bl = { v: Infinity, x: 0, y: 0 };
  for (let i = 0; i < w * h; i++) {
    if (label[i] !== bestLabel) continue;
    const x = i % w, y = (i / w) | 0;
    const s = x + y, df = x - y;
    if (s < tl.v) tl = { v: s, x, y };
    if (s > br.v) br = { v: s, x, y };
    if (df > tr.v) tr = { v: df, x, y };
    if (df < bl.v) bl = { v: df, x, y };
  }
  const inv = 1 / scale;
  const q: Quad = [tl, tr, br, bl].map((p) => ({ x: Math.min(src.width, Math.max(0, p.x * inv)), y: Math.min(src.height, Math.max(0, p.y * inv)) })) as Quad;
  // Plausibilität: Fläche des Vierecks
  const area = Math.abs(((q[0].x * q[1].y - q[1].x * q[0].y) + (q[1].x * q[2].y - q[2].x * q[1].y) + (q[2].x * q[3].y - q[3].x * q[2].y) + (q[3].x * q[0].y - q[0].x * q[3].y)) / 2);
  if (area < src.width * src.height * 0.15) return null;
  return q;
}

/** Homographie, die das Einheitsrechteck (0..W,0..H) auf das Viereck abbildet. */
function homography(W: number, H: number, q: Quad): number[] {
  const src = [[0, 0], [W, 0], [W, H], [0, H]];
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const { x: u, y: v } = q[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Gauß-Elimination
  for (let i = 0; i < 8; i++) {
    let piv = i;
    for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    [b[i], b[piv]] = [b[piv], b[i]];
    for (let r = 0; r < 8; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Schneidet das Viereck aus und entzerrt es zu einem Rechteck. */
export function warp(src: HTMLCanvasElement, q: Quad, maxSide = 2200): HTMLCanvasElement {
  let W = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let H = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const s = Math.min(1, maxSide / Math.max(W, H));
  W = Math.max(1, Math.round(W * s));
  H = Math.max(1, Math.round(H * s));
  const h = homography(W, H, q);
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  const sd = sctx.getImageData(0, 0, src.width, src.height).data;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(W, H);
  const od = img.data;
  const sw = src.width, sh = src.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const den = h[6] * x + h[7] * y + 1;
      const u = (h[0] * x + h[1] * y + h[2]) / den;
      const v = (h[3] * x + h[4] * y + h[5]) / den;
      const o = (y * W + x) * 4;
      // bilineare Interpolation
      const x0 = Math.floor(u), y0 = Math.floor(v);
      if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) {
        od[o] = od[o + 1] = od[o + 2] = 255;
        od[o + 3] = 255;
        continue;
      }
      const fx = u - x0, fy = v - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        od[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
      }
      od[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

export type Filter = 'original' | 'grau' | 'dokument';

/** Bildoptimierung. „Dokument“: Graustufen + Hintergrund aufhellen + Kontrast spreizen (gut für OCR). */
export function applyFilter(src: HTMLCanvasElement, f: Filter): HTMLCanvasElement {
  if (f === 'original') return src;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const n = c.width * c.height;
  const g = new Uint8ClampedArray(n);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) {
    const v = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    g[i] = v;
    hist[g[i]]++;
  }
  let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.02) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * (f === 'dokument' ? 0.35 : 0.01)) { hi = i; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    let v = ((g[i] - lo) / range) * 255;
    if (f === 'dokument') v = v > 235 ? 255 : v < 0 ? 0 : Math.pow(v / 255, 1.25) * 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function rotate(src: HTMLCanvasElement, clockwise = true): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.height;
  c.height = src.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((clockwise ? 90 : -90) * (Math.PI / 180));
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.85): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden.'))), type, quality));
}

export function thumbnail(c: HTMLCanvasElement, max = 220): string {
  const s = Math.min(1, max / Math.max(c.width, c.height));
  const t = document.createElement('canvas');
  t.width = Math.round(c.width * s);
  t.height = Math.round(c.height * s);
  t.getContext('2d')!.drawImage(c, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.7);
}
