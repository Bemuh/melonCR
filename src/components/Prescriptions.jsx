import React, { useEffect, useState } from 'react';
import { exec, run } from '../db/index.js';
import Modal from './Modal.jsx';

export default function Prescriptions({ encounter, onCountChange }) {
  const [list, setList] = useState([]);
  const [rx, setRx] = useState({
    name: '',
    dose_per_take: '',
    freq_hours: '',
    duration_days: '',
    indications: '',
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

  // Load prescriptions for this encounter
  function reload() {
    if (!encounter?.id) return;
    const rows = exec(
      'SELECT * FROM prescriptions WHERE encounter_id=$id',
      { $id: encounter.id }
    );
    setList(rows);
    onCountChange?.(rows.length || 0);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.id]);

  // Calculate total quantity: Cantidad por toma * (24 / frecuencia) * duración
  function computeTotal(dosePerTake, freqHours, durationDays) {
    const d = parseFloat(String(dosePerTake || '').replace(',', '.'));
    const f = parseFloat(String(freqHours || '').replace(',', '.'));
    const days = parseFloat(String(durationDays || '').replace(',', '.'));

    if (!d || !f || !days || f <= 0) return '';
    const dosesPerDay = 24 / f;
    if (!isFinite(dosesPerDay) || dosesPerDay <= 0) return '';

    const total = d * dosesPerDay * days;
    // round to 2 decimals but strip trailing .00
    const rounded = Math.round(total * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(rounded);
  }

  async function add() {
    const {
      name,
      dose_per_take,
      freq_hours,
      duration_days,
      indications,
    } = rx;

    if (!name || !dose_per_take || !freq_hours || !duration_days) {
      showModal({
        title: "Datos incompletos",
        content: "Nombre, cantidad por toma, frecuencia (horas) y duración (días) son obligatorios.",
      });
      return;
    }

    const quantity_total = computeTotal(
      dose_per_take,
      freq_hours,
      duration_days
    );
    if (!quantity_total) {
      showModal({
        title: "Error de cálculo",
        content: "No se pudo calcular la cantidad total. Verifique la cantidad por toma, la frecuencia (horas) y la duración (días).",
      });
      return;
    }

    await run(
      `INSERT INTO prescriptions (
        id,
        encounter_id,
        active_ingredient,
        presentation,
        concentration,
        dose,
        route,
        frequency,
        duration_days,
        quantity_total,
        repeats,
        indications,
        warnings,
        substitution_allowed
      ) VALUES (
        $id,
        $encounter_id,
        $name,
        '',
        '',
        $dose,
        $route,
        $freq,
        $days,
        $qty,
        0,
        $indications,
        '',
        0
      )`,
      {
        $id: crypto.randomUUID(),
        $encounter_id: encounter.id,
        $name: name,
        $dose: String(dose_per_take),
        $route: 'VO',
        $freq: String(freq_hours),
        $days: parseInt(duration_days, 10) || 0,
        $qty: quantity_total,
        $indications: indications || '',
      }
    );

    // Reset form
    setRx({
      name: '',
      dose_per_take: '',
      freq_hours: '',
      duration_days: '',
      indications: '',
    });

    reload();
  }

  async function del(id) {
    await run('DELETE FROM prescriptions WHERE id=$id', { $id: id });
    reload();
  }

  const previewTotal = computeTotal(
    rx.dose_per_take,
    rx.freq_hours,
    rx.duration_days
  );

  return (
    <div>
      <div className="row">
        <label style={{ flex: 2 }}>
          Nombre
          <input
            value={rx.name}
            onChange={e =>
              setRx(prev => ({ ...prev, name: e.target.value }))
            }
            placeholder="Ej: Ibuprofeno 400 mg"
            data-testid="input-rx-name"
          />
        </label>
      </div>

      <div className="row">
        <label>
          Cantidad por toma
          <input
            value={rx.dose_per_take}
            onChange={e =>
              setRx(prev => ({
                ...prev,
                dose_per_take: e.target.value,
              }))
            }
            placeholder="Ej: 1"
            data-testid="input-rx-dose"
          />
        </label>

        <label>
          Frecuencia (horas)
          <input
            value={rx.freq_hours}
            onChange={e =>
              setRx(prev => ({
                ...prev,
                freq_hours: e.target.value,
              }))
            }
            placeholder="Ej: 8"
            data-testid="input-rx-freq"
          />
        </label>

        <label>
          Duración (días)
          <input
            value={rx.duration_days}
            onChange={e =>
              setRx(prev => ({
                ...prev,
                duration_days: e.target.value,
              }))
            }
            placeholder="Ej: 5"
            data-testid="input-rx-days"
          />
        </label>

        <label>
          Cantidad total (auto)
          <input
            value={previewTotal || ''}
            readOnly
            placeholder="Calculado"
            style={{ backgroundColor: '#f0f0f0' }}
          />
        </label>
      </div>

      <label>
        Indicaciones
        <textarea
          value={rx.indications}
          onChange={e =>
            setRx(prev => ({
              ...prev,
              indications: e.target.value,
            }))
          }
          placeholder="Instrucciones adicionales para el paciente"
          data-testid="input-rx-indications"
        />
      </label>

      <div className="row" style={{ marginTop: 12 }} />
      <div className="row" style={{ marginTop: 12 }} />
      <button onClick={add} data-testid="btn-add-rx">Agregar</button>
      <hr />
      <hr />

      <ul>
        {list.map(it => {
          const total = it.quantity_total;
          const freq = it.frequency;
          const days = it.duration_days;

          const partes = [];
          if (it.dose)
            partes.push(`${it.dose}`);
          if (freq)
            partes.push(`cada ${freq} horas`);
          if (days)
            partes.push(
              `durante ${days} día${Number(days) === 1 ? '' : 's'}`
            );

          const frasePosologia =
            partes.length > 0
              ? `Usar ${partes.join(' ')}.`
              : '';

          return (
            <li key={it.id} style={{ marginBottom: 8 }} data-testid={`list-rx-item-${it.id}`}>
              <div>
                <strong>{it.active_ingredient}</strong>
              </div>
              <div className="small">
                {frasePosologia && `${frasePosologia} `}
                {total &&
                  `Cantidad total sugerida: ${total} unidad(es). `}
                {it.indications &&
                  `Indicaciones: ${it.indications}`}
              </div>
              <button
                className="ghost"
                onClick={() => del(it.id)}
                data-testid={`btn-delete-rx-${it.id}`}
              >
                Eliminar
              </button>
            </li>
          );
        })}
      </ul>

      {modal.open && (
        <Modal
          title={modal.title}
          onClose={modal.onConfirm}
        >
          {modal.content}
        </Modal>
      )}
    </div>
  );
}
