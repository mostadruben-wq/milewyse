import type { CategoryId, DriveType, FuelType, ItemKind, MaintenanceItem, SourceType, Vehicle } from '../lib/types';

/**
 * Wartungsdatenbank – herstellerunabhängig.
 * GENERIC_DEFS gilt für jedes Fahrzeug und wird nach Kraftstoff/Antrieb gefiltert.
 * T4_DEFS ist eine optionale Vorlage für den VW T4 2.5 TDI (AXL) Syncro.
 *
 * WICHTIG – Sicherheitsregel:
 * In diesem Katalog sind KEINE Werte als verifizierte VW-Herstellerangabe ('vw') hinterlegt.
 * - 'empfehlung': allgemein fachlich übliche Kontrollrhythmen (z. B. jährliche Sichtprüfung,
 *   Bremsflüssigkeit alle 2 Jahre). Sie ersetzen keinen Serviceplan.
 * - 'ungeprueft': Startwerte, damit die App sofort rechnen kann. Bitte mit Serviceheft,
 *   Werkstatt oder VW-Unterlagen abgleichen und danach als 'vw' oder 'benutzer' markieren.
 * - Intervall null: bewusst leer gelassen, weil für den AXL unterschiedliche Angaben kursieren
 *   oder die Wartung stark von Ausstattung/Getriebekennbuchstaben abhängt.
 * Ölspezifikationen und Füllmengen sind grundsätzlich leer und müssen vom Nutzer eingetragen werden.
 */

export const CATEGORIES: { id: CategoryId; name: string; icon: string }[] = [
  { id: 'motor', name: 'Motor', icon: 'engine' },
  { id: 'antrieb', name: 'Getriebe & Antrieb', icon: 'gear' },
  { id: 'bremsen', name: 'Bremsanlage', icon: 'brake' },
  { id: 'fahrwerk', name: 'Fahrwerk & Lenkung', icon: 'wheel' },
  { id: 'karosserie', name: 'Karosserie & Sonstiges', icon: 'van' }
];

export const categoryName = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

interface Def {
  id: string;
  /** nur für diese Kraftstoffarten */
  fuel?: FuelType[];
  /** nur für diese Antriebsarten */
  drive?: DriveType[];
  name: string;
  kind?: ItemKind;
  km?: number | null;
  months?: number | null;
  src?: SourceType;
  desc?: string;
  related?: string[];
  enabled?: boolean;
}

const PRUEF_12: Partial<Def> = { kind: 'pruefung', months: 12, src: 'empfehlung' };

