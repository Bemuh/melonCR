import React, { useEffect, useState } from "react";
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
  const [printedAt] = useState(() =>
    formatPrintDateTime(new Date())
  );

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

      setTimeout(() => window.print(), 400);
    });
  }, [patientId]);

  // After printing, go back to previous screen
  useEffect(() => {
    const onAfter = () => navigate(-1);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
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
            {patient.document_type}{" "}
            {patient.document_number}
          </div>
          {patient.phone && (
            <div>
              <strong>Teléfono:</strong>{" "}
              {patient.phone}
            </div>
          )}
          {patient.sex && (
            <div>
              <strong>Género:</strong>{" "}
              {patient.sex}
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

        {/* Encounters in order, sections filtered with data */}
        {encounters.map((e) => (
          <EncounterBlock key={e.id} e={e} />
        ))}
      </div>

      {/* Footer: timestamp (page X de Y handled via CSS) */}
      <div
        className="print-footer"
        style={{ fontSize: "9px", color: "#444" }}
      >
        Impreso: {printedAt}
      </div>
    </div>
  );
}

function EncounterBlock({ e }) {
  const vit = e.vitals_json
    ? JSON.parse(e.vitals_json)
    : {};

  const rows = exec(
    `SELECT * FROM diagnoses WHERE encounter_id=$id ORDER BY is_primary DESC`,
    { $id: e.id }
  );
  const principal = rows.find((r) => r.is_primary === 1);
  const rel = rows.filter((r) => !r.is_primary);

  // Helper: non-empty text
  const has = (v) => String(v || "").trim().length > 0;

  // Any vitals
  const hasVitals =
    vit &&
    (vit.taS ||
      vit.taD ||
      vit.fc ||
      vit.fr ||
      vit.temp ||
      vit.spo2 ||
      vit.talla ||
      vit.peso);

  // Any prescriptions / procedures will be handled inside their components

  return (
    <div
      style={{
        marginBottom: "14px",
        pageBreakInside: "avoid",
      }}
    >
      <h2>
        {isoToBogotaText(e.occurred_at)} —{" "}
        {e.cas_code} —{" "}
        {labelType(e.encounter_type)}
      </h2>

      {/* ORDERED SECTIONS WITH DATA ONLY */}

      {/* 2. Motivo de consulta */}
      {has(e.chief_complaint) && (
        <Section
          title="Motivo de consulta"
          text={e.chief_complaint}
        />
      )}

      {/* 3. Enfermedad actual */}
      {has(e.hpi) && (
        <Section
          title="Enfermedad actual"
          text={e.hpi}
        />
      )}

      {/* 4. Antecedentes */}
      {has(e.antecedentes) && (
        <Section
          title="Antecedentes"
          text={e.antecedentes}
        />
      )}

      {/* 5. Signos vitales */}
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

      {/* 6. Examen físico */}
      {has(e.physical_exam) && (
        <Section
          title="Examen físico"
          text={e.physical_exam}
        />
      )}

      {/* 7. Análisis */}
      {has(e.impression) && (
        <Section
          title="Análisis"
          text={e.impression}
        />
      )}

      {/* 8. Plan / Conducta */}
      {has(e.plan) && (
        <Section
          title="Plan / Conducta"
          text={e.plan}
        />
      )}

      {/* 9. Diagnósticos */}
      <DiagnosticosPrint
        principal={principal}
        relacionados={rel}
        e={e}
      />

      {/* 10. Fórmula médica */}
      <Prescriptions encounterId={e.id} />

      {/* Procedimientos only if minor_procedure and has rows */}
      {e.encounter_type === "minor_procedure" && (
        <Procedures encounterId={e.id} />
      )}

      <hr />
    </div>
  );
}

function DiagnosticosPrint({ principal, relacionados, e }) {
  const hasPrincipal =
    principal &&
    (principal.code || principal.label);

  const hasR1 =
    relacionados[0] &&
    (relacionados[0].code ||
      relacionados[0].label);
  const hasR2 =
    relacionados[1] &&
    (relacionados[1].code ||
      relacionados[1].label);
  const hasR3 =
    relacionados[2] &&
    (relacionados[2].code ||
      relacionados[2].label);

  const hasFinalidad = String(
    e.finalidad_consulta || ""
  ).trim().length > 0;
  const hasCausa = String(
    e.causa_externa || ""
  ).trim().length > 0;

  // If nothing meaningful, don't render the block
  if (
    !hasPrincipal &&
    !hasR1 &&
    !hasR2 &&
    !hasR3 &&
    !hasFinalidad &&
    !hasCausa
  ) {
    return null;
  }

  const tipo =
    principal?.diagnosis_type ||
    relacionados[0]?.diagnosis_type ||
    "-";

  return (
    <div style={{ margin: "6px 0" }}>
      <strong>Diagnósticos</strong>
      {hasPrincipal && (
        <div>
          Diagnóstico principal:{" "}
          {principal.code}{" "}
          {principal.label}
        </div>
      )}
      {hasR1 && (
        <div>
          Relacionado 1:{" "}
          {relacionados[0].code}{" "}
          {relacionados[0].label}
        </div>
      )}
      {hasR2 && (
        <div>
          Relacionado 2:{" "}
          {relacionados[1].code}{" "}
          {relacionados[1].label}
        </div>
      )}
      {hasR3 && (
        <div>
          Relacionado 3:{" "}
          {relacionados[2].code}{" "}
          {relacionados[2].label}
        </div>
      )}
      {(hasPrincipal ||
        hasR1 ||
        hasR2 ||
        hasR3) && (
        <div>
          Tipo de diagnóstico:{" "}
          {tipo}
        </div>
      )}
      {hasFinalidad && (
        <div>
          Finalidad consulta:{" "}
          {e.finalidad_consulta}
        </div>
      )}
      {hasCausa && (
        <div>
          Causa externa:{" "}
          {e.causa_externa}
        </div>
      )}
    </div>
  );
}

function Section({ title, text }) {
  return (
    <div>
      <strong>{title}</strong>
      <div style={{ whiteSpace: "pre-wrap" }}>
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

          const parts = [];
          if (rx.dose) parts.push(rx.dose);
          if (freq) parts.push(`cada ${freq} horas`);
          if (days)
            parts.push(
              `durante ${days} día${
                Number(days) === 1 ? "" : "s"
              }`
            );

          const frase =
            parts.length > 0
              ? `Usar ${parts.join(" ")}.`
              : "";

          return (
            <li key={rx.id} style={{ marginBottom: 4 }}>
              <div>
                <strong>
                  {rx.active_ingredient}
                </strong>
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
            {pr.name}{" "}
            {pr.code
              ? `(${pr.code})`
              : ""}{" "}
            — Sitio{" "}
            {pr.anatomical_site ||
              "-"}{" "}
            — Lote{" "}
            {pr.lot_number ||
              "-"}{" "}
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
  const pad = (n) =>
    String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}
