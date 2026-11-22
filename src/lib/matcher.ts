/**
 * Ordnet Rechnungspositionen herstellerunabhängigen Wartungsarbeiten zu.
 * Die Begriffslisten decken gängige Bezeichnungen verschiedener Hersteller und Werkstätten ab
 * (z. B. „Pollenfilter“ = „Innenraumfilter“ = „Mikrofilter“).
 * Ergebnis sind VORSCHLÄGE – übernommen wird erst nach Bestätigung durch den Nutzer.
 */
import type { CategoryId } from './types';
import type { InvoiceAnalysis, InvoiceLine } from './invoice';

interface Rule {
  /** mögliche Katalogschlüssel – der erste beim Fahrzeug vorhandene wird verwendet */
  keys: string[];
  label: string;
  category: CategoryId;
  re: RegExp;
  /** Gruppe: Treffer derselben Gruppe werden zu einem Vorschlag zusammengefasst */
  group?: string;
  exclude?: RegExp;
}

const RULES: Rule[] = [
  { keys: ['motoroel'], label: 'Motoröl', category: 'motor', group: 'oel', re: /(motor(en)?[- ]?öl|ölwechsel|motoroel|oelwechsel|engine oil|\b\d{1,2}W-?\d{2}\b|longlife[- ]?öl|leichtlauföl)/i, exclude: /getriebe|differential|servo|hydraulik|ölfilter|ölstand|öldeckel|ölwanne|dichtung|kühler|ölverlust|ölleck/i },
  { keys: ['oelfilter'], label: 'Ölfilter', category: 'motor', group: 'oel', re: /(öl[- ]?filter|oelfilter|oil filter|filtereinsatz öl|ölfiltereinsatz)/i },
  { keys: ['luftfilter'], label: 'Luftfilter', category: 'motor', re: /(luft[- ]?filter|luftfiltereinsatz|air filter)/i },
  { keys: ['kraftstofffilter'], label: 'Kraftstofffilter', category: 'motor', re: /(kraftstoff[- ]?filter|diesel[- ]?filter|benzin[- ]?filter|fuel filter)/i },
  { keys: ['innenraumfilter'], label: 'Innenraumfilter', category: 'karosserie', re: /(innenraum[- ]?filter|pollen[- ]?filter|mikro[- ]?filter|aktivkohle[- ]?filter|cabin filter|staubfilter)/i },
  { keys: ['zuendkerzen'], label: 'Zündkerzen', category: 'motor', re: /(zünd[- ]?kerze|zuendkerze|spark plug)/i },
  { keys: ['gluehkerzen'], label: 'Glühkerzen', category: 'motor', re: /(glüh[- ]?kerze|gluehkerze|glow plug)/i },
  { keys: ['zahnriemen'], label: 'Zahnriemen', category: 'motor', group: 'zr', re: /(zahn[- ]?riemen|steuer[- ]?riemen|timing belt|zahnriemensatz|zahnriemenkit)/i },
  { keys: ['zahnriemenspanner'], label: 'Zahnriemenspanner', category: 'motor', group: 'zr', re: /(spannrolle|spanner zahnriemen|zahnriemenspanner|riemenspanner zahnriemen)/i },
  { keys: ['umlenkrollen'], label: 'Umlenkrollen', category: 'motor', group: 'zr', re: /(umlenk[- ]?rolle|führungsrolle|idler)/i },
  { keys: ['wasserpumpe'], label: 'Wasserpumpe', category: 'motor', group: 'zr', re: /(wasser[- ]?pumpe|kühlmittelpumpe|water pump)/i },
  { keys: ['keilrippenriemen'], label: 'Keilrippenriemen', category: 'motor', re: /(keil[- ]?rippen[- ]?riemen|keil[- ]?riemen|poly[- ]?v|zusatzaggregate riemen|aggregatriemen)/i },
  { keys: ['kuehlmittel'], label: 'Kühlmittel', category: 'motor', re: /(kühl[- ]?mittel|kuehlmittel|frostschutz|kühlerschutz|G1[123]\b|coolant)/i, exclude: /pumpe|schlauch|temperatur/i },
  { keys: ['batterie'], label: 'Batterie', category: 'motor', re: /(batterie|starterbatterie|akku 12)/i, exclude: /hochvolt|test|prüfen/i },
  { keys: ['getriebeoel'], label: 'Getriebeöl', category: 'antrieb', re: /(getriebe[- ]?öl|schaltgetriebeöl|getriebeoel|gear oil|MTF\b)/i, exclude: /automatik|ATF/i },
  { keys: ['automatikgetriebe'], label: 'Automatikgetriebe-Service', category: 'antrieb', re: /(ATF\b|automatik[- ]?getriebe[- ]?(öl|spülung|service)|DSG[- ]?(öl|service)|getriebespülung)/i },
  { keys: ['differential', 'hinterachsdiff'], label: 'Differentialöl', category: 'antrieb', re: /(differential|achsgetriebe[- ]?öl|hinterachs[- ]?öl|diff[- ]?öl)/i },
  { keys: ['verteilergetriebe', 'winkeltrieb', 'visco'], label: 'Verteilergetriebe / Allrad', category: 'antrieb', re: /(verteiler[- ]?getriebe|haldex|allrad[- ]?kupplung|winkeltrieb|visco)/i },
  { keys: ['kupplung'], label: 'Kupplung', category: 'antrieb', re: /(kupplung(ssatz|skit|sscheibe)?|ausrücklager|zweimassen)/i, exclude: /allrad|haldex|visco/i },
  { keys: ['achsmanschetten'], label: 'Achsmanschette', category: 'antrieb', re: /(achs[- ]?manschette|gelenkmanschette|faltenbalg antriebs)/i },
  { keys: ['antriebswellen'], label: 'Antriebswelle', category: 'antrieb', re: /(antriebs[- ]?welle|gelenkwelle|homokinetisch)/i },
  { keys: ['bremsfluessigkeit'], label: 'Bremsflüssigkeit', category: 'bremsen', re: /(brems[- ]?flüssigkeit|bremsfluessigkeit|DOT ?[345]|brake fluid)/i },
  { keys: ['belaege_vorne'], label: 'Bremsbeläge vorne', category: 'bremsen', re: /(brems[- ]?beläge?|bremsbelag|bremsklötze|brake pads?).*(vorn|VA\b|vorderachse)|(vorn|VA\b|vorderachse).*(brems[- ]?beläge?|bremsbelag|bremsklötze)/i },
  { keys: ['belaege_hinten'], label: 'Bremsbeläge hinten', category: 'bremsen', re: /(brems[- ]?beläge?|bremsbelag|bremsklötze|bremsbacken|brake pads?).*(hint|HA\b|hinterachse)|(hint|HA\b|hinterachse).*(brems[- ]?beläge?|bremsbelag|bremsklötze|bremsbacken)/i },
  { keys: ['scheiben_vorne'], label: 'Bremsscheiben vorne', category: 'bremsen', re: /(brems[- ]?scheibe).*(vorn|VA\b|vorderachse)|(vorn|VA\b|vorderachse).*(brems[- ]?scheibe)/i },
  { keys: ['scheiben_hinten'], label: 'Bremsscheiben hinten', category: 'bremsen', re: /(brems[- ]?scheibe|brems[- ]?trommel).*(hint|HA\b|hinterachse)|(hint|HA\b|hinterachse).*(brems[- ]?scheibe|brems[- ]?trommel)/i },
  { keys: ['stossdaempfer'], label: 'Stoßdämpfer', category: 'fahrwerk', re: /(stoß[- ]?dämpfer|stossdaempfer|federbein|shock absorber)/i },
  { keys: ['fahrwerk_gelenke', 'spurstangenkoepfe', 'traggelenke', 'koppelstangen'], label: 'Fahrwerksteile', category: 'fahrwerk', re: /(spurstange|traggelenk|führungsgelenk|koppelstange|querlenker|stabilisator|lenker(lager)?)/i },
  { keys: ['radlager'], label: 'Radlager', category: 'fahrwerk', re: /(rad[- ]?lager|wheel bearing)/i },
  { keys: ['achsvermessung'], label: 'Achsvermessung', category: 'fahrwerk', re: /(achs[- ]?vermessung|spur(einstellung|vermessung)|fahrwerksvermessung)/i },
  { keys: ['reifen'], label: 'Reifen', category: 'fahrwerk', re: /(reifen(wechsel|montage)?|räderwechsel|radwechsel|wuchten|\b\d{3}\/\d{2} ?R ?\d{2}\b)/i, exclude: /druck(kontrolle|sensor)/i },
  { keys: ['hu'], label: 'Hauptuntersuchung', category: 'karosserie', re: /(hauptuntersuchung|(?<![\wÄÖÜäöüß])(HU|AU)(?![\wÄÖÜäöüß]|\s?\d)|§ ?29|TÜV[- ]?(prüfung|abnahme|gebühr)|DEKRA|GTÜ|KÜS|abgasuntersuchung)/ },
  { keys: ['thermostat'], label: 'Thermostat', category: 'motor', re: /thermostat/i },
  { keys: ['turbolader'], label: 'Turbolader & Ladeluft', category: 'motor', re: /(turbolader|ladeluft|lader[- ]?(dichtung|montage)|montagesatz,? lader)/i },
  { keys: ['getriebelager'], label: 'Getriebelager', category: 'antrieb', re: /getriebe[- ]?lager/i },
  { keys: ['kardanwelle'], label: 'Kardanwelle', category: 'antrieb', re: /kardan/i },
  { keys: ['unterdruckschlaeuche'], label: 'Unterdruckschläuche', category: 'motor', re: /unterdruck[- ]?(schlauch|leitung)/i },
  { keys: ['kuehlmittelschlaeuche'], label: 'Kühlmittelschläuche', category: 'motor', re: /(kühlmittel|kühler|wasser)[- ]?(schlauch|rohr)/i },
  { keys: ['klima'], label: 'Klimaservice', category: 'karosserie', re: /(klima[- ]?(service|wartung|anlage|desinfektion|befüllung)|kältemittel|R1234yf|R134a)/i },
  { keys: ['wischer'], label: 'Scheibenwischer', category: 'karosserie', re: /(wischer[- ]?blatt|scheibenwischer|wischblätter|wiper)/i },
  { keys: ['beleuchtung'], label: 'Beleuchtung', category: 'karosserie', re: /(glühlampe|leuchtmittel|H[147]\b|scheinwerfer[- ]?(einstellung|lampe))/i }
];