const T4_DEFS: Record<CategoryId, Def[]> = {
  motor: [
    { id: 'motoroel', name: 'Motoröl', km: 10000, months: 12, src: 'ungeprueft', related: ['oelfilter'], desc: 'Ölwechsel. Ölspezifikation (VW-Norm) und Füllmenge bitte aus Betriebsanleitung/Serviceunterlagen eintragen.' },
    { id: 'oelfilter', name: 'Ölfilter', km: 10000, months: 12, src: 'ungeprueft', related: ['motoroel'], desc: 'Wird üblicherweise zusammen mit dem Motoröl gewechselt.' },
    { id: 'luftfilter', name: 'Luftfilter', km: 30000, months: 24, src: 'ungeprueft', desc: 'Bei viel Staub/Offroad häufiger prüfen.' },
    { id: 'kraftstofffilter', name: 'Kraftstofffilter', km: 30000, months: 24, src: 'ungeprueft', desc: 'Dieselfilter inkl. Entwässerung. Nach dem Wechsel auf Luft im System achten.' },
    { id: 'zahnriemen', name: 'Zahnriemen', km: null, months: null, desc: 'Intervall bitte aus Serviceunterlagen eintragen – für den AXL kursieren unterschiedliche Angaben. Kritisches Bauteil: Riss führt zu Motorschaden.', related: ['zahnriemenspanner', 'umlenkrollen', 'wasserpumpe', 'esp_riemen'] },
    { id: 'zahnriemenspanner', name: 'Zahnriemenspanner', km: null, months: null, desc: 'Wird meist zusammen mit dem Zahnriemen erneuert.', related: ['zahnriemen'] },
    { id: 'umlenkrollen', name: 'Umlenkrollen', km: null, months: null, desc: 'Wird meist zusammen mit dem Zahnriemen erneuert.', related: ['zahnriemen'] },
    { id: 'wasserpumpe', name: 'Wasserpumpe', km: null, months: null, desc: 'Wird häufig beim Zahnriemenwechsel mit erneuert.', related: ['zahnriemen', 'kuehlmittel'] },
    { id: 'esp_riemen', name: 'Einspritzpumpen-Zahnriemen inkl. Komponenten', km: null, months: null, desc: 'Separater Riemen zur Einspritzpumpe. Intervall und zugehörige Teile bitte verifizieren.', related: ['zahnriemen'] },
    { id: 'keilrippenriemen', name: 'Keilrippenriemen', km: null, months: 12, kind: 'wechsel', src: 'empfehlung', desc: 'Jährliche Sichtprüfung auf Risse und Verschleiß empfohlen; Wechselintervall bitte selbst festlegen.', related: ['riemenspanner'] },
    { id: 'riemenspanner', name: 'Riemenspanner (Keilrippenriemen)', km: null, months: null, related: ['keilrippenriemen'] },
    { id: 'kuehlmittel', name: 'Kühlmittel', km: null, months: null, desc: 'Frostschutz jährlich vor dem Winter prüfen. Kühlmittelspezifikation bitte verifizieren.', related: ['kuehlmittelschlaeuche', 'thermostat'] },
    { id: 'kuehlmittelschlaeuche', name: 'Kühlmittelschläuche', ...PRUEF_12, desc: 'Sichtprüfung auf Risse, Porosität und Undichtigkeiten.' },
    { id: 'thermostat', name: 'Thermostat', km: null, months: null },
    { id: 'gluehkerzen', name: 'Glühkerzen', km: null, months: null, desc: 'Vor dem Winter prüfen, wenn der Motor schlecht kalt anspringt.' },
    { id: 'unterdruckschlaeuche', name: 'Unterdruckschläuche', ...PRUEF_12, desc: 'Alte Unterdruckleitungen werden spröde – Ladedruck- und Bremskraftverstärker-Funktion hängen daran.' },
    { id: 'turbolader', name: 'Turbolader & Ladeluftsystem', ...PRUEF_12, desc: 'Sichtprüfung Ladeluftschläuche, Ölverlust, Pfeifgeräusche.' },
    { id: 'kurbelgehaeuse', name: 'Kurbelgehäuseentlüftung', ...PRUEF_12 },
    { id: 'ansaugtrakt', name: 'Ansaugtrakt', ...PRUEF_12 },
    { id: 'batterie', name: 'Batterie', ...PRUEF_12, desc: 'Ruhespannung, Pole und Befestigung prüfen. Ggf. Zweitbatterie separat anlegen.' },
    { id: 'lichtmaschine', name: 'Lichtmaschine', ...PRUEF_12, desc: 'Ladespannung prüfen.' },
    { id: 'anlasser', name: 'Anlasser', km: null, months: null }
  ],
  antrieb: [
    { id: 'getriebeoel', name: 'Schaltgetriebeöl', km: null, months: null, desc: 'Spezifikation und Füllmenge hängen vom Getriebekennbuchstaben ab – bitte verifizieren.' },
    { id: 'winkeltrieb', name: 'Winkeltrieb / Vorderachsantrieb', km: null, months: null, desc: 'Öl und Dichtigkeit. Spezifikation bitte verifizieren.', related: ['visco'] },
    { id: 'hinterachsdiff', name: 'Hinterachsdifferentialöl', km: null, months: null, desc: 'Spezifikation und Füllmenge bitte verifizieren.', related: ['getriebeoel'] },
    { id: 'kardanwelle', name: 'Kardanwelle', ...PRUEF_12, desc: 'Spiel und Geräusche prüfen.', related: ['kardanlager', 'gelenke'] },
    { id: 'kardanlager', name: 'Kardanwellenlager', ...PRUEF_12, related: ['kardanwelle'] },
    { id: 'gelenke', name: 'Gelenke (Kardan)', ...PRUEF_12, related: ['kardanwelle'] },
    { id: 'visco', name: 'Visco-Kupplung', ...PRUEF_12, desc: 'Funktionsprüfung des Allradantriebs. Prüfverfahren bitte aus Fachliteratur übernehmen.' },
    { id: 'antriebswellen', name: 'Antriebswellen', ...PRUEF_12, related: ['antriebswellengelenke', 'achsmanschetten'] },
    { id: 'antriebswellengelenke', name: 'Antriebswellengelenke', ...PRUEF_12, related: ['achsmanschetten'] },
    { id: 'achsmanschetten', name: 'Achsmanschetten', ...PRUEF_12, desc: 'Risse führen schnell zu Gelenkschäden – besonders nach Offroad prüfen.' },
    { id: 'getriebelager', name: 'Getriebelager', ...PRUEF_12 },
    { id: 'kupplung', name: 'Kupplung', km: null, months: null },
    { id: 'schaltgestaenge', name: 'Schaltgestänge', ...PRUEF_12 }
  ],
  bremsen: [
    { id: 'bremsfluessigkeit', name: 'Bremsflüssigkeit', km: null, months: 24, src: 'empfehlung', desc: 'Bremsflüssigkeit ist hygroskopisch; ein Wechsel alle 2 Jahre ist fachlich üblich. Spezifikation bitte verifizieren.' },
    { id: 'belaege_vorne', name: 'Bremsbeläge vorne', ...PRUEF_12, related: ['scheiben_vorne'] },
    { id: 'belaege_hinten', name: 'Bremsbeläge hinten', ...PRUEF_12, related: ['scheiben_hinten'] },
    { id: 'scheiben_vorne', name: 'Bremsscheiben vorne', ...PRUEF_12, related: ['belaege_vorne'] },
    { id: 'scheiben_hinten', name: 'Bremsscheiben hinten', ...PRUEF_12, related: ['belaege_hinten'] },
    { id: 'bremsschlaeuche', name: 'Bremsschläuche', ...PRUEF_12 },
    { id: 'bremsleitungen', name: 'Bremsleitungen', ...PRUEF_12, desc: 'Auf Korrosion prüfen – beim älteren T4 ein häufiges HU-Thema.' },
    { id: 'handbremse', name: 'Handbremse', ...PRUEF_12 },
    { id: 'abs', name: 'ABS-System', ...PRUEF_12, desc: 'Kontrollleuchte, Sensoren und Leitungen.' }
  ],
  fahrwerk: [
    { id: 'stossdaempfer', name: 'Stoßdämpfer', ...PRUEF_12 },
    { id: 'traggelenke', name: 'Traggelenke', ...PRUEF_12 },
    { id: 'fuehrungsgelenke', name: 'Führungsgelenke', ...PRUEF_12 },
    { id: 'spurstangen', name: 'Spurstangen', ...PRUEF_12, related: ['spurstangenkoepfe', 'achsvermessung'] },
    { id: 'spurstangenkoepfe', name: 'Spurstangenköpfe', ...PRUEF_12, related: ['achsvermessung'] },
    { id: 'koppelstangen', name: 'Koppelstangen', ...PRUEF_12 },
    { id: 'stabilager', name: 'Stabilisatorlager', ...PRUEF_12 },
    { id: 'radlager', name: 'Radlager', ...PRUEF_12 },
    { id: 'lenkgetriebe', name: 'Lenkgetriebe', ...PRUEF_12 },
    { id: 'servooel', name: 'Servolenkungsflüssigkeit', ...PRUEF_12, desc: 'Füllstand prüfen. Spezifikation bitte verifizieren.' },
    { id: 'achsvermessung', name: 'Achsvermessung', km: null, months: null, desc: 'Nach Arbeiten an Lenkung/Fahrwerk oder Höherlegung.' }
  ],
  karosserie: [
    { id: 'hu', name: 'Hauptuntersuchung (HU/TÜV)', kind: 'pruefung', km: null, months: 24, src: 'ungeprueft', desc: 'Frist hängt von der Zulassungsart ab (z. B. Pkw, Lkw, Wohnmobil) – bitte anhand der Fahrzeugpapiere prüfen.' },
    { id: 'rost', name: 'Rostkontrolle', ...PRUEF_12, desc: 'Typische Stellen am T4: Radläufe, Schweller, Wagenheberaufnahmen, Türunterkanten, Schiebetürschiene.' },
    { id: 'unterboden', name: 'Unterboden', ...PRUEF_12 },
    { id: 'hohlraum', name: 'Hohlraumkonservierung', km: null, months: null },
    { id: 'unterbodenschutz', name: 'Unterbodenschutz', km: null, months: null },
    { id: 'tuerdichtungen', name: 'Türdichtungen', ...PRUEF_12 },
    { id: 'schiebetuer', name: 'Schiebetürmechanik', ...PRUEF_12, desc: 'Laufschienen reinigen und schmieren.' },
    { id: 'wischer', name: 'Scheibenwischer', kind: 'wechsel', km: null, months: 12, src: 'empfehlung' },
    { id: 'beleuchtung', name: 'Beleuchtung', kind: 'pruefung', km: null, months: 6, src: 'empfehlung' },
    { id: 'reifen', name: 'Reifen', kind: 'pruefung', km: null, months: 6, src: 'empfehlung', desc: 'Profil, Alter (DOT), Schäden. Saisonwechsel als Anlass nutzen.', related: ['radlager', 'belaege_vorne', 'belaege_hinten'] },
    { id: 'ersatzrad', name: 'Ersatzrad', ...PRUEF_12, desc: 'Luftdruck, Alter, Bordwerkzeug.' },
    { id: 'klima', name: 'Klimaanlage', ...PRUEF_12, enabled: false, desc: 'Nur falls verbaut – sonst deaktiviert lassen.' },
    { id: 'innenraumfilter', name: 'Innenraumfilter', kind: 'wechsel', km: null, months: 12, src: 'ungeprueft', enabled: false, desc: 'Nur falls vorhanden.' },
    { id: 'standheizung', name: 'Standheizung', ...PRUEF_12, enabled: false, desc: 'Nur falls verbaut. Vor der Heizsaison testen.' }
  ]
};

