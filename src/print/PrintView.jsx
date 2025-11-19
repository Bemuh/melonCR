// src/print/PrintView.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { openDb, exec } from "../db/index.js";
import Modal from "../components/Modal.jsx";
import { isoToBogotaText } from "../utils.js";
import { DoctorHeader, formatPrintDateTime } from "./PrintShared.jsx";

const isElectron =
  typeof window !== "undefined" && !!window.electronAPI;

export default function PrintView() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: "",
    onConfirm: null,
  });

  function showModal({ title, content }) {
    setModal({ open: true, title, content, onConfirm: () => setModal({ ...modal, open: false }) });
  }

  // Timestamp fijo para este trabajo de impresión (por si luego se usa en footer)
  const [printedAt] = useState(() => formatPrintDateTime(new Date()));

  const searchParams = new URLSearchParams(location.search);
  const isPdfExport =
    isElectron && searchParams.get("mode") === "pdf";

  // Carga de datos
  useEffect(() => {
    openDb().then(() => {
      const p =
        exec(`SELECT * FROM patients WHERE id = $id`, {
          $id: patientId,
        })[0] || null;

      const e = exec(
        `SELECT * FROM encounters WHERE patient_id = $id ORDER BY occurred_at ASC`,
        { $id: patientId }
      );

      setPatient(p);
      setEncounters(e || []);
    });
  }, [patientId]);

  // Disparar impresión o exportación a PDF cuando ya hay datos
  useEffect(() => {
    if (!patient) return;

    // Desktop: exportar PDF con Electron
    if (isPdfExport && isElectron && window.electronAPI?.exportHistoryPdf) {
      const suggestedName = `historia_${patient.document_type || "DOC"}_${patient.document_number || patient.id
        }.pdf`;

      window.electronAPI
        .exportHistoryPdf({ suggestedName })
        .then(() => {
          navigate(-1);
        })
        .catch((err) => {
          console.error("Error exportando PDF:", err);
          showModal({
            title: "Error de exportación",
            content: "No se pudo exportar la historia a PDF.",
          });
          navigate(-1);
        });

      return;
    }

    // Navegador: diálogo de impresión del sistema
    const handle = setTimeout(() => window.print(), 400);
    return () => clearTimeout(handle);
  }, [patient, isPdfExport, navigate]);

  // Volver atrás después de imprimir (sólo cuando NO es modo PDF interno)
  useEffect(() => {
    if (isPdfExport) return;

    const onAfter = () => {
      navigate(-1);
    };
    window.addEventListener("afterprint", onAfter);
    return () => {
      window.removeEventListener("afterprint", onAfter);
    };
  }, [navigate, isPdfExport]);

  if (!patient) {
    return (
      <div className="container">
        <div className="card">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="print-page">
      <div style={{ padding: "16px" }}>
        {/* Encabezado compartido médico + logo */}
        <DoctorHeader marginBottom={12} />

        {/* Título */}
        <h1 style={{ marginTop: 0 }}>Historia Clínica</h1>

        {/* Datos del paciente debajo del título */}
        <div
          style={{
            marginTop: "4px",
            marginBottom: "12px",
            fontSize: "0.95rem",
          }}
        >
          <div>
            <strong>Paciente:</strong> {patient.first_name}{" "}
            {patient.last_name}
          </div>
          <div>
            <strong>Documento:</strong> {patient.document_type}{" "}
            {patient.document_number}
          </div>
          {patient.phone && (
            <div>
              <strong>Teléfono:</strong> {patient.phone}
            </div>
          )}
          {patient.sex && (
            <div>
              <strong>Género:</strong> {patient.sex}
            </div>
          )}
          {patient.birth_date && (
            <div>
              <strong>Fecha de nacimiento:</strong>{" "}
              {patient.birth_date}
            </div>
          )}
        </div>

        <hr />

        {/* Todas las atenciones */}
        {encounters.map((e) => (
          <EncounterBlock key={e.id} e={e} />
        ))}

        {modal.open && (
          <Modal
            title={modal.title}
            onClose={modal.onConfirm}
          >
            {modal.content}
          </Modal>
        )}
      </div>
    </div>
  );
}

