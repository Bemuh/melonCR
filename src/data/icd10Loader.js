import data from "/./public/data/icd10.json";

let cache = null;

/**
 * Load ICD-10 list.
 * Works in web build and desktop exe (no network fetch).
 * Exposes items as:
 *   { code: "A001", label: "Descripción..." }
 */
export async function loadICD10() {
  if (cache) return cache;

  cache = (data || [])
    .map((it) => {
      const rawCode = it.code || it.codigo || "";
      const rawLabel =
        it.label ||
        it.description ||
        it.nombre ||
        "";
      const code = String(rawCode)
        .replace(".", "")
        .toUpperCase()
        .trim();
      const label = String(rawLabel)
        .trim();
      if (!code || !label) return null;
      return { code, label };
    })
    .filter(Boolean);

  return cache;
}
