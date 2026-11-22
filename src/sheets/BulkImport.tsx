import { useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Sheet, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { DraftReview } from '../components/DraftReview';
import { buildDraft, compactPages, draftToPayload, fileHash, fileToPages, recognizePages, validateDraft, type Draft, type ScanPage } from '../lib/scan';
import { findDuplicate } from '../lib/duplicates';
import { formatDate } from '../lib/dates';
import { fmtEur } from '../lib/util';

interface Entry {
  file: File;
  pages: ScanPage[];
  draft: Draft | null;
  error: string | null;
}

/**
 * Sammelimport alter Rechnungen: mehrere Dateien auf einmal, jede einzeln ausgewertet,
 * Dubletten markiert, chronologische Vorschau der rekonstruierten Historie, Übernahme erst nach Bestätigung.
 */
export function BulkImport({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<'pick' | 'process' | 'review' | 'done'>('pick');
  const [progress, setProgress] = useState({ i: 0, n: 0, label: '' });
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState({ docs: 0, records: 0, parts: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const start = async (files: FileList | null) => {
    if (!files?.length) return;
    cancelRef.current = false;
    const list = [...files];
    setPhase('process');
    const out: Entry[] = [];
    const seen = [...store.root.documents];
    for (let i = 0; i < list.length; i++) {
      if (cancelRef.current) break;
      const f = list[i];
      setProgress({ i: i + 1, n: list.length, label: f.name });
      try {
        const rawPages = await fileToPages(f, true);
        const rec = await recognizePages(rawPages, (_frac, label) => setProgress({ i: i + 1, n: list.length, label: `${f.name} – ${label}` }));
        const pages = await compactPages(rawPages);
        const hash = await fileHash(f);
        const d = buildDraft({ rec, fileName: f.name, hash, vehicleId: store.root.activeVehicleId, items: store.root.items, vehicles: store.root.vehicles, records: store.root.records, documents: seen, today: store.today });
        // Dubletten auch innerhalb des Stapels erkennen
        if (!d.duplicate) {
          const inBatch = findDuplicate({ hash, invoiceNo: d.invoiceNo || null, vendor: d.vendor || null, date: d.date || null, total: d.total ? Number(d.total.replace(',', '.')) : null }, out.filter((e) => e.draft).map((e) => ({ id: e.draft!.id, hash: e.draft!.hash, invoiceNo: e.draft!.invoiceNo, vendor: e.draft!.vendor, date: e.draft!.date || null, total: e.draft!.total ? Number(e.draft!.total.replace(',', '.')) : null, title: e.draft!.title })));
          if (inBatch) {
            d.duplicate = { ...inBatch, reason: `${inBatch.reason} (in dieser Auswahl)` };
            d.include = false;
          }
        }
        out.push({ file: f, pages, draft: d, error: null });
      } catch (e) {
        out.push({ file: f, pages: [], draft: null, error: (e as Error).message });
      }
      setEntries([...out]);
    }
    out.sort((a, b) => ((a.draft?.date || '9999') < (b.draft?.date || '9999') ? -1 : 1));
    setEntries(out);
    setPhase('review');
  };

  const setDraft = (idx: number, d: Draft) => setEntries((es) => es.map((e, i) => (i === idx ? { ...e, draft: d } : e)));

  const included = entries.filter((e) => e.draft?.include);
  const timeline = included
    .flatMap((e) => e.draft!.suggestions.filter((s) => s.accepted).map((s) => ({ date: s.date, title: s.title, km: s.km, src: e.draft!.title })))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const importAll = async () => {
    for (const e of included) {
      const err = validateDraft(e.draft!, store.today);
      if (err) {
        setOpen(entries.indexOf(e));
        return setError(`${e.file.name}: ${err}`);
      }
    }
    setError(null);
    let records = 0;
    let parts = 0;
    try {
      for (const e of included) {
        const { payload, files } = await draftToPayload(e.draft!, e.pages, e.file);
        await store.importDocument(payload, files);
        records += payload.records.length;
        parts += payload.parts.length;
      }
      setSummary({ docs: included.length, records, parts });
      setPhase('done');
      toast('Import abgeschlossen');
    } catch (e) {
      setError(`Import abgebrochen: ${(e as Error).message}. Bereits übernommene Belege bleiben gespeichert.`);
    }
  };

  return (
    <Sheet
      open
      title="Sammelimport"
      onClose={() => {
        cancelRef.current = true;
        onClose();
      }}
      leftLabel={phase === 'done' ? 'Schließen' : 'Abbrechen'}
      right={
        phase === 'review' ? (
          <button className="nav-btn bold" onClick={importAll} disabled={!included.length}>
            Übernehmen
          </button>
        ) : undefined
      }
    >
      <input ref={inputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={(e) => (start(e.target.files), (e.target.value = ''))} />

      {phase === 'pick' && (
        <div style={{ padding: '24px 4px' }}>
          <div className="center">
            <Icon name="archive" size={40} style={{ color: 'var(--tint)' }} />
            <h2 style={{ margin: '10px 0 6px', fontSize: 22 }}>Alte Rechnungen importieren</h2>
            <p className="muted" style={{ margin: '0 0 20px' }}>Mehrere PDFs oder Fotos auswählen. Jede Rechnung wird einzeln ausgewertet, Dubletten werden erkannt. Übernommen wird erst nach deiner Bestätigung – bestehende Einträge werden nie überschrieben.</p>
          </div>
          <button className="btn btn-primary btn-block" onClick={() => inputRef.current?.click()}>
            Dateien auswählen
          </button>
        </div>
      )}

      {phase === 'process' && (
        <div style={{ padding: '30px 4px' }}>
          <div className="center" style={{ fontWeight: 600, fontSize: 18 }}>
            Beleg {progress.i} von {progress.n}
          </div>
          <div className="small muted center" style={{ margin: '4px 0 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{progress.label}</div>
          <div className="progress-lg">
            <span style={{ width: `${(progress.i / Math.max(1, progress.n)) * 100}%` }} />
          </div>
          <button className="btn btn-plain btn-block mt-lg" onClick={() => (cancelRef.current = true)}>
            Nach diesem Beleg stoppen
          </button>
        </div>
      )}

      {phase === 'review' && (
        <>
          <div className="card small" style={{ lineHeight: 1.5 }}>
            <b>{entries.length} Datei(en) ausgewertet</b> · {included.length} zur Übernahme ausgewählt · {entries.filter((e) => e.draft?.duplicate).length} mögliche Dublette(n) · {entries.filter((e) => e.error).length} Fehler
          </div>

          <div className="section-header">Belege (chronologisch)</div>
          <div className="group">
            {entries.map((e, i) => (
              <div key={i}>
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  {e.draft ? (
                    <button
                      role="checkbox"
                      aria-checked={e.draft.include}
                      aria-label={`${e.file.name} übernehmen`}
                      onClick={() => setDraft(i, { ...e.draft!, include: !e.draft!.include })}
                      style={{ width: 24, height: 24, borderRadius: 12, flex: 'none', display: 'grid', placeItems: 'center', border: e.draft.include ? 0 : '1.5px solid var(--label-3)', background: e.draft.include ? 'var(--tint)' : 'transparent', color: '#fff', marginTop: 2 }}
                    >
                      {e.draft.include && <Icon name="check" size={15} stroke={3} />}
                    </button>
                  ) : (
                    <Icon name="alert" size={22} style={{ color: 'var(--overdue)', flex: 'none' }} />
                  )}
                  <button className="row-main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
                    <div className="row-title">{e.draft?.title ?? e.file.name}</div>
                    <div className="row-sub">
                      {e.error
                        ? e.error
                        : `${e.draft!.date ? formatDate(e.draft!.date) : 'Datum unbekannt'} · ${e.draft!.total ? fmtEur(Number(e.draft!.total.replace(',', '.'))) : 'Betrag unbekannt'} · ${e.draft!.suggestions.filter((s) => s.accepted).length}/${e.draft!.suggestions.length} Arbeiten · ${e.draft!.parts.filter((p) => p.accepted).length} Teile`}
                    </div>
                    {e.draft?.duplicate && <div className="small" style={{ color: 'var(--soon-text)' }}>Mögliche Dublette: {e.draft.duplicate.reason}</div>}
                  </button>
                  {e.draft && <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" style={{ transform: open === i ? 'rotate(90deg)' : undefined, marginTop: 6 }} />}
                </div>
                {open === i && e.draft && (
                  <div style={{ padding: '0 12px 12px', background: 'var(--card-2)' }}>
                    <DraftReview d={e.draft} set={(d) => setDraft(i, d)} compact />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="section-header">Rekonstruierte Historie ({timeline.length})</div>
          {timeline.length ? (
            <div className="timeline">
              {timeline.map((t, i) => (
                <div key={i} className="tl-item">
                  <div className="card" style={{ padding: 12 }}>
                    <div style={{ fontWeight: 600 }}>{t.title}</div>
                    <div className="small muted">
                      {formatDate(t.date)}
                      {t.km ? ` · ${Number(t.km.replace(/\./g, '')).toLocaleString('de-DE')} km` : ''} · {t.src}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card small muted">Keine Arbeiten zur Übernahme ausgewählt. Belege und Ersatzteile werden trotzdem archiviert. Bei Teilekäufen bitte den Einbau im jeweiligen Beleg bestätigen.</div>
          )}
          {error && (
            <div className="error-text" role="alert">
              <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-block mt-lg" onClick={importAll} disabled={!included.length}>
            {included.length} Beleg(e) übernehmen
          </button>
        </>
      )}

      {phase === 'done' && (
        <div className="center" style={{ padding: '36px 8px' }}>
          <Icon name="checkCircle" size={48} style={{ color: 'var(--ok)' }} />
          <h2 style={{ margin: '12px 0 6px' }}>Import abgeschlossen</h2>
          <p className="muted">
            {summary.docs} Beleg(e) · {summary.records} Historieneintrag/-einträge · {summary.parts} Ersatzteil(e)
          </p>
          <button className="btn btn-primary btn-block mt" onClick={onClose}>
            Fertig
          </button>
        </div>
      )}
    </Sheet>
  );
}
