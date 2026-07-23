import json
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
CANDIDATES_PATH = PROJECT_DIR / "tmp" / "pdfs" / "pattern-candidates.json"
OVERRIDES_PATH = PROJECT_DIR / "data" / "pattern-manual-overrides.json"
OUTPUT_PATH = PROJECT_DIR / "data" / "patterns-import.json"

DATABASE_FIELDS = (
    "name",
    "description",
    "materials",
    "meters_per_100g",
    "yarn_requirements",
    "source_filename",
    "source_language",
    "needs_review",
)

ALLOWED_LANGUAGES = {"pl", "en", "mixed", "unknown"}


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def validate_record(record: dict) -> list[str]:
    errors = []
    source = record.get("source_filename", "<brak nazwy pliku>")

    if not isinstance(record.get("name"), str) or not record["name"].strip():
        errors.append(f"{source}: brak nazwy")
    elif len(record["name"].strip()) > 200:
        errors.append(f"{source}: nazwa przekracza 200 znaków")

    if not isinstance(record.get("description"), str) or not record["description"].strip():
        errors.append(f"{source}: brak opisu")
    elif len(record["description"].strip()) > 1000:
        errors.append(f"{source}: opis przekracza 1000 znaków")

    materials = record.get("materials")
    if not isinstance(materials, list) or not all(
        isinstance(material, str) and material.strip() for material in materials
    ):
        errors.append(f"{source}: materiały muszą być listą niepustych nazw")

    ratio = record.get("meters_per_100g")
    if ratio is not None and (not isinstance(ratio, (int, float)) or ratio <= 0):
        errors.append(f"{source}: meters_per_100g musi być dodatnią liczbą albo null")

    requirements = record.get("yarn_requirements")
    if not isinstance(requirements, list):
        errors.append(f"{source}: yarn_requirements musi być listą")

    if record.get("source_language") not in ALLOWED_LANGUAGES:
        errors.append(f"{source}: nieobsługiwany język źródła")

    if not isinstance(record.get("needs_review"), bool):
        errors.append(f"{source}: needs_review musi mieć wartość true albo false")

    requirements_have_ratios = bool(requirements) and all(
        isinstance(requirement, dict)
        and isinstance(requirement.get("meters_per_100g"), (int, float))
        and requirement["meters_per_100g"] > 0
        for requirement in requirements
    )

    is_incomplete = not materials or (
        ratio is None and not requirements_have_ratios
    )
    if is_incomplete and record.get("needs_review") is not True:
        errors.append(
            f"{source}: niepełny rekord musi być oznaczony needs_review=true"
        )

    return errors


def main() -> None:
    candidate_document = load_json(CANDIDATES_PATH)
    overrides = load_json(OVERRIDES_PATH)
    candidates = candidate_document["candidates"]
    candidate_filenames = {candidate["source_filename"] for candidate in candidates}

    unknown_overrides = sorted(set(overrides) - candidate_filenames)
    if unknown_overrides:
        raise ValueError(
            "Poprawki wskazują nieistniejące pliki PDF: "
            + ", ".join(unknown_overrides)
        )

    records = []
    audit = []
    validation_errors = []

    for candidate in candidates:
        source_filename = candidate["source_filename"]
        merged = {**candidate, **overrides.get(source_filename, {})}
        merged["source_filename"] = source_filename

        record = {field: merged[field] for field in DATABASE_FIELDS}
        validation_errors.extend(validate_record(record))
        records.append(record)

        audit.append(
            {
                "source_filename": source_filename,
                "manual_override": source_filename in overrides,
                "review_reasons": candidate.get("review_reasons", []),
                "review_notes": merged.get("review_notes", []),
            }
        )

    if len({record["source_filename"] for record in records}) != len(records):
        validation_errors.append("Nazwy plików źródłowych nie są unikalne.")

    if validation_errors:
        raise ValueError(
            "Dane nie przeszły kontroli:\n- " + "\n- ".join(validation_errors)
        )

    result = {
        "metadata": {
            "record_count": len(records),
            "manual_override_count": len(overrides),
            "needs_review_count": sum(record["needs_review"] for record in records),
            "complete_material_count": sum(bool(record["materials"]) for record in records),
            "complete_ratio_count": sum(
                record["meters_per_100g"] is not None for record in records
            ),
        },
        "records": records,
        "audit": audit,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(result["metadata"], ensure_ascii=False, indent=2))
    print(f"IMPORT_PATH={OUTPUT_PATH.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    main()