const COMBUSTION: FuelType[] = ['diesel', 'benzin', 'hybrid', 'gas'];

/** Allgemeiner Katalog für alle Marken. Intervalle nur als Empfehlung/ungeprüft oder leer. */
const GENERIC_DEFS: Record<CategoryId, Def[]> = {
  motor: [
    { id: 'motoroel', name: 'Motoröl', fuel: COMBUSTION, km: 15000, months: 12, src: 'ungeprueft', related: ['oelfilter'], desc: 'Intervall, Ölspezifikation und Füllmenge bitte aus Betriebsanleitung/Serviceheft übernehmen.' },
    { id: 'oelfilter', name: 'Ölfilter', fuel: COMBUSTION, km: 15000, months: 12, src: 'ungeprueft', related: ['motoroel'] },
    { id: 'luftfilter', name: 'Luftfilter', fuel: COMBUSTION, km: null, months: 24, src: 'ungeprueft' },
    { id: 'kraftstofffilter', name: 'Kraftstofffilter', fuel: ['diesel', 'benzin', 'hybrid'], km: null, months: null },
    { id: 'zuendkerzen', name: 'Zündkerzen', fuel: ['benzin', 'hybrid', 'gas'], km: null, months: null },
    { id: 'gluehkerzen', name: 'Glühkerzen', fuel: ['diesel'], km: null, months: null },
    { id: 'zahnriemen', name: 'Zahnriemen / Steuerkette', fuel: COMBUSTION, km: null, months: null, desc: 'Bei Zahnriemen: Intervall unbedingt aus Herstellerunterlagen eintragen. Bei Steuerkette meist nur Kontrolle bei Geräuschen.', related: ['zahnriemenspanner', 'umlenkrollen', 'wasserpumpe'] },
    { id: 'zahnriemenspanner', name: 'Zahnriemenspanner', fuel: COMBUSTION, km: null, months: null, desc: 'Wird meist zusammen mit dem Zahnriemen erneuert.', related: ['zahnriemen'] },
    { id: 'umlenkrollen', name: 'Umlenkrollen', fuel: COMBUSTION, km: null, months: null, desc: 'Wird meist zusammen mit dem Zahnriemen erneuert.', related: ['zahnriemen'] },
    { id: 'wasserpumpe', name: 'Wasserpumpe', fuel: COMBUSTION, km: null, months: null, related: ['zahnriemen', 'kuehlmittel'] },
    { id: 'keilrippenriemen', name: 'Keilrippenriemen', fuel: COMBUSTION, km: null, months: 12, src: 'empfehlung', desc: 'Jährliche Sichtprüfung empfohlen.' },
    { id: 'kuehlmittel', name: 'Kühlmittel', km: null, months: null, desc: 'Frostschutz vor dem Winter prüfen.' },
    { id: 'batterie', name: 'Batterie (12 V)', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'hv_batterie', name: 'Hochvoltbatterie (Check)', fuel: ['elektro', 'hybrid'], kind: 'pruefung', km: null, months: null, desc: 'Prüfintervall laut Hersteller eintragen.' }
  ],
  antrieb: [
    { id: 'getriebeoel', name: 'Getriebeöl', km: null, months: null, desc: 'Spezifikation hängt vom Getriebe ab – bitte verifizieren.' },
    { id: 'automatikgetriebe', name: 'Automatikgetriebe-Service', km: null, months: null, enabled: false, desc: 'Nur bei Automatik.' },
    { id: 'differential', name: 'Differentialöl', drive: ['heck', 'allrad'], km: null, months: null },
    { id: 'verteilergetriebe', name: 'Verteilergetriebe / Allradkupplung', drive: ['allrad'], km: null, months: null, desc: 'Öl bzw. Kupplungsöl laut Hersteller.' },
    { id: 'kupplung', name: 'Kupplung', km: null, months: null },
    { id: 'achsmanschetten', name: 'Achsmanschetten', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'antriebswellen', name: 'Antriebswellen & Gelenke', kind: 'pruefung', months: 12, src: 'empfehlung' }
  ],
  bremsen: [
    { id: 'bremsfluessigkeit', name: 'Bremsflüssigkeit', km: null, months: 24, src: 'empfehlung', desc: 'Wechsel alle 2 Jahre ist fachlich üblich. Spezifikation laut Hersteller.' },
    { id: 'belaege_vorne', name: 'Bremsbeläge vorne', kind: 'pruefung', months: 12, src: 'empfehlung', related: ['scheiben_vorne'] },
    { id: 'belaege_hinten', name: 'Bremsbeläge hinten', kind: 'pruefung', months: 12, src: 'empfehlung', related: ['scheiben_hinten'] },
    { id: 'scheiben_vorne', name: 'Bremsscheiben vorne', kind: 'pruefung', months: 12, src: 'empfehlung', related: ['belaege_vorne'] },
    { id: 'scheiben_hinten', name: 'Bremsscheiben / -trommeln hinten', kind: 'pruefung', months: 12, src: 'empfehlung', related: ['belaege_hinten'] },
    { id: 'bremsleitungen', name: 'Bremsleitungen & -schläuche', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'handbremse', name: 'Handbremse', kind: 'pruefung', months: 12, src: 'empfehlung' }
  ],
  fahrwerk: [
    { id: 'stossdaempfer', name: 'Stoßdämpfer', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'fahrwerk_gelenke', name: 'Gelenke, Lager & Spurstangen', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'radlager', name: 'Radlager', kind: 'pruefung', months: 12, src: 'empfehlung' },
    { id: 'achsvermessung', name: 'Achsvermessung', km: null, months: null },
    { id: 'reifen', name: 'Reifen', kind: 'pruefung', km: null, months: 6, src: 'empfehlung', desc: 'Profil, Alter (DOT), Schäden.' }
  ],
  karosserie: [
    { id: 'hu', name: 'Hauptuntersuchung (HU/TÜV)', kind: 'pruefung', km: null, months: 24, src: 'ungeprueft', desc: 'Frist hängt von Zulassungsart und Fahrzeugalter ab – bitte anhand der Fahrzeugpapiere prüfen.' },
    { id: 'innenraumfilter', name: 'Innenraum-/Pollenfilter', kind: 'wechsel', km: null, months: 12, src: 'ungeprueft' },
    { id: 'klima', name: 'Klimaanlage', kind: 'pruefung', km: null, months: 24, src: 'ungeprueft' },
    { id: 'wischer', name: 'Scheibenwischer', kind: 'wechsel', km: null, months: 12, src: 'empfehlung' },
    { id: 'beleuchtung', name: 'Beleuchtung', kind: 'pruefung', km: null, months: 6, src: 'empfehlung' },
    { id: 'rost', name: 'Rost- & Unterbodenkontrolle', kind: 'pruefung', months: 12, src: 'empfehlung' }
  ]
};

