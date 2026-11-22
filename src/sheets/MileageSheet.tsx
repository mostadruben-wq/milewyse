import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Field, Row, Section, Sheet, TextArea, Toggle, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { latestEntry, validateMileage } from '../lib/mileage';
import { isValidISO } from '../lib/dates';
import { fmtKm, haptic, parseNum } from '../lib/util';

export function MileageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, today, addMileage } = useStore();
  const [date, setDate] = useState(today);
  const [kmStr, setKmStr] = useState('');
  const [correction, setCorrection] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const last = latestEntry(state.mileage);

  useEffect(() => {
    if (open) {
      setDate(today);
      setKmStr('');
      setCorrection(false);
      setNote('');
      setError(null);
    }
  }, [open, today]);

  const km = parseNum(kmStr);
  const delta = km !== null && !Number.isNaN(km) && last ? km - last.km : null;

  const save = () => {
    if (!isValidISO(date)) return setError('Bitte ein gültiges Datum wählen.');
    if (km === null || Number.isNaN(km)) return setError('Bitte einen Kilometerstand eingeben.');
    const r = validateMileage(state.mileage, { date, km, correction, note }, today);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    addMileage({ date, km, correction, note: note.trim() });
    haptic();
    toast('Kilometerstand gespeichert');
    onClose();
  };

  return (
    <Sheet
      open={open}
      title="Kilometerstand"
      onClose={onClose}
      right={
        <button className="nav-btn bold" onClick={save} disabled={!kmStr}>
          Sichern
        </button>
      }
    >
      <div className="center" style={{ margin: '8px 0 18px' }}>
        <div className="muted small">Bisher</div>
        <div className="ring-text" style={{ fontSize: 28 }}>{last ? fmtKm(last.km) : '–'}</div>
      </div>
      <div className="group">
        <Field label="Neuer Stand" value={kmStr} onChange={(v) => { setKmStr(v); setError(null); }} placeholder={last ? String(last.km) : 'z. B. 257500'} inputMode="numeric" unit="km" autoFocus invalid={!!error} />
        <Field label="Datum" type="date" value={date} onChange={(v) => { setDate(v); setError(null); }} max={today} />
      </div>
      {delta !== null && delta >= 0 && !error && <div className="hint">+ {fmtKm(delta)} seit der letzten Eingabe</div>}
      {error && (
        <div className="error-text" role="alert">
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}

      <Section header="Korrektur" footer="Nur für bewusste Korrekturen, z. B. nach Tippfehler oder Tachotausch. Korrekturen werden in der Liste gekennzeichnet.">
        <div className="group">
          <Row title="Als Korrektur speichern" right={<Toggle label="Als Korrektur speichern" checked={correction} onChange={(v) => { setCorrection(v); setError(null); }} />} />
          {(correction || note) && <TextArea label={correction ? 'Begründung (Pflicht)' : 'Notiz'} value={note} onChange={setNote} placeholder="z. B. Tippfehler bei letzter Eingabe" />}
        </div>
      </Section>
      {!correction && !note && (
        <button className="btn btn-plain btn-block mt" onClick={() => setNote(' ')}>
          Notiz hinzufügen
        </button>
      )}
    </Sheet>
  );
}
