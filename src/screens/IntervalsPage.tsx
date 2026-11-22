import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, NavBar, Section, toast } from '../components/ui';
import { Collapsible } from '../components/Collapsible';
import { CATEGORIES } from '../data/catalog';
import { fmtNum } from '../lib/util';

type Val = { km: number; months: number };
const KM_MAX = 200000;
const KM_STEP = 1000;
const MO_MAX = 120;
const roundKm = (n: number) => Math.min(KM_MAX, Math.max(0, Math.round(n / KM_STEP) * KM_STEP));
const roundMo = (n: number) => Math.min(MO_MAX, Math.max(0, Math.round(n)));

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-line">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        aria-valuetext={fmt(value)}
        style={{ ['--p' as string]: `${p}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className={`slider-val ${value === 0 && min === 0 ? 'off' : ''}`}>{fmt(value)}</span>
    </div>
  );
}

/**
 * Alle Intervalle auf einer Seite anpassen: pro Position mit Schiebereglern,
 * für alle gleichzeitig per Prozent-Regler, dazu die Vorwarnung für alle Positionen.
 */
export function IntervalsPage() {
  const { state, update } = useStore();
  const nav = useNav();
  const items = useMemo(() => state.items.filter((i) => i.enabled), [state.items]);
  const base = useMemo(() => Object.fromEntries(items.map((i) => [i.id, { km: i.intervalKm ?? 0, months: i.intervalMonths ?? 0 }])) as Record<string, Val>, [items]);
  const [scale, setScale] = useState(100);
  const [over, setOver] = useState<Record<string, Partial<Val>>>({});
  const [warnKm, setWarnKm] = useState(state.settings.warnKm);
  const [warnDays, setWarnDays] = useState(state.settings.warnDays);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const val = (id: string): Val => {
    const b = base[id];
    return {
      km: over[id]?.km ?? (b.km ? roundKm((b.km * scale) / 100) : 0),
      months: over[id]?.months ?? (b.months ? roundMo((b.months * scale) / 100) : 0)
    };
  };
  const changedIds = items.filter((i) => {
    const v = val(i.id);
    return v.km !== base[i.id].km || v.months !== base[i.id].months;
  });
  const warnChanged = warnKm !== state.settings.warnKm || warnDays !== state.settings.warnDays;
  const dirty = changedIds.length > 0 || warnChanged;

  const save = () => {
    const changes = Object.fromEntries(changedIds.map((i) => [i.id, val(i.id)]));
    update((s) => ({
      ...s,
      settings: { ...s.settings, warnKm, warnDays },
      items: s.items.map((i) =>
        changes[i.id] ? { ...i, intervalKm: changes[i.id].km || null, intervalMonths: changes[i.id].months || null, intervalSource: 'benutzer' } : i
      )
    }));
    toast(changedIds.length ? `${changedIds.length} Intervall(e) angepasst` : 'Vorwarnung gespeichert');
    nav.pop();
  };

  const kmFmt = (v: number) => (v ? `${fmtNum(v)} km` : 'aus');
  const moFmt = (v: number) => (v ? `${v} ${v === 1 ? 'Monat' : 'Monate'}` : 'aus');

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Wartung" right={<button className="nav-btn bold" onClick={save} disabled={!dirty}>Sichern</button>} />
      <h1 className="large-title">Intervalle anpassen</h1>

      <Section header="Alle Positionen gleichzeitig" footer="Verändert alle vorhandenen Intervalle prozentual – z. B. kürzer bei viel Kurzstrecke, Anhänger oder Offroad. Einzeln verschobene Regler unten haben Vorrang.">
        <div className="card" style={{ padding: '6px 0' }}>
          <div className="slider-row">
            <div className="slider-head">
              <span className="slider-name">Alle Intervalle</span>
              <button className="btn btn-sm btn-plain" style={{ minHeight: 30 }} onClick={() => (setScale(100), setOver({}))} disabled={scale === 100 && !Object.keys(over).length}>
                Zurücksetzen
              </button>
            </div>
            <Slider label="Faktor" value={scale} min={50} max={200} step={5} onChange={setScale} fmt={(v) => `${v} %`} />
          </div>
          <div className="slider-row">
            <div className="slider-head">
              <span className="slider-name">Vorwarnung</span>
              <span className="small muted">gilt für alle ohne eigene Schwelle</span>
            </div>
            <Slider label="Kilometer" value={warnKm} min={0} max={5000} step={100} onChange={setWarnKm} fmt={(v) => `${fmtNum(v)} km`} />
            <Slider label="Tage" value={warnDays} min={0} max={90} step={1} onChange={setWarnDays} fmt={(v) => `${v} Tage`} />
          </div>
        </div>
      </Section>

      <Section header="Einzeln" footer="Regler ganz links = kein Intervall dieser Art. Geänderte Werte werden als „Eigener Wert“ gekennzeichnet.">
        {CATEGORIES.map((c) => {
          const list = items.filter((i) => i.category === c.id);
          if (!list.length) return null;
          const n = list.filter((i) => changedIds.includes(i)).length;
          const withInterval = list.filter((i) => val(i.id).km || val(i.id).months).length;
          return (
            <Collapsible
              key={c.id}
              id={`int-${c.id}`}
              title={c.name}
              summary={
                <>
                  <span>{withInterval} von {list.length} mit Intervall</span>
                  {n > 0 && (
                    <span className="s" style={{ color: 'var(--accent-blue)' }}>
                      <span className="changed-dot" style={{ margin: 0 }} />
                      {n} geändert
                    </span>
                  )}
                </>
              }
              open={!!open[c.id]}
              onToggle={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
            >
              {list.map((i) => {
                const v = val(i.id);
                const changed = v.km !== base[i.id].km || v.months !== base[i.id].months;
                return (
                  <div key={i.id} className="slider-row">
                    <div className="slider-head">
                      <span className="slider-name">
                        {i.name}
                        {changed && <span className="changed-dot" aria-label="geändert" />}
                      </span>
                      {changed && (
                        <button className="nav-btn" style={{ minHeight: 0, padding: 0, fontSize: 13, background: 'none', boxShadow: 'none', color: 'var(--label-2)' }} onClick={() => setOver((o) => ({ ...o, [i.id]: { km: base[i.id].km, months: base[i.id].months } }))}>
                          Original
                        </button>
                      )}
                    </div>
                    <Slider label="Kilometer" value={v.km} min={0} max={KM_MAX} step={KM_STEP} onChange={(x) => setOver((o) => ({ ...o, [i.id]: { ...o[i.id], km: x } }))} fmt={kmFmt} />
                    <Slider label="Zeit" value={v.months} min={0} max={MO_MAX} step={1} onChange={(x) => setOver((o) => ({ ...o, [i.id]: { ...o[i.id], months: x } }))} fmt={moFmt} />
                  </div>
                );
              })}
            </Collapsible>
          );
        })}
      </Section>

      <div className="sticky-actions">
        <button className="btn btn-plain" onClick={() => setConfirmReset(true)} disabled={!dirty}>
          Verwerfen
        </button>
        <button className="btn btn-primary" onClick={save} disabled={!dirty}>
          {changedIds.length ? `${changedIds.length} Änderung${changedIds.length === 1 ? '' : 'en'} sichern` : 'Sichern'}
        </button>
      </div>

      <Confirm
        open={confirmReset}
        title="Änderungen verwerfen?"
        message="Alle Regler springen auf die gespeicherten Werte zurück."
        confirmLabel="Verwerfen"
        destructive
        onConfirm={() => {
          setScale(100);
          setOver({});
          setWarnKm(state.settings.warnKm);
          setWarnDays(state.settings.warnDays);
        }}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}
