"""Write app-facing datasets to data/processed/, validated against the JSON
Schema generated from the Zod schemas (pnpm gen:schema)."""

import json
from datetime import UTC, datetime
from pathlib import Path

from jsonschema import Draft202012Validator

from atlas.config import PROCESSED, SCHEMA_VERSION, SCHEMAS

DATASET_NAMES = (
    "investors",
    "partners",
    "funds",
    "companies",
    "competitors",
    "rounds",
    "benchmarks",
    "legal_notes",
    "accelerator_programs",
    "fit_features",
    "landscape_companies",
    "target_customers",
    "layout_thesis",
    "clusters",
    "layout_bubbles",
    "anomalies",
    "merges",
)

MAX_ERRORS_SHOWN = 20


class SchemaValidationError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


def load_schema(name: str) -> dict:
    path = SCHEMAS / f"{name}.schema.json"
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing; run `pnpm gen:schema` first")
    return json.loads(path.read_text(encoding="utf-8"))


def validate_dataset(name: str, payload: dict) -> None:
    validator = Draft202012Validator(
        load_schema(name), format_checker=Draft202012Validator.FORMAT_CHECKER
    )
    errors = sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path))
    if not errors:
        return
    lines = []
    for err in errors[:MAX_ERRORS_SHOWN]:
        where = list(err.absolute_path)
        record_id = None
        if len(where) >= 2 and where[0] == "records":
            record_id = payload["records"][where[1]].get("id")
        label = record_id or ".".join(map(str, where)) or "(root)"
        lines.append(f"  {label} {'.'.join(map(str, where[2:]))}: {err.message}")
    more = len(errors) - MAX_ERRORS_SHOWN
    if more > 0:
        lines.append(f"  … {more} more")
    raise SchemaValidationError(f"{name}.json failed JSON Schema validation:\n" + "\n".join(lines))


def write_dataset(
    name: str, records: list[dict], generated_at: str, out_dir: Path = PROCESSED
) -> Path:
    if name not in DATASET_NAMES:
        raise ValueError(f"unknown dataset {name}")
    payload = {
        "version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "records": sorted(records, key=lambda r: r["id"]),
    }
    validate_dataset(name, payload)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.json"
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return path


DOCUMENT_NAMES = ("graph", "competitor_overlap")


def write_document(name: str, doc: dict, out_dir: Path = PROCESSED) -> Path:
    """Analytics files that aren't record datasets (graph, competitor overlap)."""
    if name not in DOCUMENT_NAMES:
        raise ValueError(f"unknown document {name}")
    validate_dataset(name, doc)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{name}.json"
    text = json.dumps(doc, indent=2, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")
    return path
