/**
 * Zentrale Datenmodelle der App (herstellerunabhängig, mehrere Fahrzeuge).
 * Alle Datumswerte sind ISO-Datumsstrings im Format JJJJ-MM-TT (lokales Kalenderdatum).
 */

/** Herkunft bzw. Verlässlichkeit eines Werts (Intervall, Spezifikation, Füllmenge). */
export type SourceType =
  | 'vw' // verifizierte Herstellerangabe (nur vom Nutzer nach Prüfung zu setzen; Schlüssel aus Kompatibilitätsgründen „vw“)
  | 'empfehlung' // fachlich begründete Empfehlung (z. B. jährliche Sichtprüfung)
  | 'benutzer' // vom Nutzer selbst festgelegt
  | 'ungeprueft'; // Startwert, noch nicht verifiziert

export type CategoryId = 'motor' | 'antrieb' | 'bremsen' | 'fahrwerk' | 'karosserie';
export type Status = 'ok' | 'soon' | 'overdue' | 'unknown' | 'inactive';
export type ItemKind = 'wechsel' | 'pruefung';
export type FuelType = 'diesel' | 'benzin' | 'hybrid' | 'elektro' | 'gas';
export type DriveType = 'front' | 'heck' | 'allrad';
export type TemplateId = 'generic' | 't4-syncro';

export interface MaintenanceItem {
  id: string;
  vehicleId: string;
  /** Katalogschlüssel (z. B. „motoroel“) – Grundlage für die Rechnungserkennung */
  key: string;
  name: string;
  category: CategoryId;
  kind: ItemKind;
  description: string;
  enabled: boolean;
  custom: boolean;
  lastDate: string | null;
  lastKm: number | null;
  intervalKm: number | null;
  intervalMonths: number | null;
  intervalSource: SourceType;
  warnKm: number | null;
  warnDays: number | null;
  parts: string;
  partNumbers: string;
  fluidSpec: string;
  fluidSpecSource: SourceType;
  capacity: string;
  capacitySource: SourceType;
  cost: number | null;
  notes: string;
  relatedIds: string[];
}

export interface MileageEntry {
  id: string;
  vehicleId: string;
  date: string;
  km: number;
  note: string;
  correction: boolean;
  createdAt: number;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  date: string;
  km: number | null;
  title: string;
  category: CategoryId;
  type: 'wartung' | 'reparatur';
  itemIds: string[];
  description: string;
  doneBy: 'selbst' | 'werkstatt';
  workshop: string;
  costParts: number | null;
  costLabor: number | null;
  notes: string;
  /** Verknüpfte Rechnung. Kosten zählen dann über das Dokument (keine Doppelbuchung). */
  documentId: string | null;
  createdAt: number;
}

export interface Vehicle {
  id: string;
  name: string;
  make: string;
  model: string;
  engineCode: string;
  fuel: FuelType;
  drive: DriveType;
  template: TemplateId;
  year: number | null;
  plate: string;
  vin: string;
  gearboxCode: string;
  annualKm: number | null;
  photo: string | null;
  /** Aktivierte Sets, z. B. „zahnriemen_set“ – deren Einzelpositionen werden als eine Position geführt */
  groupedSets?: string[];
}

export interface Part {
  id: string;
  vehicleId: string;
  name: string;
  manufacturer: string;
  partNumber: string;
  category: CategoryId | null;
  compatibility: string;
  installDate: string | null;
  installKm: number | null;
  price: number | null;
  dealer: string;
  link: string;
  recordId: string | null;
  documentId: string | null;
  notes: string;
  createdAt: number;
}

export type DocCategory = 'rechnung' | 'werkstattbeleg' | 'tuev' | 'gutachten' | 'wartungsnachweis' | 'fahrzeugpapiere' | 'anleitung' | 'sonstiges';
export type CostCategory = 'wartung' | 'reparatur' | 'ersatzteile' | 'kraftstoff' | 'versicherung' | 'steuer' | 'tuev' | 'umbauten' | 'sonstiges';

export interface DocumentMeta {
  id: string;
  vehicleId: string | null;
  title: string;
  category: DocCategory;
  date: string | null;
  vendor: string;
  invoiceNo: string;
  total: number | null;
  vat: number | null;
  km: number | null;
  /** Wird der Betrag in den Kosten gezählt? (Rechnungen: ja) */
  countCost: boolean;
  costCategory: CostCategory;
  /** Erkannter oder eingebetteter Text (für Volltextsuche) */
  text: string;
  textSource: 'ocr' | 'pdf' | 'keine';
  ocrConfidence: number | null;
  /** IDs der gespeicherten Dateien (Seitenbilder bzw. Original) im Dateispeicher */
  fileIds: string[];
  originalFileId: string | null;
  originalName: string;
  mime: string;
  thumb: string | null;
  hash: string;
  pageCount: number;
  recordIds: string[];
  partIds: string[];
  notes: string;
  createdAt: number;
}

export interface Settings {
  warnKm: number;
  warnDays: number;
  theme: 'auto' | 'light' | 'dark';
  /** true, sobald der Nutzer das Erscheinungsbild selbst gewählt hat */
  themeChosen?: boolean;
}

export interface AppState {
  schemaVersion: 2;
  setupDone: boolean;
  isSample: boolean;
  activeVehicleId: string;
  vehicles: Vehicle[];
  items: MaintenanceItem[];
  mileage: MileageEntry[];
  records: ServiceRecord[];
  parts: Part[];
  documents: DocumentMeta[];
  settings: Settings;
}
