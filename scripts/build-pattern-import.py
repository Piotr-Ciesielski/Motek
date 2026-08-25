import json
from pathlib import Path

from pattern_taxonomy import infer_project_type


PROJECT_DIR = Path(__file__).resolve().parent.parent
CANDIDATES_PATH = PROJECT_DIR / "tmp" / "pdfs" / "pattern-candidates.json"
OVERRIDES_PATH = PROJECT_DIR / "data" / "pattern-manual-overrides.json"
EXCLUSIONS_PATH = PROJECT_DIR / "data" / "pattern-catalog-exclusions.json"
DEMO_PATH = PROJECT_DIR / "data" / "pattern-demo.json"
WEB_PATH = PROJECT_DIR / "data" / "pattern-web-catalog.json"
AUDIT_PATH = PROJECT_DIR / "data" / "pattern-content-audit.json"
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
    "publication_status",
    "content_audit_version",
    "content_audited_at",
    "official_source_url",
    "technique",
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
ALLOWED_MATERIALS = {
    "wełna",
    "alpaka",
    "moher",
    "kaszmir",
    "angora",
    "jak",
    "bawełna",
    "len",
    "bambus",
    "wiskoza",
    "jedwab",
    "poliamid",
    "poliester",
    "akryl",
    "mieszanka",
}
ALLOWED_WEIGHT_CLASSES = {"lace", "fingering", "sport", "dk", "worsted", "bulky"}
ALLOWED_TECHNIQUES = {"knitting", "crochet"}


def validate_matching_requirements(value: object, source: str) -> list[str]:
    errors = []
    if not isinstance(value, dict) or value.get("version") != 2:
        return [f"{source}: matching_requirements musi mieć wersję 2"]

    variants = value.get("variants")
    if not isinstance(variants, list) or len(variants) > 250:
        return [f"{source}: matching_requirements.variants musi być listą do 250 elementów"]

    seen_ids = set()
    for index, variant in enumerate(variants, start=1):
        context = f"{source}: wariant {index}"
        if not isinstance(variant, dict):
            errors.append(f"{context} nie jest obiektem")
            continue

        variant_id = variant.get("id")
        label = variant.get("label")
        if not isinstance(variant_id, str) or not variant_id.strip() or len(variant_id.strip()) > 100:
            errors.append(f"{context} ma nieprawidłowe id")
        elif variant_id.strip() in seen_ids:
            errors.append(f"{context} ma powtórzone id")
        else:
            seen_ids.add(variant_id.strip())
        if not isinstance(label, str) or not label.strip() or len(label.strip()) > 100:
            errors.append(f"{context} ma nieprawidłową etykietę")

        requirements = variant.get("requirements")
        if not isinstance(requirements, list) or not 1 <= len(requirements) <= 8:
            errors.append(f"{context} musi zawierać od 1 do 8 ról")
            continue

        for role_index, requirement in enumerate(requirements, start=1):
            role_context = f"{context}, rola {role_index}"
            if not isinstance(requirement, dict):
                errors.append(f"{role_context} nie jest obiektem")
                continue

            if not isinstance(requirement.get("role"), str) or not requirement["role"].strip():
                errors.append(f"{role_context} nie ma nazwy")
            basis = requirement.get("measurement_basis")
            if basis not in {"meters", "grams"}:
                errors.append(f"{role_context} ma nieprawidłową podstawę pomiaru")

            for prefix in ("meters", "grams", "skeins"):
                minimum = requirement.get(f"{prefix}_min")
                maximum = requirement.get(f"{prefix}_max")
                if minimum is not None and (
                    not isinstance(minimum, int)
                    or isinstance(minimum, bool)
                    or minimum < 1
                ):
                    errors.append(f"{role_context}.{prefix}_min musi być dodatnią liczbą")
                if maximum is not None and (
                    not isinstance(maximum, int)
                    or isinstance(maximum, bool)
                    or maximum < 1
                    or minimum is None
                    or maximum < minimum
                ):
                    errors.append(f"{role_context}.{prefix}_max ma nieprawidłowy zakres")
            if basis in {"meters", "grams"} and requirement.get(f"{basis}_min") is None:
                errors.append(f"{role_context} nie ma {basis}_min")

            material_match = requirement.get("material_match")
            materials = requirement.get("materials")
            if material_match not in {"all", "any", "any_material"}:
                errors.append(f"{role_context} ma nieprawidłowy tryb materiału")
            elif not isinstance(materials, list):
                errors.append(f"{role_context}.materials musi być listą")
            elif material_match == "any_material" and materials:
                errors.append(f"{role_context}: any_material wymaga pustej listy")
            elif material_match != "any_material" and (
                not materials
                or any(material not in ALLOWED_MATERIALS for material in materials)
                or ("mieszanka" in materials and len(set(materials)) > 1)
            ):
                errors.append(f"{role_context} zawiera nieprawidłowy materiał")

            if requirement.get("color_mode") not in {"same", "any"}:
                errors.append(f"{role_context} ma nieprawidłowy tryb koloru")
            weight_classes = requirement.get("weight_classes")
            if (
                not isinstance(weight_classes, list)
                or not weight_classes
                or any(value not in ALLOWED_WEIGHT_CLASSES for value in weight_classes)
            ):
                errors.append(f"{role_context} ma nieprawidłową grubość")

    return errors


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_project_type(candidate: dict, override: dict) -> str:
    explicit_type = override.get("project_type")
    if explicit_type:
        return explicit_type

    final_name = override.get("name", candidate.get("name", ""))
    final_description = override.get(
        "description",
        candidate.get("description") or "",
    ) or ""
    return infer_project_type(final_name, final_description)[0]