export const TEMPLATES: { id: TemplateIdLocal; name: string; description: string }[] = [
  { id: 'generic', name: 'Allgemein', description: 'Für jede Marke – angepasst an Kraftstoff und Antrieb.' },
  { id: 't4-syncro', name: 'VW T4 2.5 TDI Syncro (AXL)', description: 'Erweiterte Liste mit Syncro-Allrad, Visco-Kupplung, Winkeltrieb und T4-typischen Stellen.' }
];
type TemplateIdLocal = 'generic' | 't4-syncro';

function makeItem(vehicleId: string, cat: CategoryId, d: Def): MaintenanceItem {
  return {
    id: `${vehicleId}.${d.id}`,
    vehicleId,
    key: d.id,
    name: d.name,
    category: cat,
    kind: d.kind ?? 'wechsel',
    description: d.desc ?? '',
    enabled: d.enabled ?? true,
    custom: false,
    lastDate: null,
    lastKm: null,
    intervalKm: d.km ?? null,
    intervalMonths: d.months ?? null,
    intervalSource: d.src ?? 'ungeprueft',
    warnKm: null,
    warnDays: null,
    parts: '',
    partNumbers: '',
    fluidSpec: '',
    fluidSpecSource: 'ungeprueft',
    capacity: '',
    capacitySource: 'ungeprueft',
    cost: null,
    notes: '',
    relatedIds: (d.related ?? []).map((r) => `${vehicleId}.${r}`)
  };
}

