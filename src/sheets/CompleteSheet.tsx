import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Section, Segmented, Sheet, TextArea, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CATEGORIES } from '../data/catalog';
import { isValidISO } from '../lib/dates';
import { fmtEur, fmtKm, haptic, parseNum } from '../lib/util';

/**
 * „Wartung eintragen“: Positionen wählen, zusammenhängende Arbeiten einzeln bestätigen,
 * danach werden die Intervalle der bestätigten Positionen aktualisiert und ein Historieneintrag angelegt.
 */
export function CompleteSheet({ initialIds, onClose }: { initialIds: string[]; onClose: () => void }) {
  const { state, today, km, completeMaintenance } = useStore();
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [step, setStep] = useState<'pick' | 'form'>(initialIds.length ? 'form' : 'pick');
  const [q, setQ] = useState('');
  const [date, setDate] = useState(today);
  const [kmStr, setKmStr] = useState(km !== null ? String(km) : '');
  const [doneBy, setDoneBy] = useState<'selbst' | 'werkstatt'>('selbst');
  const [workshop, setWorkshop] = useState('');
  const [parts, setParts] = useState('');
  const [labor, setLabor] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const byId = (id: string) => state.items.find((i) => i.id === id);
  const enabledItems = state.items.filter((i) => i.enabled);

  // Vorschläge: zusammenhängende Positionen der Auswahl, die noch nicht ausgewählt sind
  const suggestions = useMemo(() => {
    const set = new Set<string>();
    selected.forEach((id) => byId(id)?.relatedIds.forEach((r) => !selected.includes(r) && byId(r)?.enabled && set.add(r)));
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, state.items]);
  const [confirmedSugg, setConfirmedSugg] = useState<string[]>([]);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleSugg = (id: string) => setConfirmedSugg((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allIds = [...selected, ...confirmedSugg.filter((id) => suggestions.includes(id))];
  const autoTitle = allIds.map((id) => byId(id)?.name).filter(Boolean).join(', ');
  const costParts = parseNum(parts);
  const costLabor = parseNum(labor);

  const save = () => {
    if (!allIds.length) return setError('Bitte mindestens eine Wartungsposition auswählen.');
    if (!isValidISO(date) || date > today) return setError('Bitte ein gültiges Datum (nicht in der Zukunft) wählen.');
    const k = parseNum(kmStr);
    if (k !== null && (Number.isNaN(k) || k < 0 || !Number.isInteger(k))) return setError('Bitte einen gültigen Kilometerstand eingeben oder das Feld leeren.');
    if ([costParts, costLabor].some((c) => c !== null && (Number.isNaN(c) || c < 0))) return setError('Bitte gültige Kosten eingeben (z. B. 89,90).');
    completeMaintenance({
      itemIds: allIds,
      date,
      km: k,
      title: title.trim() || autoTitle,
      description: description.trim(),
      doneBy,
      workshop: doneBy === 'werkstatt' ? workshop.trim() : '',
      costParts: costParts,
      costLabor: costLabor,
      notes: notes.trim()
    });
    haptic();
    toast(allIds.length === 1 ? 'Wartung eingetragen' : `${allIds.length} Positionen eingetragen`);
    onClose();
  };

  if (step === 'pick') {
    const needle = q.trim().toLowerCase();
    return (
      <Sheet
        open
        title="Was wurde gemacht?"
        onClose={onClose}
        right={
          <button className="nav-btn bold" disabled={!selected.length} onClick={() => setStep('form')}>
            Weiter
          </button>
        }
      >
        <div className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Position suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Position suchen" />
        </div>
        {CATEGORIES.map((c) => {
          const items = enabledItems.filter((i) => i.category === c.id && (!needle || i.name.toLowerCase().includes(needle)));
          if (!items.length) return null;
          return (
            <Section key={c.id} header={c.name}>
              <div className="group">
                {items.map((i) => (
                  <CheckRow key={i.id} checked={selected.includes(i.id)} label={i.name} onClick={() => toggle(i.id)} />
                ))}
              </div>
            </Section>
          );
        })}
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      title="Wartung eintragen"
      onClose={onClose}
      right={
        <button className="nav-btn bold" onClick={save}>
          Sichern
        </button>
      }
    >
      <Section header={<>Erledigt <button onClick={() => setStep('pick')}>Ändern</button></>}>
        <div className="group">
          {selected.map((id) => (
            <CheckRow key={id} checked label={byId(id)?.name ?? id} onClick={() => toggle(id)} />
          ))}
          {!selected.length && <div className="row muted">Keine Position gewählt</div>}
        </div>
      </Section>

      {suggestions.length > 0 && (
        <Section
          header="Auch erledigt?"
          footer="Diese Arbeiten hängen oft zusammen. Bitte nur bestätigen, was tatsächlich gemacht wurde – sonst bleiben die Intervalle unverändert."
        >
          <div className="group">
            {suggestions.map((id) => (
              <CheckRow key={id} checked={confirmedSugg.includes(id)} label={byId(id)?.name ?? id} sub="Zugehörige Arbeit" onClick={() => toggleSugg(id)} />
            ))}
          </div>
        </Section>
      )}

      <Section header="Wann">
        <div className="group">
          <Field label="Datum" type="date" value={date} onChange={setDate} max={today} />
          <Field label="Kilometerstand" value={kmStr} onChange={setKmStr} inputMode="numeric" unit="km" placeholder="optional" />
        </div>
        {km !== null && parseNum(kmStr) !== null && (parseNum(kmStr) as number) > km && (
          <div className="hint">Der Kilometerstand liegt über dem aktuellen Stand ({fmtKm(km)}) und wird automatisch übernommen.</div>
        )}
      </Section>

      <Section header="Durchführung">
        <div style={{ margin: '0 0 10px' }}>
          <Segmented
            label="Durchgeführt von"
            value={doneBy}
            onChange={setDoneBy}
            options={[
              { value: 'selbst', label: 'Selbst' },
              { value: 'werkstatt', label: 'Werkstatt' }
            ]}
          />
        </div>
        <div className="group">
          {doneBy === 'werkstatt' && <Field label="Werkstatt" value={workshop} onChange={setWorkshop} placeholder="Name" />}
          <Field label="Titel" value={title} onChange={setTitle} placeholder={autoTitle || 'automatisch'} />
          <Field label="Teilekosten" value={parts} onChange={setParts} inputMode="decimal" unit="€" placeholder="0,00" />
          <Field label="Arbeitskosten" value={labor} onChange={setLabor} inputMode="decimal" unit="€" placeholder="0,00" />
          {(costParts || costLabor) ? <div className="field"><label>Gesamt</label><span style={{ marginLeft: 'auto', fontWeight: 600 }}>{fmtEur((costParts && !Number.isNaN(costParts) ? costParts : 0) + (costLabor && !Number.isNaN(costLabor) ? costLabor : 0))}</span></div> : null}
          <TextArea label="Beschreibung" value={description} onChange={setDescription} placeholder="Was wurde gemacht? Verwendete Teile, Hersteller, Teilenummern …" />
          <TextArea label="Notizen" value={notes} onChange={setNotes} />
        </div>
      </Section>

      {error && (
        <div className="error-text" role="alert">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}
      <button className="btn btn-primary btn-block mt-lg" onClick={save}>
        {allIds.length > 1 ? `${allIds.length} Positionen eintragen` : 'Eintragen'}
      </button>
    </Sheet>
  );
}

function CheckRow({ checked, label, sub, onClick }: { checked: boolean; label: string; sub?: string; onClick: () => void }) {
  return (
    <button className="row" role="checkbox" aria-checked={checked} onClick={onClick}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          background: checked ? 'var(--tint)' : 'transparent',
          border: checked ? 'none' : '1.5px solid var(--label-3)',
          color: '#fff',
          transition: 'all .2s'
        }}
      >
        {checked && <Icon name="check" size={16} stroke={3} />}
      </span>
      <div className="row-main">
        <div className="row-title">{label}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
    </button>
  );
}
