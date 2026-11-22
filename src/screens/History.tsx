import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Icon } from '../components/Icon';
import { CAT_COLOR, Empty } from '../components/ui';
import { CATEGORIES, categoryName } from '../data/catalog';
import { formatDate, formatMonth } from '../lib/dates';
import { fmtEur, fmtKm } from '../lib/util';
import type { CategoryId } from '../lib/types';

export function History() {
  const { state } = useStore();
  const nav = useNav();
  const [cat, setCat] = useState<CategoryId | 'alle'>('alle');
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...state.records]
      .filter((r) => (cat === 'alle' || r.category === cat) && (!needle || `${r.title} ${r.description} ${r.workshop} ${r.notes}`.toLowerCase().includes(needle)))
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  }, [state.records, cat, q]);

  let lastMonth = '';
  return (
    <>
      <h1 className="large-title">Historie</h1>
      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Serviceheft durchsuchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Historie durchsuchen" />
      </div>
      <div className="chips">
        <button className={`chip-btn ${cat === 'alle' ? 'active' : ''}`} onClick={() => setCat('alle')}>
          Alle
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`chip-btn ${cat === c.id ? 'active' : ''}`} onClick={() => setCat(c.id)}>
            <span className="dot" style={{ background: CAT_COLOR[c.id], width: 8, height: 8 }} />
            {c.name}
          </button>
        ))}
      </div>

      {!list.length && (
        <Empty
          icon="clock"
          title={state.records.length ? 'Keine Treffer' : 'Serviceheft ist leer'}
          text={state.records.length ? 'Filter oder Suchbegriff anpassen.' : 'Trage deine erste Wartung oder Reparatur ein.'}
          action={
            !state.records.length ? (
              <button className="btn btn-primary" onClick={() => nav.openComplete([])}>
                Wartung eintragen
              </button>
            ) : undefined
          }
        />
      )}

      <div className="timeline">
        {list.map((r) => {
          const month = r.date.slice(0, 7);
          const showMonth = month !== lastMonth;
          lastMonth = month;
          const total = (r.costParts ?? 0) + (r.costLabor ?? 0);
          return (
            <div key={r.id}>
              {showMonth && <div className="tl-month">{formatMonth(r.date)}</div>}
              <div className={`tl-item ${r.type}`}>
                <button className="card" style={{ width: '100%', border: 0, textAlign: 'left', padding: 14 }} onClick={() => nav.openRecord(r.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600 }}>{r.title}</div>
                    {total > 0 && <div className="num" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEur(total)}</div>}
                  </div>
                  <div className="small muted" style={{ marginTop: 3 }}>
                    {formatDate(r.date)}
                    {r.km !== null && ` · ${fmtKm(r.km)}`} · {r.doneBy === 'werkstatt' ? r.workshop || 'Werkstatt' : 'Selbst gemacht'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: 'var(--fill)', color: 'var(--label-2)' }}>
                      <span className="dot" style={{ background: CAT_COLOR[r.category], width: 7, height: 7 }} />
                      {categoryName(r.category)}
                    </span>
                    <span className={`badge ${r.type === 'reparatur' ? 'badge-src-ungeprueft' : 'badge-src-empfehlung'}`}>{r.type === 'reparatur' ? 'Reparatur' : 'Wartung'}</span>
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
