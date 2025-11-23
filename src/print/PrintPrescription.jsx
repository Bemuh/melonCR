import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { openDb, exec } from "../db/index.js";
import Modal from "../components/Modal.jsx";
import {
  DoctorHeader,
  formatYMD,
  formatPrintDateTime,
  DoctorFooter
} from "./PrintShared.jsx";
import { getEncounterLabel } from "../utils.js";

const isElectron =
  typeof window !== "undefined" && !!window.electronAPI;

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
  const location = useLocation();

  const [patient, setPatient] = useState(null);
  const [encounter, setEncounter] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [diagnoses, setDiagnoses] = useState([]);
  const [modal, setModal] = useState({
    open: false,
    title: "",
    content: "",
    onConfirm: null,
  });

  function showModal({ title, content }) {
    setModal({ open: true, title, content, onConfirm: () => setModal({ ...modal, open: false }) });
  }

  // Fixed timestamp for this print job (footer)
  const [printedAt] = useState(() =>
    formatPrintDateTime(new Date())
  );

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

      const searchParams = new URLSearchParams(location.search);
      const isPdfExport =
        isElectron && searchParams.get("mode") === "pdf";

      if (isPdfExport && window.electronAPI?.exportHistoryPdf) {
        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 5).replace(":", "");
        const typeLabel = getEncounterLabel(enc.encounter_type).replace(/\//g, '-').replace(/\s+/g, '_');
        const dateLabel = enc.occurred_at.slice(0, 10);
        const filename = `Formula_${pat?.document_number || "Doc"}_${pat?.first_name}_${pat?.last_name}_${dateLabel}_${typeLabel}.pdf`;

        window.electronAPI
          .exportHistoryPdf({
            suggestedName: filename,
          })
          .then(() => {
            navigate(-1);
          })
          .catch((err) => {
            console.error("Error exportando PDF:", err);
            showModal({
              title: "Error de exportación",
              content: "No se pudo exportar la fórmula a PDF.",
            });
            navigate(-1);
          });
      } else {
        setTimeout(() => window.print(), 400);
      }
    });
  }, [encounterId, location.search, navigate]);

  // After printing, go back to previous screen
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isPdfExport =
      isElectron && searchParams.get("mode") === "pdf";

    if (isPdfExport) return;

    const onAfter = () => navigate(-1);
    window.addEventListener("afterprint", onAfter);
    return () => window.removeEventListener("afterprint", onAfter);
  }, [navigate, location.search]);

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
              idx === copies.length - 1
                ? "auto"
                : "always",
            fontSize: "13px",
            minHeight: "95vh",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ flex: 1 }}>
            {/* Shared doctor header */}
            <DoctorHeader marginBottom={8} />

            {/* Title + date */}
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
              data-testid="print-rx-patient-info"
            >
              <div>
                <strong data-testid="print-rx-patient-name">Paciente:</strong>{" "}
                {patient.first_name}{" "}
                {patient.last_name}
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
                {formatYMD(
                  encounter.occurred_at
                )}
              </div>
              <div>
                <strong>CAS:</strong>{" "}
                {encounter.cas_code || "-"}
              </div>
              {principalDx && (
                <div>
                  <strong>
                    Diagnóstico principal:
                  </strong>{" "}
                  {principalDx.code}{" "}
                  {principalDx.label}
                </div>
              )}
            </div>

            <hr />

            {/* Prescription body */}
            {copy.items.length === 0 ? (
              <div
                style={{ marginTop: "12px" }}
              >
                <em>
                  No hay medicamentos
                  registrados para esta
                  fórmula.
                </em>
              </div>
            ) : (
              <div
                style={{ marginTop: "10px" }}
              >
                {copy.items.map(
                  (it, i) => (
                    <div
                      key={i}
                      style={{
                        marginBottom:
                          "6px",
                        lineHeight: 1.4,
                      }}
                      data-testid="print-rx-item"
                    >
                      <div>
                        <strong>
                          {it.name}
                        </strong>{" "}
                        {it.total !==
                          "" &&
                          `(# ${it.total})`}
                      </div>
                      <div>
                        {it.dose &&
                          it.freq &&
                          it.days ? (
                          <>
                            Usar{" "}
                            <strong>
                              {it.dose}
                            </strong>{" "}
                            cada{" "}
                            <strong>
                              {it.freq}{" "}
                              horas
                            </strong>{" "}
                            durante{" "}
                            <strong>
                              {it.days}{" "}
                              día
                              {it.days >
                                1
                                ? "s"
                                : ""}
                            </strong>
                            {it.total !==
                              "" && (
                                <>
                                  {" "}
                                  — cantidad
                                  total
                                  estimada:{" "}
                                  <strong>
                                    {
                                      it.total
                                    }
                                  </strong>
                                </>
                              )}
                            .
                          </>
                        ) : (
                          <>
                            Posología
                            según
                            indicación
                            médica.
                          </>
                        )}
                        {it.indications && (
                          <>
                            {" "}
                            Indicaciones:{" "}
                            {
                              it.indications
                            }
                          </>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Footer Section */}
          <DoctorFooter>
            <div
              style={{
                marginTop: "8px",
                fontSize: "10px",
                color: "#555",
              }}
            >
              Esta fórmula es válida
              únicamente con firma del
              profesional tratante. Cada
              copia corresponde al
              período de tratamiento
              indicado para renovación de
              la medicación.
            </div>
          </DoctorFooter>
        </div>
      ))}

      <div className="print-footer-text">
        Generado el {printedAt}
      </div>

      {modal.open && (
        <Modal
          title={modal.title}
          onClose={modal.onConfirm}
        >
          {modal.content}
        </Modal>
      )}
    </div>
  );
}
