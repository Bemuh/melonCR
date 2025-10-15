import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { openDb, exec, run, exportFile, chooseBackupFile, hasBackupFile, persistNow } from '../db/index.js'
import { nowIso, fullName, isoToBogotaInput, bogotaInputToIso } from '../utils.js'

const IS_ELECTRON = /electron/i.test(navigator.userAgent)

export default function PatientPage(){
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [encounters, setEncounters] = useState([])
  const [activeEncounterId, setActiveEncounterId] = useState(null)
  const [encounter, setEncounter] = useState(null)
  const [hasBackup, setHasBackup] = useState(false)

  // Load patient and encounters
  useEffect(()=>{
    openDb().then(async ()=>{
      const p = exec(`SELECT * FROM patients WHERE id=$id`, { $id:patientId })[0]
      const e = exec(`SELECT * FROM encounters WHERE patient_id=$id ORDER BY occurred_at DESC`, { $id:patientId })
      setPatient(p); setEncounters(e)
      if (e.length) { setActiveEncounterId(e[0].id) } else { createNewEncounter(p) }
      setHasBackup(await hasBackupFile())
    })
  }, [patientId])

  // When activeEncounterId changes, load encounter
  useEffect(()=>{
    if (!activeEncounterId) return
    const e = exec(`SELECT * FROM encounters WHERE id=$id`, { $id:activeEncounterId })[0]
    setEncounter(e)
  }, [activeEncounterId])

  function createNewEncounter(p){
    const id = crypto.randomUUID()
    const base = {
      id, patient_id: p.id, cas_code: generateCAS(),
      encounter_type: 'first_visit', objective: 'Atencion de usuario, evaluacion, diagnostico y tratamiento',
      occurred_at: nowIso(), chief_complaint: '', hpi: '', antecedentes: '', physical_exam: '',
      vitals_json: '', impression: '', plan: '', status: 'open', created_by: 'clinico',
      created_at: nowIso(), updated_at: nowIso()
    }
    run(`INSERT INTO encounters (id, patient_id, cas_code, encounter_type, objective, occurred_at, chief_complaint, hpi, antecedentes, physical_exam, vitals_json, impression, plan, status, created_by, created_at, updated_at)
          VALUES ($id,$pid,$cas,$type,$obj,$occ,$cc,$hpi,$ant,$pe,$vitals,$imp,$plan,'open','clinico',$ca,$ua)`,
          { $id:base.id,$pid:base.patient_id,$cas:base.cas_code,$type:base.encounter_type,$obj:base.objective,$occ:base.occurred_at,$cc:'',$hpi:'',$ant:'',$pe:'',$vitals:'',$imp:'',$plan:'',$ca:base.created_at,$ua:base.updated_at })
    const e = exec(`SELECT * FROM encounters WHERE id=$id`, { $id:id })[0]
    setEncounters(prev => [e, ...prev])
    setActiveEncounterId(id)
  }

  if (!patient || !encounter) return <div className='container'><div className='card'>Cargando...</div></div>

  const handlePrint = () => {
    if (IS_ELECTRON) {
      // same-window route change (works in Electron)
      navigate(`/print/${patient.id}`)
    } else {
      // open in a new tab in the browser
      window.open(`/print/${patient.id}`, '_blank', 'noopener')
    }
  }

  return (
    <div className='container'>
      <div className='card toolbar'>
        <div>
          <div className='kicker'>Paciente</div>
          <div><strong>{fullName(patient)}</strong> — {patient.document_type} {patient.document_number}</div>
        </div>
        <div className='no-print'>
          <Link to='/'><button className='ghost'>Volver al inicio</button></Link>
          <button className='ghost' onClick={handlePrint}>Imprimir historia completa</button>
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
              const v = e.target.value
              await run(`UPDATE encounters SET encounter_type=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:encounter.id, $ua:nowIso() })
              setEncounter({ ...encounter, encounter_type:v })
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
                const newIso = bogotaInputToIso(e.target.value)
                await run(`UPDATE encounters SET occurred_at=$v, updated_at=$ua WHERE id=$id`,
                  { $v: newIso, $id: encounter.id, $ua: nowIso() })
                setEncounter({ ...encounter, occurred_at: newIso })
              }}
            />
          </label>
          <label>CAS
            <input value={encounter.cas_code||''} onBlur={async e=>{
              const v = e.target.value
              await run(`UPDATE encounters SET cas_code=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:encounter.id, $ua:nowIso() })
              setEncounter({ ...encounter, cas_code:v })
            }} defaultValue={encounter.cas_code||''}/>
          </label>
        </div>
      </div>

      {/* Single long page with all sections */}
      <SectionCard title='Datos del paciente'>
        <PatientFields patient={patient} setPatient={setPatient} />
      </SectionCard>

      <SectionCard title='Motivo de consulta'>
        <TextAreaAuto encounter={encounter} field='chief_complaint' label='Motivo de consulta' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Enfermedad actual'>
        <TextAreaAuto encounter={encounter} field='hpi' label='Enfermedad actual (HPI)' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Antecedentes'>
        <TextAreaAuto encounter={encounter} field='antecedentes' label='Antecedentes' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Examen físico'>
        <TextAreaAuto encounter={encounter} field='physical_exam' label='Examen físico' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Signos vitales'>
        <Vitals encounter={encounter} setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Diagnósticos (CIE-10)'>
        <Diagnoses encounter={encounter} />
      </SectionCard>

      <SectionCard title='Plan / Conducta'>
        <TextAreaAuto encounter={encounter} field='plan' label='Plan' setEncounter={setEncounter} />
      </SectionCard>

      <SectionCard title='Fórmula médica'>
        <Prescriptions encounter={encounter} />
      </SectionCard>

      <SectionCard title='Procedimientos'>
        <Procedures encounter={encounter} />
      </SectionCard>

      <SectionCard title='Adjuntos'>
        <div className='small'>Adjuntos — pendiente definir metadatos y carga de archivos.</div>
      </SectionCard>

      <SectionCard title='Evoluciones'>
        <div className='small'>Evoluciones — pendiente definir contenido.</div>
      </SectionCard>
    </div>
  )
}