def validate_record(record: dict) -> list[str]:
    errors = []
    source = record.get("source_filename", "<brak nazwy pliku>")

    if not isinstance(record.get("name"), str) or not record["name"].strip():
        errors.append(f"{source}: brak nazwy")
    elif len(record["name"].strip()) > 200:
        errors.append(f"{source}: nazwa przekracza 200 znaków")

    description = record.get("description")
    if description is not None and (
        not isinstance(description, str) or len(description.strip()) > 1000
    ):
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

    errors.extend(validate_matching_requirements(record.get("matching_requirements"), source))

    if record.get("source_language") not in ALLOWED_LANGUAGES:
        errors.append(f"{source}: nieobsługiwany język źródła")

    if not isinstance(record.get("needs_review"), bool):
        errors.append(f"{source}: needs_review musi mieć wartość true albo false")

    if record.get("publication_status") not in {"pending_review", "published", "hidden"}:
        errors.append(f"{source}: nieobsługiwany status publikacji")
    technique = record.get("technique")
    if technique is not None and technique not in ALLOWED_TECHNIQUES:
        errors.append(f"{source}: nieobsługiwana technika")
    if record.get("publication_status") == "published" and (
        not record.get("content_audit_version") or not record.get("content_audited_at")
    ):
        errors.append(f"{source}: published wymaga metadanych audytu")
    if (
        record.get("publication_status") == "published"
        and technique not in ALLOWED_TECHNIQUES
    ):
        errors.append(f"{source}: published wymaga techniki")

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
    web_document = load_json(WEB_PATH)
    audit_document = load_json(AUDIT_PATH)
    audit_records = audit_document["records"]
    audit_by_filename = {item["source_filename"]: item for item in audit_records}
    candidates = candidate_document["candidates"]
    demo_records = demo_document["records"]
    web_records = web_document["records"]
    candidate_filenames = {candidate["source_filename"] for candidate in candidates}
    all_filenames = (
        (candidate_filenames - set(exclusions))
        | {record["source_filename"] for record in demo_records}
        | {record["source_filename"] for record in web_records}
    )
    missing_audit = sorted(all_filenames - set(audit_by_filename))
    if missing_audit:
        raise ValueError("Brak decyzji audytu dla: " + ", ".join(missing_audit))

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

        override = overrides.get(source_filename, {})
        merged = {**candidate, **override}
        merged["source_filename"] = source_filename
        merged["project_type"] = resolve_project_type(candidate, override)

        record = {
            field: merged.get(
                field,
                {"version": 2, "variants": []}
                if field == "matching_requirements"
                else None,
            )
            for field in DATABASE_FIELDS
        }
        audit_record = audit_by_filename[source_filename]
        record["description"] = merged.get("description") if audit_record["source_kind"] == "synthetic" else None
        record["publication_status"] = audit_record["status"]
        record["content_audit_version"] = audit_document["audit_version"]
        record["content_audited_at"] = audit_record.get("audited_at")
        record["official_source_url"] = audit_record.get("official_source_url")
        record["technique"] = audit_record.get("technique")
        record["matching_requirements"] = override.get(
            "matching_requirements",
            {"version": 2, "variants": []},
        )
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
        demo_record = {
            **demo_record,
            "matching_requirements": {"version": 2, "variants": []},
        }
        audit_record = audit_by_filename[demo_record["source_filename"]]
        demo_record["publication_status"] = audit_record["status"]
        demo_record["content_audit_version"] = audit_document["audit_version"]
        demo_record["content_audited_at"] = audit_record.get("audited_at")
        demo_record["official_source_url"] = audit_record.get("official_source_url")
        demo_record["technique"] = audit_record.get("technique")
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

    for web_record in web_records:
        web_record = dict(web_record)
        source_filename = web_record["source_filename"]
        audit_record = audit_by_filename[source_filename]
        web_record["publication_status"] = audit_record["status"]
        web_record["content_audit_version"] = audit_document["audit_version"]
        web_record["content_audited_at"] = audit_record.get("audited_at")
        web_record["official_source_url"] = audit_record.get("official_source_url")
        web_record["technique"] = audit_record.get("technique")
        validation_errors.extend(validate_record(web_record))
        records.append(web_record)
        audit.append(
            {
                "source_filename": source_filename,
                "manual_override": False,
                "web_source": True,
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
