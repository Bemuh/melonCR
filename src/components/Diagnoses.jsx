import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { exec, run } from '../db/index.js';
import { loadICD10 } from '../data/icd10Loader.js';

export default function Diagnoses({ encounter, onCountChange }) {
  const [principal, setPrincipal] = useState({ code: '', label: '' });
  const [rel1, setRel1] = useState({ code: '', label: '' });
  const [rel2, setRel2] = useState({ code: '', label: '' });
  const [rel3, setRel3] = useState({ code: '', label: '' });

  const [dtype, setDtype] = useState('Impresión Diagnóstica');
  const [finalidad, setFinalidad] = useState(encounter.finalidad_consulta || '');
  const [causa, setCausa] = useState(encounter.causa_externa || '');

  // Load diagnoses from DB when encounter changes
  useEffect(() => {
    const rows = exec(
      'SELECT * FROM diagnoses WHERE encounter_id=$id ORDER BY is_primary DESC',
      { $id: encounter.id }
    );

    const p = rows.find(r => r.is_primary === 1) || {};
    const sec = rows.filter(r => !r.is_primary);

    setPrincipal({ code: p.code || '', label: p.label || '' });
    setRel1({ code: sec[0]?.code || '', label: sec[0]?.label || '' });
    setRel2({ code: sec[1]?.code || '', label: sec[1]?.label || '' });
    setRel3({ code: sec[2]?.code || '', label: sec[2]?.label || '' });

    if (rows[0]?.diagnosis_type) {
      setDtype(rows[0].diagnosis_type || 'Impresión Diagnóstica');
    } else {
      setDtype('Impresión Diagnóstica');
    }

    setFinalidad(encounter.finalidad_consulta || '');
    setCausa(encounter.causa_externa || '');
  }, [encounter?.id]);

  // Persist diagnoses + finalidad + causa
  async function persistAll(next = {}) {
    const p  = next.principal ?? principal;
    const r1 = next.rel1 ?? rel1;
    const r2 = next.rel2 ?? rel2;
    const r3 = next.rel3 ?? rel3;
    const t  = next.dtype ?? dtype;
    const f  = next.finalidad ?? finalidad;
    const c  = next.causa ?? causa;

    const list = [
      { is_primary: 1, ...p },
      { is_primary: 0, ...r1 },
      { is_primary: 0, ...r2 },
      { is_primary: 0, ...r3 },
    ].filter(x => x.code && x.label);

    await run(
      'DELETE FROM diagnoses WHERE encounter_id=$id',
      { $id: encounter.id }
    );

    for (const x of list) {
      await run(
        `INSERT INTO diagnoses
          (id, encounter_id, code, label, is_primary, diagnosis_type)
         VALUES
          ($id,$e,$c,$l,$p,$t)`,
        {
          $id: crypto.randomUUID(),
          $e: encounter.id,
          $c: x.code,
          $l: x.label,
          $p: x.is_primary ? 1 : 0,
          $t: t,
        }
      );
    }

    await run(
      'UPDATE encounters SET finalidad_consulta=$f, causa_externa=$c WHERE id=$id',
      { $f: f, $c: c, $id: encounter.id }
    );

    onCountChange?.(list.length);
  }

  // ------- Autocomplete dataset (lazy-loaded from JSON) -------
  const [normalized, setNormalized] = useState([]);

  useEffect(() => {
    let alive = true;
    loadICD10().then(list => {
      if (!alive) return;
      setNormalized(
        list.map(it => ({
          code: it.code,                  // already normalized
          codeRaw: it.code.toLowerCase(),
          label: it.label,
          labelLow: it.label.toLowerCase(),
        }))
      );
    });
    return () => { alive = false; };
  }, []);

  const findByCodePrefix = useCallback((input) => {
    const q = (input || '').replace('.', '').toLowerCase();
    if (!q) return [];
    return normalized
      .filter(it => it.codeRaw.startsWith(q))
      .slice(0, 10);
  }, [normalized]);

  const findByNameSubstr = useCallback((input) => {
    const q = (input || '').toLowerCase();
    if (!q) return [];
    return normalized
      .filter(it => it.labelLow.includes(q))
      .slice(0, 10);
  }, [normalized]);

  return (
    <div>
      <DxRow
        title="Diagnóstico Principal:"
        kind="principal"
        state={principal}
        setState={setPrincipal}
        findByCodePrefix={findByCodePrefix}
        findByNameSubstr={findByNameSubstr}
        persistAll={persistAll}
      />
      <DxRow
        title="Diagnóstico Relacionado nro 1:"
        kind="rel1"
        state={rel1}
        setState={setRel1}
        findByCodePrefix={findByCodePrefix}
        findByNameSubstr={findByNameSubstr}
        persistAll={persistAll}
      />
      <DxRow
        title="Diagnóstico Relacionado nro 2:"
        kind="rel2"
        state={rel2}
        setState={setRel2}
        findByCodePrefix={findByCodePrefix}
        findByNameSubstr={findByNameSubstr}
        persistAll={persistAll}
      />
      <DxRow
        title="Diagnóstico Relacionado nro 3:"
        kind="rel3"
        state={rel3}
        setState={setRel3}
        findByCodePrefix={findByCodePrefix}
        findByNameSubstr={findByNameSubstr}
        persistAll={persistAll}
      />

      <div className="diag-grid">
        <div className="diag-title">Tipo de Diagnóstico:</div>
        <div>
          <select
            value={dtype}
            onChange={async e => {
              const v = e.target.value;
              setDtype(v);
              await persistAll({ dtype: v });
            }}
          >
            <option>1 - Impresión Diagnóstica</option>
            <option>2 - Confirmado Nuevo</option>
            <option>3 - Confirmado Repetido</option>
          </select>
        </div>
        <div />
      </div>

      <div className="diag-block">
        <label>
          Finalidad Consulta
          <textarea
            value={finalidad}
            onChange={e => setFinalidad(e.target.value)}
            onBlur={persistAll}
            placeholder="Escriba la finalidad de la consulta…"
          />
        </label>
      </div>

      <div className="diag-grid">
        <div className="diag-title">Causa Externa</div>
        <div>
          <select
            value={causa}
            onChange={async e => {
              const v = e.target.value;
              setCausa(v);
              await persistAll({ causa: v });
            }}
          >
            {CAUSAS_EXTERNAS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
        <div />
      </div>

      <div className="row" style={{ marginTop: 12 }} />
      <button onClick={persistAll}>Guardar diagnósticos</button>
    </div>
  );
}

function DxRow({
  title,
  kind,
  state,
  setState,
  findByCodePrefix,
  findByNameSubstr,
  persistAll,
}) {
  return (
    <div className="diag-grid">
      <div className="diag-title">{title}</div>

      <AutoSuggest
        placeholder="Código (sin punto, ej: J069)"
        value={state.code}
        onChange={v => setState({ ...state, code: v })}
        onPick={it => {
          const next = { code: it.code, label: it.label };
          setState(next);
          persistAll({ [kind]: next });
        }}
        dataFn={findByCodePrefix}
        renderItem={it => <>{it.code} — {it.label}</>}
      />

      <AutoSuggest
        placeholder="Nombre CIE-10"
        value={state.label}
        onChange={v => setState({ ...state, label: v })}
        onPick={it => {
          const next = { code: it.code, label: it.label };
          setState(next);
          persistAll({ [kind]: next });
        }}
        dataFn={findByNameSubstr}
        renderItem={it => <>{it.code} — {it.label}</>}
      />
    </div>
  );
}

function AutoSuggest({
  value,
  onChange,
  onPick,
  dataFn,
  renderItem,
  placeholder,
}) {
  const [q, setQ] = useState(value ?? '');
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const inputRef = useRef(null);
  const focusedRef = useRef(false);

  // Sync from parent when not editing
  useEffect(() => {
    if (!focusedRef.current) setQ(value ?? '');
  }, [value]);

  const recompute = useCallback((text) => {
    const next = dataFn ? dataFn(text) : [];
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
    // small delay for menu click
    setTimeout(() => {
      focusedRef.current = false;
      setOpen(false);
    }, 120);
  };

  const pick = (it) => {
    onPick(it);
    setOpen(false);
    focusedRef.current = false;
    inputRef.current?.blur();
  };

  return (
    <div className="input-wrap">
      <input
        ref={inputRef}
        value={q}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {open && (
        <ul
          className="suggest"
          onMouseDown={e => e.preventDefault()}
        >
          {items.map((it, i) => (
            <li
              key={i}
              onMouseDown={e => {
                e.preventDefault();
                pick(it);
              }}
            >
              {renderItem(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CAUSAS_EXTERNAS = [
  '01 – Accidente de trabajo',
  '02 – Accidente de tránsito',
  '03 – Accidente rábico',
  '04 – Accidente ofídico',
  '05 – Otro tipo de accidente',
  '06 – Evento catastrófico',
  '07 – Lesión por agresión',
  '08 – Lesión autoinfligida',
  '09 – Sospecha de maltrato físico',
  '10 – Sospecha de abuso sexual',
  '11 – Sospecha de violencia sexual',
  '12 – Sospecha de maltrato emocional',
  '13 – Enfermedad general',
  '14 – Enfermedad profesional',
  '15 – Otra',
];