function SectionCard({ title, children, defaultOpen = false }) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div className="card">
      <button
        type="button"
        className="collapser"
        aria-expanded={open}
        onClick={async () => { setOpen(o => !o); await persistNow(); }}
      >
        <span className="caret">{open ? '▾' : '▸'}</span>
        <h2>{title}</h2>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  )
}

function PatientFields({ patient, setPatient }){
  return (
    <div className='row'>
      <label>Teléfono
        <input defaultValue={patient.phone||''} onBlur={async e=>{
          const v = e.target.value; await run(`UPDATE patients SET phone=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:patient.id, $ua:nowIso() })
          setPatient({ ...patient, phone:v })
        }}/>
      </label>
      <label>Email
        <input defaultValue={patient.email||''} onBlur={async e=>{
          const v = e.target.value; await run(`UPDATE patients SET email=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:patient.id, $ua:nowIso() })
          setPatient({ ...patient, email:v })
        }}/>
      </label>
      <label>Dirección
        <input defaultValue={patient.address||''} onBlur={async e=>{
          const v = e.target.value; await run(`UPDATE patients SET address=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:patient.id, $ua:nowIso() })
          setPatient({ ...patient, address:v })
        }}/>
      </label>
      <label>Ciudad
        <input defaultValue={patient.city||''} onBlur={async e=>{
          const v = e.target.value; await run(`UPDATE patients SET city=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:patient.id, $ua:nowIso() })
          setPatient({ ...patient, city:v })
        }}/>
      </label>
    </div>
  )
}

