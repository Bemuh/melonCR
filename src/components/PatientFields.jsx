import { run } from '../db/index.js';
import { nowIso } from '../utils.js';

export default function PatientFields({ patient, setPatient }) {
  return (
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
  );
}
