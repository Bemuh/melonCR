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

      if (e.length) {
        setActiveEncounterId(e[0].id);
      } else if (p) {
        createNewEncounter(p);
      }
    });
  }, [patientId]);

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
        <div>
          <div className="kicker">Paciente</div>
          <div>
            <strong>{fullName(patient)}</strong> —{" "}
            {patient.document_type} {patient.document_number}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: "8px" }}>
          <Link to="/">
            <button className="ghost">Volver al inicio</button>
          </Link>

          {/* Exportar PDF sólo en escritorio */}
          {isElectron && (
            <button
              className="secondary"
              onClick={() => navigate("/print/" + patient.id + "?mode=pdf" + (activeEncounterId ? "&encounterId=" + activeEncounterId : ""))}
            >
              Exportar historia
            </button>
          )}

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
              onChange={(e) =>
                e.target.value === "__new__"
                  ? createNewEncounter(patient)
                  : setActiveEncounterId(e.target.value)
              }
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
            >
              <TextAreaAuto
                encounter={encounter}
                field="chief_complaint"
                label="Motivo de consulta"
                setEncounter={setEncounter}
              />
            </SectionCard>

            <SectionCard
              title="Enfermedad actual"
              empty={empties.enfermedad}
              defaultOpen={!empties.enfermedad}
            >
              <TextAreaAuto
                encounter={encounter}
                field="hpi"
                label="Enfermedad actual (HPI)"
                setEncounter={setEncounter}
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
            >
              <Vitals encounter={encounter} setEncounter={setEncounter} />
            </SectionCard>

            <SectionCard
              title="Examen físico"
              empty={empties.examen}
              defaultOpen={!empties.examen}
            >
              <TextAreaAuto
                encounter={encounter}
                field="physical_exam"
                label="Examen físico"
                setEncounter={setEncounter}
              />
            </SectionCard>

            <SectionCard
              title="Análisis"
              empty={empties.analisis}
              defaultOpen={!empties.analisis}
            >
              <TextAreaAuto
                encounter={encounter}
                field="impression"
                label="Análisis"
                setEncounter={setEncounter}
              />
            </SectionCard>

            <SectionCard
              title="Plan / Conducta"
              empty={empties.plan}
              defaultOpen={!empties.plan}
            >
              <TextAreaAuto
                encounter={encounter}
                field="plan"
                label="Plan"
                setEncounter={setEncounter}
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

// ----- UI helpers -----
function SectionCard({
  title,
  children,
  defaultOpen = false,
  empty = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="card">
      <button
        type="button"
        className="collapser"
        aria-expanded={open}
        onClick={async () => {
          setOpen((o) => !o);
          await persistNow();
        }}
      >
        <span className="caret">{open ? "▾" : "▸"}</span>
        <h2 className="section-title">
          {title}
          {empty && (
            <span
              className="warn-badge"
              title="Sección sin completar"
            />
          )}
        </h2>
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

function PatientFields({ patient, setPatient }) {
  return (
    <div className="row">
      <label>
        Teléfono
        <input
          defaultValue={patient.phone || ""}
          onBlur={async (e) => {
            const v = e.target.value;
            await run(
              `UPDATE patients SET phone=$v, updated_at=$ua WHERE id=$id`,
              { $v: v, $id: patient.id, $ua: nowIso() }
            );
            setPatient({ ...patient, phone: v });
          }}
        />
      </label>
      <label>
        Email
        <input
          defaultValue={patient.email || ""}
          onBlur={async (e) => {
            const v = e.target.value;
            await run(
              `UPDATE patients SET email=$v, updated_at=$ua WHERE id=$id`,
              { $v: v, $id: patient.id, $ua: nowIso() }
            );
            setPatient({ ...patient, email: v });
          }}
        />
      </label>
      <label>
        Dirección
        <input
          defaultValue={patient.address || ""}
          onBlur={async (e) => {
            const v = e.target.value;
            await run(
              `UPDATE patients SET address=$v, updated_at=$ua WHERE id=$id`,
              { $v: v, $id: patient.id, $ua: nowIso() }
            );
            setPatient({ ...patient, address: v });
          }}
        />
      </label>
      <label>
        Ciudad
        <input
          defaultValue={patient.city || ""}
          onBlur={async (e) => {
            const v = e.target.value;
            await run(
              `UPDATE patients SET city=$v, updated_at=$ua WHERE id=$id`,
              { $v: v, $id: patient.id, $ua: nowIso() }
            );
            setPatient({ ...patient, city: v });
          }}
        />
      </label>
    </div>
  );
}

function TextAreaAuto({ encounter, setEncounter, field, label }) {
  return (
    <label>
      {label}
      <textarea
        defaultValue={encounter[field] || ""}
        onBlur={async (e) => {
          const v = e.target.value;
          await run(
            `UPDATE encounters SET ${field}=$v, updated_at=$ua WHERE id=$id`,
            { $v: v, $id: encounter.id, $ua: nowIso() }
          );
          setEncounter({ ...encounter, [field]: v });
        }}
      />
    </label>
  );
}

function Vitals({ encounter, setEncounter }) {
  const v = encounter.vitals_json ? JSON.parse(encounter.vitals_json) : {};
  const [state, setState] = useState({
    taS: v.taS || "",
    taD: v.taD || "",
    fc: v.fc || "",
    fr: v.fr || "",
    temp: v.temp || "",
    spo2: v.spo2 || "",
    talla: v.talla || "",
    peso: v.peso || "",
    bmi: v.bmi || "",
  });

  function calcBMI(next) {
    const talla = Number(next.talla || state.talla || 0);
    const peso = Number(next.peso || state.peso || 0);
    return peso && talla
      ? (peso / (talla / 100) ** 2).toFixed(1)
      : "";
  }

  async function save(next) {
    const data = { ...state, ...next };
    data.bmi = calcBMI(next);
    await run(
      `UPDATE encounters SET vitals_json=$v, updated_at=$ua WHERE id=$id`,
      {
        $v: JSON.stringify(data),
        $id: encounter.id,
        $ua: nowIso(),
      }
    );
    setState(data);
    setEncounter({
      ...encounter,
      vitals_json: JSON.stringify(data),
    });
  }

  function field(name, labelText) {
    return (
      <label>
        {labelText}
        <input
          defaultValue={state[name]}
          onBlur={(e) => save({ [name]: e.target.value })}
        />
      </label>
    );
  }

  return (
    <div className="row">
      {field("taS", "TA Sistólica")}
      {field("taD", "TA Diastólica")}
      {field("fc", "FC")}
      {field("fr", "FR")}
      {field("temp", "Temperatura °C")}
      {field("spo2", "SatO₂ %")}
      {field("talla", "Talla (cm)")}
      {field("peso", "Peso (kg)")}
      <div className="small">
        IMC: <span className="badge">{state.bmi || "-"}</span>
      </div>
    </div>
  );
}

function generateCAS() {
  const k = "cas_seq";
  const n = parseInt(localStorage.getItem(k) || "0", 10) + 1;
  localStorage.setItem(k, String(n));
  return `CAS-${String(n).padStart(6, "0")}`;
}