function TextAreaAuto({ encounter, setEncounter, field, label }){
  return (
    <label>{label}
      <textarea defaultValue={encounter[field]||''}
        onBlur={async e=>{
          const v = e.target.value
          await run(`UPDATE encounters SET ${field}=$v, updated_at=$ua WHERE id=$id`, { $v:v, $id:encounter.id, $ua:nowIso() })
          setEncounter({ ...encounter, [field]: v })
        }}/>
    </label>
  )
}

function Vitals({ encounter, setEncounter }){
  const v = encounter.vitals_json ? JSON.parse(encounter.vitals_json) : {}
  const [state, setState] = useState({ taS:v.taS||'', taD:v.taD||'', fc:v.fc||'', fr:v.fr||'', temp:v.temp||'', spo2:v.spo2||'', talla:v.talla||'', peso:v.peso||'', bmi:v.bmi||'' })
  function calcBMI(next){ const talla = Number(next.talla||state.talla||0); const peso = Number(next.peso||state.peso||0); return (peso && talla) ? (peso/((talla/100)**2)).toFixed(1) : '' }
  async function save(next){
    const data = { ...state, ...next }; data.bmi = calcBMI(next)
    await run(`UPDATE encounters SET vitals_json=$v, updated_at=$ua WHERE id=$id`, { $v:JSON.stringify(data), $id:encounter.id, $ua:nowIso() })
    setState(data); setEncounter({ ...encounter, vitals_json: JSON.stringify(data) })
  }
  function field(name, labelText){
    return <label>{labelText}<input defaultValue={state[name]} onBlur={e=>save({ [name]: e.target.value })} /></label>
  }
  return <div className='row'>
    {field('taS','TA Sistólica')}{field('taD','TA Diastólica')}{field('fc','FC')}{field('fr','FR')}
    {field('temp','Temperatura °C')}{field('spo2','SatO₂ %')}{field('talla','Talla (cm)')}{field('peso','Peso (kg)')}
    <div className='small'>IMC: <span className='badge'>{state.bmi||'-'}</span></div>
  </div>
}

function Diagnoses({ encounter }){
  const [list, setList] = useState([])
  const [code, setCode] = useState(''); const [label, setLabel] = useState('')
  const [primary, setPrimary] = useState(false); const [dtype, setDtype] = useState('Impresión Diagnóstica')
  function reload(){ setList(exec(`SELECT * FROM diagnoses WHERE encounter_id=$id`, { $id:encounter.id })) }
  useEffect(()=>{ reload() }, [encounter?.id])
  async function add(){
    if (!code || !label) return alert('CIE-10 código + nombre')
    await run(`INSERT INTO diagnoses (id, encounter_id, code, label, is_primary, diagnosis_type) VALUES ($id,$e,$c,$l,$p,$t)`,
      { $id:crypto.randomUUID(), $e:encounter.id, $c:code, $l:label, $p:primary?1:0, $t:dtype })
    setCode(''); setLabel(''); setPrimary(false); reload()
  }
  async function del(id){ await run(`DELETE FROM diagnoses WHERE id=$id`, { $id:id }); reload() }
  return <div>
    <div className='row'>
      <label>Código CIE-10<input value={code} onChange={e=>setCode(e.target.value)} placeholder='M43.6' /></label>
      <label>Nombre<input value={label} onChange={e=>setLabel(e.target.value)} placeholder='Tortícolis' /></label>
      <label>Tipo<select value={dtype} onChange={e=>setDtype(e.target.value)}>
          <option value='Impresión'>1 - Impresión Diagnóstica</option>
          <option value='Confirmado Nuevo'>2 - Confirmado Nuevo</option>
          <option value='Confirmado Repetido'>3 - Confirmado Repetido</option>
      </select></label>
      <label className="inline-center no-grow self-center">
        <input
          type="checkbox"
          checked={primary}
          onChange={e => setPrimary(e.target.checked)}
        />
        Principal
      </label>
    </div>
    <div className='row' style={{ marginTop: 12 }} ></div>
    <button onClick={add}>Agregar</button>
    <hr/>
    <ul>
      {list.map(dx => <li key={dx.id}>{dx.is_primary? 'Principal':'Secundario'} — {dx.code} {dx.label} ({dx.diagnosis_type}) <button className='ghost' onClick={()=>del(dx.id)}>Eliminar</button></li>)}
    </ul>
  </div>
}