const GROUP_TITLES: Record<string, (labels: string[]) => string> = {
  oel: (l) => (l.includes('Motoröl') && l.includes('Ölfilter') ? 'Motorölwechsel inkl. Ölfilter' : l.includes('Motoröl') ? 'Motorölwechsel' : 'Ölfilterwechsel'),
  zr: (l) => {
    const rest = l.filter((x) => x !== 'Zahnriemen');
    if (!l.includes('Zahnriemen')) return rest.join(', ');
    return rest.length ? `Zahnriemenwechsel inkl. ${rest.join(', ')}` : 'Zahnriemenwechsel';
  }
};

export interface Suggestion {
  id: string;
  title: string;
  /** Katalogschlüssel der erkannten Arbeiten (beim Fahrzeug aufzulösen) */
  keys: string[][];
  labels: string[];
  category: CategoryId;
  type: 'wartung' | 'reparatur';
  /** Summe der Beträge der zugeordneten Zeilen (nur Information, keine Kostenbuchung) */
  amount: number | null;
  lines: string[];
  confidence: 'hoch' | 'niedrig';
}

/** Erkennt Arbeiten in den Rechnungszeilen und fasst zusammengehörige zusammen. */
export function suggestMaintenance(a: InvoiceAnalysis, fullText = ''): Suggestion[] {
  const hits = new Map<string, { rule: Rule; lines: InvoiceLine[] }>();
  const scan = a.lines.length ? a.lines.filter((l) => l.kind !== 'versand') : fullText.split('\n').map((t) => ({ text: t, description: t, amount: null, kind: 'sonstig' as const, partNumber: null, manufacturer: null }));
  for (const line of scan) {
    for (const rule of RULES) {
      if (!rule.re.test(line.text)) continue;
      if (rule.exclude?.test(line.text)) continue;
      const k = rule.keys[0];
      const h = hits.get(k) ?? { rule, lines: [] };
      if (!h.lines.includes(line)) h.lines.push(line);
      hits.set(k, h);
    }
  }
  // Generische Bremsbeläge/-scheiben ohne Achsangabe nicht raten → Hinweis „Achse prüfen“
  if (!hits.has('belaege_vorne') && !hits.has('belaege_hinten')) {
    const l = scan.find((x) => /(brems[- ]?beläge?|bremsbelag|bremsklötze)/i.test(x.text));
    if (l) hits.set('belaege_vorne', { rule: { ...RULES.find((r) => r.keys[0] === 'belaege_vorne')!, label: 'Bremsbeläge (Achse prüfen)' }, lines: [l] });
  }
  if (!hits.has('scheiben_vorne') && !hits.has('scheiben_hinten')) {
    const l = scan.find((x) => /brems[- ]?scheibe/i.test(x.text));
    if (l) hits.set('scheiben_vorne', { rule: { ...RULES.find((r) => r.keys[0] === 'scheiben_vorne')!, label: 'Bremsscheiben (Achse prüfen)' }, lines: [l] });
  }

  const groups = new Map<string, { rules: Rule[]; lines: InvoiceLine[] }>();
  for (const [k, h] of hits) {
    const g = h.rule.group ?? k;
    const e = groups.get(g) ?? { rules: [], lines: [] };
    e.rules.push(h.rule);
    h.lines.forEach((l) => !e.lines.includes(l) && e.lines.push(l));
    groups.set(g, e);
  }

  const out: Suggestion[] = [];
  let n = 0;
  for (const [g, e] of groups) {
    const labels = e.rules.map((r) => r.label);
    const amounts = e.lines.map((l) => l.amount).filter((x): x is number => x !== null);
    const uncertain = labels.some((l) => l.includes('prüfen'));
    out.push({
      id: `s${n++}`,
      title: GROUP_TITLES[g]?.(labels) ?? labels.join(', '),
      keys: e.rules.map((r) => r.keys),
      labels,
      category: e.rules[0].category,
      type: 'wartung',
      amount: amounts.length ? Math.round(amounts.reduce((x, y) => x + y, 0) * 100) / 100 : null,
      lines: e.lines.map((l) => l.description || l.text),
      confidence: uncertain ? 'niedrig' : 'hoch'
    });
  }
  return out;
}

