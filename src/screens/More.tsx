import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Row, Section } from '../components/ui';
import { Icon } from '../components/Icon';
import { fmtKm } from '../lib/util';
import { vehicleSubtitle } from '../components/VehicleFields';
import wordmark from '../assets/wordmark-navy.svg';
import { displayName, useAuth } from '../lib/auth';

const I = ({ n }: { n: string }) => (
  <span className="icon-tile" style={{ width: 30, height: 30, borderRadius: 8 }}>
    <Icon name={n} size={18} />
  </span>
);

export function More() {
  const { root, state, km, mode } = useStore();
  const nav = useNav();
  const v = state.vehicle;
  const auth = useAuth();
  return (
    <>
      <h1 className="large-title" style={{ marginTop: 14 }}>Mehr</h1>
      {auth.configured && (
        <div className="group" style={{ marginBottom: 12 }}>
          <button className="row" style={{ minHeight: 68 }} onClick={() => nav.push({ name: 'account' })}>
            <span className="avatar" style={{ width: 44, height: 44, fontSize: 15 }} aria-hidden="true">
              {auth.user ? displayName(auth.user).split(/[\s@.]+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() : <Icon name="user" size={22} />}
            </span>
            <div className="row-main">
              <div className="row-title" style={{ fontWeight: 600 }}>{auth.user ? displayName(auth.user) : 'Anmelden oder registrieren'}</div>
              <div className="row-sub">{auth.user ? auth.user.email : 'Optionales Milewyse-Konto'}</div>
            </div>
            <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" />
          </button>
        </div>
      )}
      <div className="group">
        <button className="row" style={{ minHeight: 76 }} onClick={() => nav.push({ name: 'vehicle' })}>
          {v.photo ? <span style={{ width: 52, height: 52, borderRadius: 14, background: `center/cover url(${v.photo})`, flex: 'none' }} /> : <span className="icon-tile" style={{ width: 52, height: 52, borderRadius: 14 }}><Icon name="car" size={28} /></span>}
          <div className="row-main">
            <div className="row-title" style={{ fontWeight: 600, fontSize: 18 }}>{v.name}</div>
            <div className="row-sub">{vehicleSubtitle(v)}</div>
          </div>
          <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" />
        </button>
      </div>

      <Section header="Fahrzeug">
        <div className="group">
          <Row icon={<I n="swap" />} title="Fahrzeuge" value={String(root.vehicles.length)} onClick={() => nav.push({ name: 'vehicles' })} />
          <Row icon={<I n="gauge" />} title="Kilometerstand" value={fmtKm(km)} onClick={() => nav.push({ name: 'mileage' })} />
          <Row icon={<I n="tag" />} title="Ersatzteile" value={String(state.parts.length)} onClick={() => nav.push({ name: 'parts' })} />
        </div>
      </Section>

      <Section header="Fahrzeugakte">
        <div className="group">
          <Row icon={<I n="folder" />} title="Dokumente" value={String(root.documents.length)} onClick={() => nav.push({ name: 'documents' })} />
          <Row icon={<I n="scan" />} title="Dokument scannen" onClick={nav.openScan} />
          <Row icon={<I n="archive" />} title="Alte Rechnungen importieren" onClick={nav.openBulk} />
        </div>
      </Section>

      <Section header="App">
        <div className="group">
          <Row icon={<I n="settings" />} title="Einstellungen" onClick={() => nav.push({ name: 'settings' })} />
          <Row icon={<I n="download" />} title="Datensicherung" sub={mode === 'indexeddb' ? 'Lokal gespeichert' : mode === 'localstorage' ? 'Lokal gespeichert (eingeschränkt)' : 'Achtung: nur temporär gespeichert'} onClick={() => nav.push({ name: 'backup' })} />
          <Row icon={<I n="shield" />} title="Datenquellen & Verlässlichkeit" onClick={() => nav.push({ name: 'sources' })} />
        </div>
      </Section>

      <div className="section-footer center mt-lg">
        <img src={wordmark} alt="Milewyse" className="brand-wordmark" style={{ height: 20, display: 'block', margin: '0 auto 6px', opacity: 0.8 }} />
        Version 0.2
        <br />
        Alle Daten und Dokumente bleiben auf diesem Gerät.
      </div>
    </>
  );
}
