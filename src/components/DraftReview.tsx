import { useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Section, SelectField, TextArea, Toggle } from './ui';
import { Icon } from './Icon';
import type { Draft, DraftSuggestion } from '../lib/scan';
import type { CostCategory, DocCategory } from '../lib/types';
import { COST_LABEL } from '../lib/costs';
import { fmtEur } from '../lib/util';
import { DOC_CAT_LABEL } from '../lib/docs';

const Unsure = ({ c }: { c: 'hoch' | 'niedrig' | null }) =>
  c === 'niedrig' ? <span className="uncertain-badge">unsicher</span> : null;

/** Prüfen und Korrigieren eines erkannten Belegs (Einzelscan & Sammelimport). */
export function DraftReview({ d, set, compact }: { d: Draft; set: (d: Draft) => void; compact?: boolean }) {
  const { root, today } = useStore();
  const [showText, setShowText] = useState(false);
  const f = <K extends keyof Draft>(k: K, v: Draft[K]) => set({ ...d, [k]: v });
  const setS = (id: string, patch: Partial<DraftSuggestion>) => set({ ...d, suggestions: d.suggestions.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const vehItems = root.items.filter((i) => i.vehicleId === d.vehicleId);
  const shop = d.purchaseType === 'teilekauf';

  const label = (t: string, c: 'hoch' | 'niedrig' | null) => (
    <>
      {t}
      <Unsure c={c} />
    </>
  );

  return (
    <>
      {d.duplicate && (
        <div className="banner" role="alert" style={{ borderColor: 'var(--soon)' }}>
          <Icon name="alert" size={20} style={{ color: 'var(--soon-text)', flex: 'none' }} />
          <div className="small">
            <strong>Möglicherweise schon vorhanden</strong>
            „{d.duplicate.title}“ ({d.duplicate.reason}). Wird standardmäßig nicht erneut übernommen.
          </div>
        </div>
      )}
      {d.textSource === 'ocr' && d.ocrConfidence !== null && d.ocrConfidence < 70 && (
        <div className="banner">
          <Icon name="info" size={20} style={{ color: 'var(--tint)', flex: 'none' }} />
          <div className="small">Die Bildqualität ist eher schwach ({d.ocrConfidence} % Erkennungssicherheit). Bitte die Werte besonders sorgfältig prüfen.</div>
        </div>
      )}

      <Section header="Beleg" footer={!compact ? 'Gelb markierte Werte wurden nur indirekt gefunden. Leere Felder standen nicht eindeutig im Dokument und wurden bewusst nicht ergänzt.' : undefined}>
        <div className="group">
          <Field label="Titel" value={d.title} onChange={(v) => f('title', v)} />
          <SelectField<DocCategory> label="Kategorie" value={d.category} onChange={(v) => f('category', v)} options={(Object.keys(DOC_CAT_LABEL) as DocCategory[]).map((k) => ({ value: k, label: DOC_CAT_LABEL[k] }))} />
          {root.vehicles.length > 1 && (
            <SelectField<string> label="Fahrzeug" value={d.vehicleId} onChange={(v) => set({ ...d, vehicleId: v, suggestions: d.suggestions.map((s) => ({ ...s, itemIds: [] })) })} options={root.vehicles.map((v) => ({ value: v.id, label: v.name }))} />
          )}
          <div className={d.conf.date === 'niedrig' ? 'uncertain' : ''}><Field label={label('Datum', d.conf.date)} type="date" value={d.date} onChange={(v) => f('date', v)} max={today} /></div>
          <div className={d.conf.vendor === 'niedrig' ? 'uncertain' : ''}><Field label={label('Händler', d.conf.vendor)} value={d.vendor} onChange={(v) => f('vendor', v)} placeholder="nicht erkannt" /></div>
          <div className={d.conf.invoiceNo === 'niedrig' ? 'uncertain' : ''}><Field label={label('Rechnungs-Nr.', d.conf.invoiceNo)} value={d.invoiceNo} onChange={(v) => f('invoiceNo', v)} placeholder="nicht erkannt" /></div>
          <div className={d.conf.total === 'niedrig' ? 'uncertain' : ''}><Field label={label('Gesamtbetrag', d.conf.total)} value={d.total} onChange={(v) => f('total', v)} inputMode="decimal" unit="€" placeholder="–" /></div>
          <div className={d.conf.vat === 'niedrig' ? 'uncertain' : ''}><Field label={label('MwSt.', d.conf.vat)} value={d.vat} onChange={(v) => f('vat', v)} inputMode="decimal" unit="€" placeholder="–" /></div>
          <div className={d.conf.km === 'niedrig' ? 'uncertain' : ''}><Field label={label('Kilometerstand', d.conf.km)} value={d.km} onChange={(v) => f('km', v)} inputMode="numeric" unit="km" placeholder="nicht im Beleg" /></div>
          <div className="field">
            <label>In Kosten zählen</label>
            <span style={{ marginLeft: 'auto' }}>
              <Toggle label="In Kosten zählen" checked={d.countCost} onChange={(v) => f('countCost', v)} />
            </span>
          </div>
          {d.countCost && <SelectField<CostCategory> label="Kostenart" value={d.costCategory} onChange={(v) => f('costCategory', v)} options={(Object.keys(COST_LABEL) as CostCategory[]).map((k) => ({ value: k, label: COST_LABEL[k] }))} />}
        </div>
        {(d.plate || d.fluids.length > 0) && (
          <div className="hint">
            {d.plate && <>Kennzeichen im Beleg: <b>{d.plate}</b>. </>}
            {d.fluids.length > 0 && <>Betriebsstoffe/Spezifikationen: <b>{d.fluids.join(', ')}</b></>}
          </div>
        )}
      </Section>

      <Section
        header={`Erkannte Arbeiten (${d.suggestions.length})`}
        footer={
          shop
            ? 'Das ist ein Teilekauf. Ob und wann die Teile eingebaut wurden, steht nicht im Beleg – bestätige eine Arbeit nur, wenn sie erledigt ist, und passe Datum und Kilometerstand an.'
            : 'Nur bestätigte Arbeiten werden in die Historie übernommen und aktualisieren die Wartungsintervalle. Die Kosten werden einmal über den Beleg gezählt.'
        }
      >
        {d.suggestions.length === 0 && <div className="card small muted">Keine Wartungsarbeit eindeutig erkannt. Du kannst den Beleg trotzdem speichern und später verknüpfen.</div>}
        {d.suggestions.map((s) => (
          <div key={s.id} className="card" style={{ padding: 14, marginTop: 10, opacity: s.accepted ? 1 : 0.85 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <button
                role="checkbox"
                aria-checked={s.accepted}
                aria-label={`${s.title} übernehmen`}
                onClick={() => setS(s.id, { accepted: !s.accepted })}
                style={{ width: 26, height: 26, borderRadius: 13, flex: 'none', display: 'grid', placeItems: 'center', border: s.accepted ? 0 : '1.5px solid var(--label-3)', background: s.accepted ? 'var(--tint)' : 'transparent', color: '#fff', marginTop: 2 }}
              >
                {s.accepted && <Icon name="check" size={16} stroke={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  value={s.title}
                  onChange={(e) => setS(s.id, { title: e.target.value })}
                  aria-label="Titel der Arbeit"
                  style={{ border: 0, background: 'none', fontWeight: 600, fontSize: 16, width: '100%', padding: 0, outline: 'none' }}
                />
                <div className="small muted" style={{ marginTop: 2 }}>
                  {s.itemIds.length ? `Aktualisiert: ${s.itemIds.map((id) => vehItems.find((i) => i.id === id)?.name).filter(Boolean).join(', ')}` : 'Keine passende Wartungsposition – wird als Historieneintrag gespeichert'}
                  {s.unmatched.length > 0 && s.itemIds.length > 0 && ` · ohne Position: ${s.unmatched.join(', ')}`}
                </div>
                {s.amount !== null && <div className="small muted">Positionen laut Beleg: {fmtEur(s.amount)}</div>}
                {s.confidence === 'niedrig' && <div className="small" style={{ color: 'var(--soon-text)', marginTop: 2 }}>Bitte prüfen – Zuordnung unsicher.</div>}
                {s.duplicateOf && <div className="small" style={{ color: 'var(--soon-text)', marginTop: 2 }}>Am selben Tag existiert bereits ein Eintrag für diese Arbeit.</div>}
              </div>
            </div>
            {s.accepted && (
              <div className="group mt" style={{ background: 'var(--card-2)' }}>
                <Field label={shop ? 'Einbaudatum' : 'Datum'} type="date" value={s.date} onChange={(v) => setS(s.id, { date: v })} max={today} />
                <Field label="Kilometerstand" value={s.km} onChange={(v) => setS(s.id, { km: v })} inputMode="numeric" unit="km" placeholder="optional" />
              </div>
            )}
          </div>
        ))}
      </Section>

      {d.parts.length > 0 && (
        <Section header={`Ersatzteile (${d.parts.length})`} footer="Übernommen werden nur Angaben, die im Beleg stehen. Fehlende Hersteller oder Teilenummern bleiben leer.">
          <div className="group">
            {d.parts.map((p) => (
              <button key={p.id} className="row" role="checkbox" aria-checked={p.accepted} onClick={() => set({ ...d, parts: d.parts.map((x) => (x.id === p.id ? { ...x, accepted: !x.accepted } : x)) })}>
                <span style={{ width: 22, height: 22, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', border: p.accepted ? 0 : '1.5px solid var(--label-3)', background: p.accepted ? 'var(--tint)' : 'transparent', color: '#fff' }}>
                  {p.accepted && <Icon name="check" size={14} stroke={3} />}
                </span>
                <div className="row-main">
                  <div className="row-title">{p.name}</div>
                  <div className="row-sub">
                    {[p.manufacturer || 'Hersteller unbekannt', p.partNumber ? `Nr. ${p.partNumber}` : 'ohne Teilenummer'].join(' · ')}
                  </div>
                </div>
                <span className="row-value">{p.price !== null ? fmtEur(p.price) : ''}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {!compact && (
        <Section header="Notiz">
          <div className="group">
            <TextArea label="Notiz zum Beleg" value={d.notes} onChange={(v) => f('notes', v)} />
          </div>
        </Section>
      )}

      <Section header={<>Erkannter Text <button onClick={() => setShowText(!showText)}>{showText ? 'Ausblenden' : 'Anzeigen'}</button></>} footer={`Quelle: ${d.textSource === 'pdf' ? 'im PDF eingebetteter Text' : d.textSource === 'ocr' ? `Texterkennung auf dem Gerät${d.ocrConfidence !== null ? ` (${d.ocrConfidence} %)` : ''}` : 'kein Text'}`}>
        {showText && <pre className="card mono" style={{ whiteSpace: 'pre-wrap', maxHeight: 280, overflow: 'auto', margin: 0 }}>{d.text || '(kein Text erkannt)'}</pre>}
      </Section>
    </>
  );
}