/** Ersatzteil-Kandidaten: nur Zeilen mit Teilenummer oder bekanntem Hersteller. Nichts wird ergänzt. */
export interface PartCandidate {
  id: string;
  name: string;
  manufacturer: string;
  partNumber: string;
  price: number | null;
  line: string;
}

export function extractParts(a: InvoiceAnalysis): PartCandidate[] {
  const out: PartCandidate[] = [];
  a.lines.forEach((l, i) => {
    if (l.kind === 'versand' || l.kind === 'arbeit') return;
    if (l.kind !== 'teil' && !(l.kind === 'betriebsstoff' && l.partNumber) && !(l.kind === 'sonstig' && l.amount !== null && a.purchaseType === 'teilekauf')) return;
    if (!l.partNumber && !l.manufacturer && a.purchaseType !== 'teilekauf') return;
    if (/^(rechnung|beleg|kunden|bestell|liefer|tel|fax|ust|steuer|iban|bic|tracking|seite|auftrag|total|invoice|vat|betrag|ebay|\d{5}\s)/i.test(l.text) || /#:|date:|betrag/i.test(l.text)) return;
    if (a.purchaseType === 'teilekauf' && l.amount === null && !l.partNumber) return;
    const name = (l.description || l.text).replace(/(art(ikel)?\.?[- ]?nr\.?|teile[- ]?nr\.?)/gi, ' ').replace(/\s{2,}/g, ' ').trim();
    out.push({ id: `p${i}`, name: name.slice(0, 80) || 'Ersatzteil', manufacturer: l.manufacturer ?? '', partNumber: l.partNumber ?? '', price: l.amount, line: l.text });
  });
  return out;
}
