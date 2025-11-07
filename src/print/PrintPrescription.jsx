import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { openDb, exec } from "../db/index.js";
import doctor from "../config/doctor.json";
import logo from "../config/FullColor.png";

/** ISO → yyyy-mm-dd */
function formatYMD(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

/** dd-mm-yyyy hh:mm:ss for footer (if needed later) */
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

/** Add days to ISO date */
function addDays(iso, days) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Compute quantity for a chunk of days */
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

/**
 * Build copies:
 * - If max duration <= 30: single formula (1 copy)
 * - If > 30: multiple copies in blocks of 30 days
 *   labeled with renewal dates.
 */
function buildCopies(prescriptions, encounter) {
  if (!prescriptions.length || !encounter?.occurred_at) return [];

  const durations = prescriptions.map(
    (p) => Number(p.duration_days || 0) || 0
  );
  const maxDuration = Math.max(...durations, 0);
  const startIso = encounter.occurred_at;

  // <= 30 days → one copy
  if (!maxDuration || maxDuration <= 30) {
    const items = prescriptions.map((p) => {
      const days = Number(p.duration_days || 0) || 0;
      const total = computeChunkTotal(p, days);
      return {
        name: p.active_ingredient || p.name || "",
        dose: p.dose || p.cantidad || "",
        freq: p.frequency || "",
        days,
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

  // > 30 days → multiple 30-day blocks
  const copies = [];
  const numCopies = Math.ceil(maxDuration / 30);

  for (let i = 0; i < numCopies; i++) {
    const isFirst = i === 0;
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

  // Track print lifecycle
  const printingStartedRef = useRef(false);
  const navigatedRef = useRef(false);

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

      // Auto-print once content is ready
      setTimeout(() => {
        printingStartedRef.current = true;
        window.print();
      }, 400);
    });
  }, [encounterId]);

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

    window.addEventListener("afterprint", handleAfterPrint);

    // Fallback: matchMedia("print")
    const mql = window.matchMedia
      ? window.matchMedia("print")
      : null;

    const handleMediaChange = (e) => {
      if (printingStartedRef.current && !e.matches) {
        goBackOnce();
      }
    };

    if (mql) {
      if (mql.addEventListener) {
        mql.addEventListener("change", handleMediaChange);
      } else if (mql.addListener) {
        mql.addListener(handleMediaChange);
      }
    }

    // Fallback: focus after print dialog
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
            pageBreakAfter:
              idx === copies.length - 1 ? "auto" : "always",
            fontSize: "13px",
          }}
        >
          {/* Doctor header: info left, logo right */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: "8px",
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "6px",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "1.4rem",
              }}
            >
              FÓRMULA MÉDICA
            </h1>
            <div>Fecha: {copy.labelDate}</div>
          </div>

          {/* Patient & encounter info */}
          <div
            style={{
              marginTop: "4px",
              marginBottom: "10px",
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
            <div>
              <strong>Teléfono:</strong>{" "}
              {patient.phone || "-"}{" "}
              <strong>Género:</strong>{" "}
              {patient.sex || "-"}{" "}
              <strong>Fecha nacimiento:</strong>{" "}
              {patient.birth_date || "-"}
            </div>
            <div>
              <strong>Fecha y hora de atención:</strong>{" "}
              {formatYMD(encounter.occurred_at)}
            </div>
            <div>
              <strong>CAS:</strong>{" "}
              {encounter.cas_code || "-"}
            </div>
            {principalDx && (
              <div>
                <strong>Diagnóstico principal:</strong>{" "}
                {principalDx.code}{" "}
                {principalDx.label}
              </div>
            )}
          </div>

          <hr />

          {/* Prescription body */}
          {copy.items.length === 0 ? (
            <div style={{ marginTop: "12px" }}>
              <em>
                No hay medicamentos registrados para esta
                fórmula.
              </em>
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
                    {it.total !== "" &&
                      `(# ${it.total})`}
                  </div>
                  <div>
                    {it.dose && it.freq && it.days ? (
                      <>
                        Usar{" "}
                        <strong>{it.dose}</strong>{" "}
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
                            — cantidad total
                            estimada:{" "}
                            <strong>
                              {it.total}
                            </strong>
                          </>
                        )}
                        .
                      </>
                    ) : (
                      <>
                        Posología según indicación
                        médica.
                      </>
                    )}
                    {it.indications && (
                      <> Indicaciones: {it.indications}</>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "24px" }}>
            <div>
              ______________________________
            </div>
            <div>
              Firma y sello del profesional
            </div>
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "10px",
              color: "#555",
            }}
          >
            Esta fórmula es válida únicamente con firma
            del profesional tratante. Cada copia
            corresponde al período de tratamiento
            indicado para renovación de la medicación.
          </div>
        </div>
      ))}
    </div>
  );
}
