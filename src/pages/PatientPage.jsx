import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { openDb, exec, run, persistNow } from "../db/index.js";
import {
  nowIso,
  fullName,
  isoToBogotaInput,
  bogotaInputToIso,
  getEncounterLabel,
} from "../utils.js";
import Diagnoses from "../components/Diagnoses.jsx";
import Prescriptions from "../components/Prescriptions.jsx";
import Procedures from "../components/Procedures.jsx";
import Modal from "../components/Modal.jsx";

const isElectron =
  typeof window !== "undefined" && !!window.electronAPI;

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [activeEncounterId, setActiveEncounterId] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [showNoRxModal, setShowNoRxModal] = useState(false);

  // counters to mark sections empty/full
  const [counts, setCounts] = useState({ dx: 0, rx: 0, pr: 0, at: 0 });

  // Load patient + encounters
  useEffect(() => {
    openDb().then(async () => {
      const p =
        exec(`SELECT * FROM patients WHERE id=$id`, {
          $id: patientId,
        })[0] || null;

      const e = exec(
        `SELECT * FROM encounters WHERE patient_id=$id ORDER BY occurred_at DESC`,
        { $id: patientId }
      );

      setPatient(p);
      setEncounters(e);

      // Check URL param first
      const urlEncounterId = new URLSearchParams(location.search).get("encounterId");
      if (urlEncounterId && e.find(enc => enc.id === urlEncounterId)) {
        setActiveEncounterId(urlEncounterId);
      } else if (e.length) {
        setActiveEncounterId(e[0].id);
      } else if (p) {
        createNewEncounter(p);
      }
    });
  }, [patientId, location.search]);

  // Load active encounter + counts
  useEffect(() => {
    if (!activeEncounterId) return;

    const e =
      exec(`SELECT * FROM encounters WHERE id=$id`, {
        $id: activeEncounterId,
      })[0] || null;
    if (!e) return;

    setEncounter(e);

    const dx =
      exec(
        `SELECT COUNT(1) c FROM diagnoses WHERE encounter_id=$id`,
        { $id: activeEncounterId }
      )[0]?.c ?? 0;

    const rx =
      exec(
        `SELECT COUNT(1) c FROM prescriptions WHERE encounter_id=$id`,
        { $id: activeEncounterId }
      )[0]?.c ?? 0;

    const pr =
      exec(
        `SELECT COUNT(1) c FROM procedures WHERE encounter_id=$id`,
        { $id: activeEncounterId }
      )[0]?.c ?? 0;

    const at =
      exec(
        `SELECT COUNT(1) c FROM attachments WHERE encounter_id=$id AND attachment_type='procedure_file'`,
        { $id: activeEncounterId }
      )[0]?.c ?? 0;

    setCounts({
      dx: Number(dx),
      rx: Number(rx),
      pr: Number(pr),
      at: Number(at),
    });
  }, [activeEncounterId]);

  function createNewEncounter(p) {
    const id = crypto.randomUUID();
    const base = {
      id,
      patient_id: p.id,
      cas_code: generateCAS(),
      encounter_type: "first_visit",
      objective:
        "Atencion de usuario, evaluacion, diagnostico y tratamiento",
      occurred_at: nowIso(),
      chief_complaint: "",
      hpi: "",
      antecedentes: "",
      physical_exam: "",
      vitals_json: "",
      impression: "",
      plan: "",
      status: "open",
      created_by: "clinico",
      created_at: nowIso(),
      updated_at: nowIso(),
    };

    run(
      `INSERT INTO encounters (
        id, patient_id, cas_code, encounter_type, objective,
        occurred_at, chief_complaint, hpi, antecedentes,
        physical_exam, vitals_json, impression, plan,
        status, created_by, created_at, updated_at
      )
      VALUES (
        $id,$pid,$cas,$type,$obj,
        $occ,$cc,$hpi,$ant,
        $pe,$vitals,$imp,$plan,
        'open','clinico',$ca,$ua
      )`,
      {
        $id: base.id,
        $pid: base.patient_id,
        $cas: base.cas_code,
        $type: base.encounter_type,
        $obj: base.objective,
        $occ: base.occurred_at,
        $cc: "",
        $hpi: "",
        $ant: "",
        $pe: "",
        $vitals: "",
        $imp: "",
        $plan: "",
        $ca: base.created_at,
        $ua: base.updated_at,
      }
    );

    const e =
      exec(`SELECT * FROM encounters WHERE id=$id`, {
        $id: id,
      })[0] || null;

    if (!e) return;

    setEncounters((prev) => [e, ...prev]);
    setActiveEncounterId(id);
  }

  if (!patient || !encounter) {
    return (
      <div className="container">
        <div className="card">Cargando...</div>
      </div>
    );
  }

  // Sync check: don't render if encounter doesn't match active ID (prevents stale data in defaultValues)
  if (!encounter || encounter.id !== activeEncounterId) {
    return (
      <div className="container">
        <div className="card">Cargando atención...</div>
      </div>
    );
  }

  // --- empty flags for warnings ---
  const vitEmpty = (() => {
    try {
      const v = encounter.vitals_json
        ? JSON.parse(encounter.vitals_json)
        : {};
      return (
        !v.taS &&
        !v.taD &&
        !v.fc &&
        !v.fr &&
        !v.temp &&
        !v.spo2 &&
        !v.talla &&
        !v.peso
      );
    } catch {
      return true;
    }
  })();

  const patientInfoEmpty = ![
    patient.phone,
    patient.email,
    patient.address,
    patient.city,
  ].some((s) => String(s || "").trim());

  const empties = {
    datos: patientInfoEmpty,
    motivo: !String(encounter.chief_complaint || "").trim(),
    enfermedad: !String(encounter.hpi || "").trim(),
    antecedentes: !String(encounter.antecedentes || "").trim(),
    vitales: vitEmpty,
    examen: !String(encounter.physical_exam || "").trim(),
    analisis: !String(encounter.impression || "").trim(),
    plan: !String(encounter.plan || "").trim(),
    dx: counts.dx === 0,
    rx: counts.rx === 0,
    pr: counts.pr === 0,
    at: counts.at === 0,
  };

  // key so that when encounter changes, SectionCards remount and defaultOpen recomputes
  const sectionKey = activeEncounterId;
  const isMinorProc = encounter.encounter_type === 'minor_procedure';

  return (
    <div className="container">
      {/* Toolbar */}
      <div className="card toolbar">
        <div data-testid="existing-patient-summary">
          <div className="kicker">Paciente</div>
          <div>
            <strong>{fullName(patient)}</strong> —{" "}
            {patient.document_type} {patient.document_number}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: "8px" }}>
          <Link to="/">
            <button className="ghost" data-testid="btn-back-home">
              Volver al inicio
            </button>
          </Link>

          {/* Exportar PDF sólo en escritorio */}
          <button
            className="secondary"
            onClick={async () => {
              await persistNow();
              navigate(
                "/print/" +
                patient.id +
                "?mode=pdf" +
                (activeEncounterId ? "&encounterId=" + activeEncounterId : "")
              );
            }}
            data-testid="btn-export-history"
          >
            Exportar historia
          </button>


          {/* Fórmula médica solo del encuentro activo */}
          {activeEncounterId && (
            <button
              onClick={() => {
                if (!activeEncounterId) return;
                const r = exec(
                  `SELECT COUNT(1) c FROM prescriptions WHERE encounter_id=$id`,
                  { $id: activeEncounterId }
                );
                const count = Number(r[0]?.c || 0);
                if (!count) {
                  setShowNoRxModal(true);
                  return;
                }
                navigate(
                  "/rx/" +
                  activeEncounterId +
                  (isElectron ? "?mode=pdf" : "")
                );
              }}
              data-testid="btn-export-rx"
            >
              Exportar fórmula médica
            </button>
          )}
        </div>
      </div>

      {/* Encounter header */}
      <div className="card">
        <div className="row">
          <label>
            Atención
            <select
              value={activeEncounterId || ""}
              onChange={(e) => {
                if (e.target.value === "__new__") {
                  createNewEncounter(patient);
                } else {
                  setActiveEncounterId(e.target.value);
                  navigate("?encounterId=" + e.target.value, { replace: true });
                }
              }}
              data-testid="select-encounter"
            >
              <option value="__new__">➕ Nueva atención</option>
              {encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {isoToBogotaInput(e.occurred_at).replace("T", " ")} —{" "}
                  {e.cas_code} ({getEncounterLabel(e.encounter_type)})
                </option>
              ))}
            </select>
          </label>

          <label>
            Tipo
            <select
              value={encounter.encounter_type}
              onChange={async (e) => {
                const v = e.target.value;
                await run(
                  `UPDATE encounters SET encounter_type=$v, updated_at=$ua WHERE id=$id`,
                  { $v: v, $id: encounter.id, $ua: nowIso() }
                );
                setEncounter({ ...encounter, encounter_type: v });
              }}
              data-testid="select-encounter-type"
            >
              <option value="first_visit">Primera vez / ingreso</option>
              <option value="follow_up">Control / seguimiento</option>
              <option value="minor_procedure">Procedimientos menores</option>
            </select>
          </label>

          <label>
            Fecha/hora
            <input
              type="datetime-local"
              step="60"
              value={isoToBogotaInput(encounter.occurred_at)}
              onChange={async (e) => {
                const newIso = bogotaInputToIso(e.target.value);
                await run(
                  `UPDATE encounters SET occurred_at=$v, updated_at=$ua WHERE id=$id`,
                  { $v: newIso, $id: encounter.id, $ua: nowIso() }
                );
                setEncounter({ ...encounter, occurred_at: newIso });
              }}
              data-testid="input-encounter-date"
            />
          </label>

          <label>
            CAS
            <input
              defaultValue={encounter.cas_code || ""}
              onBlur={async (e) => {
                const v = e.target.value;
                await run(
                  `UPDATE encounters SET cas_code=$v, updated_at=$ua WHERE id=$id`,
                  { $v: v, $id: encounter.id, $ua: nowIso() }
                );
                setEncounter({ ...encounter, cas_code: v });
              }}
            />
          </label>
        </div>
      </div>

      {/* Sections (remount on encounter change for defaultOpen) */}
      <div key={sectionKey}>
        {/* 1. Datos del paciente (Always shown) */}
        <SectionCard
          title="Datos del paciente"
          empty={empties.datos}
          defaultOpen={!empties.datos}
          data-testid="section-patient-data"
        >
          <PatientFields patient={patient} setPatient={setPatient} />
        </SectionCard>

        {/* Standard Sections (Hidden for Minor Procedures) */}
        {!isMinorProc && (
          <>
            <SectionCard
              title="Motivo de consulta"
              empty={empties.motivo}
              defaultOpen={!empties.motivo}
              data-testid="section-chief-complaint"
            >
              <TextAreaAuto
                encounter={encounter}
                field="chief_complaint"
                label="Motivo de consulta"
                setEncounter={setEncounter}
                data-testid="input-chief-complaint"
              />
            </SectionCard>

            <SectionCard
              title="Enfermedad actual"
              empty={empties.enfermedad}
              defaultOpen={!empties.enfermedad}
              data-testid="section-hpi"
            >
              <TextAreaAuto
                encounter={encounter}
                field="hpi"
                label="Enfermedad actual (HPI)"
                setEncounter={setEncounter}
                data-testid="input-hpi"
              />
            </SectionCard>

            <SectionCard
              title="Antecedentes"
              empty={empties.antecedentes}
              defaultOpen={!empties.antecedentes}
            >
              <TextAreaAuto
                encounter={encounter}
                field="antecedentes"
                label="Antecedentes"
                setEncounter={setEncounter}
              />
            </SectionCard>

            <SectionCard
              title="Signos vitales"
              empty={empties.vitales}
              defaultOpen={!empties.vitales}
              data-testid="section-vitals"
            >
              <Vitals encounter={encounter} setEncounter={setEncounter} />
            </SectionCard>

            <SectionCard
              title="Examen físico"
              empty={empties.examen}
              defaultOpen={!empties.examen}
              data-testid="section-physical-exam"
            >
              <TextAreaAuto
                encounter={encounter}
                field="physical_exam"
                label="Examen físico"
                setEncounter={setEncounter}
                data-testid="input-physical-exam"
              />
            </SectionCard>

            <SectionCard
              title="Análisis"
              empty={empties.analisis}
              defaultOpen={!empties.analisis}
              data-testid="section-analysis"
            >
              <TextAreaAuto
                encounter={encounter}
                field="impression"
                label="Análisis"
                setEncounter={setEncounter}
                data-testid="input-analysis"
              />
            </SectionCard>

            <SectionCard
              title="Plan / Conducta"
              empty={empties.plan}
              defaultOpen={!empties.plan}
              data-testid="section-plan"
            >
              <TextAreaAuto
                encounter={encounter}
                field="plan"
                label="Plan"
                setEncounter={setEncounter}
                data-testid="input-plan"
              />
            </SectionCard>

            <SectionCard
              title="Diagnósticos (CIE-10)"
              empty={empties.dx}
              defaultOpen={!empties.dx}
            >
              <Diagnoses
                encounter={encounter}
                onCountChange={(n) =>
                  setCounts((c) => ({ ...c, dx: n }))
                }
              />
            </SectionCard>
          </>
        )}

        {/* Procedimientos (Only for Minor Procedures) */}
        {isMinorProc && (
          <SectionCard
            title="Procedimientos"
            empty={empties.pr}
            defaultOpen={!empties.pr}
            data-testid="section-procedures"
          >
            <Procedures
              encounter={encounter}
              mode="procedures_only"
              onCountChange={(n) =>
                setCounts((c) => ({ ...c, pr: n }))
              }
            />
          </SectionCard>
        )}

        {/* Diagnósticos (Also for Minor Procedures now) */}
        {isMinorProc && (
          <SectionCard
            title="Diagnósticos (CIE-10)"
            empty={empties.dx}
            defaultOpen={!empties.dx}
          >
            <Diagnoses
              encounter={encounter}
              onCountChange={(n) =>
                setCounts((c) => ({ ...c, dx: n }))
              }
            />
          </SectionCard>
        )}

        {/* Adjuntos (Only for Minor Procedures) */}
        {isMinorProc && (
          <SectionCard
            title="Adjuntos"
            empty={empties.at}
            defaultOpen={!empties.at}
          >
            <Procedures
              encounter={encounter}
              mode="attachments_only"
              onCountChange={(n) =>
                setCounts((c) => ({ ...c, at: n }))
              }
            />
          </SectionCard>
        )}

        {/* Remove the placeholder Adjuntos card if I'm using Procedures.jsx for it. 
            Actually, let's just use Procedures.jsx. It has the attachments.
            I will remove the explicit "Adjuntos" SectionCard I added in the previous turn (or that was there).
        */}

        {/* Fórmula médica (Always shown or at least for Minor Proc too) */}
        <SectionCard
          title="Fórmula médica"
          empty={empties.rx}
          defaultOpen={!empties.rx}
        >
          <Prescriptions
            encounter={encounter}
            onCountChange={(n) =>
              setCounts((c) => ({ ...c, rx: n }))
            }
          />
        </SectionCard>
      </div>

      {
        showNoRxModal && (
          <Modal
            title="Fórmula vacía"
            onClose={() => setShowNoRxModal(false)}
          >
            No hay medicamentos registrados en la fórmula médica para esta
            atención.
          </Modal>
        )
      }
    </div >
  );
}

import PatientFields from "../components/PatientFields.jsx";
import SectionCard from "../components/SectionCard.jsx";
import TextAreaAuto from "../components/TextAreaAuto.jsx";
import Vitals from "../components/Vitals.jsx";

function generateCAS() {
  const k = "cas_seq";
  const n = parseInt(localStorage.getItem(k) || "0", 10) + 1;
  localStorage.setItem(k, String(n));
  return `CAS-${String(n).padStart(6, "0")}`;
}
