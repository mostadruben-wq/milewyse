import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Row, Section } from '../components/ui';
import { costEntries, COST_LABEL } from '../lib/costs';
import { addDays, formatDate } from '../lib/dates';
import { fmtEur } from '../lib/util';
import type { CostCategory } from '../lib/types';

/** Kostenübersicht – jeder Beleg wird genau einmal gezählt (siehe lib/costs.ts). */
export function Costs() {
  const { root, state, today, km } = useStore();
  const nav = useNav();
  const entries = costEntries(root, state.vehicle.id);
  const year = today.slice(0, 4);
  const yearAgo = addDays(today, -365);
  const sum = (f: (e: (typeof entries)[number]) => boolean) => entries.filter(f).reduce((s, e) => s + e.amount, 0);
  const thisYear = sum((e) => e.date.startsWith(year));
  const last12 = sum((e) => e.date >= yearAgo);
  const byCat = (Object.keys(COST_LABEL) as CostCategory[]).map((c) => ({ c, v: sum((e) => e.category === c && e.date >= yearAgo) })).filter((x) => x.v > 0);
  const max = Math.max(1, ...byCat.map((x) => x.v));
  // Kosten pro km: Kosten der letzten 12 Monate / gefahrene km in dem Zeitraum (nur wenn Daten reichen)
  const ms = [...state.mileage].sort((a, b) => (a.date < b.date ? -1 : 1));
  const anchor = [...ms].reverse().find((m) => m.date <= yearAgo) ?? ms.find((m) => m.date >= yearAgo);
  const driven = anchor && km !== null ? km - anchor.km : null;
  const perKm = driven && driven > 500 ? last12 / driven : null;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - (11 - i), 1));
    const key = d.toISOString().slice(0, 7);
    return { key, label: new Intl.DateTimeFormat('de-DE', { month: 'narrow', timeZone: 'UTC' }).format(d), v: sum((e) => e.date.startsWith(key)) };
  });
  const mMax = Math.max(1, ...months.map((m) => m.v));

  return (
    <>
      <h1 className="large-title" style={{ marginTop: 14 }}>Kosten</h1>
      <div className="kv">
        <div className="card" style={{ padding: 14 }}>
          <div className="k">Jahr {year}</div>
          <div className="v">{fmtEur(thisYear)}</div>
        </div>
        <div className="card" style={{ padding: 14, marginTop: 0 }}>
          <div className="k">Letzte 12 Monate</div>
          <div className="v">{fmtEur(last12)}</div>
          <div className="s">{perKm !== null ? `${perKm.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 3, maximumFractionDigits: 3 })} pro km` : 'pro km: zu wenig Daten'}</div>
        </div>
      </div>

      <Section header="Monatlich (12 Monate)">
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 110 }} role="img" aria-label="Monatliche Kosten der letzten 12 Monate">
            {months.map((m) => (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }} title={`${m.key}: ${fmtEur(m.v)}`}>
                <div style={{ width: '100%', height: `${(m.v / mMax) * 84}%`, minHeight: m.v ? 3 : 1, background: m.v ? 'var(--tint)' : 'var(--fill)', borderRadius: 4 }} />
                <span className="small muted" style={{ fontSize: 10.5 }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section header="Nach Kategorie (12 Monate)" footer="Belege zählen genau einmal mit ihrem Gesamtbetrag – auch wenn mehrere Wartungen daraus übernommen wurden.">
        <div className="card">
          {byCat.length ? (
            byCat.map((x) => (
              <div key={x.c} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                  <span>{COST_LABEL[x.c]}</span>
                  <span className="num" style={{ fontWeight: 600 }}>{fmtEur(x.v)}</span>
                </div>
                <div className="progress">
                  <span style={{ width: `${(x.v / max) * 100}%`, background: 'var(--tint)' }} />
                </div>
              </div>
            ))
          ) : (
            <div className="muted small">Noch keine Kosten. Kosten entstehen aus gescannten Belegen oder beim Eintragen von Wartungen und Reparaturen.</div>
          )}
        </div>
      </Section>

      <Section header={`Buchungen (${entries.length})`}>
        {entries.length ? (
          <div className="group">
            {entries.slice(0, 40).map((e) => (
              <Row key={e.source + e.id} title={e.title} sub={`${formatDate(e.date)} · ${COST_LABEL[e.category]}${e.source === 'document' ? ' · Beleg' : ''}`} value={fmtEur(e.amount)} onClick={() => (e.source === 'document' ? nav.goTo('mehr', { name: 'document', id: e.id }) : nav.openRecord(e.id))} />
            ))}
          </div>
        ) : (
          <div className="card small muted">Keine Buchungen.</div>
        )}
      </Section>
      <div className="section-footer">Tankbuch, Versicherung und Kfz-Steuer als eigene Erfassung folgen. Belege dieser Art kannst du schon jetzt scannen und der passenden Kostenart zuordnen.</div>
    </>
  );
}