function Prescriptions({ encounter }){
  const [list,setList]=useState([])
  const [rx,setRx]=useState({ active_ingredient:'', presentation:'', concentration:'', dose:'', route:'VO', frequency:'', duration_days:'', quantity_total:'', repeats:'', indications:'', warnings:'' })
  function reload(){ setList(exec(`SELECT * FROM prescriptions WHERE encounter_id=$id`, { $id:encounter.id })) }
  useEffect(()=>{ reload() }, [encounter?.id])
  async function add(){
    if (!rx.active_ingredient) return alert('Principio activo requerido')
    await run(`INSERT INTO prescriptions (id, encounter_id, active_ingredient, presentation, concentration, dose, route, frequency, duration_days, quantity_total, repeats, indications, warnings, substitution_allowed)
      VALUES ($id,$e,$a,$p,$c,$d,$r,$f,$du,$qt,$re,$in,$w,0)`, {
      $id:crypto.randomUUID(), $e:encounter.id, $a:rx.active_ingredient, $p:rx.presentation, $c:rx.concentration, $d:rx.dose,
      $r:rx.route, $f:rx.frequency, $du:parseInt(rx.duration_days||'0',10), $qt:rx.quantity_total, $re:parseInt(rx.repeats||'0',10),
      $in:rx.indications, $w:rx.warnings
    })
    setRx({ active_ingredient:'', presentation:'', concentration:'', dose:'', route:'VO', frequency:'', duration_days:'', quantity_total:'', repeats:'', indications:'', warnings:'' })
    reload()
  }
  async function del(id){ await run(`DELETE FROM prescriptions WHERE id=$id`, { $id:id }); reload() }
  return <div>
    <div className='row'>
      <label>Principio activo<input value={rx.active_ingredient} onChange={e=>setRx({...rx, active_ingredient:e.target.value})} /></label>
      <label>Presentación<input value={rx.presentation} onChange={e=>setRx({...rx, presentation:e.target.value})} /></label>
      <label>Concentración<input value={rx.concentration} onChange={e=>setRx({...rx, concentration:e.target.value})} /></label>
      <label>Dosis<input value={rx.dose} onChange={e=>setRx({...rx, dose:e.target.value})} /></label>
      <label>Vía<select value={rx.route} onChange={e=>setRx({...rx, route:e.target.value})}>
        <option>VO</option><option>IM</option><option>IV</option><option>SC</option><option>Tópica</option><option>SL</option>
      </select></label>
      <label>Frecuencia<input value={rx.frequency} onChange={e=>setRx({...rx, frequency:e.target.value})} /></label>
      <label>Duración (días)<input value={rx.duration_days} onChange={e=>setRx({...rx, duration_days:e.target.value})} /></label>
      <label>Cantidad total<input value={rx.quantity_total} onChange={e=>setRx({...rx, quantity_total:e.target.value})} /></label>
      <label>Repeticiones<input value={rx.repeats} onChange={e=>setRx({...rx, repeats:e.target.value})} /></label>
    </div>
    <label>Indicaciones<textarea value={rx.indications} onChange={e=>setRx({...rx, indications:e.target.value})} /></label>
    <label>Advertencias<textarea value={rx.warnings} onChange={e=>setRx({...rx, warnings:e.target.value})} /></label>
    <div className='row' style={{ marginTop: 12 }} ></div>  
    <button onClick={add}>Agregar</button>
    <hr/>
    <ul>
      {list.map(it => <li key={it.id}>{it.active_ingredient} — {it.dose} {it.route} {it.frequency} ({it.duration_days} días) <button className='ghost' onClick={()=>del(it.id)}>Eliminar</button></li>)}
    </ul>
  </div>
}

