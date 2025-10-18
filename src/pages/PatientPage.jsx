import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { openDb, exec, run, exportFile, chooseBackupFile, hasBackupFile } from '../db/index.js';
import { nowIso, fullName, isoToBogotaInput, bogotaInputToIso } from '../utils.js';

import SectionCard from '../components/SectionCard.jsx';
import PatientFields from '../components/PatientFields.jsx';
import TextAreaAuto from '../components/TextAreaAuto.jsx';
import Vitals from '../components/Vitals.jsx';
import Diagnoses from '../components/Diagnoses.jsx';
import Prescriptions from '../components/Prescriptions.jsx';
import Procedures from '../components/Procedures.jsx';

export default function PatientPage(){
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [activeEncounterId, setActiveEncounterId] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [hasBackup, setHasBackup] = useState(false);

  // simple counters to mark sections empty/full
  const [counts, setCounts] = useState({ dx:0, rx:0, pr:0 });

  useEffect(()=>{
    openDb().then(async ()=>{
      const p = exec(`SELECT * FROM patients WHERE id=$id`, { $id:patientId })[0];
      const e = exec(`SELECT * FROM encounters WHERE patient_id=$id ORDER BY occurred_at DESC`, { $id:patientId });
      setPatient(p); setEncounters(e);
      if (e.length) { setActiveEncounterId(e[0].id) } else { createNewEncounter(p) }
      setHasBackup(await hasBackupFile());
    })
  }, [patientId]);

  useEffect(()=>{
    if (!activeEncounterId) return;
    const e = exec(`SELECT * FROM encounters WHERE id=$id`, { $id:activeEncounterId })[0];
    setEncounter(e);
    // refresh counters whenever we switch encounter
    const dx = exec(`SELECT COUNT(1) c FROM diagnoses   WHERE encounter_id=$id`, { $id:activeEncounterId })[0]?.c ?? 0;
    const rx = exec(`SELECT COUNT(1) c FROM prescriptions WHERE encounter_id=$id`, { $id:activeEncounterId })[0]?.c ?? 0;
    const pr = exec(`SELECT COUNT(1) c FROM procedures    WHERE encounter_id=$id`, { $id:activeEncounterId })[0]?.c ?? 0;
    setCounts({ dx:Number(dx), rx:Number(rx), pr:Number(pr) });
  }, [activeEncounterId]);

  function createNewEncounter(p){
    const id = crypto.randomUUID();
    const base = {
      id, patient_id: p.id, cas_code: generateCAS(),
      encounter_type: 'first_visit', objective: 'Atencion de usuario, evaluacion, diagnostico y tratamiento',
      occurred_at: nowIso(), chief_complaint: '', hpi: '', antecedentes: '', physical_exam: '',
      vitals_json: '', impression: '', plan: '', status: 'open', created_by: 'clinico',
      created_at: nowIso(), updated_at: nowIso()
    };
    run(`INSERT INTO encounters (id, patient_id, cas_code, encounter_type, objective, occurred_at, chief_complaint, hpi, antecedentes, physical_exam, vitals_json, impression, plan, status, created_by, created_at, updated_at)
          VALUES ($id,$pid,$cas,$type,$obj,$occ,$cc,$hpi,$ant,$pe,$vitals,$imp,$plan,'open','clinico',$ca,$ua)`,
          { $id:base.id,$pid:base.patient_id,$cas:base.cas_code,$type:base.encounter_type,$obj:base.objective,$occ:base.occurred_at,$cc:'',$hpi:'',$ant:'',$pe:'',$vitals:'',$imp:'',$plan:'',$ca:base.created_at,$ua:base.updated_at });
    const e = exec(`SELECT * FROM encounters WHERE id=$id`, { $id:id })[0];
    setEncounters(prev => [e, ...prev]);
    setActiveEncounterId(id);
  }

  if (!patient || !encounter) return <div className='container'><div className='card'>Cargando...</div></div>;

  // --- helpers for "empty" markers ---
  const vitEmpty = (() => {
    try {
      const v = encounter.vitals_json ? JSON.parse(encounter.vitals_json) : {};
      return !v.taS && !v.taD && !v.fc && !v.fr && !v.temp && !v.spo2 && !v.talla && !v.peso;
    } catch { return true; }
  })();

  const patientInfoEmpty = ![patient.phone, patient.email, patient.address, patient.city].some(s => String(s||'').trim());

  const empties = {
    datos: patientInfoEmpty,
    motivo: !String(encounter.chief_complaint||'').trim(),
    enfermedad: !String(encounter.hpi||'').trim(),
    antecedentes: !String(encounter.antecedentes||'').trim(),
    vitales: vitEmpty,
    examen: !String(encounter.physical_exam||'').trim(),
    analisis: !String(encounter.impression||'').trim(),
    plan: !String(encounter.plan||'').trim(),
    dx: counts.dx === 0,
    rx: counts.rx === 0,
    pr: counts.pr === 0,
  };

  return (
    <div className='container'>
      <div className='card toolbar'>
        <div>
          <div className='kicker'>Paciente</div>
          <div><strong>{fullName(patient)}</strong> — {patient.document_type} {patient.document_number}</div>
        </div>
        <div className='no-print'>
          <Link to='/'><button className='ghost'>Volver al inicio</button></Link>
          <a className='ghost' href={'/print/' + patient.id} target='_blank' rel='noreferrer'><button className='ghost'>Imprimir historia completa</button></a>
          <button className='ghost' onClick={exportFile}>Respaldo inmediato</button>
          <button
            className='ghost'
            onClick={async ()=>{ await chooseBackupFile(); setHasBackup(true); }}
            title={hasBackup ? 'Cambiar archivo de respaldo fijo' : 'Elegir archivo de respaldo fijo'}
          >
            {hasBackup ? 'Cambiar archivo fijo' : 'Elegir archivo fijo'}
          </button>
        </div>
      </div>

      <div className='card'>
        <div className='row'>
          <label>Atención
            <select value={activeEncounterId||''} onChange={e=> e.target.value==='__new__' ? createNewEncounter(patient) : setActiveEncounterId(e.target.value)}>
              <option value='__new__'>➕ Nueva atención</option>
              {encounters.map(e => (
                <option key={e.id} value={e.id}>{isoToBogotaInput(e.occurred_at).replace('T',' ')} — {e.cas_code}</option>
              ))}
            </select>
          </label>
          <label>Tipo
            <select value={encounter.encounter_type} onChange={async e=>{
              const v = e.target.value;
              await run(`UPDATE encounters SET encounter_type=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:encounter.id, $ua:nowIso() });
              setEncounter({ ...encounter, encounter_type:v });
            }}>
              <option value='first_visit'>Primera vez / ingreso</option>
              <option value='follow_up'>Control / seguimiento</option>
              <option value='minor_procedure'>Procedimientos menores</option>
            </select>
          </label>
          <label>Fecha/hora
            <input
              type="datetime-local"
              step="60"
              value={isoToBogotaInput(encounter.occurred_at)}
              onChange={async e => {
                const newIso = bogotaInputToIso(e.target.value);
                await run(`UPDATE encounters SET occurred_at=$v, updated_at=$ua WHERE id=$id`,
                  { $v: newIso, $id: encounter.id, $ua: nowIso() });
                setEncounter({ ...encounter, occurred_at: newIso });
              }}
            />
          </label>
          <label>CAS
            <input value={encounter.cas_code||''} onBlur={async e=>{
              const v = e.target.value;
              await run(`UPDATE encounters SET cas_code=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:encounter.id, $ua:nowIso() });
              setEncounter({ ...encounter, cas_code:v });
            }} defaultValue={encounter.cas_code||''}/>
          </label>
        </div>
      </div>

      {/* ORDER:
          Datos del paciente
          Motivo de consulta
          Enfermedad actual
          Antecedentes
          Signos vitales
          Examen físico
          Diagnósticos
          Plan / Conducta
          Análisis
          Fórmula médica
          Procedimientos
      */}

      <SectionCard title='Datos del paciente' empty={empties.datos}>
        <PatientFields patient={patient} setPatient={setPatient} />
      </SectionCard>

      <SectionCard title='Motivo de consulta' empty={empties.motivo}>
        <TextAreaAuto encounter={encounter} field='chief_complaint' label='Motivo de consulta' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Enfermedad actual' empty={empties.enfermedad}>
        <TextAreaAuto encounter={encounter} field='hpi' label='Enfermedad actual (HPI)' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Antecedentes' empty={empties.antecedentes}>
        <TextAreaAuto encounter={encounter} field='antecedentes' label='Antecedentes' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Signos vitales' empty={empties.vitales}>
        <Vitals encounter={encounter} setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Examen físico' empty={empties.examen}>
        <TextAreaAuto encounter={encounter} field='physical_exam' label='Examen físico' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Diagnósticos (CIE-10)' empty={empties.dx}>
        <Diagnoses encounter={encounter} onCountChange={(n)=>setCounts(c=>({...c,dx:n}))} />
      </SectionCard>

      <SectionCard title='Plan / Conducta' empty={empties.plan}>
        <TextAreaAuto encounter={encounter} field='plan' label='Plan' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Análisis' empty={empties.analisis}>
        <TextAreaAuto encounter={encounter} field='impression' label='Análisis' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Fórmula médica' empty={empties.rx}>
        <Prescriptions encounter={encounter} onCountChange={(n)=>setCounts(c=>({...c,rx:n}))} />
      </SectionCard>

      <SectionCard title='Procedimientos' empty={empties.pr}>
        <Procedures encounter={encounter} onCountChange={(n)=>setCounts(c=>({...c,pr:n}))} />
      </SectionCard>

      <SectionCard title='Adjuntos'>
        <div className='small'>Adjuntos — pendiente definir metadatos y carga de archivos.</div>
      </SectionCard>

      <SectionCard title='Evoluciones'>
        <div className='small'>Evoluciones — pendiente definir contenido.</div>
      </SectionCard>
    </div>
  );
}

function generateCAS(){
  const k='cas_seq', n = parseInt(localStorage.getItem(k) || '0', 10) + 1;
  localStorage.setItem(k, String(n));
  return `CAS-${String(n).padStart(6,'0')}`;
}
