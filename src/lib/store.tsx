import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppState, DocumentMeta, MaintenanceItem, MileageEntry, Part, ServiceRecord, Vehicle } from './types';
import { emptyState, migrateV1, newVehicle, sampleState } from '../data/initial';
import { buildItems } from '../data/catalog';
import { clearFiles, clearState, deleteFiles, getFile, loadState, putFile, saveState, storageMode, type StorageMode } from './storage';
import { averageRate, currentKm, type MileageRate } from './mileage';
import { computeDue, markDone, type DueInfo } from './maintenance';
import { todayISO } from './dates';
import { expandIds, isHidden, toggleGroup } from './groups';
import { uid } from './util';

/** Sicht auf das aktive Fahrzeug (Form wie vor der Mehrfahrzeug-Umstellung). */
export interface VehicleView {
  vehicle: Vehicle;
  items: MaintenanceItem[];
  mileage: MileageEntry[];
  records: ServiceRecord[];
  parts: Part[];
  documents: DocumentMeta[];
  settings: AppState['settings'];
  isSample: boolean;
  setupDone: boolean;
}

export interface CompleteInput {
  itemIds: string[];
  date: string;
  km: number | null;
  title: string;
  description: string;
  doneBy: 'selbst' | 'werkstatt';
  workshop: string;
  costParts: number | null;
  costLabor: number | null;
  notes: string;
  type?: 'wartung' | 'reparatur';
  category?: ServiceRecord['category'];
  documentId?: string | null;
  vehicleId?: string;
}

export interface ImportPayload {
  doc: DocumentMeta;
  records: CompleteInput[];
  parts: Omit<Part, 'id' | 'createdAt' | 'documentId' | 'recordId'>[];
}

interface Store {
  root: AppState;
  state: VehicleView;
  ready: boolean;
  mode: StorageMode;
  today: string;
  km: number | null;
  rate: MileageRate | null;
  dues: Record<string, DueInfo>;
  update: (fn: (s: AppState) => AppState) => void;
  updateVehicle: (patch: Partial<Vehicle>, id?: string) => void;
  setGroup: (groupId: string, on: boolean) => void;
  setActiveVehicle: (id: string) => void;
  addVehicle: (v: Vehicle) => void;
  deleteVehicle: (id: string) => Promise<void>;
  addMileage: (e: Omit<MileageEntry, 'id' | 'createdAt' | 'vehicleId'>) => void;
  deleteMileage: (id: string) => void;
  saveItem: (item: MaintenanceItem) => void;
  deleteItem: (id: string) => void;
  completeMaintenance: (p: CompleteInput) => void;
  saveRecord: (r: ServiceRecord) => void;
  deleteRecord: (id: string) => void;
  savePart: (p: Part) => void;
  deletePart: (id: string) => void;
  /** Dokument inkl. Dateien speichern und bestätigte Einträge übernehmen */
  importDocument: (p: ImportPayload, files: { id: string; blob: Blob }[]) => Promise<void>;
  saveDocument: (d: DocumentMeta) => void;
  deleteDocument: (id: string, withLinked: boolean) => Promise<void>;
  deleteAllDocuments: () => Promise<void>;
  loadSample: () => void;
  resetAll: () => Promise<void>;
  exportData: (withFiles: boolean) => Promise<string>;
  importData: (json: string) => Promise<{ ok: boolean; message: string }>;
}

const Ctx = createContext<Store | null>(null);

/** Prüft, migriert und ergänzt geladene oder importierte Daten. */
export function normalizeState(raw: unknown): AppState {
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültigen Daten.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let r = raw as any;
  if (r.schemaVersion === 1) r = migrateV1(r);
  if (r.schemaVersion !== 2) throw new Error('Unbekanntes Datenformat.');
  if (!Array.isArray(r.vehicles) || !r.vehicles.length || !Array.isArray(r.items) || !Array.isArray(r.mileage) || !Array.isArray(r.records)) throw new Error('Datei ist unvollständig.');
  const base = emptyState();
  const vehicles: Vehicle[] = r.vehicles.map((v: Vehicle) => ({ ...newVehicle(), ...v }));
  const items: MaintenanceItem[] = [...r.items];
  // fehlende Katalogpositionen (z. B. nach App-Update) ergänzen, vorhandene nie überschreiben
  vehicles.forEach((v) =>
    buildItems(v).forEach((c) => {
      if (!items.some((i) => i.id === c.id)) items.push(c);
    })
  );
  return {
    ...base,
    ...r,
    vehicles,
    items,
    parts: Array.isArray(r.parts) ? r.parts : [],
    documents: Array.isArray(r.documents) ? r.documents : [],
    records: r.records.map((x: ServiceRecord) => ({ ...x, documentId: x.documentId ?? null })),
    activeVehicleId: vehicles.some((v) => v.id === r.activeVehicleId) ? r.activeVehicleId : vehicles[0].id,
    // Standard ist der helle Stil; nur eine bewusste Wahl des Nutzers bleibt erhalten
    settings: { ...base.settings, ...(r.settings ?? {}), theme: r.settings?.themeChosen || (r.settings?.theme && r.settings.theme !== 'auto') ? r.settings.theme : 'light' }
  };
}