function Procedures({ encounter }){
  const [list,setList]=useState([])
  const [pr,setPr]=useState({ name:'', code:'', technique:'', anatomical_site:'', materials:'', dose_per_site:'', lot_number:'', lot_expiry:'', responsible:'', consent_obtained:false })
  function reload(){ setList(exec(`SELECT * FROM procedures WHERE encounter_id=$id`, { $id:encounter.id })) }
  useEffect(()=>{ reload() }, [encounter?.id])
  async function add(){
    if (!pr.name) return alert('Nombre del procedimiento')
    await run(`INSERT INTO procedures (id, encounter_id, name, code, technique, anatomical_site, materials, dose_per_site, lot_number, lot_expiry, responsible, consent_obtained)
      VALUES ($id,$e,$n,$c,$t,$a,$m,$d,$l,$x,$r,$co)`, {
      $id:crypto.randomUUID(), $e:encounter.id, $n:pr.name, $c:pr.code, $t:pr.technique, $a:pr.anatomical_site, $m:pr.materials,
      $d:pr.dose_per_site, $l:pr.lot_number, $x:pr.lot_expiry, $r:pr.responsible, $co:pr.consent_obtained?1:0
    })
    setPr({ name:'', code:'', technique:'', anatomical_site:'', materials:'', dose_per_site:'', lot_number:'', lot_expiry:'', responsible:'', consent_obtained:false })
    reload()
  }
  async function del(id){ await run(`DELETE FROM procedures WHERE id=$id`, { $id:id }); reload() }
  return <div>
    <div className='row'>
      <label>Nombre<input value={pr.name} onChange={e=>setPr({...pr, name:e.target.value})} /></label>
      <label>Código (CUPS)<input value={pr.code} onChange={e=>setPr({...pr, code:e.target.value})} /></label>
      <label>Sitio anatómico<input value={pr.anatomical_site} onChange={e=>setPr({...pr, anatomical_site:e.target.value})} /></label>
    </div>
    <div className='row'>
      <label>Técnica<input value={pr.technique} onChange={e=>setPr({...pr, technique:e.target.value})} /></label>
      <label>Materiales/insumos<input value={pr.materials} onChange={e=>setPr({...pr, materials:e.target.value})} /></label>
      <label>Dosis por sitio<input value={pr.dose_per_site} onChange={e=>setPr({...pr, dose_per_site:e.target.value})} /></label>
    </div>
    <div className='row'>
      <label>Lote<input value={pr.lot_number} onChange={e=>setPr({...pr, lot_number:e.target.value})} /></label>
      <label>Vencimiento<input value={pr.lot_expiry} onChange={e=>setPr({...pr, lot_expiry:e.target.value})} /></label>
      <label>Responsable<input value={pr.responsible} onChange={e=>setPr({...pr, responsible:e.target.value})} /></label>
      <label className="inline-center no-grow">
        <input type="checkbox" checked={pr.consent_obtained}
              onChange={e=>setPr({...pr, consent_obtained:e.target.checked})}/>
        Consentimiento obtenido
      </label>
    </div>
    <div className='row' style={{ marginTop: 12 }} ></div>
    <button onClick={add}>Agregar</button>
    <hr/>
    <ul>
      {list.map(it => <li key={it.id}>{it.name} {it.code?`(${it.code})`:''} — Sitio: {it.anatomical_site||'-'} — Lote: {it.lot_number||'-'} <button className='ghost' onClick={()=>del(it.id)}>Eliminar</button></li>)}
    </ul>
  </div>
}

function generateCAS(){
  const k='cas_seq', n = parseInt(localStorage.getItem(k) || '0', 10) + 1
  localStorage.setItem(k, String(n))
  return `CAS-${String(n).padStart(6,'0')}`
}
