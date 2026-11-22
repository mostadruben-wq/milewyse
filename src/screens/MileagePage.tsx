import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, NavBar, Row, Section, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { sortEntries } from '../lib/mileage';
import { addDays, daysBetween, formatDate, relativeDays } from '../lib/dates';
import { fmtKm, fmtNum } from '../lib/util';

export function MileagePage() {
  const { state, km, rate, today, deleteMileage } = useStore();
  const nav = useNav();
  const [del, setDel] = useState<string | null>(null);
  const sorted = sortEntries(state.mileage);
  const desc = [...sorted].reverse();
  const yearKm = (() => {
    const start = addDays(today, -365);
    const inYear = sorted.filter((e) => e.date >= start);
    const anchor = [...sorted].reverse().find((e) => e.date < start);
    const s = anchor ? [anchor, ...inYear] : inYear;
    return s.length >= 2 ? s[s.length - 1].km - s[0].km : null;
  })();

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Zurück" right={<button className="nav-btn" onClick={nav.openMileage} aria-label="Kilometerstand hinzufügen"><Icon name="plus" size={24} stroke={2.4} /></button>} />
      <h1 className="large-title">Kilometer</h1>

      <div className="card">
        <div className="muted small">Aktueller Stand</div>
        <div className="ring-text" style={{ fontSize: 36 }}>{fmtKm(km)}</div>
        <Sparkline entries={sorted} />
        <div className="kv mt">
          <div>
            <div className="k">Ø pro Monat</div>
            <div className="v">{rate ? `${fmtNum(rate.kmPerMonth)} km` : '–'}</div>
            <div className="s">{rate ? (rate.basis === 'log' ? `Schätzung · Sicherheit ${rate.confidence}` : 'aus Jahresfahrleistung') : 'mind. 2 Einträge nötig'}</div>
          </div>
          <div>
            <div className="k">Letzte 12 Monate</div>
            <div className="v">{yearKm !== null ? fmtKm(yearKm) : '–'}</div>
            <div className="s">gefahren laut Einträgen</div>
          </div>
        </div>
      </div>
      <div className="section-footer">
        Prognosen sind Schätzungen. Grundlage sind die Einträge der letzten 12 Monate; schwankende Fahrleistung (z. B. Reisen im Sommer) macht sie ungenauer. Nach einer Korrektur wird erst ab der Korrektur gerechnet.
      </div>

      <Section header={`Verlauf (${desc.length})`}>
        {desc.length ? (
          <div className="group">
            {desc.map((e, i) => {
              const prev = desc[i + 1];
              const diff = prev ? e.km - prev.km : null;
              return (
                <Row
                  key={e.id}
                  title={<span className="num">{fmtKm(e.km)}</span>}
                  sub={
                    <>
                      {formatDate(e.date)} · {relativeDays(-Math.max(0, daysBetween(e.date, today)))}
                      {e.correction && <span className="badge badge-src-ungeprueft" style={{ marginLeft: 6 }}>Korrektur</span>}
                      {e.note.trim() && <div>{e.note}</div>}
                    </>
                  }
                  value={diff !== null ? <span style={{ color: diff < 0 ? 'var(--overdue-text)' : undefined }}>{diff >= 0 ? '+' : ''}{fmtNum(diff)}</span> : undefined}
                  right={
                    <button className="nav-btn" style={{ color: 'var(--label-3)', minHeight: 0, padding: 6 }} aria-label="Eintrag löschen" onClick={() => setDel(e.id)}>
                      <Icon name="trash" size={18} />
                    </button>
                  }
                />
              );
            })}
          </div>
        ) : (
          <div className="card small muted">Noch keine Einträge.</div>
        )}
      </Section>
      <button className="btn btn-primary btn-block mt-lg" onClick={nav.openMileage}>
        Kilometerstand erfassen
      </button>

      <Confirm
        open={!!del}
        title="Eintrag löschen?"
        message="Der Kilometerstand wird aus dem Verlauf entfernt. Für nachvollziehbare Änderungen besser eine Korrektur speichern."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => {
          if (del) deleteMileage(del);
          toast('Gelöscht');
        }}
        onClose={() => setDel(null)}
      />
    </>
  );
}

function Sparkline({ entries }: { entries: { date: string; km: number }[] }) {
  if (entries.length < 2) return null;
  const xs = entries.map((e) => Date.parse(e.date));
  const ys = entries.map((e) => e.km);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const W = 300;
  const H = 72;
  const px = (x: number) => (x1 === x0 ? W : ((x - x0) / (x1 - x0)) * W);
  const py = (y: number) => (y1 === y0 ? H / 2 : H - 6 - ((y - y0) / (y1 - y0)) * (H - 12));
  const pts = entries.map((e, i) => `${px(xs[i])},${py(e.km)}`).join(' ');
  return (
    <svg className="spark mt" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Verlauf des Kilometerstands">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--tint)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--tint)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sg)" />
      <polyline points={pts} fill="none" stroke="var(--tint)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
