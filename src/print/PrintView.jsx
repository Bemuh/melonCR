import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { openDb, exec } from "../db/index.js";
import { isoToBogotaText } from "../utils.js";
import doctor from "../config/doctor.json";
import logo from "../config/FullColor.png";

export default function PrintView() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [encounters, setEncounters] = useState([]);

  // Fixed timestamp for this print job
  const [printedAt] = useState(() => formatPrintDateTime(new Date()));

  // Track print lifecycle to support browser + desktop exe
  const printingStartedRef = useRef(false);
  const navigatedRef = useRef(false);

  // Load data and trigger print
  useEffect(() => {
    openDb().then(() => {
      const p =
        exec(
          `SELECT * FROM patients WHERE id=$id`,
          { $id: patientId }
        )[0] || null;

      const e = exec(
        `SELECT * FROM encounters WHERE patient_id=$id ORDER BY occurred_at ASC`,
        { $id: patientId }
      );

      setPatient(p);
      setEncounters(e || []);

      // Give React a moment to render before invoking print
      setTimeout(() => {
        printingStartedRef.current = true;
        window.print();
      }, 400);
    });
  }, [patientId]);

  // After printing (or closing dialog), navigate back once
  useEffect(() => {
    const goBackOnce = () => {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      navigate(-1);
    };

    const handleAfterPrint = () => {
      if (printingStartedRef.current) {
        goBackOnce();
      }
    };

    // Some environments fire this reliably
    window.addEventListener("afterprint", handleAfterPrint);

    // Fallback: matchMedia(print)
    const mql = window.matchMedia
      ? window.matchMedia("print")
      : null;

    const handleMediaChange = (e) => {
      // when e.matches goes from true -> false, printing ended
      if (printingStartedRef.current && !e.matches) {
        goBackOnce();
      }
    };

    if (mql) {
      if (mql.addEventListener) {
        mql.addEventListener("change", handleMediaChange);
      } else if (mql.addListener) {
        // older API
        mql.addListener(handleMediaChange);
      }
    }

    // Extra fallback: when window regains focus after starting print
    const handleFocus = () => {
      if (printingStartedRef.current && !navigatedRef.current) {
        goBackOnce();
      }
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("afterprint", handleAfterPrint);
      window.removeEventListener("focus", handleFocus);
      if (mql) {
        if (mql.removeEventListener) {
          mql.removeEventListener("change", handleMediaChange);
        } else if (mql.removeListener) {
          mql.removeListener(handleMediaChange);
        }
      }
    };
  }, [navigate]);

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
        {/* Doctor header: info left, logo right */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "12px",
          }}
        >
          <div>
            {doctor.name && (
              <div
                style={{
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                {doctor.name}
              </div>
            )}
            {doctor.specialty && <div>{doctor.specialty}</div>}
            {doctor.professionalId && (
              <div>{doctor.professionalId}</div>
            )}
            {doctor.address && <div>{doctor.address}</div>}
            {doctor.phone && <div>{doctor.phone}</div>}
          </div>
          {logo && (
            <img
              src={logo}
              alt={doctor.name || "Logo"}
              style={{ height: "112px", objectFit: "contain" }}
            />
          )}
        </div>

        {/* Title */}
        <h1 style={{ marginTop: 0 }}>Historia Clínica</h1>

        {/* Patient info below title */}
        <div
          style={{
            marginTop: "4px",
            marginBottom: "12px",
            fontSize: "0.95rem",
          }}
        >
          <div>
            <strong>Paciente:</strong>{" "}
            {patient.first_name} {patient.last_name}
          </div>
          <div>
            <strong>Documento:</strong>{" "}
            {patient.document_type} {patient.document_number}
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

        {/* All encounters */}
        {encounters.map((e) => (
          <EncounterBlock key={e.id} e={e} />
        ))}
      </div>

      {/* Footer: timestamp only (page X/Y handled via CSS counters) */}
      <div className="print-footer" style={{ fontSize: "9px", color: "#444" }}>
        Impreso: {printedAt}
      </div>
    </div>
  );
}

