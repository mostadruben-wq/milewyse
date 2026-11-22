export function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

const nf = new Intl.NumberFormat('de-DE');
const cf = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const fmtNum = (n: number | null | undefined) => (n === null || n === undefined ? '–' : nf.format(Math.round(n)));
export const fmtKm = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${nf.format(Math.round(n))} km`);
export const fmtEur = (n: number | null | undefined) => (n === null || n === undefined ? '–' : cf.format(n));

/** Liest eine Zahl aus einer deutschen Eingabe („257.500“, „12,5“). Leer → null. */
export function parseNum(input: string): number | null {
  const t = input.trim().replace(/\s/g, '').replace(/km$/i, '');
  if (!t) return null;
  const normalized = /,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

/** Bild verkleinern und als JPEG-Data-URL zurückgeben (spart Speicher). */
export function resizeImage(file: File, max = 1200, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Dateiformat wird nicht unterstützt.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function downloadFile(name: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function haptic() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* nicht unterstützt */
  }
}