/** Reine Funktion: übernimmt einen Wartungs-/Reparatureintrag (nur vorwärts). */
export function applyComplete(s: AppState, p0: CompleteInput): { state: AppState; recordId: string } {
  // Sets: Set-Position und Einzelpositionen gemeinsam fortschreiben
  const p = { ...p0, itemIds: expandIds(p0.itemIds, s.items) };
  const vid = p.vehicleId ?? s.activeVehicleId;
  const items = s.items.map((i) => {
    if (!p.itemIds.includes(i.id)) return i;
    if (i.lastDate && i.lastDate > p.date) return i; // ältere Nachträge überschreiben keine neuere Wartung
    return markDone(i, p.date, p.km);
  });
  const first = s.items.find((i) => i.id === p.itemIds[0]);
  const record: ServiceRecord = {
    id: uid(),
    vehicleId: vid,
    date: p.date,
    km: p.km,
    title: p.title,
    category: p.category ?? first?.category ?? 'motor',
    type: p.type ?? 'wartung',
    itemIds: p.itemIds,
    description: p.description,
    doneBy: p.doneBy,
    workshop: p.workshop,
    costParts: p.costParts,
    costLabor: p.costLabor,
    notes: p.notes,
    documentId: p.documentId ?? null,
    createdAt: Date.now()
  };
  const vm = s.mileage.filter((m) => m.vehicleId === vid);
  const cur = currentKm(vm);
  const mileage =
    p.km !== null && (cur === null || p.km > cur) && !vm.some((m) => m.date > p.date)
      ? [...s.mileage, { id: uid(), vehicleId: vid, date: p.date, km: p.km, note: `Aus Eintrag: ${p.title}`, correction: false, createdAt: Date.now() }]
      : s.mileage;
  return { state: { ...s, items, records: [record, ...s.records], mileage }, recordId: record.id };
}

/** Reine Funktion: Dokument mit bestätigten Einträgen und Teilen übernehmen. */
export function applyImport(s: AppState, p: ImportPayload): AppState {
  let next: AppState = { ...s, documents: [...s.documents.filter((d) => d.id !== p.doc.id)] };
  const recordIds: string[] = [];
  p.records.forEach((r) => {
    const res = applyComplete(next, { ...r, documentId: p.doc.id, vehicleId: p.doc.vehicleId ?? s.activeVehicleId });
    next = res.state;
    recordIds.push(res.recordId);
  });
  const parts: Part[] = p.parts.map((x) => ({ ...x, id: uid(), createdAt: Date.now(), documentId: p.doc.id, recordId: recordIds[0] ?? null }));
  next = {
    ...next,
    parts: [...next.parts, ...parts],
    documents: [{ ...p.doc, recordIds: [...p.doc.recordIds, ...recordIds], partIds: [...p.doc.partIds, ...parts.map((x) => x.id)] }, ...next.documents]
  };
  return next;
}

