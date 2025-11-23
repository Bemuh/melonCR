import { useState } from 'react';
import { persistNow } from '../db/index.js';

export default function SectionCard({ title, children, defaultOpen = false, empty = false, "data-testid": testId }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card" data-testid={testId}>
      <button
        type="button"
        className="collapser"
        aria-expanded={open}
        onClick={async () => { setOpen(o => !o); await persistNow?.(); }}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        <h2 className="section-title">
          {title}
          {empty && <span className="warn-badge" title="Sección sin completar" />}
        </h2>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}
