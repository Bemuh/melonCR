#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Builds a minimal icd10.json (Spanish CIE-10) from a CSV like:
code,code_0,code_1,code_2,code_3,code_4,description,level,source

- Keeps only individual codes (skips ranges like "A00-B99").
- Normalizes codes by removing dots (e.g., "J06.9" -> "J069").
- Preserves accents/ñ/á/etc.
- Outputs: public/data/icd10.json as [{"code":"A09","label":"..."}...]

Usage:
  python scripts/build_cie10_json.py --in data-src/cie-10.csv --out public/data/icd10.json
"""
import argparse
import csv
import json
import os
import re
from pathlib import Path

RANGE_RE = re.compile(r".+-.+")              # e.g. "A00-B99"
CODE_RE  = re.compile(r"^[A-Z][0-9A-Z.]{2,7}$")  # simple sanity check for codes

def normalize_code(raw: str) -> str:
    # Uppercase, strip spaces/non-breaking spaces, remove dots
    c = (raw or "").strip().upper().replace("\u00A0", "").replace(" ", "")
    c = c.replace(".", "")
    return c

def is_code_row(code: str) -> bool:
    if not code:
        return False
    s = code.strip().upper()
    if RANGE_RE.fullmatch(s):      # skip ranges like "A00-B99"
        return False
    return bool(CODE_RE.fullmatch(s))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True, help="Path to CIE-10 CSV")
    ap.add_argument("--out", dest="out", default="public/data/icd10.json", help="Output JSON path")
    args = ap.parse_args()

    src_path = Path(args.src)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    seen = set()

    with src_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            raw_code = (r.get("code") or "").strip()
            desc = (r.get("description") or "").strip()
            # collapse internal whitespace: multiple spaces, tabs, etc.
            desc = " ".join(desc.split())

            if not is_code_row(raw_code):
                continue

            code = normalize_code(raw_code)
            if not code:
                continue

            # Deduplicate by normalized code; keep first occurrence
            if code in seen:
                continue

            rows.append({"code": code, "label": desc})
            seen.add(code)

    rows.sort(key=lambda x: (x["code"]))
    with out_path.open("w", encoding="utf-8") as out:
        json.dump(rows, out, ensure_ascii=False)

    print(f"Wrote {len(rows)} CIE-10 entries → {out_path}")

if __name__ == "__main__":
    main()
