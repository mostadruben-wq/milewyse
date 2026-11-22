import { useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Field, NavBar, Section, Segmented, toast } from '../components/ui';
import { parseNum } from '../lib/util';
import { Icon } from '../components/Icon';

export function SettingsPage() {
  const { state, update } = useStore();
  const nav = useNav();
  const [warnKm, setWarnKm] = useState(String(state.settings.warnKm));
  const [warnDays, setWarnDays] = useState(String(state.settings.warnDays));
  const [error, setError] = useState<string | null>(null);

  const saveWarn = () => {
    const k = parseNum(warnKm);
    const d = parseNum(warnDays);
    if (k === null || Number.isNaN(k) || k < 0 || k > 50000 || !Number.isInteger(k)) return setError('Kilometer-Vorwarnung: ganze Zahl zwischen 0 und 50.000.');
    if (d === null || Number.isNaN(d) || d < 0 || d > 365 || !Number.isInteger(d)) return setError('Tage-Vorwarnung: ganze Zahl zwischen 0 und 365.');
    update((s) => ({ ...s, settings: { ...s.settings, warnKm: k, warnDays: d } }));
    setError(null);
    toast('Vorwarnung gespeichert');
  };

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" title="Einstellungen" />
      <h1 className="large-title">Einstellungen</h1>

      <Section header="Darstellung">
        <Segmented
          label="Erscheinungsbild"
          value={state.settings.theme}
          onChange={(t) => update((s) => ({ ...s, settings: { ...s.settings, theme: t, themeChosen: true } }))}
          options={[
            { value: 'light', label: 'Hell' },
            { value: 'auto', label: 'Wie System' },
            { value: 'dark', label: 'Dunkel' }
          ]}
        />
      </Section>

      <Section header="Vorwarnschwellen (global)" footer="Ab diesen Werten wird eine Wartung gelb („bald fällig“). Pro Position individuell überschreibbar.">
        <div className="group">
          <Field label="Kilometer vorher" value={warnKm} onChange={setWarnKm} inputMode="numeric" unit="km" />
          <Field label="Tage vorher" value={warnDays} onChange={setWarnDays} inputMode="numeric" unit="Tage" />
        </div>
        {error && (
          <div className="error-text" role="alert">
            <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
            {error}
          </div>
        )}
        <button className="btn btn-secondary btn-block mt" onClick={saveWarn}>
          Übernehmen
        </button>
      </Section>

      <Section header="Intervalle">
        <div className="group">
          <button className="row" onClick={() => nav.push({ name: 'intervals' })}>
            <div className="row-main">Alle Intervalle anpassen</div>
            <span className="row-value">Schieberegler</span>
          </button>
        </div>
      </Section>

      <Section header="Benachrichtigungen" footer="Push-Benachrichtigungen funktionieren bei Web-Apps auf dem iPhone erst ab iOS 16.4 und nur, wenn die App zum Home-Bildschirm hinzugefügt wurde. Sie folgen in Phase 4; bis dahin zeigt die Übersicht alle fälligen Arbeiten zuverlässig an.">
        <div className="group">
          <div className="row">
            <div className="row-main">Push-Benachrichtigungen</div>
            <span className="row-value">Phase 4</span>
          </div>
        </div>
      </Section>
    </>
  );
}
