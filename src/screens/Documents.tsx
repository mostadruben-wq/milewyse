import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Icon } from '../components/Icon';
import { Empty, NavBar, Segmented, SelectField } from '../components/ui';
import { DOC_CAT_LABEL } from '../lib/docs';
import type { DocCategory } from '../lib/types';
import { formatDate } from '../lib/dates';
import { fmtEur } from '../lib/util';

type Sort = 'neu' | 'alt' | 'betrag';

/** Digitales Dokumentenarchiv mit Volltextsuche (inkl. Teilenummern) und Filtern. */
export function Documents() {
  const { root, state } = useStore();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DocCategory | 'alle'>('alle');
  const [sort, setSort] = useState<Sort>('neu');
  const [scope, setScope] = useState<string>('aktiv');
  const [year, setYear] = useState('alle');

  const years = useMemo(() => [...new Set(root.documents.map((d) => d.date?.slice(0, 4)).filter(Boolean) as string[])].sort().reverse(), [root.documents]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const partText = (docId: string) => root.parts.filter((p) => p.documentId === docId).map((p) => `${p.partNumber} ${p.manufacturer} ${p.name}`).join(' ');
    return root.documents
      .filter((d) => (scope === 'alle' ? true : scope === 'aktiv' ? d.vehicleId === state.vehicle.id || d.vehicleId === null : d.vehicleId === scope))
      .filter((d) => cat === 'alle' || d.category === cat)
      .filter((d) => year === 'alle' || d.date?.startsWith(year))
      .filter((d) => {
        if (!needle) return true;
        const hay = `${d.title} ${d.vendor} ${d.invoiceNo} ${d.notes} ${d.text} ${partText(d.id)}`.toLowerCase();
        return needle.split(/\s+/).every((w) => hay.includes(w) || hay.replace(/[\s.\-/]/g, '').includes(w.replace(/[\s.\-/]/g, '')));
      })
      .sort((a, b) => (sort === 'betrag' ? (b.total ?? 0) - (a.total ?? 0) : sort === 'alt' ? ((a.date ?? '') < (b.date ?? '') ? -1 : 1) : (a.date ?? '') < (b.date ?? '') ? 1 : -1));
  }, [root.documents, root.parts, q, cat, sort, scope, year, state.vehicle.id]);

  const sum = list.reduce((s, d) => s + (d.countCost && d.total ? d.total : 0), 0);

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Mehr" right={<button className="nav-btn icon-btn" aria-label="Dokument scannen" onClick={nav.openScan}><Icon name="plus" size={20} stroke={2.4} /></button>} />
      <h1 className="large-title">Dokumente</h1>

      <div className="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder="Text, Händler, Teilenummer …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Dokumente durchsuchen" />
      </div>
      <div className="chips">
        {(['alle', ...Object.keys(DOC_CAT_LABEL)] as (DocCategory | 'alle')[]).map((c) => (
          <button key={c} className={`chip-btn ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c === 'alle' ? 'Alle' : DOC_CAT_LABEL[c]}
          </button>
        ))}
      </div>
      <Segmented<Sort> label="Sortierung" value={sort} onChange={setSort} options={[{ value: 'neu', label: 'Neueste' }, { value: 'alt', label: 'Älteste' }, { value: 'betrag', label: 'Betrag' }]} />
      <div className="group mt">
        {root.vehicles.length > 1 && (
          <SelectField<string> label="Fahrzeug" value={scope} onChange={setScope} options={[{ value: 'aktiv', label: state.vehicle.name }, { value: 'alle', label: 'Alle Fahrzeuge' }, ...root.vehicles.filter((v) => v.id !== state.vehicle.id).map((v) => ({ value: v.id, label: v.name }))]} />
        )}
        <SelectField<string> label="Jahr" value={year} onChange={setYear} options={[{ value: 'alle', label: 'Alle Jahre' }, ...years.map((y) => ({ value: y, label: y }))]} />
      </div>

      <div className="row-gap mt">
        <button className="btn btn-secondary btn-sm" onClick={nav.openScan}>
          <Icon name="scan" size={16} /> Scannen
        </button>
        <button className="btn btn-plain btn-sm" onClick={nav.openBulk}>
          <Icon name="archive" size={16} /> Sammelimport
        </button>
      </div>

      {list.length === 0 ? (
        <Empty icon="doc" title={root.documents.length ? 'Keine Treffer' : 'Noch keine Dokumente'} text={root.documents.length ? 'Suche oder Filter anpassen.' : 'Scanne eine Rechnung oder importiere mehrere alte Belege auf einmal.'} />
      ) : (
        <>
          <div className="section-header">
            {list.length} Dokument(e){sum ? ` · ${fmtEur(sum)}` : ''}
          </div>
          <div className="group">
            {list.map((d) => (
              <button key={d.id} className="row" onClick={() => nav.push({ name: 'document', id: d.id })}>
                {d.thumb ? <img className="doc-thumb" src={d.thumb} alt="" /> : <span className="doc-thumb" style={{ display: 'grid', placeItems: 'center' }}><Icon name="doc" size={20} /></span>}
                <div className="row-main">
                  <div className="row-title">{d.title}</div>
                  <div className="row-sub">
                    {DOC_CAT_LABEL[d.category]} · {d.date ? formatDate(d.date) : 'ohne Datum'}
                    {d.recordIds.length ? ` · ${d.recordIds.length} verknüpft` : ''}
                  </div>
                </div>
                <span className="row-value">{d.total !== null ? fmtEur(d.total) : ''}</span>
                <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
