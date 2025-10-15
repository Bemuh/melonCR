export function uid() {
  return (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now();
}

export function nowIso() {
  return new Date().toISOString();
}

export function fullName(p) {
  return `${p.first_name || ''} ${p.last_name || ''}`.trim();
}

/** Timezone helpers — Bogotá GMT-5 */
export const TZ_BOGOTA = 'America/Bogota';

// For inputs (datetime-local) – returns "YYYY-MM-DDTHH:MM" in GMT-5
export function isoToBogotaInput(iso) {
  const d = iso ? new Date(iso) : new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BOGOTA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// From "YYYY-MM-DDTHH:MM" in Bogotá to ISO UTC
export function bogotaInputToIso(input) {
  const [date, time] = input.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh + 5, mm); // GMT-5 → UTC
  return new Date(utcMs).toISOString();
}

// For printing – returns "DD-MM-YYYY HH:MM" in GMT-5
export function isoToBogotaText(iso) {
  const d = iso ? new Date(iso) : new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_BOGOTA,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  // -> "DD-MM-YYYY HH:MM"
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
}