/** Wartungspositionen für ein Fahrzeug erzeugen. */
export function buildItems(v: Pick<Vehicle, 'id' | 'fuel' | 'drive' | 'template'>): MaintenanceItem[] {
  const defs = v.template === 't4-syncro' ? T4_DEFS : GENERIC_DEFS;
  const items: MaintenanceItem[] = [];
  (Object.keys(defs) as CategoryId[]).forEach((cat) =>
    defs[cat].forEach((d) => {
      if (d.fuel && !d.fuel.includes(v.fuel)) return;
      if (d.drive && !d.drive.includes(v.drive)) return;
      items.push(makeItem(v.id, cat, d));
    })
  );
  const ids = new Set(items.map((i) => i.id));
  items.forEach((i) => (i.relatedIds = i.relatedIds.filter((r) => ids.has(r))));
  return items;
}

/** Alle bekannten Katalogschlüssel mit Namen (für Erkennung/Zuordnung). */
export function catalogName(key: string): string | null {
  for (const defs of [GENERIC_DEFS, T4_DEFS]) for (const cat of Object.values(defs)) for (const d of cat) if (d.id === key) return d.name;
  return null;
}
export function catalogCategory(key: string): CategoryId | null {
  for (const defs of [GENERIC_DEFS, T4_DEFS]) for (const [cat, list] of Object.entries(defs)) if (list.some((d) => d.id === key)) return cat as CategoryId;
  return null;
}

export const SOURCE_LABEL: Record<SourceType, string> = {
  vw: 'Herstellerangabe (verifiziert)',
  empfehlung: 'Fachliche Empfehlung',
  benutzer: 'Eigener Wert',
  ungeprueft: 'Ungeprüft'
};
