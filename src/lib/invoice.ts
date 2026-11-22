/**
 * Regelbasierte Auswertung von Rechnungstext (deutsch), vollständig lokal.
 * Grundsatz: Es wird nur übernommen, was im Text steht. Nichts wird erfunden.
 * Jeder Wert trägt eine Sicherheit: 'hoch' = über eindeutige Beschriftung gefunden,
 * 'niedrig' = nur heuristisch (z. B. erstes Datum im Dokument) → in der App markiert.
 */

export type Confidence = 'hoch' | 'niedrig';
export interface Found<T> {
  value: T;
  confidence: Confidence;
  /** Textstelle, aus der der Wert stammt (zur Kontrolle) */
  source: string;
}

export interface InvoiceLine {
  text: string;
  amount: number | null;
  kind: 'arbeit' | 'teil' | 'betriebsstoff' | 'versand' | 'sonstig';
  /** bereinigte Bezeichnung (ohne Nummern, Mengen, Preise) */
  description: string;
  partNumber: string | null;
  manufacturer: string | null;
}

export interface InvoiceAnalysis {
  date: Found<string> | null;
  invoiceNo: Found<string> | null;
  vendor: Found<string> | null;
  total: Found<number> | null;
  vat: Found<number> | null;
  vatRate: number | null;
  km: Found<number> | null;
  plate: Found<string> | null;
  vin: Found<string> | null;
  lines: InvoiceLine[];
  laborTotal: number | null;
  fluids: string[];
  isInvoice: boolean;
  /** Werkstattrechnung (Arbeit wurde erbracht) oder reiner Teilekauf (Einbau unbekannt) */
  purchaseType: 'werkstatt' | 'teilekauf' | 'unbekannt';
}

/* ---------- Zahlen & Datum ---------- */

const AMOUNT_RE = /(?<![\d,.])-?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[,.]\d{2}(?![\d])/g;

/** „1.234,56“, „149,90“, „149.90“, „1 234,56“ → Zahl */
export function parseAmount(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(/€|EUR/gi, '');
  let n: number;
  if (/,\d{2}$/.test(t)) n = Number(t.replace(/\./g, '').replace(',', '.'));
  else if (/\.\d{2}$/.test(t)) n = Number(t.replace(/,/g, ''));
  else return null;
  return Number.isFinite(n) ? n : null;
}

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(AMOUNT_RE)) {
    // Datumsangaben wie 12.03 nicht als Betrag werten
    const before = line.slice(Math.max(0, (m.index ?? 0) - 1), m.index);
    const after = line.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 1);
    if (/\./.test(after) && /^\d/.test(line.slice((m.index ?? 0) + m[0].length + 1))) continue;
    if (before === '.') continue;
    const n = parseAmount(m[0]);
    if (n !== null) out.push(n);
  }
  return out;
}

const MONTHS: Record<string, number> = { januar: 1, jan: 1, februar: 2, feb: 2, märz: 3, maerz: 3, mär: 3, mrz: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6, juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11, dezember: 12, dez: 12 };

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y > 50 ? 1900 : 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1950 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** Alle Datumsangaben einer Zeile (deutsche Formate). */
export function datesIn(line: string): string[] {
  const out: string[] = [];
  for (const m of line.matchAll(/(?<!\d)(\d{1,2})\s?[./-]\s?(\d{1,2})\s?[./-]\s?(\d{4}|\d{2})(?!\d)/g)) {
    const d = iso(Number(m[3]), Number(m[2]), Number(m[1]));
    if (d) out.push(d);
  }
  for (const m of line.matchAll(/(?<!\d)(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]{3,9})\.?\s+(\d{4})/g)) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) {
      const d = iso(Number(m[3]), mon, Number(m[1]));
      if (d) out.push(d);
    }
  }
  for (const m of line.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) {
    const d = iso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (d) out.push(d);
  }
  return out;
}

