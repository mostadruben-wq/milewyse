import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { CAT_COLOR, Confirm, IconTile, NavBar, Ring, Row, Section, SourceBadge, StatusBadge, Toggle, statusColor, toast } from '../components/ui';
import { CATEGORIES, categoryName } from '../data/catalog';
import { describeDue } from '../lib/describe';
import { formatDate, relativeDays } from '../lib/dates';
import { fmtEur, fmtKm, fmtNum } from '../lib/util';
import { GROUPS, groupOf } from '../lib/groups';
import { GroupToggles } from '../components/GroupToggles';

export function ItemDetail({ id }: { id: string }) {
  const { state, dues, saveItem, deleteItem } = useStore();
  const nav = useNav();
  const [confirmDel, setConfirmDel] = useState(false);
  const item = state.items.find((i) => i.id === id);
  if (!item) {
    return (
      <>
        <NavBar onBack={nav.pop} backLabel="Wartung" />
        <p className="muted center">Diese Position existiert nicht mehr.</p>
      </>
    );
  }
  const d = dues[item.id];
  const cat = CATEGORIES.find((c) => c.id === item.category)!;
  const related = item.relatedIds.map((rid) => state.items.find((i) => i.id === rid)).filter(Boolean);
  const records = state.records.filter((r) => r.itemIds.includes(item.id)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const warnKm = item.warnKm ?? state.settings.warnKm;
  const warnDays = item.warnDays ?? state.settings.warnDays;

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Wartung" right={<button className="nav-btn" onClick={() => nav.openItemEditor(item.id)}>Bearbeiten</button>} />

      <div className="detail-head">
        <IconTile name={cat.icon} color={CAT_COLOR[item.category]} size={56} />
        <h2>{item.name}</h2>
        <div className="muted small">
          {categoryName(item.category)} · {item.kind === 'pruefung' ? 'Kontrolle' : 'Wechsel/Austausch'}
        </div>
        <StatusBadge status={d.status} />
      </div>

      <div className="card">
        <div className="ring-wrap">
          <Ring value={d.progress ?? 0} color={statusColor(d.status)} size={84}>
            <span className="ring-text" style={{ fontSize: 18 }}>{d.progress !== null ? `${Math.min(999, Math.round(d.progress * 100))}%` : '–'}</span>
          </Ring>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 17 }}>{describeDue(d)}</div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {d.progress !== null ? 'des Intervalls verbraucht' : 'Fortschritt erst nach erster Eintragung berechenbar'}
              {d.decisive && d.nextKm !== null && d.nextDate !== null && ` · maßgeblich: ${d.decisive === 'km' ? 'Kilometer' : 'Datum'}`}
            </div>
          </div>
        </div>
        <div className="kv mt-lg">
          <div>
            <div className="k">Nächste Fälligkeit</div>
            <div className="v">{d.nextKm !== null ? fmtKm(d.nextKm) : '–'}</div>
            <div className="s">nach Kilometern</div>
          </div>
          <div>
            <div className="k">Nächste Fälligkeit</div>
            <div className="v">{d.nextDate ? formatDate(d.nextDate) : '–'}</div>
            <div className="s">nach Datum</div>
          </div>
          <div>
            <div className="k">Restkilometer</div>
            <div className="v" style={{ color: d.remainingKm !== null && d.remainingKm <= 0 ? 'var(--overdue-text)' : undefined }}>
              {d.remainingKm !== null ? fmtKm(d.remainingKm) : '–'}
            </div>
            <div className="s">geschätzt aus aktuellem Stand</div>
          </div>
          <div>
            <div className="k">Voraussichtlich</div>
            <div className="v" style={{ fontSize: 17 }}>{d.estimatedDays !== null ? (d.estimatedDays <= 0 ? 'jetzt' : relativeDays(d.estimatedDays)) : '–'}</div>
            <div className="s">{d.estimated ? 'Schätzung über Fahrleistung' : d.estimatedDays !== null ? 'laut Datum' : 'keine Prognose möglich'}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-block mt-lg" onClick={() => nav.openComplete([item.id])} disabled={!item.enabled}>
          Als erledigt eintragen
        </button>
      </div>

      <Section header="Intervall" footer={item.intervalSource === 'ungeprueft' ? 'Startwert ohne Verifizierung. Bitte mit Serviceheft, Werkstatt oder VW-Unterlagen abgleichen und die Quelle anpassen.' : item.intervalSource === 'empfehlung' ? 'Allgemein übliche fachliche Empfehlung – kein offizieller VW-Wert.' : undefined}>
        <div className="group">
          <Row title="Kilometer" value={item.intervalKm ? fmtKm(item.intervalKm) : 'nicht festgelegt'} />
          <Row title="Zeit" value={item.intervalMonths ? `${fmtNum(item.intervalMonths)} Monate` : 'nicht festgelegt'} />
          <Row title="Quelle" right={<SourceBadge source={item.intervalSource} />} />
          <Row title="Vorwarnung" value={`${fmtKm(warnKm)} / ${warnDays} Tage${item.warnKm === null && item.warnDays === null ? ' (global)' : ''}`} />
          <Row
            title="Position aktiv"
            right={
              <Toggle
                label="Position aktiv"
                checked={item.enabled}
                onChange={(v) => {
                  saveItem({ ...item, enabled: v });
                  toast(v ? 'Aktiviert' : 'Deaktiviert');
                }}
              />
            }
          />
        </div>
      </Section>

      <Section header="Letzte Wartung">
        <div className="group">
          <Row title="Datum" value={item.lastDate ? formatDate(item.lastDate) : 'unbekannt'} />
          <Row title="Kilometerstand" value={item.lastKm !== null ? fmtKm(item.lastKm) : 'unbekannt'} />
          {item.cost !== null && <Row title="Kosten" value={fmtEur(item.cost)} />}
        </div>
      </Section>

      <Section header="Betriebsstoffe & Ersatzteile">
        <div className="group">
          <Row title="Spezifikation" sub={item.fluidSpec || 'nicht eingetragen'} right={item.fluidSpec ? <SourceBadge source={item.fluidSpecSource} /> : undefined} />
          <Row title="Füllmenge" sub={item.capacity || 'nicht eingetragen'} right={item.capacity ? <SourceBadge source={item.capacitySource} /> : undefined} />
          <Row title="Ersatzteile" sub={item.parts || '–'} />
          <Row title="Teilenummern" sub={item.partNumbers || '–'} />
        </div>
      </Section>

      {(item.description || item.notes) && (
        <Section header="Hinweise">
          <div className="card small" style={{ lineHeight: 1.5 }}>
            {item.description && <p style={{ margin: 0 }}>{item.description}</p>}
            {item.notes && <p style={{ margin: item.description ? '10px 0 0' : 0 }}><b>Notiz:</b> {item.notes}</p>}
          </div>
        </Section>
      )}

      {related.length > 0 && (
        <Section header="Zusammenhängende Arbeiten" footer="Werden beim Eintragen zur Bestätigung angeboten – nichts wird automatisch als erledigt markiert.">
          <div className="group">
            {related.map((r) => (
              <Row key={r!.id} icon={<span className={`dot dot-${dues[r!.id].status}`} style={{ width: 12, height: 12, margin: '0 4px' }} />} title={r!.name} sub={describeDue(dues[r!.id])} onClick={() => nav.push({ name: 'item', id: r!.id })} />
            ))}
          </div>
        </Section>
      )}

      <Section header={`Historie (${records.length})`}>
        {records.length ? (
          <div className="group">
            {records.map((r) => (
              <Row key={r.id} title={r.title} sub={`${formatDate(r.date)}${r.km !== null ? ' · ' + fmtKm(r.km) : ''}`} onClick={() => nav.openRecord(r.id)} />
            ))}
          </div>
        ) : (
          <div className="card small muted">Noch keine dokumentierte Wartung für diese Position.</div>
        )}
      </Section>

      {(groupOf(item.key) || GROUPS.some((g) => g.id === item.key)) && (
        <Section header="Set" footer={GROUPS.find((g) => g.id === item.key)?.description}>
          <GroupToggles only={(groupOf(item.key) ?? GROUPS.find((g) => g.id === item.key))!.id} />
        </Section>
      )}

      {item.custom && (
        <div className="group mt-lg">
          <button className="row destructive" onClick={() => setConfirmDel(true)}>
            Position löschen
          </button>
        </div>
      )}

      <Confirm
        open={confirmDel}
        title={`„${item.name}“ löschen?`}
        message="Die Position wird entfernt. Einträge in der Historie bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => {
          deleteItem(item.id);
          nav.pop();
          toast('Gelöscht');
        }}
        onClose={() => setConfirmDel(false)}
      />
    </>
  );
}
