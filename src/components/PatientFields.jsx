import { run } from '../db/index.js';
import { nowIso } from '../utils.js';

export default function PatientFields({ patient, setPatient }) {
  return (
    <>
      <div className='row'>
        <label>Nombres
          <input defaultValue={patient.first_name || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET first_name=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, first_name: v });
          }} data-testid="input-patient-firstname" />
        </label>
        <label>Apellidos
          <input defaultValue={patient.last_name || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET last_name=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, last_name: v });
          }} data-testid="input-patient-lastname" />
        </label>
      </div>
      <div className='row'>
        <label>Tipo Doc
          <select
            value={patient.document_type}
            onChange={async e => {
              const v = e.target.value;
              await run(`UPDATE patients SET document_type=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
              setPatient({ ...patient, document_type: v });
            }}
            data-testid="select-patient-doctype"
          >
            <option>CC</option>
            <option>CE</option>
            <option>TI</option>
            <option>PA</option>
          </select>
        </label>
        <label>Nº Documento
          <input defaultValue={patient.document_number || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET document_number=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, document_number: v });
          }} data-testid="input-patient-docnumber" />
        </label>
        <label>Sexo
          <select
            value={patient.sex || ''}
            onChange={async e => {
              const v = e.target.value;
              await run(`UPDATE patients SET sex=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
              setPatient({ ...patient, sex: v });
            }}
            data-testid="select-patient-sex"
          >
            <option value="">—</option>
            <option>Hombre</option>
            <option>Mujer</option>
            <option>Indeterminado</option>
          </select>
        </label>
        <label>Fecha Nacimiento
          <input type="date" defaultValue={patient.birth_date || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET birth_date=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, birth_date: v });
          }} data-testid="input-patient-birthdate" />
        </label>
      </div>
      <div className='row'>
        <label>Teléfono
          <input defaultValue={patient.phone || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET phone=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, phone: v });
          }} data-testid="input-patient-phone" />
        </label>
        <label>Email
          <input defaultValue={patient.email || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET email=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, email: v });
          }} data-testid="input-patient-email" />
        </label>
        <label>Dirección
          <input defaultValue={patient.address || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET address=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, address: v });
          }} data-testid="input-patient-address" />
        </label>
        <label>Ciudad
          <input defaultValue={patient.city || ''} onBlur={async e => {
            const v = e.target.value; await run(`UPDATE patients SET city=$v, updated_at=$ua WHERE id=$id`, { $v: v, $id: patient.id, $ua: nowIso() });
            setPatient({ ...patient, city: v });
          }} data-testid="input-patient-city" />
        </label>
      </div>
    </>
  );
}
