import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { openDb, exec } from "../db/index.js";
import doctor from "../config/doctor.json";

// Helper: ISO → yyyy-mm-dd (local date portion)
function formatYMD(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

// Helper: add days to ISO date
function addDays(iso, days) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// Compute quantity for a given chunk of days
function computeChunkTotal(p, days) {
  const base =
    parseFloat(p.dose || p.quantity || p.cantidad || 0) || 0; // cantidad por toma
  const freq = parseFloat(p.frequency || 0) || 0; // horas entre tomas
  if (!base || !freq || !days) {
    return p.quantity_total ? Number(p.quantity_total) : "";
  }
  const perDay = 24 / freq;
  const total = base * perDay * days;
  return Math.round(total * 100) / 100;
}

// Build copies of the formula based on 30-day blocks.
// Copies share all header data; each copy shows only meds
// that still have días restantes in that block.
function buildCopies(prescriptions, encounter) {
  if (!prescriptions.length || !encounter?.occurred_at) return [];

  const durations = prescriptions.map(
    (p) => Number(p.duration_days || 0) || 0
  );
  const maxDuration = Math.max(...durations, 0);
  const startIso = encounter.occurred_at;

  if (!maxDuration || maxDuration <= 30) {
    // Single formula
    const items = prescriptions.map((p) => {
      const total = computeChunkTotal(
        p,
        Number(p.duration_days || 0) || 0
      );
      return {
        name: p.active_ingredient || p.name || "",
        dose: p.dose || p.cantidad || "",
        freq: p.frequency || "",
        days: Number(p.duration_days || 0) || "",
        total,
        indications: p.indications || "",
      };
    });

    return [
      {
        labelDate: formatYMD(startIso),
        items,
      },
    ];
  }

  const copies = [];
  const numCopies = Math.ceil(maxDuration / 30);

  for (let i = 0; i < numCopies; i++) {
    const isFirst = i === 0;
    // Example rule:
    // copy 0 label = start date
    // copy 1 label = start + (30*1 - 1) days
    // copy 2 label = start + (30*2 - 1) days, etc.
    const offset = isFirst ? 0 : 30 * i - 1;
    const labelDate = formatYMD(addDays(startIso, offset));

    const items = [];

    prescriptions.forEach((p) => {
      const fullDuration = Number(p.duration_days || 0) || 0;
      const remaining = fullDuration - 30 * i;
      if (remaining <= 0) return;

      const daysChunk = Math.min(30, remaining);
      const total = computeChunkTotal(p, daysChunk);

      items.push({
        name: p.active_ingredient || p.name || "",
        dose: p.dose || p.cantidad || "",
        freq: p.frequency || "",
        days: daysChunk,
        total,
        indications: p.indications || "",
      });
    });

    if (items.length) {
      copies.push({ labelDate, items });
    }
  }

  return copies;
}

export default function PrintPrescription() {
  const { encounterId } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);

  useEffect(() => {
    openDb().then(() => {
      const enc =
        exec(
          `SELECT * FROM encounters WHERE id=$id`,
          { $id: encounterId }
        )[0] || null;
      if (!enc) return;

      const pat =
        exec(
          `SELECT * FROM patients WHERE id=$id`,
          { $id: enc.patient_id }
        )[0] || null;

      const rx = exec(
        `SELECT * FROM prescriptions WHERE encounter_id=$id`,
        { $id: encounterId }
      );

      const dx = exec(
        `SELECT * FROM diagnoses WHERE encounter_id=$id ORDER BY is_primary DESC`,
        { $id: encounterId }
      );

      setEncounter(enc);
      setPatient(pat || null);
      setPrescriptions(rx || []);
      setDiagnoses(dx || []);

      // Print automatically once data is ready
      setTimeout(() => window.print(), 400);
    });
  }, [encounterId]);

  useEffect(() => {
    const onAfter = () => navigate(-1);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, [navigate]);

  if (!encounter || !patient) {
    return (
      <div className="container">
        <div className="card">Cargando fórmula médica…</div>
      </div>
    );
  }

  const copies = buildCopies(prescriptions, encounter);

  const principalDx =
    diagnoses.find((d) => d.is_primary === 1) || diagnoses[0] || null;

  return (
    <div className="print-page">
      {copies.map((copy, idx) => (
        <div
          key={idx}
          style={{
            padding: "16px",
            pageBreakAfter: idx === copies.length - 1 ? "auto" : "always",
            fontSize: "13px",
          }}
        >
          {/* Header with doctor & title */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "12px",
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                {doctor.name}
              </div>
              {doctor.specialty && (
                <div>{doctor.specialty}</div>
              )}
              {doctor.professionalId && (
                <div>{doctor.professionalId}</div>
              )}
              {doctor.address && (
                <div>{doctor.address}</div>
              )}
              {doctor.phone && (
                <div>{doctor.phone}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontWeight: "bold",
                  textTransform: "uppercase",
                }}
              >
                FÓRMULA MÉDICA
              </div>
              <div>Fecha: {copy.labelDate}</div>
            </div>
          </div>

          <hr />

          {/* Patient + encounter info */}
          <div style={{ marginTop: "6px", marginBottom: "6px" }}>
            <div>
              <strong>Paciente:</strong>{" "}
              {patient.first_name} {patient.last_name}
            </div>
            <div>
              <strong>Documento:</strong>{" "}
              {patient.document_type} {patient.document_number}
            </div>
            <div>
              <strong>Teléfono:</strong>{" "}
              {patient.phone || "-"}
              {"   "}
              <strong>Género:</strong>{" "}
              {patient.sex || "-"}
              {"   "}
              <strong>Fecha nacimiento:</strong>{" "}
              {patient.birth_date || "-"}
            </div>
          </div>

          <div style={{ marginBottom: "6px" }}>
            <div>
              <strong>Fecha y hora de atención:</strong>{" "}
              {formatYMD(encounter.occurred_at)}
            </div>
            <div>
              <strong>CAS:</strong>{" "}
              {encounter.cas_code || "-"}
            </div>
            {/* <div>
              <strong>Diagnóstico principal:</strong>{" "}
              {principalDx
                ? `${principalDx.code} ${principalDx.label}`
                : "-"}
            </div> */}
          </div>

          <hr />

          {/* Prescription body */}
          {copy.items.length === 0 ? (
            <div style={{ marginTop: "12px" }}>
              <em>No hay medicamentos registrados para esta fórmula.</em>
            </div>
          ) : (
            <div style={{ marginTop: "10px" }}>
              {copy.items.map((it, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: "6px",
                    lineHeight: 1.4,
                  }}
                >
                  <div>
                    <strong>{it.name}</strong>{" "}
                    {it.total !== "" && `(# ${it.total})`}
                  </div>
                  <div>
                    {/* Clear Spanish wording */}
                    {it.dose && it.freq && it.days ? (
                      <>
                        Usar{" "}
                        <strong>
                          {it.dose}
                        </strong>{" "}
                        cada{" "}
                        <strong>
                          {it.freq} horas
                        </strong>{" "}
                        durante{" "}
                        <strong>
                          {it.days} día
                          {it.days > 1 ? "s" : ""}
                        </strong>
                        {it.total !== "" && (
                          <>
                            {" "}
                            — cantidad total estimada:{" "}
                            <strong>{it.total}</strong>
                          </>
                        )}
                        .
                      </>
                    ) : (
                      <>Posología según indicación médica.</>
                    )}
                    {it.indications && (
                      <>
                        {" "}
                        Indicaciones: {it.indications}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "24px" }}>
            <div>______________________________</div>
            <div>Firma y sello del profesional</div>
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "10px",
              color: "#555",
            }}
          >
            Esta fórmula es válida únicamente con firma del
            profesional tratante. Cada copia corresponde al
            período de tratamiento indicado para renovación de la
            medicación.
          </div>
        </div>
      ))}
    </div>
  );
}
