import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { NavBar, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { vehicleSubtitle } from '../components/VehicleFields';
import { VehicleWizard, applyWizard } from './Onboarding';
import { currentKm } from '../lib/mileage';
import { fmtKm } from '../lib/util';

/** Fahrzeuge verwalten: wechseln, hinzufügen. */
export function VehiclesPage() {
  const { root, setActiveVehicle, update, today } = useStore();
  const nav = useNav();
  const [wizard, setWizard] = useState(false);

  if (wizard)
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'var(--bg)', overflowY: 'auto' }}>
        <VehicleWizard
          onCancel={() => setWizard(false)}
          onDone={(r) => {
            update((s) => ({ ...applyWizard(s, r, today), isSample: s.isSample }));
            setWizard(false);
            toast('Fahrzeug hinzugefügt');
            nav.setTab('uebersicht');
          }}
        />
      </div>
    );

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" right={<button className="nav-btn icon-btn" aria-label="Fahrzeug hinzufügen" onClick={() => setWizard(true)}><Icon name="plus" size={20} stroke={2.4} /></button>} />
      <h1 className="large-title">Fahrzeuge</h1>
      <div className="group">
        {root.vehicles.map((v) => {
          const active = v.id === root.activeVehicleId;
          const km = currentKm(root.mileage.filter((m) => m.vehicleId === v.id));
          return (
            <div key={v.id} className="row" style={{ minHeight: 72, paddingRight: 8 }}>
            <button className="row-select" onClick={() => (setActiveVehicle(v.id), toast(`${v.name} ausgewählt`), nav.setTab('uebersicht'))}>
              {v.photo ? <span style={{ width: 48, height: 48, borderRadius: 12, background: `center/cover url(${v.photo})`, flex: 'none' }} /> : <span className="icon-tile" style={{ width: 48, height: 48, borderRadius: 12 }}><Icon name="car" size={26} /></span>}
              <div className="row-main">
                <div className="row-title" style={{ fontWeight: 600 }}>{v.name}</div>
                <div className="row-sub">{vehicleSubtitle(v)}{km !== null ? ` · ${fmtKm(km)}` : ''}</div>
              </div>
              {active && <Icon name="check" size={20} stroke={2.6} style={{ color: 'var(--tint)' }} />}
            </button>
            <button className="circle-btn" style={{ width: 40, height: 40, flex: 'none' }} aria-label={`${v.name} bearbeiten`} onClick={() => nav.push({ name: 'vehicle', id: v.id })}>
              <Icon name="edit" size={18} />
            </button>
            </div>
          );
        })}
      </div>
      <button className="btn btn-secondary btn-block mt-lg" onClick={() => setWizard(true)}>
        Fahrzeug hinzufügen
      </button>
      <div className="section-footer">Tippe auf ein Fahrzeug, um es auszuwählen, oder auf den Stift, um seine Daten zu ändern. Jedes Fahrzeug hat eigene Wartungspositionen, Kilometerstände, Historie und Ersatzteile. Dokumente lassen sich einem oder keinem Fahrzeug zuordnen.</div>
    </>
  );
}
