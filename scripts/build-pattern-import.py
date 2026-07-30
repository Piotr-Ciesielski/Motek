import json
from pathlib import Path

from pattern_taxonomy import infer_project_type


PROJECT_DIR = Path(__file__).resolve().parent.parent
CANDIDATES_PATH = PROJECT_DIR / "tmp" / "pdfs" / "pattern-candidates.json"
OVERRIDES_PATH = PROJECT_DIR / "data" / "pattern-manual-overrides.json"
EXCLUSIONS_PATH = PROJECT_DIR / "data" / "pattern-catalog-exclusions.json"
DEMO_PATH = PROJECT_DIR / "data" / "pattern-demo.json"
OUTPUT_PATH = PROJECT_DIR / "data" / "patterns-import.json"

DATABASE_FIELDS = (
    "name",
    "description",
    "project_type",
    "materials",
    "meters_per_100g",
    "yarn_requirements",
    "matching_requirements",
    "source_filename",
    "source_language",
    "needs_review",
)

ALLOWED_LANGUAGES = {"pl", "en", "mixed", "unknown"}
ALLOWED_PROJECT_TYPES = {
    "socks",
    "sweater",
    "cardigan",
    "top",
    "shawl_scarf",
    "head_accessory",
    "gloves",
    "vest",
    "skirt_dress",
    "blanket",
    "other",
}


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

    if record.get("project_type") not in ALLOWED_PROJECT_TYPES:
        errors.append(f"{source}: nieobsługiwany typ projektu")

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

    matching_requirements = record.get("matching_requirements")
    if not isinstance(matching_requirements, dict) or not isinstance(
        matching_requirements.get("variants"), list
    ):
        errors.append(
            f"{source}: matching_requirements musi zawierać listę variants"
        )
    else:
        for index, variant in enumerate(matching_requirements["variants"], start=1):
            if not isinstance(variant, dict):
                errors.append(f"{source}: wariant {index} nie jest obiektem")
                continue
            for field in ("yarns_needed", "meters_needed", "grams_needed"):
                value = variant.get(field)
                if not isinstance(value, int) or isinstance(value, bool) or value < 1:
                    errors.append(
                        f"{source}: wariant {index} ma nieprawidłowe pole {field}"
                    )
            for field in ("materials", "weight_classes"):
                value = variant.get(field)
                if not isinstance(value, list) or not all(
                    isinstance(item, str) and item.strip() for item in value
                ):
                    errors.append(
                        f"{source}: wariant {index} ma nieprawidłowe pole {field}"
                    )

    if record.get("source_language") not in ALLOWED_LANGUAGES:
        errors.append(f"{source}: nieobsługiwany język źródła")

    if not isinstance(record.get("needs_review"), bool):
        errors.append(f"{source}: needs_review musi mieć wartość true albo false")

    requirements_are_complete = bool(requirements) and all(
        isinstance(requirement, dict)
        and (
            (
                isinstance(requirement.get("meters_per_100g"), (int, float))
                and requirement["meters_per_100g"] > 0
            )
            or (
                requirement.get("flexible") is True
                and isinstance(requirement.get("quantity_note"), str)
                and requirement["quantity_note"].strip()
            )
        )
        for requirement in requirements
    )

    is_incomplete = not materials or (
        ratio is None and not requirements_are_complete
    )
    if is_incomplete and record.get("needs_review") is not True:
        errors.append(
            f"{source}: niepełny rekord musi być oznaczony needs_review=true"
        )

    return errors


def main() -> None:
    candidate_document = load_json(CANDIDATES_PATH)
    overrides = load_json(OVERRIDES_PATH)
    exclusions = load_json(EXCLUSIONS_PATH)["exclusions"]
    demo_document = load_json(DEMO_PATH)
    candidates = candidate_document["candidates"]
    demo_records = demo_document["records"]
    candidate_filenames = {candidate["source_filename"] for candidate in candidates}

    unknown_overrides = sorted(set(overrides) - candidate_filenames)
    if unknown_overrides:
        raise ValueError(
            "Poprawki wskazują nieistniejące pliki PDF: "
            + ", ".join(unknown_overrides)
        )

    unknown_exclusions = sorted(set(exclusions) - candidate_filenames)
    if unknown_exclusions:
        raise ValueError(
            "Wykluczenia wskazują nieistniejące pliki PDF: "
            + ", ".join(unknown_exclusions)
        )

    overlapping_rules = sorted(set(overrides) & set(exclusions))
    if overlapping_rules:
        raise ValueError(
            "Plik nie może mieć jednocześnie poprawki i wykluczenia: "
            + ", ".join(overlapping_rules)
        )

    records = []
    audit = []
    validation_errors = []

    for candidate in candidates:
        source_filename = candidate["source_filename"]
        if source_filename in exclusions:
            audit.append(
                {
                    "source_filename": source_filename,
                    "excluded": True,
                    "exclusion_reason": exclusions[source_filename]["reason"],
                    "manual_override": False,
                    "review_reasons": candidate.get("review_reasons", []),
                    "review_notes": [],
                    "reference_sources": candidate.get("reference_sources", []),
                }
            )
            continue

        merged = {**candidate, **overrides.get(source_filename, {})}
        merged["source_filename"] = source_filename
        merged["project_type"] = merged.get("project_type") or infer_project_type(
            f"{source_filename} {merged.get('name', '')}",
            merged.get("description", ""),
        )[0]

        record = {
            field: merged.get(
                field,
                {"variants": []} if field == "matching_requirements" else None,
            )
            for field in DATABASE_FIELDS
        }
        validation_errors.extend(validate_record(record))
        records.append(record)

        audit.append(
            {
                "source_filename": source_filename,
                "manual_override": source_filename in overrides,
                "review_reasons": candidate.get("review_reasons", []),
                "review_notes": merged.get("review_notes", []),
                "reference_sources": candidate.get("reference_sources", []),
            }
        )

    for demo_record in demo_records:
        validation_errors.extend(validate_record(demo_record))
        records.append(demo_record)
        audit.append(
            {
                "source_filename": demo_record["source_filename"],
                "manual_override": False,
                "synthetic_demo": True,
                "review_reasons": [],
                "review_notes": [],
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
            "excluded_pdf_count": len(exclusions),
            "synthetic_demo_count": len(demo_records),
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
