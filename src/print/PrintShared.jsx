import doctor from "../config/doctor.json";
import logo from "../config/FullColor.png";
import firma from "../config/firma.PNG";

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

/**
 * Standard footer with signature and doctor info.
 */
export function DoctorFooter({ marginBottom = 0 }) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: '20px', marginBottom: marginBottom, pageBreakInside: 'avoid' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src={firma}
          alt="Firma"
          style={{ height: '80px', objectFit: 'contain', marginBottom: '-10px' }}
          onError={(e) => e.target.style.display = 'none'}
        />
        <div style={{ width: '250px', borderBottom: '1px solid #000', marginBottom: '4px' }}></div>
        <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.9rem' }}>{doctor.name}</div>
        <div style={{ fontSize: '0.85rem' }}>{doctor.specialty}</div>
        <div style={{ fontSize: '0.85rem' }}>{doctor.professionalId}</div>
      </div>
    </div>
  );
}
