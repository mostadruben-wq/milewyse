/**
 * Optionale Sets: mehrere Wartungspositionen, die üblicherweise gemeinsam erneuert werden,
 * als EINE Position führen (gemeinsames Intervall, gemeinsame Fälligkeit).
 * Die Einzelpositionen bleiben im Hintergrund erhalten und werden beim Eintragen mitgeführt,
 * damit beim Ausschalten des Sets keine Daten verloren gehen.
 */
import type { AppState, MaintenanceItem, Vehicle } from './types';

export interface GroupDef {
  id: string;
  name: string;
  members: string[];
  description: string;
}

export const GROUPS: GroupDef[] = [
  {
    id: 'zahnriemen_set',
    name: 'Zahnriemen-Set',
    members: ['zahnriemen', 'zahnriemenspanner', 'umlenkrollen', 'wasserpumpe'],
    description: 'Zahnriemen, Zahnriemenspanner, Umlenkrollen und Wasserpumpe werden gemeinsam gewechselt und als eine Position verfolgt. Intervall bitte aus Herstellerunterlagen eintragen.'
  }
];

export const groupOf = (key: string) => GROUPS.find((g) => g.members.includes(key));
const isOn = (v: Pick<Vehicle, 'groupedSets'> | undefined, groupId: string) => !!v?.groupedSets?.includes(groupId);

/** Ist eine Position in der Ansicht ausgeblendet (Mitglied eines aktiven Sets bzw. Set-Position bei inaktivem Set)? */
export function isHidden(item: MaintenanceItem, v: Pick<Vehicle, 'groupedSets'> | undefined): boolean {
  const asGroup = GROUPS.find((g) => g.id === item.key);
  if (asGroup) return !isOn(v, asGroup.id);
  const g = groupOf(item.key);
  return !!g && isOn(v, g.id);
}

/** Beim Eintragen: Set-Position → zusätzlich alle (vorhandenen) Einzelpositionen; Einzelposition → zugehöriges Set, falls aktiv. */
export function expandIds(ids: string[], items: MaintenanceItem[]): string[] {
  const out = new Set(ids);
  for (const id of ids) {
    const it = items.find((i) => i.id === id);
    if (!it) continue;
    const g = GROUPS.find((x) => x.id === it.key);
    if (g) items.filter((i) => i.vehicleId === it.vehicleId && g.members.includes(i.key)).forEach((m) => out.add(m.id));
  }
  return [...out];
}

/** Eine erkannte Einzelposition auf das aktive Set abbilden (für die Rechnungserkennung). */
export function resolveToGroup(itemId: string, items: MaintenanceItem[], v: Pick<Vehicle, 'groupedSets'> | undefined): string {
  const it = items.find((i) => i.id === itemId);
  if (!it) return itemId;
  const g = groupOf(it.key);
  if (!g || !isOn(v, g.id)) return itemId;
  return `${it.vehicleId}.${g.id}`;
}

const later = (a: { lastDate: string | null }, b: { lastDate: string | null }) => (a.lastDate ?? '') >= (b.lastDate ?? '');

/** Set ein- oder ausschalten. Daten werden übertragen, nie gelöscht. */
export function toggleGroup(s: AppState, vehicleId: string, groupId: string, on: boolean): AppState {
  const g = GROUPS.find((x) => x.id === groupId);
  if (!g) return s;
  const members = s.items.filter((i) => i.vehicleId === vehicleId && g.members.includes(i.key));
  if (!members.length) return s;
  const setId = `${vehicleId}.${g.id}`;
  let items = [...s.items];
  let setItem = items.find((i) => i.id === setId);
  const lead = members.find((m) => m.key === g.members[0]) ?? members[0];
  if (on) {
    // Neuester Stand der Einzelpositionen wird übernommen (bevorzugt der Zahnriemen selbst)
    const newest = members.reduce((a, b) => (later(a, b) ? a : b), lead);
    const base: MaintenanceItem = setItem ?? {
      ...lead,
      id: setId,
      key: g.id,
      name: g.name,
      description: g.description,
      custom: false,
      parts: '',
      partNumbers: '',
      notes: '',
      relatedIds: items.filter((i) => i.vehicleId === vehicleId && i.key === 'kuehlmittel').map((i) => i.id)
    };
    const next: MaintenanceItem = {
      ...base,
      enabled: true,
      intervalKm: base.intervalKm ?? lead.intervalKm,
      intervalMonths: base.intervalMonths ?? lead.intervalMonths,
      intervalSource: base.intervalKm || base.intervalMonths ? base.intervalSource : lead.intervalSource,
      lastDate: later(base, newest) && setItem ? base.lastDate : newest.lastDate,
      lastKm: later(base, newest) && setItem ? base.lastKm : newest.lastKm
    };
    if (setItem) items = items.map((i) => (i.id === setId ? next : i));
    else {
      // an der Stelle des Zahnriemens einsortieren, damit die Liste ihre Reihenfolge behält
      const at = items.findIndex((i) => i.id === lead.id);
      items.splice(at >= 0 ? at : items.length, 0, next);
    }
  } else if (setItem) {
    // Stand des Sets an die Einzelpositionen zurückgeben, wenn er neuer ist
    items = items.map((i) => (members.some((m) => m.id === i.id) && setItem && setItem.lastDate && !later(i, setItem) ? { ...i, lastDate: setItem.lastDate, lastKm: setItem.lastKm } : i));
    setItem = undefined;
  }
  const vehicles = s.vehicles.map((v) => {
    if (v.id !== vehicleId) return v;
    const set = new Set(v.groupedSets ?? []);
    if (on) set.add(groupId);
    else set.delete(groupId);
    return { ...v, groupedSets: [...set] };
  });
  return { ...s, items, vehicles };
}

/** Gibt es für dieses Fahrzeug ein Set, das angeboten werden kann? */
export function availableGroups(items: MaintenanceItem[], vehicleId: string): GroupDef[] {
  return GROUPS.filter((g) => items.filter((i) => i.vehicleId === vehicleId && g.members.includes(i.key)).length >= 2);
}