function EncounterBlock({ e }) {
  const vit = e.vitals_json ? JSON.parse(e.vitals_json) : {};

  const rows = exec(
    `SELECT * FROM diagnoses WHERE encounter_id = $id ORDER BY is_primary DESC`,
    { $id: e.id }
  );

  // Sólo diagnósticos significativos
  const meaningfulDx = (rows || []).filter((r) => {
    const code = String(r.code || "").trim();
    const label = String(r.label || "").trim();
    return !!(code || label);
  });

  const principal =
    meaningfulDx.find((r) => r.is_primary === 1) || null;
  const rel = meaningfulDx.filter((r) => !r.is_primary);
  const hasDx = meaningfulDx.length > 0;

  // Objetivo por defecto se trata como "vacío" para impresión
  const defaultObjective =
    "Atencion de usuario, evaluacion, diagnostico y tratamiento";
  const objectiveText = String(e.objective || "").trim();
  const hasObjective =
    !!objectiveText && objectiveText !== defaultObjective;

  const hasChief = !!String(e.chief_complaint || "").trim();
  const hasHpi = !!String(e.hpi || "").trim();
  const hasAnt = !!String(e.antecedentes || "").trim();
  const hasPE = !!String(e.physical_exam || "").trim();
  const hasPlan = !!String(e.plan || "").trim();
  const hasImp = !!String(e.impression || "").trim();

  const hasVitals =
    vit &&
    (vit.taS ||
      vit.taD ||
      vit.fc ||
      vit.fr ||
      vit.temp ||
      vit.spo2 ||
      vit.talla ||
      vit.peso ||
      vit.bmi);

  return (
    <div
      style={{
        marginBottom: "14px",
      }}
    >
      <h2>
        {isoToBogotaText(e.occurred_at)} — {e.cas_code} —{" "}
        {labelType(e.encounter_type)}
      </h2>

      {hasObjective && (
        <div className="print-text-block">
          <strong>Objetivo:</strong> {e.objective}
        </div>
      )}

      {hasChief && (
        <Section
          title="Motivo de consulta"
          text={e.chief_complaint}
        />
      )}

      {hasHpi && (
        <Section
          title="Enfermedad actual"
          text={e.hpi}
        />
      )}

      {hasAnt && (
        <Section
          title="Antecedentes"
          text={e.antecedentes}
        />
      )}

      {hasVitals && (
        <Section
          title="Signos vitales"
          text={
            "TA " +
            (vit.taS || "-") +
            "/" +
            (vit.taD || "-") +
            " FC " +
            (vit.fc || "-") +
            " FR " +
            (vit.fr || "-") +
            " Temp " +
            (vit.temp || "-") +
            " SatO₂ " +
            (vit.spo2 || "-") +
            " Talla " +
            (vit.talla || "-") +
            " Peso " +
            (vit.peso || "-") +
            " IMC " +
            (vit.bmi || "-")
          }
        />
      )}

      {hasPE && (
        <Section
          title="Examen físico"
          text={e.physical_exam}
        />
      )}

      {hasImp && (
        <Section
          title="Análisis"
          text={e.impression}
        />
      )}

      {hasPlan && (
        <Section
          title="Plan / Conducta"
          text={e.plan}
        />
      )}

      {hasDx && (
        <DiagnosticosPrint
          principal={principal}
          relacionados={rel}
          e={e}
        />
      )}

      <Prescriptions encounterId={e.id} />
      <Procedures encounterId={e.id} />

      <hr />
    </div>
  );
}

function DiagnosticosPrint({ principal, relacionados, e }) {
  const tipo =
    principal?.diagnosis_type ||
    relacionados[0]?.diagnosis_type ||
    "";

  return (
    <div className="print-text-block" style={{ margin: "6px 0" }}>
      <strong>Diagnósticos</strong>
      {principal && (
        <div>
          Diagnóstico principal: {principal.code}{" "}
          {principal.label}
        </div>
      )}
      {relacionados[0] && (
        <div>
          Relacionado 1: {relacionados[0].code}{" "}
          {relacionados[0].label}
        </div>
      )}
      {relacionados[1] && (
        <div>
          Relacionado 2: {relacionados[1].code}{" "}
          {relacionados[1].label}
        </div>
      )}
      {relacionados[2] && (
        <div>
          Relacionado 3: {relacionados[2].code}{" "}
          {relacionados[2].label}
        </div>
      )}
      {tipo && <div>Tipo de diagnóstico: {tipo}</div>}
      {(e.finalidad_consulta || "").trim() && (
        <div>
          Finalidad consulta: {e.finalidad_consulta}
        </div>
      )}
      {(e.causa_externa || "").trim() && (
        <div>
          Causa externa: {e.causa_externa}
        </div>
      )}
    </div>
  );
}

function Section({ title, text }) {
  if (!String(text || "").trim()) return null;
  return (
    <div className="print-text-block">
      <strong>{title}</strong>
      <div
        className="print-text-block-inner"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {text}
      </div>
    </div>
  );
}

function labelType(t) {
  return t === "first_visit"
    ? "Primera vez/ingreso"
    : t === "follow_up"
      ? "Control/seguimiento"
      : "Procedimiento menor";
}

function Prescriptions({ encounterId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const r = exec(
      `SELECT * FROM prescriptions WHERE encounter_id = $id`,
      { $id: encounterId }
    );
    setRows(r);
  }, [encounterId]);

  if (!rows.length) return null;

  return (
    <div className="print-text-block">
      <strong>Fórmula médica</strong>
      <ul>
        {rows.map((rx) => {
          const total = rx.quantity_total;
          const freq = rx.frequency;
          const days = rx.duration_days;

          const partes = [];
          if (rx.dose) partes.push(`${rx.dose} `);
          if (freq) partes.push(`cada ${freq} horas`);
          if (days)
            partes.push(
              `durante ${days} día${Number(days) === 1 ? "" : "s"} `
            );

          const frase =
            partes.length > 0 ? `Usar ${partes.join(" ")}.` : "";

          return (
            <li key={rx.id} style={{ marginBottom: 4 }}>
              <div>
                <strong>{rx.active_ingredient}</strong>
              </div>
              <div>
                {frase}
                {total &&
                  ` Cantidad total: ${total} unidad(es).`}
                {rx.indications &&
                  ` Indicaciones: ${rx.indications} `}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Procedures({ encounterId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const r = exec(
      `SELECT * FROM procedures WHERE encounter_id = $id`,
      { $id: encounterId }
    );
    setRows(r);
  }, [encounterId]);

  if (!rows.length) return null;

  return (
    <div className="print-text-block">
      <strong>Procedimientos</strong>
      <ul>
        {rows.map((pr) => (
          <li key={pr.id}>
            {pr.name} {pr.code ? `(${pr.code})` : ""} — Sitio{" "}
            {pr.anatomical_site || "-"} — Lote{" "}
            {pr.lot_number || "-"}{" "}
            {pr.consent_obtained
              ? "(consentimiento: Sí)"
              : "(consentimiento: No)"}
          </li>
        ))}
      </ul>
    </div>
  );
}