function EncounterBlock({ e }) {
  const vit = e.vitals_json ? JSON.parse(e.vitals_json) : {};

  const rows = exec(
    `SELECT * FROM diagnoses WHERE encounter_id=$id ORDER BY is_primary DESC`,
    { $id: e.id }
  );
  const principal = rows.find((r) => r.is_primary === 1);
  const rel = rows.filter((r) => !r.is_primary);

  const hasDx =
    (principal && principal.code && principal.label) ||
    rel.some((r) => r.code && r.label);

  const hasRx =
    exec(
      `SELECT COUNT(1) c FROM prescriptions WHERE encounter_id=$id`,
      { $id: e.id }
    )[0]?.c > 0;

  const hasPr =
    exec(
      `SELECT COUNT(1) c FROM procedures WHERE encounter_id=$id`,
      { $id: e.id }
    )[0]?.c > 0;

  return (
    <div
      style={{
        marginBottom: "14px",
        pageBreakInside: "avoid",
      }}
    >
      <h2>
        {isoToBogotaText(e.occurred_at)} — {e.cas_code} —{" "}
        {labelType(e.encounter_type)}
      </h2>

      {e.chief_complaint && (
        <Section
          title="Motivo de consulta"
          text={e.chief_complaint}
        />
      )}

      {e.hpi && (
        <Section
          title="Enfermedad actual"
          text={e.hpi}
        />
      )}

      {e.antecedentes && (
        <Section
          title="Antecedentes"
          text={e.antecedentes}
        />
      )}

      {vit && (vit.taS || vit.taD || vit.fc || vit.fr || vit.temp || vit.spo2 || vit.talla || vit.peso || vit.bmi) && (
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

      {e.physical_exam && (
        <Section
          title="Examen físico"
          text={e.physical_exam}
        />
      )}

      {e.impression && (
        <Section
          title="Análisis"
          text={e.impression}
        />
      )}

      {e.plan && (
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

      {hasRx && <Prescriptions encounterId={e.id} />}

      {hasPr && e.encounter_type === "minor_procedure" && (
        <Procedures encounterId={e.id} />
      )}

      <hr />
    </div>
  );
}

function DiagnosticosPrint({ principal, relacionados, e }) {
  const tipo =
    principal?.diagnosis_type ||
    relacionados[0]?.diagnosis_type ||
    "";

  if (
    !principal &&
    !relacionados.some((r) => r.code && r.label) &&
    !e.finalidad_consulta &&
    !e.causa_externa
  ) {
    return null;
  }

  return (
    <div style={{ margin: "6px 0" }}>
      <strong>Diagnósticos</strong>
      {principal && principal.code && principal.label && (
        <div>
          Diagnóstico principal: {principal.code} {principal.label}
        </div>
      )}
      {relacionados[0] && relacionados[0].code && relacionados[0].label && (
        <div>
          Relacionado 1: {relacionados[0].code} {relacionados[0].label}
        </div>
      )}
      {relacionados[1] && relacionados[1].code && relacionados[1].label && (
        <div>
          Relacionado 2: {relacionados[1].code} {relacionados[1].label}
        </div>
      )}
      {relacionados[2] && relacionados[2].code && relacionados[2].label && (
        <div>
          Relacionado 3: {relacionados[2].code} {relacionados[2].label}
        </div>
      )}
      {tipo && <div>Tipo de diagnóstico: {tipo}</div>}
      {e.finalidad_consulta && (
        <div>Finalidad consulta: {e.finalidad_consulta}</div>
      )}
      {e.causa_externa && (
        <div>Causa externa: {e.causa_externa}</div>
      )}
    </div>
  );
}

function Section({ title, text }) {
  if (!String(text || "").trim()) return null;
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>
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
      `SELECT * FROM prescriptions WHERE encounter_id=$id`,
      { $id: encounterId }
    );
    setRows(r);
  }, [encounterId]);

  if (!rows.length) return null;

  return (
    <div>
      <strong>Fórmula médica</strong>
      <ul>
        {rows.map((rx) => {
          const total = rx.quantity_total;
          const freq = rx.frequency;
          const days = rx.duration_days;

          const partes = [];
          if (rx.dose) partes.push(`${rx.dose}`);
          if (freq) partes.push(`cada ${freq} horas`);
          if (days)
            partes.push(
              `durante ${days} día${
                Number(days) === 1 ? "" : "s"
              }`
            );

          const frase =
            partes.length > 0
              ? `Usar ${partes.join(" ")}.`
              : "";

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
                  ` Indicaciones: ${rx.indications}`}
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
      `SELECT * FROM procedures WHERE encounter_id=$id`,
      { $id: encounterId }
    );
    setRows(r);
  }, [encounterId]);

  if (!rows.length) return null;

  return (
    <div>
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

/** dd-mm-yyyy hh:mm:ss */
function formatPrintDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}
