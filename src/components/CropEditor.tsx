import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pt, Quad } from '../lib/imageproc';

/** Viereck-Zuschnitt mit vier verschiebbaren Ecken (Touch & Maus). */
export function CropEditor({ source, quad, onChange }: { source: HTMLCanvasElement; quad: Quad; onChange: (q: Quad) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [drag, setDrag] = useState<number | null>(null);
  const preview = useMemo(() => {
    const s = Math.min(1, 1100 / Math.max(source.width, source.height));
    const c = document.createElement('canvas');
    c.width = Math.round(source.width * s);
    c.height = Math.round(source.height * s);
    c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }, [source]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sx = size.w / source.width;
  const sy = size.h / source.height;
  const toScreen = (p: Pt) => ({ x: p.x * sx, y: p.y * sy });

  const move = (e: React.PointerEvent) => {
    if (drag === null || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const x = Math.min(source.width, Math.max(0, (e.clientX - r.left) / sx));
    const y = Math.min(source.height, Math.max(0, (e.clientY - r.top) / sy));
    const q = [...quad] as Quad;
    q[drag] = { x, y };
    onChange(q);
  };

  const pts = quad.map(toScreen);
  return (
    <div className="scan-stage" ref={wrap} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}>
      <img src={preview} alt="Aufnahme" draggable={false} />
      <svg viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
        <defs>
          <mask id="cropmask">
            <rect width="100%" height="100%" fill="white" />
            <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="black" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#cropmask)" />
        <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#2D62F2" strokeWidth="2" />
      </svg>
      {pts.map((p, i) => (
        <span
          key={i}
          className="handle"
          role="slider"
          aria-label={['Ecke oben links', 'Ecke oben rechts', 'Ecke unten rechts', 'Ecke unten links'][i]}
          aria-valuenow={Math.round(quad[i].x)}
          style={{ left: p.x, top: p.y }}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setDrag(i);
          }}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
        />
      ))}
    </div>
  );
}
