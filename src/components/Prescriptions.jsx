import React, { useEffect, useState } from 'react';
import { exec, run } from '../db/index.js';
import { nowIso } from '../utils.js';

export default function Prescriptions({ encounter, onCountChange }) {
  const [list, setList] = useState([]);
  const [rx, setRx] = useState({
    active_ingredient: '',
    presentation: '',
    concentration: '',
    dose: '',
    route: 'VO',
    frequency: '',
    duration_days: '',
    quantity_total: '',
    repeats: '',
    indications: '',
    warnings: '',
  });

  function reload() {
    const rows = exec(
      'SELECT * FROM prescriptions WHERE encounter_id=$id',
      { $id: encounter.id }
    );
    setList(rows);
    onCountChange?.(rows.length);
  }

  useEffect(() => {
    reload();
  }, [encounter?.id]);

  async function add() {
    if (!rx.active_ingredient) {
      alert('Principio activo requerido');
      return;
    }

    await run(
      `INSERT INTO prescriptions (
        id, encounter_id, active_ingredient, presentation,
        concentration, dose, route, frequency,
        duration_days, quantity_total, repeats,
        indications, warnings, substitution_allowed
      ) VALUES (
        $id,$e,$a,$p,
        $c,$d,$r,$f,
        $du,$qt,$re,
        $in,$w,0
      )`,
      {
        $id: crypto.randomUUID(),
        $e: encounter.id,
        $a: rx.active_ingredient,
        $p: rx.presentation,
        $c: rx.concentration,
        $d: rx.dose,
        $r: rx.route,
        $f: rx.frequency,
        $du: parseInt(rx.duration_days || '0', 10),
        $qt: rx.quantity_total,
        $re: parseInt(rx.repeats || '0', 10),
        $in: rx.indications,
        $w: rx.warnings,
      }
    );

    setRx({
      active_ingredient: '',
      presentation: '',
      concentration: '',
      dose: '',
      route: 'VO',
      frequency: '',
      duration_days: '',
      quantity_total: '',
      repeats: '',
      indications: '',
      warnings: '',
    });

    reload();
  }

  async function del(id) {
    await run(
      'DELETE FROM prescriptions WHERE id=$id',
      { $id: id }
    );
    reload();
  }

  return (
    <div>
      <div className="row">
        <label>
          Principio activo
          <input
            value={rx.active_ingredient}
            onChange={e =>
              setRx({ ...rx, active_ingredient: e.target.value })
            }
          />
        </label>
        <label>
          Presentación
          <input
            value={rx.presentation}
            onChange={e =>
              setRx({ ...rx, presentation: e.target.value })
            }
          />
        </label>
        <label>
          Concentración
          <input
            value={rx.concentration}
            onChange={e =>
              setRx({ ...rx, concentration: e.target.value })
            }
          />
        </label>
        <label>
          Dosis
          <input
            value={rx.dose}
            onChange={e =>
              setRx({ ...rx, dose: e.target.value })
            }
          />
        </label>
        <label>
          Vía
          <select
            value={rx.route}
            onChange={e =>
              setRx({ ...rx, route: e.target.value })
            }
          >
            <option>VO</option>
            <option>IM</option>
            <option>IV</option>
            <option>SC</option>
            <option>Tópica</option>
            <option>SL</option>
          </select>
        </label>
        <label>
          Frecuencia
          <input
            value={rx.frequency}
            onChange={e =>
              setRx({ ...rx, frequency: e.target.value })
            }
          />
        </label>
        <label>
          Duración (días)
          <input
            value={rx.duration_days}
            onChange={e =>
              setRx({ ...rx, duration_days: e.target.value })
            }
          />
        </label>
        <label>
          Cantidad total
          <input
            value={rx.quantity_total}
            onChange={e =>
              setRx({ ...rx, quantity_total: e.target.value })
            }
          />
        </label>
        <label>
          Repeticiones
          <input
            value={rx.repeats}
            onChange={e =>
              setRx({ ...rx, repeats: e.target.value })
            }
          />
        </label>
      </div>

      <label>
        Indicaciones
        <textarea
          value={rx.indications}
          onChange={e =>
            setRx({ ...rx, indications: e.target.value })
          }
        />
      </label>

      <label>
        Advertencias
        <textarea
          value={rx.warnings}
          onChange={e =>
            setRx({ ...rx, warnings: e.target.value })
          }
        />
      </label>

      <div className="row" style={{ marginTop: 12 }} />
      <button onClick={add}>Agregar</button>
      <hr />

      <ul>
        {list.map(it => (
          <li key={it.id}>
            {it.active_ingredient} — {it.dose} {it.route}{' '}
            {it.frequency} ({it.duration_days} días)
            <button
              className="ghost"
              onClick={() => del(it.id)}
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
