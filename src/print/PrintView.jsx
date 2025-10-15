import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { openDb, exec } from '../db/index.js'
import { isoToBogotaText } from '../utils.js'

export default function PrintView(){
  const { patientId } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [encounters, setEncounters] = useState([])

  useEffect(() => {
    openDb().then(() => {
      const p = exec(`SELECT * FROM patients WHERE id=$id`, { $id:patientId })[0]
      const e = exec(`SELECT * FROM encounters WHERE patient_id=$id ORDER BY occurred_at ASC`, { $id:patientId })
      setPatient(p); setEncounters(e)
      // Print after the page renders, then go back automatically
      setTimeout(() => window.print(), 300)
    })
  }, [patientId])

  useEffect(() => {
    const goBack = () => navigate(-1)
    window.addEventListener('afterprint', goBack)
    return () => window.removeEventListener('afterprint', goBack)
  }, [navigate])

  if (!patient) return <div className='container'>Cargando...</div>

  return (
    <div className='print-page'>
      <div style={{padding:'16px'}}>
        <h1>Historia Clínica — {patient.first_name} {patient.last_name}</h1>
        <div className='small'>Documento: {patient.document_type} {patient.document_number}</div>
        <hr/>
        {encounters.map(e => <EncounterBlock key={e.id} e={e} />)}
      </div>
    </div>
  )
}

function EncounterBlock({ e }){
  const vit = e.vitals_json ? JSON.parse(e.vitals_json) : {}
  return (
    <div style={{marginBottom:'14px', pageBreakInside:'avoid'}}>
      {/* Date formatted for Bogotá and only up to minutes */}
      <h2>{isoToBogotaText(e.occurred_at)} — {e.cas_code} — {labelType(e.encounter_type)}</h2>
      {e.objective && <div><strong>Objetivo:</strong> {e.objective}</div>}
      {e.chief_complaint && <Section title='Motivo de consulta' text={e.chief_complaint} />}
      {e.hpi && <Section title='Enfermedad actual' text={e.hpi} />}
      {e.antecedentes && <Section title='Antecedentes' text={e.antecedentes} />}
      {e.physical_exam && <Section title='Examen físico' text={e.physical_exam} />}
      {vit && (vit.taS||vit.talla) && (
        <Section
          title='Signos vitales'
          text={
            'TA ' + (vit.taS||'-') + '/' + (vit.taD||'-') +
            ' FC ' + (vit.fc||'-') +
            ' FR ' + (vit.fr||'-') +
            ' Temp ' + (vit.temp||'-') +
            ' SatO₂ ' + (vit.spo2||'-') +
            ' Talla ' + (vit.talla||'-') +
            ' Peso ' + (vit.peso||'-') +
            ' IMC ' + (vit.bmi||'-')
          }
        />
      )}
      <Diagnoses encounterId={e.id} />
      {e.plan && <Section title='Plan / Conducta' text={e.plan} />}
      <Prescriptions encounterId={e.id} />
      <Procedures encounterId={e.id} />
      <hr/>
    </div>
  )
}

function Section({ title, text }) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{whiteSpace:'pre-wrap'}}>{text}</div>
    </div>
  )
}

function labelType(t){
  return t==='first_visit' ? 'Primera vez/ingreso'
       : t==='follow_up'   ? 'Control/seguimiento'
       : 'Procedimiento menor'
}

function Diagnoses({ encounterId }){
  const [rows, setRows] = useState([])
  useEffect(()=>{ setRows(exec(`SELECT * FROM diagnoses WHERE encounter_id=$id`, { $id:encounterId })) }, [encounterId])
  if (!rows.length) return null
  return (
    <div>
      <strong>Diagnósticos (CIE-10)</strong>
      <ul>{rows.map(dx => <li key={dx.id}>{dx.is_primary? 'Principal':'Secundario'} — {dx.code} {dx.label} ({dx.diagnosis_type})</li>)}</ul>
    </div>
  )
}

function Prescriptions({ encounterId }){
  const [rows, setRows] = useState([])
  useEffect(()=>{ setRows(exec(`SELECT * FROM prescriptions WHERE encounter_id=$id`, { $id:encounterId })) }, [encounterId])
  if (!rows.length) return null
  return (
    <div>
      <strong>Fórmula médica</strong>
      <ul>{rows.map(rx => <li key={rx.id}>{rx.active_ingredient} {rx.presentation||''} {rx.concentration||''} — {rx.dose} {rx.route} {rx.frequency} {rx.duration_days?('('+rx.duration_days+' días)'):''}</li>)}</ul>
    </div>
  )
}

function Procedures({ encounterId }){
  const [rows, setRows] = useState([])
  useEffect(()=>{ setRows(exec(`SELECT * FROM procedures WHERE encounter_id=$id`, { $id:encounterId })) }, [encounterId])
  if (!rows.length) return null
  return (
    <div>
      <strong>Procedimientos</strong>
      <ul>{rows.map(pr => <li key={pr.id}>{pr.name} {pr.code?('('+pr.code+')'):''} — Sitio {pr.anatomical_site||'-'} — Lote {pr.lot_number||'-'} {pr.consent_obtained?'(consentimiento: Sí)':'(consentimiento: No)'}</li>)}</ul>
    </div>
  )
}
