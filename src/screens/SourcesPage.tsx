import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { NavBar, Row, Section, SourceBadge, StatusBadge } from '../components/ui';
import type { SourceType } from '../lib/types';

export function SourcesPage() {
  const { state } = useStore();
  const nav = useNav();
  const count = (s: SourceType) => state.items.filter((i) => i.enabled && (i.intervalKm || i.intervalMonths) && i.intervalSource === s).length;
  const noInterval = state.items.filter((i) => i.enabled && !i.intervalKm && !i.intervalMonths).length;

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" title="Datenquellen" />
      <h1 className="large-title">Verlässlichkeit</h1>
      <div className="card small" style={{ lineHeight: 1.5 }}>
        Die App erfindet keine offiziellen Wartungsintervalle, Drehmomente, Füllmengen oder Ölspezifikationen. Jeder Intervallwert trägt eine Quelle, damit du jederzeit siehst, wie belastbar er ist.
      </div>

      <Section header="Quellen">
        <div className="group">
          <Row title={<SourceBadge source="vw" />} sub="Von dir in VW-Unterlagen geprüft. In der App ist ab Werk kein Wert so markiert." value={count('vw')} />
          <Row title={<SourceBadge source="empfehlung" />} sub="Allgemein übliche fachliche Praxis, z. B. jährliche Sichtprüfung oder Bremsflüssigkeit alle 2 Jahre." value={count('empfehlung')} />
          <Row title={<SourceBadge source="benutzer" />} sub="Von dir festgelegt – z. B. aus Werkstattempfehlung oder eigener Erfahrung." value={count('benutzer')} />
          <Row title={<SourceBadge source="ungeprueft" />} sub="Startwert, damit gerechnet werden kann. Bitte prüfen und anpassen." value={count('ungeprueft')} />
          <Row title="Ohne Intervall" sub="Bewusst leer, weil Angaben für den AXL variieren oder von der Ausstattung abhängen (z. B. Zahnriemen, Getriebeöle)." value={noInterval} />
        </div>
      </Section>

      <Section header="Status">
        <div className="group">
          <Row title={<StatusBadge status="ok" />} sub="Alles in Ordnung" />
          <Row title={<StatusBadge status="soon" />} sub="Vorwarnschwelle erreicht (km oder Tage)" />
          <Row title={<StatusBadge status="overdue" />} sub="Grenze erreicht oder überschritten – es gilt die zuerst erreichte" />
          <Row title={<StatusBadge status="unknown" />} sub="Kein Intervall oder keine Historie bekannt" />
        </div>
      </Section>

      <Section header="Prognosen">
        <div className="card small" style={{ lineHeight: 1.5 }}>
          Zeitangaben mit „ca.“ rechnen Restkilometer über deine durchschnittliche Fahrleistung um. Sie sind Schätzungen und werden mit jedem Kilometerstand genauer.
        </div>
      </Section>
    </>
  );
}
