import { useEffect, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Segmented, Sheet, toast } from '../components/ui';
import { Icon } from '../components/Icon';
import { CropEditor } from '../components/CropEditor';
import { DraftReview } from '../components/DraftReview';
import { buildDraft, draftToPayload, fileHash, fileToPages, recognizePages, renderPage, validateDraft, type Draft, type ScanPage } from '../lib/scan';
import { canvasToBlob, detectDocument, fullQuad, rotate, type Filter } from '../lib/imageproc';
import { haptic } from '../lib/util';

type Step = 'capture' | 'edit' | 'recognize' | 'review' | 'done';

/**
 * Dokument scannen in vier Schritten:
 * 1. fotografieren/hochladen (mehrseitig, Zuschnitt, Filter)  2. erkennen  3. prüfen  4. speichern
 */
export function ScanFlow({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [step, setStep] = useState<Step>('capture');
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [original, setOriginal] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState({ frac: 0, label: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ records: number; parts: number } | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = [...files];
    const pdf = list.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    try {
      if (pdf) {
        if (pages.length) return setError('Ein PDF wird als eigenes Dokument erfasst. Bitte zuerst die aktuellen Seiten speichern oder verwerfen.');
        setBusy('PDF wird geöffnet …');
        const p = await fileToPages(pdf, false, (s) => setBusy(s));
        setOriginal(pdf);
        setPages(p);
        setBusy(null);
        return run(p, pdf);
      }
      for (const f of list) {
        setBusy('Bild wird verarbeitet …');
        const [p] = await fileToPages(f, true);
        setPages((prev) => [...prev, p]);
        if (!original && list.length === 1 && !pages.length) setOriginal(null);
      }
      setBusy(null);
      // Neueste Seite direkt zur Kontrolle öffnen (wie im Apple-Scanner)
      if (list.length === 1) setTimeout(() => setEditIdx(-1), 0);
    } catch (e) {
      setBusy(null);
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (editIdx === -1) {
      setEditIdx(pages.length - 1);
      setStep('edit');
    }
  }, [editIdx, pages.length]);

  const run = async (ps: ScanPage[], orig: File | null) => {
    setStep('recognize');
    setError(null);
    setProgress({ frac: 0, label: 'Vorbereitung …' });
    try {
      const rec = await recognizePages(ps, (frac, label) => setProgress({ frac, label }));
      const hash = orig ? await fileHash(orig) : await fileHash(await canvasToBlob(ps[0].result));
      const d = buildDraft({ rec, fileName: orig?.name ?? 'Scan', hash, vehicleId: store.root.activeVehicleId, items: store.root.items, vehicles: store.root.vehicles, records: store.root.records, documents: store.root.documents, today: store.today });
      setDraft({ ...d, include: true });
      setStep('review');
    } catch (e) {
      setError((e as Error).message);
      setStep(orig ? 'capture' : 'capture');
    }
  };

  const save = async () => {
    if (!draft) return;
    const err = validateDraft(draft, store.today);
    if (err) return setError(err);
    setBusy('Wird gespeichert …');
    try {
      const { payload, files } = await draftToPayload(draft, pages, original);
      await store.importDocument(payload, files);
      haptic();
      setResult({ records: payload.records.length, parts: payload.parts.length });
      setStep('done');
    } catch (e) {
      setError(`Speichern fehlgeschlagen: ${(e as Error).message}. Möglicherweise ist der Gerätespeicher voll.`);
    } finally {
      setBusy(null);
    }
  };

  const stepIdx = { capture: 0, edit: 0, recognize: 1, review: 2, done: 3 }[step];
  const page = editIdx !== null && editIdx >= 0 ? pages[editIdx] : null;
  const updatePage = (patch: Partial<ScanPage>) => {
    if (editIdx === null || editIdx < 0) return;
    setPages((ps) => ps.map((p, i) => (i === editIdx ? renderPage({ ...p, ...patch }) : p)));
  };

  const right =
    step === 'capture' ? (
      <button className="nav-btn bold" disabled={!pages.length || !!busy} onClick={() => run(pages, original)}>
        Weiter
      </button>
    ) : step === 'edit' ? (
      <button className="nav-btn bold" onClick={() => (setStep('capture'), setEditIdx(null))}>
        Fertig
      </button>
    ) : step === 'review' ? (
      <button className="nav-btn bold" onClick={save} disabled={!!busy}>
        Sichern
      </button>
    ) : undefined;

  return (
    <Sheet open title={['Dokument scannen', 'Erkennen', 'Prüfen', 'Gespeichert'][stepIdx]} onClose={onClose} right={right} leftLabel={step === 'done' ? 'Schließen' : 'Abbrechen'}>
      <div className="stepper" aria-label={`Schritt ${stepIdx + 1} von 4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i <= stepIdx ? 'on' : ''} />
        ))}
      </div>

      <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
      <input ref={photoRef} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
      <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />

      {step === 'capture' && (
        <>
          <div className="choice-grid">
            {[
              ['camera', 'Kamera', camRef],
              ['archive', 'Fotos', photoRef],
              ['doc', 'PDF / Datei', fileRef]
            ].map(([icon, label, ref]) => (
              <button key={label as string} className="choice glass" onClick={() => (ref as React.RefObject<HTMLInputElement>).current?.click()} disabled={!!busy}>
                <span className="qi">
                  <Icon name={icon as string} size={24} />
                </span>
                {label as string}
              </button>
            ))}
          </div>
          <p className="hint" style={{ margin: '12px 2px 0' }}>
            Fotos werden automatisch zugeschnitten und für die Texterkennung optimiert. Mehrseitige Belege: einfach weitere Seiten hinzufügen. Alles bleibt auf diesem Gerät.
          </p>
          {pages.length > 0 && (
            <>
              <div className="section-header">Seiten ({pages.length})</div>
              <div className="pages">
                {pages.map((p, i) => (
                  <button key={p.id} className="page-thumb" onClick={() => (setEditIdx(i), setStep('edit'))} aria-label={`Seite ${i + 1} bearbeiten`}>
                    <img src={p.thumb} alt="" />
                    <span className="no">{i + 1}</span>
                  </button>
                ))}
                <button className="page-thumb add" onClick={() => camRef.current?.click()} aria-label="Weitere Seite aufnehmen">
                  <Icon name="plus" size={26} />
                </button>
              </div>
              <button className="btn btn-primary btn-block mt" onClick={() => run(pages, original)} disabled={!!busy}>
                Text erkennen
              </button>
            </>
          )}
          {busy && <div className="hint">{busy}</div>}
        </>
      )}

      {step === 'edit' && page && (
        <>
          {page.fromPdf ? (
            <img src={page.thumb} alt="" className="doc-page" />
          ) : (
            <CropEditor source={page.source} quad={page.quad} onChange={(q) => setPages((ps) => ps.map((p, i) => (i === editIdx ? { ...p, quad: q } : p)))} />
          )}
          <div className="row-gap mt">
            <button className="btn btn-sm btn-plain" onClick={() => updatePage({ quad: detectDocument(page.source) ?? fullQuad(page.source.width, page.source.height) })}>
              Automatisch
            </button>
            <button className="btn btn-sm btn-plain" onClick={() => updatePage({ quad: fullQuad(page.source.width, page.source.height) })}>
              Ganzes Bild
            </button>
            <button
              className="btn btn-sm btn-plain"
              aria-label="Drehen"
              onClick={() => {
                const src = rotate(page.source);
                updatePage({ source: src, quad: detectDocument(src) ?? fullQuad(src.width, src.height) });
              }}
            >
              <Icon name="refresh" size={16} /> Drehen
            </button>
          </div>
          <div className="mt">
            <Segmented<Filter>
              label="Filter"
              value={page.filter}
              onChange={(f) => updatePage({ filter: f })}
              options={[
                { value: 'dokument', label: 'Dokument' },
                { value: 'grau', label: 'Graustufen' },
                { value: 'original', label: 'Farbe' }
              ]}
            />
          </div>
          <div className="section-header">Vorschau</div>
          <EditPreview page={page} />
          <div className="row-gap mt-lg">
            <button
              className="btn btn-danger"
              onClick={() => {
                setPages((ps) => ps.filter((_, i) => i !== editIdx));
                setEditIdx(null);
                setStep('capture');
              }}
            >
              Seite löschen
            </button>
            <button className="btn btn-primary" onClick={() => (updatePage({}), setEditIdx(null), setStep('capture'))}>
              Übernehmen
            </button>
          </div>
        </>
      )}

      {step === 'recognize' && (
        <div style={{ padding: '30px 4px' }}>
          <div className="center" style={{ marginBottom: 18 }}>
            <Icon name="sparkle" size={34} style={{ color: 'var(--tint)' }} />
            <div style={{ fontWeight: 600, fontSize: 18, marginTop: 8 }}>Informationen werden erkannt</div>
            <div className="small muted" style={{ marginTop: 4 }}>{progress.label}</div>
          </div>
          <div className="progress-lg" role="progressbar" aria-valuenow={Math.round(progress.frac * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.max(4, progress.frac * 100)}%` }} />
          </div>
          <p className="hint center" style={{ marginTop: 16 }}>Die Texterkennung läuft lokal. Beim ersten Mal werden die Sprachdaten (ca. 2 MB) aus der App geladen.</p>
        </div>
      )}

      {step === 'review' && draft && (
        <>
          <div className="pages">
            {pages.map((p, i) => (
              <span key={p.id} className="page-thumb">
                <img src={p.thumb} alt={`Seite ${i + 1}`} />
                <span className="no">{i + 1}</span>
              </span>
            ))}
          </div>
          <DraftReview d={draft} set={setDraft} />
          <button className="btn btn-primary btn-block mt-lg" onClick={save} disabled={!!busy}>
            {busy ?? `Speichern${draft.suggestions.filter((s) => s.accepted).length ? ` & ${draft.suggestions.filter((s) => s.accepted).length} Arbeit(en) übernehmen` : ''}`}
          </button>
        </>
      )}

      {step === 'done' && result && (
        <div className="center" style={{ padding: '36px 8px' }}>
          <Icon name="checkCircle" size={48} style={{ color: 'var(--ok)' }} />
          <h2 style={{ margin: '12px 0 6px' }}>Beleg gespeichert</h2>
          <p className="muted" style={{ margin: 0 }}>
            {result.records ? `${result.records} Eintrag/Einträge in der Historie` : 'Keine Arbeit übernommen'}
            {result.parts ? ` · ${result.parts} Ersatzteil(e)` : ''}
          </p>
          <div className="row-gap mt-lg">
            <button className="btn btn-plain" onClick={() => (setPages([]), setDraft(null), setOriginal(null), setResult(null), setStep('capture'))}>
              Weiteren scannen
            </button>
            <button className="btn btn-primary" onClick={() => (toast('Beleg gespeichert'), onClose())}>
              Fertig
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error-text" role="alert" style={{ marginTop: 12 }}>
          <Icon name="alert" size={16} style={{ flex: 'none', marginTop: 2 }} />
          {error}
        </div>
      )}
    </Sheet>
  );
}

function EditPreview({ page }: { page: ScanPage }) {
  // Vorschau aus aktuellem Zuschnitt/Filter (wird beim Übernehmen gerechnet)
  const [src, setSrc] = useState(page.thumb);
  useEffect(() => {
    const t = setTimeout(() => setSrc(renderPage(page).thumb), 150);
    return () => clearTimeout(t);
  }, [page]);
  return <img src={src} alt="Vorschau" style={{ maxWidth: 180, borderRadius: 10, border: '0.5px solid var(--separator)', display: 'block' }} />;
}
