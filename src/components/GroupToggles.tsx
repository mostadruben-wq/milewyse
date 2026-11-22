import { useStore } from '../lib/store';
import { Row, Toggle, toast } from './ui';
import { availableGroups, GROUPS } from '../lib/groups';

/** Schalter für optionale Sets (z. B. Zahnriemen-Set). Optional auf ein Set begrenzt. */
export function GroupToggles({ only }: { only?: string }) {
  const { root, state, setGroup } = useStore();
  const groups = availableGroups(root.items, state.vehicle.id).filter((g) => !only || g.id === only);
  if (!groups.length) return null;
  return (
    <div className="group">
      {groups.map((g) => {
        const on = !!state.vehicle.groupedSets?.includes(g.id);
        const members = GROUPS.find((x) => x.id === g.id)!.members
          .map((k) => root.items.find((i) => i.vehicleId === state.vehicle.id && i.key === k)?.name)
          .filter(Boolean)
          .join(', ');
        return (
          <Row
            key={g.id}
            title={`${g.name.replace('-Set', '')} als Set`}
            sub={on ? `Eine Position für ${members}` : `Einzeln: ${members}`}
            right={
              <Toggle
                label={`${g.name} zusammenfassen`}
                checked={on}
                onChange={(v) => {
                  setGroup(g.id, v);
                  toast(v ? `${g.name} aktiviert` : 'Wieder als Einzelpositionen');
                }}
              />
            }
          />
        );
      })}
    </div>
  );
}
