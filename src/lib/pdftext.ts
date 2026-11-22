/** Setzt pdf.js-Textelemente zeilenweise (nach y-Position) zusammen. */
export function joinPdfItems(items: { str: string; transform: number[] }[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str?.trim()) continue;
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: it.transform[4], s: it.str.trim() });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(' '))
    .join('\n');
}
