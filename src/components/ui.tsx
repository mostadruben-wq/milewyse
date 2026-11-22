import { useEffect, useId, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import type { SourceType, Status } from '../lib/types';
import { STATUS_LABEL } from '../lib/maintenance';
import { SOURCE_LABEL } from '../data/catalog';

export const CAT_COLOR: Record<string, string> = {
  motor: '#2D62F2',
  antrieb: '#1E40AF',
  bremsen: '#E63946',
  fahrwerk: '#5E9EA6',
  karosserie: '#7C93A8'
};

export function StatusBadge({ status, small }: { status: Status; small?: boolean }) {
  return (
    <span className={`badge badge-${status}`} style={small ? { fontSize: 11, padding: '2px 7px' } : undefined}>
      <span className={`dot dot-${status}`} style={{ width: 7, height: 7 }} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SourceBadge({ source }: { source: SourceType }) {
  return <span className={`badge badge-src-${source}`}>{SOURCE_LABEL[source]}</span>;
}

export function IconTile({ name, color, size = 32 }: { name: string; color: string; size?: number }) {
  return (
    <span className="icon-tile" style={{ background: color, width: size, height: size, borderRadius: size * 0.26 }}>
      <Icon name={name} size={size * 0.6} stroke={2.1} />
    </span>
  );
}

export function NavBar({ title, onBack, backLabel = 'Zurück', right }: { title?: string; onBack?: () => void; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="navbar">
      {onBack ? (
        <button className="nav-btn icon-btn" onClick={onBack} aria-label={backLabel}>
          <Icon name="back" size={20} stroke={2.4} />
        </button>
      ) : (
        <span />
      )}
      {title && <div className="navbar-title">{title}</div>}
      <div>{right}</div>
    </div>
  );
}

export function Row({
  title,
  sub,
  value,
  icon,
  onClick,
  chevron = !!onClick,
  className = '',
  right
}: {
  title: ReactNode;
  sub?: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  className?: string;
  right?: ReactNode;
}) {
  const content = (
    <>
      {icon}
      <div className="row-main">
        <div className="row-title">{title}</div>
        {sub && <div className="row-sub">{sub}</div>}
      </div>
      {value !== undefined && <div className="row-value">{value}</div>}
      {right}
      {chevron && <Icon name="chevron" size={16} stroke={2.6} className="row-chevron" />}
    </>
  );
  const cls = `row ${icon ? 'with-icon' : ''} ${className}`;
  return onClick ? (
    <button className={cls} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}

export function Section({ header, footer, children, big }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; big?: boolean }) {
  return (
    <section>
      {header && <div className={`section-header ${big ? 'big' : ''}`}>{header}</div>}
      {children}
      {footer && <div className="section-footer">{footer}</div>}
    </section>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  unit,
  inputMode,
  invalid,
  max,
  autoFocus
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  unit?: string;
  inputMode?: 'numeric' | 'decimal' | 'text';
  invalid?: boolean;
  max?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className={`field ${invalid ? 'invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        max={max}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-label={typeof label === 'string' ? label : undefined}
      />
      {unit && <span className="unit">{unit}</span>}
    </div>
  );
}

export function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  return (
    <div className="field stack">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function SelectField<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={14} stroke={2.6} className="row-chevron" style={{ transform: 'rotate(90deg)' }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
  right,
  leftLabel = 'Abbrechen'
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  right?: ReactNode;
  leftLabel?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grabber" />
        <div className="sheet-head">
          <button className="nav-btn" onClick={onClose}>
            {leftLabel}
          </button>
          <div className="sheet-title">{title}</div>
          <div>{right}</div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

export function ActionSheet({ open, onClose, actions, title }: { open: boolean; onClose: () => void; title?: string; actions: { label: string; icon: string; color: string; onClick: () => void; disabled?: boolean; hint?: string }[] }) {
  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="action-sheet" role="dialog" aria-modal="true" aria-label={title ?? 'Aktionen'}>
        <div className="group">
          {title && <div className="row center small muted" style={{ justifyContent: 'center', minHeight: 40 }}>{title}</div>}
          {actions.map((a) => (
            <button
              key={a.label}
              className="row with-icon"
              disabled={a.disabled}
              style={a.disabled ? { opacity: 0.45 } : undefined}
              onClick={() => {
                onClose();
                a.onClick();
              }}
            >
              <IconTile name={a.icon} color={a.color} />
              <div className="row-main">
                <div className="row-title">{a.label}</div>
                {a.hint && <div className="row-sub">{a.hint}</div>}
              </div>
            </button>
          ))}
        </div>
        <div className="group">
          <button className="row cancel" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </>
  );
}

export function Confirm({ open, title, message, confirmLabel, destructive, onConfirm, onClose }: { open: boolean; title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm: () => void; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="backdrop" onClick={onClose} style={{ zIndex: 50 }} />
      <div className="action-sheet" role="alertdialog" aria-modal="true" aria-label={title} style={{ zIndex: 51 }}>
        <div className="group">
          <div style={{ padding: '16px 16px 12px', textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {message}
            </div>
          </div>
          <button
            className="row"
            style={{ justifyContent: 'center', color: destructive ? 'var(--overdue)' : 'var(--tint)' }}
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
        <div className="group">
          <button className="row cancel" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </>
  );
}

let toastSetter: ((t: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSetter?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  if (!msg) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <Icon name="checkCircle" size={20} style={{ color: 'var(--ok)' }} />
      {msg}
    </div>
  );
}

export function Ring({ value, size = 76, stroke = 9, color, children }: { value: number; size?: number; stroke?: number; color: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.32,.72,0,1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon-big">
        <Icon name={icon} size={30} />
      </div>
      <h3>{title}</h3>
      <p style={{ margin: '0 0 16px' }}>{text}</p>
      {action}
    </div>
  );
}

export const statusColor = (s: Status) => `var(--${s === 'inactive' ? 'unknown' : s})`;
