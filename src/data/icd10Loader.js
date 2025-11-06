let cache = null;

export async function loadICD10() {
  if (cache) return cache;
  const res = await fetch('/data/icd10.json');
  if (!res.ok) {
    console.error('No se pudo cargar icd10.json');
    cache = [];
    return cache;
  }
  cache = await res.json();
  return cache;
}
