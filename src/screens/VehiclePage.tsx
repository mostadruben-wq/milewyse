import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, NavBar, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { VehicleFields, draftToVehicle, validateVehicleDraft, type VehicleDraft } from '../components/VehicleFields';
import { resizeImage } from '../lib/util';

export function VehiclePage({ id }: { id?: string }) {
  const { state, root, updateVehicle, deleteVehicle } = useStore();
  const nav = useNav();
  const v0 = (id && root.vehicles.find((x) => x.id === id)) || state.vehicle;
  const [d, setD] = useState<VehicleDraft>({ v: v0, year: v0.year ? String(v0.year) : '', annual: v0.annualKm ? String(v0.annualKm) : '' });
  const [error, setError] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const e = validateVehicleDraft(d);
    if (e) return setError(e);
    const { template: _t, fuel: _f, drive: _d, ...rest } = draftToVehicle(d);
    void _t; void _f; void _d;
    updateVehicle({ ...rest, fuel: d.v.fuel, drive: d.v.drive }, v0.id);
    toast('Fahrzeugdaten gespeichert');
    nav.pop();
  };

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      const photo = await resizeImage(f);
      setD((x) => ({ ...x, v: { ...x.v, photo } }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Abbrechen" title="Fahrzeugdaten" right={<button className="nav-btn bold" onClick={save}>Sichern</button>} />
      <button
        onClick={() => fileRef.current?.click()}
        aria-label="Fahrzeugfoto wählen"
        style={{ width: '100%', height: 180, borderRadius: 20, border: 0, marginTop: 8, background: d.v.photo ? `center/cover url(${d.v.photo})` : 'linear-gradient(180deg, #4176F7 0%, #2D62F2 55%, #2453E3 100%)', color: '#fff', display: 'grid', placeItems: 'center' }}
      >
        {!d.v.photo && (
          <span style={{ display: 'grid', placeItems: 'center', gap: 6 }}>
            <Icon name="camera" size={30} />
            <span style={{ fontWeight: 500 }}>Foto hinzufügen</span>
          </span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
      {d.v.photo && (
        <div className="row-gap mt">
          <button className="btn btn-sm btn-secondary" onClick={() => fileRef.current?.click()}>Foto ändern</button>
          <button className="btn btn-sm btn-danger" onClick={() => setD((x) => ({ ...x, v: { ...x.v, photo: null } }))}>Entfernen</button>
        </div>
      )}
      <VehicleFields d={d} set={setD} />
      <div className="section-footer">Änderungen an Kraftstoff oder Antrieb blenden keine vorhandenen Positionen aus – das geht unter „Wartung“ pro Position. Die FIN bleibt nur auf diesem Gerät.</div>
      {error && (
        <div className="error-text" role="alert">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}
      <button className="btn btn-primary btn-block mt-lg" onClick={save}>Sichern</button>
      <button className="btn btn-danger btn-block mt" onClick={() => setDel(true)}>Fahrzeug löschen</button>
      <Confirm
        open={del}
        title={`„${v0.name}“ löschen?`}
        message={`Wartungen, Kilometerstände, Historie, Ersatzteile und zugeordnete Dokumente dieses Fahrzeugs werden endgültig gelöscht.${root.vehicles.length === 1 ? ' Danach startet die Einrichtung neu.' : ''}`}
        confirmLabel="Endgültig löschen"
        destructive
        onConfirm={async () => {
          await deleteVehicle(v0.id);
          nav.pop();
          toast('Fahrzeug gelöscht');
        }}
        onClose={() => setDel(false)}
      />
    </>
  );
}
