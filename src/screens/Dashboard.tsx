import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav, type StatusFilter } from '../nav';
import { Icon } from '../components/Icon';
import { Confirm, Row, Section } from '../components/ui';
import { compareUrgency, countStatuses, STATUS_LABEL } from '../lib/maintenance';
import { describeDue } from '../lib/describe';
import { formatDate, relativeDays, daysBetween } from '../lib/dates';
import { fmtEur, fmtNum } from '../lib/util';
import { costEntries } from '../lib/costs';

export function Dashboard() {
  const { root, state, km, rate, dues, today, resetAll } = useStore();
  const nav = useNav();
  const [confirmReal, setConfirmReal] = useState(false);
  const v = state.vehicle;

  const counts = countStatuses(Object.values(dues));
  const upcoming = state.items
    .filter((i) => ['overdue', 'soon', 'ok'].includes(dues[i.id].status))
    .sort((a, b) => compareUrgency(dues[a.id], dues[b.id]))
    .slice(0, 4);
  const lastRecord = [...state.records].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))[0];
  const lastMileage = [...state.mileage].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const mileageAge = lastMileage ? daysBetween(lastMileage.date, today) : null;
  const yearCost = costEntries(root, v.id).filter((c) => c.date.startsWith(today.slice(0, 4))).reduce((s, c) => s + c.amount, 0);
  const docsCount = root.documents.filter((d) => d.vehicleId === v.id).length;

  const goFilter = (f: StatusFilter) => {
    nav.setFilter(f);
    nav.setTab('wartung');
  };
  const total = counts.ok + counts.soon + counts.overdue + counts.unknown || 1;
  const dateStr = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  const next = upcoming[0];
  const nextDue = next ? dues[next.id] : null;
  const initials = (v.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <div className="greet">
        <button className="greet-edit" aria-label={`Fahrzeugdaten von ${v.name} bearbeiten`} onClick={() => nav.goTo('mehr', { name: 'vehicle' })}>
          <div className="avatar" style={v.photo ? { backgroundImage: `url(${v.photo})` } : undefined} aria-hidden="true">
            {!v.photo && <span style={{ fontWeight: 600 }}>{initials}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <h1 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</h1>
            <p>{dateStr}</p>
          </div>
        </button>
        {root.vehicles.length > 1 && (
          <button className="circle-btn" aria-label="Fahrzeug wechseln" onClick={() => nav.goTo('mehr', { name: 'vehicles' })}>
            <Icon name="swap" size={19} />
          </button>
        )}
        <button className="circle-btn" aria-label="Dokument scannen" onClick={nav.openScan}>
          <Icon name="scan" size={19} />
        </button>
      </div>

      {root.isSample && (
        <div className="banner" role="note">
          <Icon name="info" size={20} style={{ color: 'var(--tint)', flex: 'none' }} />
          <div className="small">
            <strong>Beispieldaten</strong>
            <span className="muted">Alle Werte sind frei erfunden.</span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => setConfirmReal(true)}>
            Eigene Daten
          </button>
        </div>
      )}

      <div className="hero">
        {v.photo && <div className="hero-photo" style={{ backgroundImage: `url(${v.photo})` }} />}
        {!v.photo && (
          <svg className="hero-deco" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M240 0 C 260 120, 330 160, 400 170 L400 0 Z" fill="rgba(255,255,255,0.07)" />
            <path d="M300 0 C 300 90, 350 120, 400 120 L400 0 Z" fill="rgba(255,255,255,0.07)" />
          </svg>
        )}
        <div className="hero-top">
          <div className="hero-label">Kilometerstand</div>
          {v.plate && <span className="plate">{v.plate}</span>}
        </div>
        <div className="hero-km">
          {km !== null ? fmtNum(km) : '–'}
          <small>km</small>
        </div>
        <div className="hero-sub">
          {lastMileage ? `Stand ${formatDate(lastMileage.date)}` : 'Noch kein Kilometerstand erfasst'}
          {rate && ` · Ø ${fmtNum(rate.kmPerMonth)} km/Monat`}
        </div>
        {next && nextDue && nextDue.progress !== null && (
          <>
            <div className="hero-progress" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(3, nextDue.progress * 100))}%` }} />
            </div>
            <div className="hero-sub" style={{ marginTop: 0 }}>
              Nächste Wartung: {next.name} · {describeDue(nextDue)}
            </div>
          </>
        )}
        <button className="hero-pill" onClick={nav.openMileage}>
          Kilometer eintragen
        </button>
      </div>

      {mileageAge !== null && mileageAge > 30 && (
        <button className="banner mt" style={{ width: '100%', textAlign: 'left' }} onClick={nav.openMileage}>
          <Icon name="gauge" size={20} style={{ color: 'var(--tint)', flex: 'none' }} />
          <div className="small">
            <strong>Kilometerstand aktualisieren</strong>
            <span className="muted">Letzte Eingabe {relativeDays(-mileageAge)} – Prognosen werden ungenauer.</span>
          </div>
        </button>
      )}

      <button className="task-card" onClick={nav.openScan} style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
        <span className="circle-btn static" style={{ background: 'var(--card-2)', boxShadow: 'none' }}>
          <Icon name="scan" size={20} />
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Dokument scannen</div>
          <div className="small muted">Rechnung erfassen – Werte werden erkannt</div>
        </div>
        <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" />
      </button>

      <Section big header="Wartungsstatus">
        <div className="card">
          <div className="status-bar" aria-hidden="true" style={{ margin: '0 0 14px' }}>
            {(['overdue', 'soon', 'ok', 'unknown'] as const).map((s) => (counts[s] ? <span key={s} style={{ flexGrow: counts[s] / total, background: `var(--${s})` }} /> : null))}
          </div>
          <div className="status-strip">
            {(
              [
                ['overdue', 'Überfällig'],
                ['soon', 'Bald fällig'],
                ['ok', 'In Ordnung'],
                ['unknown', 'Unbekannt']
              ] as const
            ).map(([s, label]) => (
              <button key={s} onClick={() => goFilter(s)} aria-label={`${label}: ${counts[s]} – Liste anzeigen`}>
                <span className="num" style={{ color: counts[s] && (s === 'overdue' || s === 'soon') ? `var(--${s}-text)` : undefined }}>{counts[s]}</span>
                <span className="lbl">
                  <span className={`dot dot-${s}`} style={{ width: 7, height: 7 }} />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section big header={<>Als Nächstes <button onClick={() => goFilter('alle')} style={{ marginLeft: 'auto' }}>Alle</button></>}>
        {upcoming.length ? (
          upcoming.map((it) => {
            const d = dues[it.id];
            return (
              <button key={it.id} className="task-card" onClick={() => nav.openItem(it.id)}>
                <span className="pill-tag">
                  <span className={`dot dot-${d.status}`} style={{ width: 8, height: 8 }} />
                  {describeDue(d)}
                </span>
                <h3>{it.name}</h3>
                <p>{STATUS_LABEL[d.status]}{d.estimated ? ' · Schätzung' : ''}</p>
                <span className="circle-btn sm" aria-hidden="true">
                  <Icon name="arrowUpRight" size={17} />
                </span>
              </button>
            );
          })
        ) : (
          <div className="card muted small">Noch keine berechenbaren Fälligkeiten. Trage bei den Wartungspositionen die letzte Wartung ein oder scanne alte Rechnungen.</div>
        )}
      </Section>

      <Section big header="Schnellzugriff">
        <div className="quick">
          <QuickBtn icon="gauge" label="Kilometer" onClick={nav.openMileage} />
          <QuickBtn icon="wrench" label="Wartung" onClick={() => nav.openComplete([])} />
          <QuickBtn icon="hammer" label="Reparatur" onClick={() => nav.openRecord(null, 'reparatur')} />
          <QuickBtn icon="archive" label="Import" onClick={nav.openBulk} />
        </div>
      </Section>

      <Section big header="Auf einen Blick">
        <div className="group">
          <Row title="Kosten dieses Jahr" value={fmtEur(yearCost)} onClick={() => nav.setTab('kosten')} />
          <Row title="Dokumente" value={String(docsCount)} onClick={() => nav.goTo('mehr', { name: 'documents' })} />
          {lastRecord && <Row title="Zuletzt erledigt" sub={`${lastRecord.title} · ${formatDate(lastRecord.date)}`} onClick={() => nav.openRecord(lastRecord.id)} />}
        </div>
      </Section>

      <Confirm
        open={confirmReal}
        title="Beispieldaten entfernen?"
        message="Alle Beispieldaten werden gelöscht und die Einrichtung für dein eigenes Fahrzeug startet."
        confirmLabel="Eigene Daten einrichten"
        destructive
        onConfirm={() => resetAll()}
        onClose={() => setConfirmReal(false)}
      />
    </>
  );
}

function QuickBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={label}>
      <span className="qi" style={{ display: 'grid', placeItems: 'center' }}>
        <Icon name={icon} size={22} />
      </span>
      {label}
    </button>
  );
}
