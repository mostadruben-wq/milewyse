import type { ReactNode } from 'react';
import { Icon } from './Icon';

/** Aufklappbare Kategorie (Dropdown) mit Zusammenfassung im Kopf. */
export function Collapsible({ title, summary, open, onToggle, children, id }: { title: string; summary?: ReactNode; open: boolean; onToggle: () => void; children: ReactNode; id: string }) {
  return (
    <div className={`collapsible ${open ? 'open' : ''}`}>
      <button className="collapsible-head" aria-expanded={open} aria-controls={`cat-${id}`} onClick={onToggle}>
        <div className="collapsible-title">
          <span>{title}</span>
          {summary && <span className="collapsible-summary">{summary}</span>}
        </div>
        <span className="circle-btn sm collapsible-chev" aria-hidden="true">
          <Icon name="chevron" size={15} stroke={2.4} />
        </span>
      </button>
      {open && (
        <div id={`cat-${id}`} className="collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}
