let cache;
export async function loadICD10() {
  if (cache) return cache;
  const res = await fetch('/data/icd10.json'); // file lives in public/data/icd10.json
  cache = await res.json();
  return cache;
}