/** „245.000“, „245 000“, „245000“ → 245000 */
function parseKm(s: string): number | null {
  const t = s.replace(/[.\s']/g, '');
  if (!/^\d{1,7}$/.test(t)) return null;
  const n = Number(t);
  return n >= 10 && n <= 2_000_000 ? n : null;
}

/* ---------- Bekannte Begriffe ---------- */

export const MANUFACTURERS = [
  'Bosch', 'Mann-Filter', 'Mann', 'Mahle', 'Knecht', 'Hengst', 'Purflux', 'Febi', 'Febi Bilstein', 'Bilstein', 'Lemförder', 'Sachs', 'ZF', 'ATE', 'Brembo', 'Textar', 'Ferodo', 'Zimmermann', 'TRW', 'Jurid', 'Pagid',
  'Gates', 'ContiTech', 'Continental', 'Dayco', 'INA', 'SKF', 'FAG', 'LuK', 'Valeo', 'Hella', 'Osram', 'Philips', 'NGK', 'Beru', 'Denso', 'Delphi', 'Meyle', 'Ruville', 'Swag', 'Topran', 'Corteco', 'Elring', 'Victor Reinz', 'Ajusa',
  'Castrol', 'Liqui Moly', 'Mobil', 'Shell', 'Total', 'Motul', 'Ravenol', 'Fuchs', 'Mannol', 'Varta', 'Exide', 'Banner', 'Michelin', 'Pirelli', 'Goodyear', 'Dunlop', 'Hankook', 'Nokian', 'BF Goodrich', 'Monroe', 'KYB', 'Koni', 'Eibach', 'H&R', 'Hepu', 'Saleri', 'Pierburg', 'Behr', 'Nissens', 'Magneti Marelli', 'Walker', 'Bosal', 'Original', 'OE', 'Mopar', 'Motorcraft', 'Genuine', 'Thermotec', 'JP Group', 'Blue Print', 'Vaico', 'Vemo', 'Metzger', 'Ridex', 'Stark', 'Maxgear', 'Herth+Buss', 'Lesjöfors', 'Seikel', 'Wahler', 'Gates', 'Optimal', 'Spidan', 'Löbro', 'GKN', 'Hepu', 'BorgWarner', 'Garrett', 'KKK', 'Bremi', 'Facet', 'Glyco', 'Kolbenschmidt'
];

const LABOR_RE = /\b(arbeits?(lohn|zeit|wert|kosten)?|lohn|AW\b|arbeitswert|montage|einbau|aus-? ?und einbau|ersetzen|erneuern|prüfen|diagnose|stunde|std\.?)\b/i;
const FLUID_RE = /\b(\d{1,2}W-?\d{2}|motor(en)?öl|getriebeöl|ATF|DOT ?[345](\.1)?|frostschutz|kühlmittel|G1[123]\+*|bremsflüssigkeit|servoöl|hydrauliköl|(VW|MB|BMW LL|Porsche|Ford|GM|Opel|Renault|PSA|Fiat)[ -]?\d{3}[ .]?\d{0,2}|ACEA ?[A-E]\d|API ?[A-Z]{2})\b/i;
const FLUID_SPEC_RE = /\b(\d{1,2}W-?\d{2}|DOT ?[345](?:\.1)?|ACEA ?[A-E]\d(?:\/[A-E]\d)*|API ?[A-Z]{2}(?:\/[A-Z]{2})?|(?:VW|MB|BMW LL|Porsche)[ -]?\d{2,3}[ .]?\d{0,2}|G1[123]\+*)\b/gi;

/** Teilenummer: 6–18 Zeichen, Ziffern + Buchstaben/Trenner, mind. 3 Ziffern, kein Datum/Betrag. */
function findPartNumber(line: string, manufacturer: string | null = null): string | null {
  // Direkt nach dem Herstellernamen steht oft die Teilenummer, auch mit Leerzeichen (z. B. „MANN HU 719/7 x“)
  if (manufacturer) {
    const idx = line.toLowerCase().indexOf(manufacturer.toLowerCase());
    if (idx >= 0) {
      const after = line.slice(idx + manufacturer.length);
      const m = after.match(/^\s+([A-Z0-9][A-Z0-9.\-/]*(?:\s[A-Z0-9][A-Z0-9.\-/]*){0,3}?)(?=\s+(?:x\b|\d+([,.]\d+)?\s?(?:stk|st|l|ltr|x)\b|\d+\s+\d|-?\d+[,.]\d{2}(?!\d))|\s*$)/);
      if (m && (m[1].match(/\d/g) ?? []).length >= 2 && !/^\d{1,2}W-?\d{2}$/i.test(m[1])) return m[1].trim();
    }
  }
  const labeled = line.match(/(?:art(?:ikel)?\.?[- ]?nr\.?|teile[- ]?nr\.?|teilenummer|best\.?[- ]?nr\.?|ET[- ]?Nr\.?)\s*[:#]?\s*([A-Z0-9][A-Z0-9 .\-/]{4,20}[A-Z0-9])/i);
  if (labeled) return labeled[1].trim();
  const tokens = line.match(/\b[A-Z0-9][A-Z0-9.\-/]{4,17}[A-Z0-9]\b/g) ?? [];
  for (const t of tokens) {
    const digits = (t.match(/\d/g) ?? []).length;
    if (digits < 3) continue;
    if (!/[A-Z]/.test(t) && !/[.\-/ ]/.test(t) && t.length < 8) continue; // reine kurze Zahl
    if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(t)) continue; // Datum
    if (/^\d+[.,]\d{2}$/.test(t)) continue; // Betrag
    if (/^\d{5}$/.test(t)) continue; // PLZ
    if (/^\d{1,2}W-?\d{2}$/i.test(t)) continue; // Ölviskosität
    if (/^(DE|AT)\d{9}$/.test(t)) continue; // USt-ID
    if (/^\d{1,3}(\.\d{3})+$/.test(t)) continue; // km-Angabe
    return t;
  }
  return null;
}

function findManufacturer(line: string): string | null {
  const lower = line.toLowerCase();
  // längere Namen zuerst (z. B. „Febi Bilstein“ vor „Febi“)
  const sorted = [...MANUFACTURERS].sort((a, b) => b.length - a.length);
  for (const m of sorted) {
    const re = new RegExp(`(^|[^a-zäöü])${m.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-zäöü]|$)`);
    if (re.test(lower)) return m;
  }
  return null;
}

const SKIP_LINE_RE = /\b(gesamt|summe|netto|brutto|mwst|ust\b|mehrwertsteuer|zwischensumme|rechnungsbetrag|endbetrag|zu zahlen|zahlbar|iban|bic|bank|konto|steuer-?nr|ust-?id|telefon|tel\.|fax|e-?mail|www\.|seite \d|übertrag|rabatt gesamt|skonto)\b/i;

/* ---------- Hauptfunktion ---------- */

export function analyzeInvoice(rawText: string): InvoiceAnalysis {
  const text = rawText.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lower = text.toLowerCase();

  // Datum
  let date: Found<string> | null = null;
  for (const l of lines) {
    if ((/(rechnungs|beleg|leistungs)?datum|rechnung vom|datum der rechnung|invoice date/i.test(l) && (!/fällig|zahlbar|liefer|bestell/i.test(l) || /rechnung/i.test(l))) || /^rechnung\s*(nr|nummer)/i.test(l)) {
      const d = datesIn(l);
      if (d.length) {
        date = { value: d[0], confidence: 'hoch', source: l };
        break;
      }
    }
  }
  if (!date) {
    // Tabellenkopf „… Datum“ mit Werten in der nächsten Zeile
    const i = lines.findIndex((l) => /datum/i.test(l) && !datesIn(l).length && (!/liefer|fällig|bestell/i.test(l) || /rechnung/i.test(l)));
    if (i >= 0 && lines[i + 1]) {
      const d = datesIn(lines[i + 1]);
      if (d.length) date = { value: d[d.length - 1], confidence: 'hoch', source: `${lines[i]} / ${lines[i + 1]}` };
    }
  }
  if (!date) {
    for (const l of lines) {
      if (/geburt|fällig|zahlbar bis|erstzulassung|EZ\b|HU bis|gültig/i.test(l)) continue;
      const d = datesIn(l);
      if (d.length) {
        date = { value: d[0], confidence: 'niedrig', source: l };
        break;
      }
    }
  }

  // Rechnungsnummer
  let invoiceNo: Found<string> | null = null;
  for (const l of lines) {
    const m = l.match(/(?:rechnungs?[- ]?(?:nr|nummer|no)\.?|rechnung\s+nr\.?|beleg[- ]?(?:nr|nummer)\.?|re\.?[- ]?nr\.?|invoice\s*(?:no|number)\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/]{2,20})/i);
    if (m && /\d/.test(m[1])) {
      invoiceNo = { value: m[1], confidence: 'hoch', source: l };
      break;
    }
  }
  if (!invoiceNo) {
    for (const l of lines.slice(0, 30)) {
      const m = l.match(/^rechnung\s*:?\s+([A-Z]{0,8}[-/]?\d[A-Z0-9\-/]{2,24})\b/i);
      if (m) {
        invoiceNo = { value: m[1], confidence: 'hoch', source: l };
        break;
      }
    }
  }
  // Spaltenkopf („Rechnungsnummer  Bestellnummer  Datum“) mit Werten in der Folgezeile
  const colValue = (label: RegExp): { value: string; source: string } | null => {
    for (let i = 0; i < lines.length - 1; i++) {
      const head = lines[i].split(/\s+/);
      const idx = head.findIndex((w) => label.test(w));
      if (idx < 0 || head.length < 2) continue;
      if (/\d/.test(lines[i])) continue;
      const vals = lines[i + 1].split(/\s+/);
      if (vals.length >= head.length && vals[idx]) return { value: vals[idx], source: `${lines[i]} / ${lines[i + 1]}` };
    }
    return null;
  };
  if (!invoiceNo) {
    const c = colValue(/^rechnungs?(nummer|nr\.?)$/i);
    if (c && /\d/.test(c.value)) invoiceNo = { value: c.value, confidence: 'hoch', source: c.source };
  }

  // Händler / Werkstatt – nur über Firmenkennzeichen oder Webadresse; sonst leer (nichts raten)
  let vendor: Found<string> | null = null;
  const LEGAL = /\b(gmbh|ag|kg|e\.\s?k\.?|ohg|ug|gbr|ltd|sas|sarl|s\.l\.|b\.v\.|inc|autohaus|werkstatt|kfz|auto ?service|car ?service|meisterbetrieb|reifen ?service|karosseriebau)\b/i;
  const vendorLine = lines.slice(0, 40).find((l) => LEGAL.test(l) && !/^(an|rechnungsempfänger|lieferanschrift|kunde)/i.test(l) && !/bank|iban|registergericht|geschäftsführer/i.test(l));
  if (vendorLine) {
    const name = vendorLine
      .split(/\s+[-–|/]\s+|,\s+/)[0]
      .replace(/^([^A-Za-zÄÖÜäöü0-9]+\s*|[A-Za-z]\s+)+(?=[A-ZÄÖÜ])/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    vendor = { value: name.slice(0, 80), confidence: 'hoch', source: vendorLine };
  } else {
    const web = text.match(/(?:www\.|@)([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:de|com|eu|at|ch|fr|nl|net|shop))/i);
    if (web && !/^(gmail|googlemail|icloud|me|mac|web|gmx|outlook|hotmail|yahoo|t-online|aol|freenet|posteo|mail)\./i.test(web[1])) vendor = { value: web[1], confidence: 'niedrig', source: web[0] };
  }

  // Gesamtbetrag (Priorität nach Beschriftung)
  let total: Found<number> | null = null;
  const TOTAL_KEYS: RegExp[] = [
    /rechnungs-?(end)?betrag|endbetrag|endsumme|gesamtsumme|gesamtbetrag|gesamt\s*-?\s*brutto|brutto[- ]?(gesamt|betrag|summe)|gesamt\s*inkl|inkl\.?\s*mwst\.?\s*$|zu zahlen|zahlbetrag|gesamtpreis|amount due|grand total/i,
    /gesamt|summe|total/i
  ];
  for (const re of TOTAL_KEYS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      if (!re.test(l) || /netto|zwischen|exkl|ohne|offener betrag|enthält|enthaltene|von \d/i.test(l)) continue;
      let a = amountsIn(l);
      if (!a.length && lines[i + 1]) a = amountsIn(lines[i + 1]);
      if (a.length) {
        total = { value: a[a.length - 1], confidence: 'hoch', source: l };
        break;
      }
    }
    if (total) break;
  }
  if (!total) {
    const all = lines.flatMap(amountsIn);
    if (all.length) total = { value: Math.max(...all), confidence: 'niedrig', source: 'größter Betrag im Dokument' };
  }

  // MwSt.
  let vat: Found<number> | null = null;
  let vatRate: number | null = null;
  for (const l of lines) {
    if (!/(mwst|ust\b|u\.?st\.?|mehrwertsteuer|umsatzsteuer)/i.test(l) || /ust-?id|steuer-?nr|ident|exkl|ohne|netto|zzgl\.? versand|satz\s*$/i.test(l)) continue;
    const rate = l.match(/(?<![\d,.])(\d{1,2})(?:[,.]\d{1,2})?\s?%/);
    if (rate) vatRate = Number(rate[1]);
    const a = amountsIn(l).filter((n) => !rate || n !== Number(rate[1]));
    if (a.length) {
      vat = { value: a[a.length - 1], confidence: 'hoch', source: l };
      break;
    }
  }
  if (vat && total && vat.value >= total.value) vat = { ...vat, confidence: 'niedrig' };

  // Plausibilitätsprüfung: Gesamtbetrag ≈ MwSt. × (100 + Satz) / Satz
  if (vat && vatRate && vatRate > 0 && vat.confidence === 'hoch') {
    const expected = (vat.value * (100 + vatRate)) / vatRate;
    const tol = Math.max(0.1, expected * 0.002);
    if (!total || Math.abs(total.value - expected) > tol) {
      const candidates = lines.flatMap(amountsIn).filter((n) => Math.abs(n - expected) <= tol);
      if (candidates.length) total = { value: candidates[candidates.length - 1], confidence: total ? 'niedrig' : 'niedrig', source: 'passt zur ausgewiesenen MwSt.' };
      else if (total) total = { ...total, confidence: 'niedrig' };
    }
  }

  // Kilometerstand
  let km: Found<number> | null = null;
  for (const l of lines) {
    const m =
      l.match(/(?:km[- .]?stand|kilometer(?:stand)?|laufleistung|tacho(?:stand)?|km-?zähler|gelaufen)\s*[:.]?\s*(?:ca\.?\s*)?(\d{1,3}(?:[.\s']\d{3})+|\d{3,7})/i) ??
      l.match(/(?<![\d,])(\d{1,3}(?:[.\s']\d{3})+|\d{4,7})\s?km\b(?!\/h)/i);
    if (m) {
      const n = parseKm(m[1]);
      if (n !== null) {
        km = { value: n, confidence: /stand|kilometer|laufleistung|tacho/i.test(l) ? 'hoch' : 'niedrig', source: l };
        break;
      }
    }
  }

  // Kennzeichen (deutsches Format) & FIN
  let plate: Found<string> | null = null;
  for (const l of lines) {
    const m = l.match(/\b([A-ZÄÖÜ]{1,3})[- ]([A-Z]{1,2})[- ]?(\d{1,4}[EH]?)\b/);
    if (m && /kennz|amtl|kfz-?kz|\bkz\.?:/i.test(l)) {
      plate = { value: `${m[1]}-${m[2]} ${m[3]}`, confidence: 'hoch', source: l };
      break;
    }
  }
  let vin: Found<string> | null = null;
  const vinM = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  if (vinM && /\d/.test(vinM[1]) && /[A-Z]/.test(vinM[1])) vin = { value: vinM[1], confidence: /fin|fahrgestell|vin|ident/i.test(lower) ? 'hoch' : 'niedrig', source: vinM[1] };

  // Positionen – bevorzugt aus der Positionstabelle (zwischen Tabellenkopf und Summenblock)
  const headerIdx = lines.findIndex((l) => /(pos\.?|position)\b.*(bezeichnung|artikel|beschreibung)|(art(ikel)?\.?\s?-?\s?nr\.?|artikelnummer|artikel-code)\b.*(bezeichnung|beschreibung)|beschreibung\b.*(menge|anzahl|preis)|bezeichnung\b.*(menge|anzahl|preis)/i.test(l));
  const hasArtCol = headerIdx >= 0 && /(art(ikel)?\.?\s?-?\s?nr|artikelnummer|artnr|nummer|artikel\b)/i.test(lines[headerIdx]);
  let region = lines;
  if (headerIdx >= 0) {
    const rest = lines.slice(headerIdx + 1);
    const endIdx = rest.findIndex((l) => /^(zwischensumme|summe|gesamt|total|netto|nettobetrag|endsumme|rechnungsbetrag|mwst|umsatzsteuer|zzgl|enthält|betrag wurde|zahlung)/i.test(l));
    region = endIdx >= 0 ? rest.slice(0, endIdx) : rest;
  }

  const items: InvoiceLine[] = [];
  let laborTotal = 0;
  let laborFound = false;
  const SHIP_RE = /(versand|\bdhl\b|\bdpd\b|\bups\b|\bgls\b|hermes|\bpaket\b|porto|fracht|sperrgut|zahlungskosten|nachnahme)/i;
  const cleanDesc = (t: string, partNo: string | null) => {
    let d = t;
    if (partNo) d = d.replace(partNo, ' ');
    return d
      .replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, ' ')
      .replace(/€?\s?(?<![\d,.])-?(?:\d{1,3}(?:[.\s]\d{3})+|\d+)[,.]\d{2}(?!\d)\s?(€|EUR)?/g, ' ')
      .replace(/(^|\s)[A-Z]\s-\s(\d+\s-\s)+/g, ' ')
      .replace(/\(?\b\d{1,2}([,.]\d+)?\s?%\)?/g, ' ')
      .replace(/\b\d+([,.]\d+)?\s?(stk|stück|st|x|l|ltr|liter|me)\b\.?/gi, ' ')
      .replace(/^\s*\d{1,3}\s+(\d{1,3}\s+)?/, '')
      .replace(/\b(EUR|Stk|Stück)\b/g, ' ')
      .replace(/\s+\d{1,2}\s*$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  for (const l of region) {
    if (SKIP_LINE_RE.test(l) && headerIdx < 0) continue;
    if (!/[A-Za-zÄÖÜäöü]{3,}/.test(l)) continue;
    const amounts = amountsIn(l);
    const startsWithPos = /^\d{1,3}\s+\S/.test(l);
    // Fortsetzungszeile (ohne Position/Preis) → zur vorherigen Position
    if (headerIdx >= 0 && items.length && !amounts.length && !startsWithPos) {
      const prev = items[items.length - 1];
      prev.text += ' ' + l;
      prev.manufacturer = prev.manufacturer ?? findManufacturer(l);
      if (!prev.partNumber) prev.partNumber = findPartNumber(l, prev.manufacturer);
      continue;
    }
    if (headerIdx < 0 && SKIP_LINE_RE.test(l)) continue;
    const isLabor = LABOR_RE.test(l);
    const isFluid = FLUID_RE.test(l);
    const manu = findManufacturer(l);
    let partNo: string | null = null;
    if (hasArtCol && startsWithPos) {
      // Spalte Artikelnummer: erstes Token mit Ziffer nach Pos (und ggf. Menge/Einheit)
      const m = l.match(/^\d{1,3}\s+(?:\d{1,3}\s+(?:stück|stk\.?)?\s*)?([A-Z0-9][A-Z0-9.\-/]{2,24})\b/i);
      if (m && /\d/.test(m[1]) && /[0-9]{3,}|[A-Z]{2,}\d/i.test(m[1])) partNo = m[1];
    }
    partNo = partNo ?? findPartNumber(l, manu);
    if (!amounts.length && !partNo && !isFluid) continue;
    const amount = amounts.length ? amounts[amounts.length - 1] : null;
    const kind: InvoiceLine['kind'] = SHIP_RE.test(l) && !isFluid && l.length < 70 ? 'versand' : isFluid ? 'betriebsstoff' : isLabor && !partNo ? 'arbeit' : partNo || manu ? 'teil' : 'sonstig';
    if (kind === 'arbeit' && amount !== null) {
      laborTotal += amount;
      laborFound = true;
    }
    items.push({ text: l, description: '', amount, kind, partNumber: partNo, manufacturer: manu });
  }
  items.forEach((it) => (it.description = cleanDesc(it.text, it.partNumber).slice(0, 120)));

  const fluids = [...new Set((text.match(FLUID_SPEC_RE) ?? []).map((f) => f.toUpperCase().replace(/\s+/g, ' ')))];

  const isInvoice = /rechnung|invoice|quittung|beleg|kassenbon|gesamtbetrag|zu zahlen/i.test(text);
  const shopSignals = (text.match(/\b(versand(art|kosten)?|dhl|paket(dienst)?|widerruf|ebay|paypal|bestell(ung|nummer|datum)|lieferdatum|tracking|onlineshop|warenkorb)\b/gi) ?? []).length;
  const workshopSignals = (text.match(/\b(arbeitslohn|arbeitswert|\bAW\b|montage|lohn|werkstatt|km[- ]?stand|kilometerstand|kennzeichen|fahrzeug[- ]?ident|erstzulassung|auftragsannahme|reparaturauftrag)\b/gi) ?? []).length + (laborFound ? 3 : 0);
  const purchaseType: InvoiceAnalysis['purchaseType'] = workshopSignals >= 2 && workshopSignals >= shopSignals ? 'werkstatt' : shopSignals >= 2 ? 'teilekauf' : 'unbekannt';

  return { date, invoiceNo, vendor, total, vat, vatRate, km, plate, vin, lines: items, laborTotal: laborFound ? Math.round(laborTotal * 100) / 100 : null, fluids, isInvoice, purchaseType };
}