async function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [root, setRoot] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<StorageMode>('memory');
  const [today, setToday] = useState(todayISO());
  const saveTimer = useRef<number | undefined>(undefined);
  const rootRef = useRef(root);
  rootRef.current = root;

  useEffect(() => {
    loadState().then((s) => {
      if (s) {
        try {
          setRoot(normalizeState(s));
        } catch {
          /* defekte Daten → leerer Start; gespeicherte Daten bleiben bis zur ersten Änderung unangetastet */
        }
      }
      setMode(storageMode());
      setReady(true);
    });
    const t = window.setInterval(() => setToday(todayISO()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveState(root).then(() => setMode(storageMode())), 250);
  }, [root, ready]);

  useEffect(() => {
    const flush = () => ready && saveState(rootRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [ready]);

  const update = useCallback((fn: (s: AppState) => AppState) => setRoot((s) => fn(s)), []);
  const vid = root.activeVehicleId;

  const state: VehicleView = useMemo(
    () => ({
      vehicle: root.vehicles.find((v) => v.id === vid) ?? root.vehicles[0],
      items: root.items.filter((i) => i.vehicleId === vid && !isHidden(i, root.vehicles.find((v) => v.id === vid))),
      mileage: root.mileage.filter((m) => m.vehicleId === vid),
      records: root.records.filter((r) => r.vehicleId === vid),
      parts: root.parts.filter((p) => p.vehicleId === vid),
      documents: root.documents.filter((d) => d.vehicleId === vid || d.vehicleId === null),
      settings: root.settings,
      isSample: root.isSample,
      setupDone: root.setupDone
    }),
    [root, vid]
  );

  const km = useMemo(() => currentKm(state.mileage), [state.mileage]);
  const rate = useMemo(() => averageRate(state.mileage, today, state.vehicle.annualKm), [state.mileage, today, state.vehicle.annualKm]);
  const dues = useMemo(() => {
    const out: Record<string, DueInfo> = {};
    state.items.forEach((it) => (out[it.id] = computeDue(it, km, today, root.settings, rate)));
    return out;
  }, [state.items, km, today, root.settings, rate]);

  const removeDocFiles = async (docs: DocumentMeta[]) => {
    await deleteFiles(docs.flatMap((d) => [...d.fileIds, ...(d.originalFileId ? [d.originalFileId] : [])]));
  };

  const store: Store = {
    root,
    state,
    ready,
    mode,
    today,
    km,
    rate,
    dues,
    update,
    updateVehicle: (patch, id) => update((s) => ({ ...s, vehicles: s.vehicles.map((v) => (v.id === (id ?? s.activeVehicleId) ? { ...v, ...patch, id: v.id } : v)) })),
    setGroup: (groupId, on) => update((s) => toggleGroup(s, s.activeVehicleId, groupId, on)),
    setActiveVehicle: (id) => update((s) => ({ ...s, activeVehicleId: id })),
    addVehicle: (v) => update((s) => ({ ...s, vehicles: [...s.vehicles, v], items: [...s.items, ...buildItems(v)], activeVehicleId: v.id })),
    deleteVehicle: async (id) => {
      const docs = rootRef.current.documents.filter((d) => d.vehicleId === id);
      await removeDocFiles(docs);
      update((s) => {
        const vehicles = s.vehicles.filter((v) => v.id !== id);
        if (!vehicles.length) return emptyState();
        return {
          ...s,
          vehicles,
          activeVehicleId: s.activeVehicleId === id ? vehicles[0].id : s.activeVehicleId,
          items: s.items.filter((x) => x.vehicleId !== id),
          mileage: s.mileage.filter((x) => x.vehicleId !== id),
          records: s.records.filter((x) => x.vehicleId !== id),
          parts: s.parts.filter((x) => x.vehicleId !== id),
          documents: s.documents.filter((x) => x.vehicleId !== id)
        };
      });
    },
    addMileage: (e) => update((s) => ({ ...s, mileage: [...s.mileage, { ...e, vehicleId: s.activeVehicleId, id: uid(), createdAt: Date.now() }] })),
    deleteMileage: (id) => update((s) => ({ ...s, mileage: s.mileage.filter((m) => m.id !== id) })),
    saveItem: (item) =>
      update((s) => ({ ...s, items: s.items.some((i) => i.id === item.id) ? s.items.map((i) => (i.id === item.id ? item : i)) : [...s.items, { ...item, vehicleId: s.activeVehicleId }] })),
    deleteItem: (id) => update((s) => ({ ...s, items: s.items.filter((i) => i.id !== id || !i.custom) })),
    completeMaintenance: (p) => update((s) => applyComplete(s, p).state),
    saveRecord: (r) => update((s) => ({ ...s, records: s.records.some((x) => x.id === r.id) ? s.records.map((x) => (x.id === r.id ? r : x)) : [{ ...r, vehicleId: s.activeVehicleId }, ...s.records] })),
    deleteRecord: (id) =>
      update((s) => {
        const rec = s.records.find((r) => r.id === id);
        if (!rec) return s;
        const records = s.records.filter((r) => r.id !== id);
        const items = s.items.map((i) => {
          if (!rec.itemIds.includes(i.id) || i.lastDate !== rec.date) return i;
          const prev = records.filter((r) => r.itemIds.includes(i.id)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
          return { ...i, lastDate: prev?.date ?? null, lastKm: prev?.km ?? null };
        });
        return { ...s, records, items, documents: s.documents.map((d) => ({ ...d, recordIds: d.recordIds.filter((x) => x !== id) })), parts: s.parts.map((p) => (p.recordId === id ? { ...p, recordId: null } : p)) };
      }),
    savePart: (p) => update((s) => ({ ...s, parts: s.parts.some((x) => x.id === p.id) ? s.parts.map((x) => (x.id === p.id ? p : x)) : [...s.parts, { ...p, vehicleId: p.vehicleId || s.activeVehicleId }] })),
    deletePart: (id) => update((s) => ({ ...s, parts: s.parts.filter((p) => p.id !== id), documents: s.documents.map((d) => ({ ...d, partIds: d.partIds.filter((x) => x !== id) })) })),
    importDocument: async (p, files) => {
      for (const f of files) await putFile(f.id, f.blob);
      update((s) => applyImport(s, p));
    },
    saveDocument: (d) => update((s) => ({ ...s, documents: s.documents.map((x) => (x.id === d.id ? d : x)) })),
    deleteDocument: async (id, withLinked) => {
      const doc = rootRef.current.documents.find((d) => d.id === id);
      if (!doc) return;
      await removeDocFiles([doc]);
      update((s) => {
        let next: AppState = { ...s, documents: s.documents.filter((d) => d.id !== id) };
        if (withLinked) {
          next = { ...next, parts: next.parts.filter((p) => p.documentId !== id) };
          for (const rid of doc.recordIds) {
            const rec = next.records.find((r) => r.id === rid);
            if (!rec) continue;
            const records = next.records.filter((r) => r.id !== rid);
            const items = next.items.map((i) => {
              if (!rec.itemIds.includes(i.id) || i.lastDate !== rec.date) return i;
              const prev = records.filter((r) => r.itemIds.includes(i.id)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
              return { ...i, lastDate: prev?.date ?? null, lastKm: prev?.km ?? null };
            });
            next = { ...next, records, items };
          }
        } else {
          // Verknüpfungen lösen; Kosten der Einträge zählen dann wieder einzeln
          next = { ...next, records: next.records.map((r) => (r.documentId === id ? { ...r, documentId: null } : r)), parts: next.parts.map((p) => (p.documentId === id ? { ...p, documentId: null } : p)) };
        }
        return next;
      });
    },
    deleteAllDocuments: async () => {
      await clearFiles();
      update((s) => ({ ...s, documents: [], records: s.records.map((r) => ({ ...r, documentId: null })), parts: s.parts.map((p) => ({ ...p, documentId: null })) }));
    },
    loadSample: () => {
      clearFiles();
      setRoot(sampleState());
    },
    resetAll: async () => {
      await clearState();
      setRoot(emptyState());
    },
    exportData: async (withFiles) => {
      const s = rootRef.current;
      const files: Record<string, string> = {};
      if (withFiles) {
        for (const d of s.documents) {
          for (const id of [...d.fileIds, ...(d.originalFileId ? [d.originalFileId] : [])]) {
            const b = await getFile(id);
            if (b) files[id] = await blobToBase64(b);
          }
        }
      }
      return JSON.stringify({ app: 'milewyse', version: 2, exportedAt: new Date().toISOString(), data: s, files: withFiles ? files : undefined });
    },
    importData: async (json) => {
      try {
        const parsed = JSON.parse(json);
        const data = parsed?.data && ['milewyse', 'milewise', 'fahrzeugbuch', 't4-syncro-companion'].includes(parsed.app) ? parsed.data : parsed;
        const next = normalizeState(data);
        let restored = 0;
        if (parsed?.files && typeof parsed.files === 'object') {
          await clearFiles();
          for (const [id, dataUrl] of Object.entries(parsed.files as Record<string, string>)) {
            const blob = await (await fetch(dataUrl)).blob();
            await putFile(id, blob);
            restored++;
          }
        }
        setRoot({ ...next, setupDone: true });
        const docsInfo = next.documents.length ? `, ${next.documents.length} Dokumente${restored ? '' : ' (ohne Dateien – Backup enthielt keine)'}` : '';
        return { ok: true, message: `Import erfolgreich: ${next.vehicles.length} Fahrzeug(e), ${next.records.length} Historieneinträge${docsInfo}.` };
      } catch (e) {
        return { ok: false, message: e instanceof SyntaxError ? 'Die Datei ist keine gültige JSON-Datei.' : (e as Error).message };
      }
    }
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider fehlt');
  return s;
}
