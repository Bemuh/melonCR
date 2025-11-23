import React, { useState } from 'react';
import { openDb, exec, run } from '../db/index.js';
import { uid, nowIso } from '../utils.js';
import { useNavigate } from 'react-router-dom';
import Modal from '../components/Modal.jsx';

export default function Intake() {
  const navigate = useNavigate();
  const [mode, setMode] = useState(''); // '' | 'new' | 'existing'
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);

  const [form, setForm] = useState({
    document_type: 'CC',
    document_number: '',
    first_name: '',
    last_name: '',
    sex: '',             // ← dropdown
    birth_date: '',
    phone: '',
    email: '',
    address: '',
    city: '',
  });

  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: "",
    onConfirm: null,
    onCancel: null,
  });

  function showModal({ title, content, onConfirm, onCancel }) {
    setModal({ open: true, title, content, onConfirm, onCancel });
  }

  function closeModal() {
    setModal({ ...modal, open: false });
  }

  async function search() {
    await openDb();
    const rows = exec(
      `SELECT *, first_name || ' ' || last_name AS full_name
         FROM patients
        WHERE document_number LIKE $q OR first_name LIKE $like OR last_name LIKE $like
        ORDER BY last_name, first_name
        LIMIT 50`,
      { $q: q, $like: '%' + q + '%' }
    );
    setResults(rows);
  }

  async function create() {
    await openDb();

    // minimal required
    if (!form.document_type || !form.document_number || !form.first_name || !form.last_name) {
      showModal({
        title: "Datos incompletos",
        content: "Tipo doc, Nº documento, Nombres y Apellidos son obligatorios.",
        onConfirm: closeModal,
      });
      return;
    }

    // ❶ Block duplicates by document (show existing instead)
    const dupByDoc = exec(
      `SELECT id FROM patients WHERE document_number=$n`,
      { $n: form.document_number }
    );

    if (dupByDoc.length) {
      showModal({
        title: "Paciente existente",
        content: "Ese documento ya existe. Abriendo la historia del paciente.",
        onConfirm: () => {
          closeModal();
          navigate('/patient/' + dupByDoc[0].id);
        },
      });
      return;
    }

    // (optional) secondary soft-check: same name + DOB
    const dupByNameDob = exec(
      `SELECT id FROM patients WHERE first_name=$f AND last_name=$l AND (birth_date=$b OR $b='')`,
      { $f: form.first_name, $l: form.last_name, $b: form.birth_date || '' }
    );
    if (dupByNameDob.length) {
      showModal({
        title: "Posible duplicado",
        content: "Existe alguien con mismo nombre/fecha. ¿Crear de todas formas?",
        onCancel: closeModal,
        onConfirm: () => {
          closeModal();
          doCreate(uid(), nowIso());
        },
      });
      return;
    }

    const newId = uid();
    const ts = nowIso();
    await doCreate(newId, ts);
  }

  async function doCreate(id, ts) {
    await run(
      `INSERT INTO patients
        (id, document_type, document_number, first_name, last_name, sex, birth_date, phone, email, address, city, created_at, updated_at)
       VALUES
        ($id,$dt,$dn,$fn,$ln,$sex,$bd,$ph,$em,$ad,$cy,$ca,$ua)`,
      {
        $id: id,
        $dt: form.document_type,
        $dn: form.document_number,
        $fn: form.first_name,
        $ln: form.last_name,
        $sex: form.sex,                  // Hombre / Mujer / Indeterminado / ''
        $bd: form.birth_date || '',
        $ph: form.phone || '',
        $em: form.email || '',
        $ad: form.address || '',
        $cy: form.city || '',
        $ca: ts,
        $ua: ts,
      }
    );

    navigate('/patient/' + id);
  }

  return (
    <div className="card">
      <h1>Ingreso</h1>
      <div className="row">
        <button className={mode === 'new' ? '' : 'ghost'} onClick={() => setMode('new')} data-testid="btn-new-patient">
          Paciente nuevo
        </button>
        <button className={mode === 'existing' ? '' : 'ghost'} onClick={() => setMode('existing')} data-testid="btn-existing-patient">
          Paciente existente
        </button>
      </div>

      {mode === 'existing' && (
        <div className="card">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <label style={{ flex: 1, marginTop: 0 }}>
              Buscar por documento/nombre
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="CC, nombre o apellido"
                data-testid="input-search"
              />
            </label>

            <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center' }}>
              <button onClick={search} style={{ alignSelf: 'center' }} data-testid="btn-search">
                Buscar
              </button>
            </div>
          </div>

          <ul>
            {results.map(r => (
              <li key={r.id} style={{ margin: '6px 0' }}>
                <button onClick={() => navigate('/patient/' + r.id)} data-testid={`list-result-item-${r.id}`}>
                  {r.full_name} — {r.document_type} {r.document_number}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'new' && (
        <div className="card">
          <h2>Datos mínimos del paciente</h2>

          <div className="row">
            <label>
              Tipo doc
              <select
                value={form.document_type}
                onChange={e => setForm({ ...form, document_type: e.target.value })}
                data-testid="input-doc-type"
              >
                <option>CC</option>
                <option>CE</option>
                <option>TI</option>
                <option>PA</option>
              </select>
            </label>

            <label>
              Nº documento
              <input
                value={form.document_number}
                onChange={e => setForm({ ...form, document_number: e.target.value })}
                data-testid="input-doc-number"
              />
            </label>

            <label>
              Nombres
              <input
                value={form.first_name}
                onChange={e => setForm({ ...form, first_name: e.target.value })}
                data-testid="input-first-name"
              />
            </label>

            <label>
              Apellidos
              <input
                value={form.last_name}
                onChange={e => setForm({ ...form, last_name: e.target.value })}
                data-testid="input-last-name"
              />
            </label>
          </div>

          <div className="row">
            {/* ❷ Sexo as a dropdown */}
            <label>
              Sexo
              <select value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })} data-testid="select-sex">
                <option value="">—</option>
                <option>Hombre</option>
                <option>Mujer</option>
                <option>Indeterminado</option>
              </select>
            </label>

            <label>
              Fecha nacimiento
              <input
                type="date"
                value={form.birth_date}
                onChange={e => setForm({ ...form, birth_date: e.target.value })}
                data-testid="input-birth-date"
              />
            </label>

            <label>
              Teléfono
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" />
            </label>

            <label>
              Dirección
              <input
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                data-testid="input-address"
              />
            </label>

            <label>
              Ciudad
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} data-testid="input-city" />
            </label>
          </div>

          <div className="row" style={{ marginTop: 12 }} />
          <div className="row">
            <button onClick={create} data-testid="btn-create">Crear y continuar</button>
          </div>
        </div>
      )}


      {modal.open && (
        <Modal
          title={modal.title}
          onClose={modal.onConfirm || closeModal}
          onCancel={modal.onCancel}
        >
          {modal.content}
        </Modal>
      )}
    </div>
  );
}
