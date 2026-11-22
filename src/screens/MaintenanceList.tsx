import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav, type StatusFilter } from '../nav';
import { Icon } from '../components/Icon';
import { CAT_COLOR, Empty, IconTile, Row, Section, Segmented, statusColor } from '../components/ui';
import { CATEGORIES } from '../data/catalog';
import { compareUrgency } from '../lib/maintenance';
import { describeDue } from '../lib/describe';
import type { MaintenanceItem } from '../lib/types';
import { GroupToggles } from '../components/GroupToggles';
import { Collapsible } from '../components/Collapsible';
import { STATUS_LABEL } from '../lib/maintenance';

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'overdue', label: 'Überfällig' },
  { id: 'soon', label: 'Bald fällig' },
  { id: 'ok', label: 'In Ordnung' },
  { id: 'unknown', label: 'Unbekannt' },
  { id: 'inactive', label: 'Deaktiviert' }
];

export function MaintenanceList() {
  const { state, dues } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'kategorie' | 'dringlichkeit'>('kategorie');
  // Kategorien standardmäßig zugeklappt; bei Suche oder Statusfilter automatisch offen
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const autoOpen = !!q.trim() || nav.filter !== 'alle';

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.items.filter((i) => {
      const st = dues[i.id].status;
      if (nav.filter === 'alle' ? st === 'inactive' : st !== nav.filter) return false;
      if (needle && !`${i.name} ${i.description} ${i.partNumbers} ${i.notes}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [state.items, dues, q, nav.filter]);

  const countFor = (f: StatusFilter) => state.items.filter((i) => (f === 'alle' ? dues[i.id].status !== 'inactive' : dues[i.id].status === f)).length;

  const renderRow = (it: MaintenanceItem, showCat = false) => {
    const d = dues[it.id];
    const cat = CATEGORIES.find((c) => c.id === it.category)!;
    return (
      <Row
        key={it.id}
        className={`item-row ${d.status === 'inactive' ? 'inactive' : ''}`}
        icon={showCat ? <IconTile name={cat.icon} color={CAT_COLOR[it.category]} /> : <span className={`dot dot-${d.status}`} style={{ width: 12, height: 12, margin: '0 4px' }} aria-label={d.status} />}
        title={it.name}
        sub={
          <>
            <span style={{ color: d.status === 'overdue' ? 'var(--overdue-text)' : d.status === 'soon' ? 'var(--soon-text)' : undefined }}>{describeDue(d)}</span>
            {it.intervalSource === 'ungeprueft' && (it.intervalKm || it.intervalMonths) ? <span className="badge badge-src-ungeprueft" style={{ fontSize: 10.5, padding: '1px 6px' }}>ungeprüft</span> : null}
            {it.custom && <span className="badge badge-src-benutzer" style={{ fontSize: 10.5, padding: '1px 6px' }}>eigene</span>}
          </>
        }
        right={
          d.progress !== null && d.status !== 'inactive' ? (
            <MiniRing value={d.progress} color={statusColor(d.status)} />
          ) : undefined
        }
        onClick={() => nav.push({ name: 'item', id: it.id })}
      />
    );
  };

  return (
    <>
      <div className="title-row">
        <h1 className="large-title">Wartung</h1>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="circle-btn" aria-label="Intervalle anpassen" title="Intervalle anpassen" onClick={() => nav.push({ name: 'intervals' })}>
          <Icon name="settings" size={20} />
        </button>
        <button className="circle-btn" aria-label="Eigene Wartungsposition anlegen" onClick={() => nav.openItemEditor(null)}>
          <Icon name="plus" size={22} stroke={2.2} />
        </button>
        </div>
      </div>

      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Wartungspositionen durchsuchen" />
        {q && (
          <button className="nav-btn" style={{ minHeight: 0, padding: 4 }} onClick={() => setQ('')} aria-label="Suche löschen">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>

      <div className="chips" role="tablist" aria-label="Nach Status filtern">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={nav.filter === f.id} className={`chip-btn ${nav.filter === f.id ? 'active' : ''}`} onClick={() => nav.setFilter(f.id)}>
            {f.id !== 'alle' && <span className={`dot dot-${f.id}`} style={{ width: 8, height: 8 }} />}
            {f.label}
            <span style={{ opacity: 0.55 }}>{countFor(f.id)}</span>
          </button>
        ))}
      </div>

      <Segmented
        label="Sortierung"
        value={sort}
        onChange={setSort}
        options={[
          { value: 'kategorie', label: 'Nach Kategorie' },
          { value: 'dringlichkeit', label: 'Nach Dringlichkeit' }
        ]}
      />

      {filtered.length === 0 && (
        <Empty
          icon="checkCircle"
          title={q ? 'Keine Treffer' : 'Nichts in dieser Ansicht'}
          text={q ? 'Versuche einen anderen Suchbegriff.' : 'In diesem Status gibt es aktuell keine Positionen.'}
        />
      )}

      {sort === 'dringlichkeit' && filtered.length > 0 && (
        <Section header=" ">
          <div className="group">{[...filtered].sort((a, b) => compareUrgency(dues[a.id], dues[b.id])).map((it) => renderRow(it, true))}</div>
        </Section>
      )}

      {sort === 'kategorie' &&
        CATEGORIES.map((c) => {
          const items = filtered.filter((i) => i.category === c.id);
          if (!items.length) return null;
          const cnt = (st: string) => items.filter((i) => dues[i.id].status === st).length;
          const summary = (
            <>
              <span>{items.length} Positionen</span>
              {(['overdue', 'soon', 'ok'] as const).map((st) =>
                cnt(st) ? (
                  <span key={st} className="s" title={STATUS_LABEL[st]}>
                    <span className={`dot dot-${st}`} style={{ width: 7, height: 7 }} />
                    {cnt(st)}
                  </span>
                ) : null
              )}
            </>
          );
          const open = autoOpen || !!openCats[c.id];
          return (
            <Collapsible key={c.id} id={c.id} title={c.name} summary={summary} open={open} onToggle={() => setOpenCats((o) => ({ ...o, [c.id]: !open }))}>
              <div className="group">{items.map((it) => renderRow(it))}</div>
            </Collapsible>
          );
        })}

      {nav.filter === 'alle' && !q && (
        <Section header="Zusammenfassen" footer="Optional: Teile, die meist gemeinsam gewechselt werden, als eine Position mit gemeinsamem Intervall führen. Beim Ausschalten bleiben alle Daten erhalten.">
          <GroupToggles />
        </Section>
      )}

      {nav.filter === 'alle' && (
        <div className="section-footer mt">
          Deaktivierte Positionen findest du unter „Deaktiviert“. Werte mit „ungeprüft“ sind Startwerte – bitte mit deinen Unterlagen abgleichen.
        </div>
      )}
    </>
  );
}

function MiniRing({ value, color }: { value: number; color: string }) {
  const size = 26;
  const r = 10;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" style={{ transform: 'rotate(-90deg)', flex: 'none' }} aria-hidden="true">
      <circle cx="13" cy="13" r={r} fill="none" stroke="var(--fill)" strokeWidth="3.5" />
      <circle cx="13" cy="13" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
    </svg>
  );
}
