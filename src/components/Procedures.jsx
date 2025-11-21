import React, { useEffect, useState, useRef, useCallback } from 'react';
import { exec, run } from '../db/index.js';
import Modal from './Modal.jsx';

export default function Procedures({ encounter, onCountChange, mode = 'all' }) {

  const [notes, setNotes] = useState(encounter.procedures_notes || '');
  const [attachments, setAttachments] = useState([]);

  // Single procedure state
  const [pr, setPr] = useState({
    id: null,
    name: '',
    code: '',
    description: '',
    consent_obtained: false,
  });

  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: "",
    onConfirm: null,
  });

  function showModal({ title, content }) {
    setModal({ open: true, title, content, onConfirm: () => setModal({ ...modal, open: false }) });
  }

  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  // Reload data
  const reload = useCallback(() => {
    // Procedures
    if (mode !== 'attachments_only') {
      const rows = exec(
        'SELECT * FROM procedures WHERE encounter_id=$id',
        { $id: encounter.id }
      );

      if (rows.length > 0) {
        // Load the first one
        const first = rows[0];
        setPr({
          id: first.id,
          name: first.name,
          code: first.code,
          description: first.description,
          consent_obtained: first.consent_obtained === 1
        });
        onCountChangeRef.current?.(1);
      } else {
        // Create a new empty one immediately so we have an ID to update
        const newId = crypto.randomUUID();
        run(
          `INSERT INTO procedures (
            id, encounter_id, name, code, description, consent_obtained
          ) VALUES ($id, $e, '', '', '', 0)`,
          {
            $id: newId,
            $e: encounter.id
          }
        );
        setPr({
          id: newId,
          name: '',
          code: '',
          description: '',
          consent_obtained: false
        });
        onCountChangeRef.current?.(0); // Technically 0 filled
      }
    }

    // Attachments & Notes
    if (mode !== 'procedures_only') {
      const atts = exec(
        `SELECT id, file_name, title, uploaded_at FROM attachments 
         WHERE encounter_id=$id AND attachment_type='procedure_file'`,
        { $id: encounter.id }
      );
      setAttachments(atts);
      // If in attachments_only mode, report count here
      if (mode === 'attachments_only') {
        onCountChangeRef.current?.(atts.length);
      }
    }
  }, [encounter.id, mode]);

  useEffect(() => {
    reload();
    if (mode !== 'procedures_only') {
      setNotes(encounter.procedures_notes || '');
    }
  }, [encounter.id, reload, mode]);

  // Actions
  async function updateSingle(name, description, consent) {
    // Optimistic update
    setPr(prev => ({ ...prev, name, description, consent_obtained: consent }));

    // DB update
    if (pr.id) {
      await run(
        `UPDATE procedures SET name=$n, description=$d, consent_obtained=$co WHERE id=$id`,
        {
          $n: name,
          $d: description,
          $co: consent ? 1 : 0,
          $id: pr.id
        }
      );
      // Update count if name is present
      if (mode !== 'attachments_only') {
        onCountChange?.(name ? 1 : 0);
      }
    }
  }

  async function saveNotes(newNotes) {
    setNotes(newNotes);
    await run(
      'UPDATE encounters SET procedures_notes=$n WHERE id=$id',
      { $n: newNotes, $id: encounter.id }
    );
  }

  async function handleFileUploadBetter(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    for (const file of files) {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);

      await run(
        `INSERT INTO attachments (
          id, encounter_id, attachment_type, file_name, file_data, uploaded_at
        ) VALUES ($id, $e, 'procedure_file', $n, $d, $t)`,
        {
          $id: crypto.randomUUID(),
          $e: encounter.id,
          $n: file.name,
          $d: uint8,
          $t: new Date().toISOString(),
        }
      );
    }
    reload();
    e.target.value = '';
  }

  async function delAttachment(id) {
    await run('DELETE FROM attachments WHERE id=$id', { $id: id });
    reload();
  }

  async function downloadAttachment(id, fileName) {
    const rows = exec('SELECT file_data FROM attachments WHERE id=$id', { $id: id });
    if (!rows.length) return;

    const data = rows[0].file_data; // Uint8Array
    const blob = new Blob([data]);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      {/* 1. Procedures Form (Single Procedure Mode) */}
      {mode !== 'attachments_only' && (
        <>
          {/* Removed "Nuevo Procedimiento" title as requested */}

          <div className="diag-grid">
            <div className="input-wrap" style={{ width: '100%' }}>
              <input
                placeholder="Nombre del procedimiento"
                value={pr.name}
                onChange={e => updateSingle(e.target.value, pr.description, pr.consent_obtained)}
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <label style={{ flex: 1 }}>
              Nota de procedimiento
              <textarea
                rows={3}
                value={pr.description}
                onChange={e => updateSingle(pr.name, e.target.value, pr.consent_obtained)}
                placeholder="Detalles del procedimiento..."
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          </div>

          <div className="row" style={{ marginTop: 8 }}>
            <label className="inline-center no-grow">
              <input
                type="checkbox"
                checked={pr.consent_obtained}
                onChange={e => updateSingle(pr.name, pr.description, e.target.checked)}
              />
              Consentimiento obtenido
            </label>
          </div>

          {/* Removed "Agregar Procedimiento" button and "Procedimientos Registrados" list */}
        </>
      )}

      {/* 3. Adjuntos Section */}
      {mode !== 'procedures_only' && (
        <div>
          {mode === 'all' && <hr />}
          {mode === 'all' && <h3>Adjuntos</h3>}
          {/* If mode is 'attachments_only', we hide the title because SectionCard handles it */}

          <div style={{ marginBottom: 12 }}>
            <label>
              Notas / Texto
              <textarea
                rows={4}
                value={notes}
                onChange={e => saveNotes(e.target.value)}
                placeholder="Ingrese notas o texto adjunto..."
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              Subir Archivos (PDF, Imágenes)
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                onChange={handleFileUploadBetter}
                style={{ marginTop: 4 }}
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {attachments.map(att => (
                <li key={att.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6, background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.file_name}</span>
                  <button className="small" onClick={() => downloadAttachment(att.id, att.file_name)} style={{ marginRight: 8 }}>
                    Descargar
                  </button>
                  <button className="small danger" onClick={() => delAttachment(att.id)}>
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal.open && (
        <Modal title={modal.title} onClose={modal.onConfirm}>
          {modal.content}
        </Modal>
      )}
    </div>
  );
}

// ====================== AutoSuggest Component ======================
function AutoSuggest({ value, onChange, onPick, dataFn, renderItem, placeholder }) {
  const [q, setQ] = useState(value ?? "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setQ(value ?? "");
  }, [value]);

  const recompute = useCallback((text) => {
    const next = dataFn(text) || [];
    setItems(next);
    setOpen(focusedRef.current && next.length > 0);
  }, [dataFn]);

  const handleChange = (e) => {
    const v = e.target.value;
    setQ(v);
    onChange(v);
    recompute(v);
  };

  const handleFocus = () => {
    focusedRef.current = true;
    recompute(q);
  };

  const handleBlur = () => {
    setTimeout(() => {
      focusedRef.current = false;
      setOpen(false);
    }, 100);
  };

  const pick = (it) => {
    onPick(it);
    setOpen(false);
    focusedRef.current = false;
    inputRef.current?.blur();
  };

  return (
    <div className="input-wrap" style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={q}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {open && (
        <ul className="suggest" onMouseDown={e => e.preventDefault()}>
          {items.map((it, i) => (
            <li key={i} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
              {renderItem(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
