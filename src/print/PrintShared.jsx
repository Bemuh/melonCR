// src/print/PrintShared.jsx
import doctor from "../config/doctor.json";
import logo from "../config/FullColor.png";

/**
 * Common doctor header for print views.
 * Renders doctor info on the left and logo on the right.
 */
export function DoctorHeader({ marginBottom = 12 }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: `${marginBottom}px`,
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
        {doctor.professionalId && <div>{doctor.professionalId}</div>}
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
  );
}

/** ISO → yyyy-mm-dd */
export function formatYMD(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

/** dd-mm-yyyy hh:mm:ss for printed footer / timestamps */
export function formatPrintDateTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  const dd = pad(d.getDate());
  const mm = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}
