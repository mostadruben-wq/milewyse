import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { useNav } from '../nav';
import { Confirm, Field, NavBar, Row, Section, SelectField, Sheet, TextArea, Toggle, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { getFile } from '../lib/storage';
import { DOC_CAT_LABEL } from '../lib/docs';
import { COST_LABEL } from '../lib/costs';
import type { CostCategory, DocCategory, DocumentMeta } from '../lib/types';
import { formatDate } from '../lib/dates';
import { fmtEur, fmtKm } from '../lib/util';

const money = (n: number | null) => (n === null ? '' : n.toFixed(2).replace('.', ','));
const parse = (s: string) => {
  const t = s.trim().replace(/\s|€/g, '');
  if (!t) return null;
  const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN;
};

export function DocumentDetail({ id }: { id: string }) {
  const { root, saveDocument, deleteDocument, update } = useStore();
  const nav = useNav();
  const doc = root.documents.find((d) => d.id === id);
  const [urls, setUrls] = useState<string[]>([]);
  const [edit, setEdit] = useState(false);
  const [link, setLink] = useState(false);
  const [del, setDel] = useState(false);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let alive = true;
    const created: string[] = [];
    (async () => {
      const out: string[] = [];
      for (const fid of doc.fileIds) {
        const b = await getFile(fid);
        if (b) {
          const u = URL.createObjectURL(b);
          created.push(u);
          out.push(u);
        }
      }
      if (alive) setUrls(out);
    })();
    return () => {
      alive = false;
      created.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [doc?.fileIds.join()]);

  if (!doc) {
    return (
      <>
        <NavBar onBack={nav.pop} />
        <p className="muted center">Dieses Dokument existiert nicht mehr.</p>
      </>
    );
  }
  const records = root.records.filter((r) => doc.recordIds.includes(r.id));
  const parts = root.parts.filter((p) => doc.partIds.includes(p.id) || p.documentId === doc.id);
  const vehicle = root.vehicles.find((v) => v.id === doc.vehicleId);

  const download = async () => {
    const fid = doc.originalFileId ?? doc.fileIds[0];
    const b = fid ? await getFile(fid) : null;
    if (!b) return toast('Datei nicht gefunden');
    const ext = b.type === 'application/pdf' ? 'pdf' : 'jpg';
    const name = (doc.originalName && doc.originalFileId ? doc.originalName : `${doc.title}.${ext}`).replace(/[\\/:*?"<>|]/g, '_');
    const url = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <>
      <NavBar onBack={nav.pop} backLabel="Dokumente" right={<button className="nav-btn" onClick={() => setEdit(true)}>Bearbeiten</button>} />
      <h1 className="large-title" style={{ fontSize: 26 }}>{doc.title}</h1>

      <div className="kv">
        <div>
          <div className="k">Betrag</div>
          <div className="v">{doc.total !== null ? fmtEur(doc.total) : '–'}</div>
          <div className="s">{doc.countCost ? `zählt als ${COST_LABEL[doc.costCategory]}` : 'nicht in Kosten'}</div>
        </div>
        <div>
          <div className="k">Datum</div>
          <div className="v" style={{ fontSize: 18 }}>{doc.date ? formatDate(doc.date) : '–'}</div>
          <div className="s">{DOC_CAT_LABEL[doc.category]}</div>
        </div>
      </div>

      <Section header="Angaben">
        <div className="group">
          <Row title="Händler" value={doc.vendor || '–'} />
          <Row title="Rechnungs-Nr." value={doc.invoiceNo || '–'} />
          {doc.vat !== null && <Row title="MwSt." value={fmtEur(doc.vat)} />}
          {doc.km !== null && <Row title="Kilometerstand" value={fmtKm(doc.km)} />}
          <Row title="Fahrzeug" value={vehicle?.name ?? 'nicht zugeordnet'} />
          <Row title="Seiten" value={String(doc.pageCount)} />
        </div>
      </Section>

      <Section header={`Verknüpfte Einträge (${records.length})`}>
        <div className="group">
          {records.map((r) => (
            <Row key={r.id} title={r.title} sub={`${formatDate(r.date)}${r.km !== null ? ' · ' + fmtKm(r.km) : ''}`} onClick={() => nav.openRecord(r.id)} />
          ))}
          <button className="row action" onClick={() => setLink(true)}>
            <Icon name="link" size={18} /> Mit Einträgen verknüpfen
          </button>
        </div>
      </Section>

      {parts.length > 0 && (
        <Section header={`Ersatzteile (${parts.length})`}>
          <div className="group">
            {parts.map((p) => (
              <Row key={p.id} title={p.name} sub={[p.manufacturer, p.partNumber].filter(Boolean).join(' · ') || '–'} value={p.price !== null ? fmtEur(p.price) : undefined} onClick={() => nav.push({ name: 'parts' })} />
            ))}
          </div>
        </Section>
      )}

      <Section header="Original">
        {urls.length ? urls.map((u, i) => <img key={u} src={u} alt={`Seite ${i + 1}`} className="doc-page" style={{ marginTop: i ? 10 : 0 }} />) : <div className="card small muted">Keine Seitenbilder vorhanden (z. B. Backup ohne Dateien wiederhergestellt).</div>}
        <div className="row-gap mt">
          <button className="btn btn-secondary btn-sm" onClick={download}>
            <Icon name="download" size={16} /> {doc.originalFileId ? 'PDF laden' : 'Bild laden'}
          </button>
          <button className="btn btn-plain btn-sm" onClick={() => setShowText(!showText)}>
            {showText ? 'Text ausblenden' : 'Erkannten Text'}
          </button>
        </div>
        {showText && <pre className="card mono mt" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>{doc.text || '(kein Text)'}</pre>}
      </Section>

      {doc.notes && (
        <Section header="Notiz">
          <div className="card small">{doc.notes}</div>
        </Section>
      )}

      <button className="btn btn-danger btn-block mt-lg" onClick={() => setDel(true)}>
        Dokument löschen
      </button>

      {edit && <DocEditor doc={doc} onClose={() => setEdit(false)} onSave={(d) => (saveDocument(d), setEdit(false), toast('Gespeichert'))} />}
      {link && (
        <LinkSheet
          doc={doc}
          onClose={() => setLink(false)}
          onSave={(ids) => {
            update((s) => ({
              ...s,
              documents: s.documents.map((d) => (d.id === doc.id ? { ...d, recordIds: ids } : d)),
              // Kosten verknüpfter Einträge laufen über das Dokument, wenn es Kosten zählt
              records: s.records.map((r) => (ids.includes(r.id) ? { ...r, documentId: doc.id } : r.documentId === doc.id ? { ...r, documentId: null } : r))
            }));
            setLink(false);
            toast('Verknüpfungen gespeichert');
          }}
        />
      )}
      <Confirm
        open={del}
        title="Dokument löschen?"
        message={records.length ? 'Die verknüpften Historieneinträge bleiben erhalten (ihre Kosten zählen dann einzeln). Das Originaldokument wird endgültig entfernt.' : 'Das Originaldokument wird endgültig entfernt.'}
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          await deleteDocument(doc.id, false);
          nav.pop();
          toast('Dokument gelöscht');
        }}
        onClose={() => setDel(false)}
      />
    </>
  );
}

function DocEditor({ doc, onClose, onSave }: { doc: DocumentMeta; onClose: () => void; onSave: (d: DocumentMeta) => void }) {
  const { root, today } = useStore();
  const [d, setD] = useState(doc);
  const [total, setTotal] = useState(money(doc.total));
  const [vat, setVat] = useState(money(doc.vat));
  const [err, setErr] = useState<string | null>(null);
  const s = <K extends keyof DocumentMeta>(k: K, v: DocumentMeta[K]) => setD((p) => ({ ...p, [k]: v }));
  const save = () => {
    const t = parse(total);
    const v = parse(vat);
    if (!d.title.trim()) return setErr('Bitte einen Titel eingeben.');
    if (Number.isNaN(t) || Number.isNaN(v)) return setErr('Beträge bitte als Zahl eingeben (z. B. 149,90).');
    if (d.date && d.date > today) return setErr('Das Datum liegt in der Zukunft.');
    onSave({ ...d, title: d.title.trim(), total: t, vat: v, countCost: d.countCost && t !== null });
  };
  return (
    <Sheet open title="Dokument bearbeiten" onClose={onClose} right={<button className="nav-btn bold" onClick={save}>Sichern</button>}>
      <div className="group">
        <Field label="Titel" value={d.title} onChange={(x) => s('title', x)} />
        <SelectField<DocCategory> label="Kategorie" value={d.category} onChange={(x) => s('category', x)} options={(Object.keys(DOC_CAT_LABEL) as DocCategory[]).map((k) => ({ value: k, label: DOC_CAT_LABEL[k] }))} />
        <SelectField<string> label="Fahrzeug" value={d.vehicleId ?? ''} onChange={(x) => s('vehicleId', x || null)} options={[{ value: '', label: 'Kein Fahrzeug' }, ...root.vehicles.map((v) => ({ value: v.id, label: v.name }))]} />
        <Field label="Datum" type="date" value={d.date ?? ''} onChange={(x) => s('date', x || null)} max={today} />
        <Field label="Händler" value={d.vendor} onChange={(x) => s('vendor', x)} />
        <Field label="Rechnungs-Nr." value={d.invoiceNo} onChange={(x) => s('invoiceNo', x)} />
        <Field label="Gesamtbetrag" value={total} onChange={setTotal} inputMode="decimal" unit="€" />
        <Field label="MwSt." value={vat} onChange={setVat} inputMode="decimal" unit="€" />
        <div className="field">
          <label>In Kosten zählen</label>
          <span style={{ marginLeft: 'auto' }}>
            <Toggle label="In Kosten zählen" checked={d.countCost} onChange={(x) => s('countCost', x)} />
          </span>
        </div>
        <SelectField<CostCategory> label="Kostenart" value={d.costCategory} onChange={(x) => s('costCategory', x)} options={(Object.keys(COST_LABEL) as CostCategory[]).map((k) => ({ value: k, label: COST_LABEL[k] }))} />
        <TextArea label="Notiz" value={d.notes} onChange={(x) => s('notes', x)} />
      </div>
      {err && <div className="error-text">{err}</div>}
    </Sheet>
  );
}

function LinkSheet({ doc, onClose, onSave }: { doc: DocumentMeta; onClose: () => void; onSave: (ids: string[]) => void }) {
  const { root } = useStore();
  const [sel, setSel] = useState<string[]>(doc.recordIds);
  const recs = root.records.filter((r) => !doc.vehicleId || r.vehicleId === doc.vehicleId).sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <Sheet open title="Verknüpfen" onClose={onClose} right={<button className="nav-btn bold" onClick={() => onSave(sel)}>Sichern</button>}>
      <p className="hint" style={{ margin: '0 2px 10px' }}>Ein Beleg kann mit mehreren Wartungen oder Reparaturen verknüpft werden. Der Rechnungsbetrag wird dabei nur einmal gezählt.</p>
      <div className="group">
        {recs.map((r) => {
          const on = sel.includes(r.id);
          return (
            <button key={r.id} className="row" role="checkbox" aria-checked={on} onClick={() => setSel(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])}>
              <span style={{ width: 22, height: 22, borderRadius: 11, flex: 'none', display: 'grid', placeItems: 'center', border: on ? 0 : '1.5px solid var(--label-3)', background: on ? 'var(--tint)' : 'transparent', color: '#fff' }}>{on && <Icon name="check" size={14} stroke={3} />}</span>
              <div className="row-main">
                <div className="row-title">{r.title}</div>
                <div className="row-sub">{formatDate(r.date)}</div>
              </div>
            </button>
          );
        })}
        {!recs.length && <div className="row muted">Keine Historieneinträge vorhanden.</div>}
      </div>
    </Sheet>
  );
}

