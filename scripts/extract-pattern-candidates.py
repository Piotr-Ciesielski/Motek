import hashlib
import json
import re
import unicodedata
from pathlib import Path

import fitz


PROJECT_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = PROJECT_DIR / "Wzory"
OUTPUT_DIR = PROJECT_DIR / "tmp" / "pdfs"
OUTPUT_PATH = OUTPUT_DIR / "pattern-candidates.json"
MAX_PAGES_TO_SCAN = 24
MAX_TEXT_CHARACTERS = 120_000

MATERIALS = {
    "wełna": ("wełna", "welna", "wool", "merino"),
    "bawełna": ("bawełna", "bawelna", "cotton"),
    "alpaka": ("alpaka", "alpaca"),
    "moher": ("moher", "mohair"),
    "akryl": ("akryl", "acrylic"),
    "len": ("len", "linen"),
    "jedwab": ("jedwab", "silk"),
    "kaszmir": ("kaszmir", "cashmere"),
    "wiskoza": ("wiskoza", "viscose"),
    "bambus": ("bambus", "bamboo"),
    "poliamid": ("poliamid", "polyamide", "nylon"),
    "poliester": ("poliester", "polyester"),
}

PROJECT_TYPES = (
    (("socks", "sock", "skarpet", "chaussettes"), "skarpetki"),
    (("cardigan", "kardigan", "cardi"), "kardigan"),
    (("sweater", "sweter", "jumper", "pullover"), "sweter"),
    (("tee", "t-shirt", "tshirt", "top", "bluzka"), "top lub bluzkę"),
    (("shawl", "chusta"), "chustę"),
    (("scarf", "szal", "capucharpe"), "szal"),
    (("hat", "czapka", "huen", "bonnet"), "czapkę"),
    (("mittens", "rękawicz", "rekawicz"), "rękawiczki"),
    (("vest", "kamizel"), "kamizelkę"),
    (("skirt", "spódnic", "spodnic"), "spódnicę"),
    (("dress", "sukien"), "sukienkę"),
    (("cowl", "komin"), "komin"),
    (("hoodie", "hood"), "projekt z kapturem"),
    (("headband", "opaska"), "opaskę"),
)

TECHNIQUES = (
    (("colorwork", "fair isle", "żakard", "zakard"), "wzorem wielokolorowym"),
    (("intarsia", "intarsj"), "intarsją"),
    (("lace", "ażur", "azur", "eyelet"), "ażurowymi detalami"),
    (("cable", "warkocz"), "warkoczami"),
    (("raglan",), "konstrukcją raglanową"),
    (("top down", "top-down", "od góry", "od gory"), "konstrukcją od góry"),
)

POLISH_MARKERS = (
    "wzór",
    "wzor",
    "włóczka",
    "wloczka",
    "druty",
    "oczka",
    "rozmiar",
    "materiały",
    "materialy",
)

ENGLISH_MARKERS = (
    "pattern",
    "yarn",
    "needles",
    "stitches",
    "size",
    "materials",
    "gauge",
)

METERS_THEN_GRAMS = re.compile(
    r"(?P<meters>\d+(?:[.,]\d+)?)\s*(?:m|metr(?:y|ów|ow)?)"
    r"[^0-9\n]{0,24}"
    r"(?P<grams>\d+(?:[.,]\d+)?)\s*(?:g|gram(?:y|ów|ow)?)\b",
    re.IGNORECASE,
)

GRAMS_THEN_METERS = re.compile(
    r"(?P<grams>\d+(?:[.,]\d+)?)\s*(?:g|gram(?:y|ów|ow)?)"
    r"[^0-9\n]{0,24}"
    r"(?P<meters>\d+(?:[.,]\d+)?)\s*(?:m|metr(?:y|ów|ow)?)\b",
    re.IGNORECASE,
)

YARDS_THEN_GRAMS = re.compile(
    r"(?P<yards>\d+(?:[.,]\d+)?)\s*(?:yds?|yards?)"
    r"[^0-9\n]{0,24}"
    r"(?P<grams>\d+(?:[.,]\d+)?)\s*(?:g|grams?)\b",
    re.IGNORECASE,
)

GRAMS_THEN_YARDS = re.compile(
    r"(?P<grams>\d+(?:[.,]\d+)?)\s*(?:g|grams?)"
    r"[^0-9\n]{0,24}"
    r"(?P<yards>\d+(?:[.,]\d+)?)\s*(?:yds?|yards?)\b",
    re.IGNORECASE,
)


def fold_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in normalized if not unicodedata.combining(char))


def clean_title_from_filename(pdf_path: Path) -> str:
    title = pdf_path.stem
    title = re.sub(r"^\s*(?:kopia pliku\s+)+", "", title, flags=re.IGNORECASE)
    title = re.sub(r"^\s*\[[^\]]+\]\s*", "", title)
    title = re.sub(r"^\d{8,}[_-]*", "", title)
    title = re.sub(
        r"(?:[_\s-]+(?:english|eng|polski|polish|pl|us|uk|kopia))+$",
        "",
        title,
        flags=re.IGNORECASE,
    )
    title = re.sub(r"[_]+", " ", title)
    title = re.sub(r"\s+", " ", title).strip(" -_")
    return title[:200] or pdf_path.stem[:200]


def extract_text(pdf_path: Path) -> tuple[str, int, bool, str | None]:
    try:
        with fitz.open(pdf_path) as document:
            if document.needs_pass:
                return "", document.page_count, True, "encrypted"

            parts = []
            current_length = 0
            pages_to_scan = min(document.page_count, MAX_PAGES_TO_SCAN)

            for page_number in range(pages_to_scan):
                page_text = document.load_page(page_number).get_text("text").strip()
                if not page_text:
                    continue

                parts.append(page_text)
                current_length += len(page_text)
                if current_length >= MAX_TEXT_CHARACTERS:
                    break

            text = "\n".join(parts)
            return text, document.page_count, len(text) < 200, None
    except Exception as error:
        return "", 0, True, f"{type(error).__name__}: {error}"


def detect_language(text: str, filename: str) -> str:
    folded = fold_text(f"{filename}\n{text[:30_000]}")
    polish_score = sum(fold_text(marker) in folded for marker in POLISH_MARKERS)
    english_score = sum(marker in folded for marker in ENGLISH_MARKERS)

    if polish_score and english_score and abs(polish_score - english_score) <= 1:
        return "mixed"
    if polish_score > english_score:
        return "pl"
    if english_score > polish_score:
        return "en"
    return "unknown"


def detect_materials(text: str) -> list[str]:
    folded = fold_text(text)
    detected = []

    for normalized_name, aliases in MATERIALS.items():
        if any(re.search(rf"\b{re.escape(fold_text(alias))}\b", folded) for alias in aliases):
            detected.append(normalized_name)

    return detected


def parse_number(value: str) -> float:
    return float(value.replace(",", "."))


def find_meter_ratio_matches(text: str) -> list[dict]:
    matches = []

    for pattern in (METERS_THEN_GRAMS, GRAMS_THEN_METERS):
        for match in pattern.finditer(text):
            meters = parse_number(match.group("meters"))
            grams = parse_number(match.group("grams"))
            if grams > 0:
                normalized = meters / grams * 100
                if 20 <= normalized <= 5_000:
                    matches.append(
                        {
                            "meters_per_100g": round(normalized, 2),
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )

    for pattern in (YARDS_THEN_GRAMS, GRAMS_THEN_YARDS):
        for match in pattern.finditer(text):
            meters = parse_number(match.group("yards")) * 0.9144
            grams = parse_number(match.group("grams"))
            if grams > 0:
                normalized = meters / grams * 100
                if 20 <= normalized <= 5_000:
                    matches.append(
                        {
                            "meters_per_100g": round(normalized, 2),
                            "start": match.start(),
                            "end": match.end(),
                        }
                    )

    return sorted(matches, key=lambda item: item["start"])


def extract_meter_ratios(ratio_matches: list[dict]) -> list[float]:
    return sorted({item["meters_per_100g"] for item in ratio_matches})


def detect_requirement_role(context: str, requirement_index: int) -> str:
    folded = fold_text(context)
    main_markers = (
        "main yarn",
        "main color",
        "main colour",
        "main shade",
        "mc:",
        "wloczka glowna",
        "kolor glowny",
    )
    additional_markers = (
        "contrast yarn",
        "contrast color",
        "contrast colour",
        "contrast shade",
        "cc:",
        "wloczka dodatkowa",
        "kolor kontrastowy",
        "mohair",
        "moher",
    )

    if any(marker in folded for marker in main_markers):
        return "główna"
    if any(marker in folded for marker in additional_markers):
        return "dodatkowa"
    return "główna" if requirement_index == 0 else "dodatkowa"


def build_yarn_requirements(
    text: str,
    all_materials: list[str],
    ratio_matches: list[dict],
) -> list[dict]:
    requirements = []
    seen = set()

    for match in ratio_matches:
        context_start = max(0, match["start"] - 500)
        context_end = min(len(text), match["end"] + 500)
        context = text[context_start:context_end]
        context_materials = detect_materials(context)

        if not context_materials and len(set(item["meters_per_100g"] for item in ratio_matches)) == 1:
            context_materials = all_materials

        identity = (match["meters_per_100g"], tuple(context_materials))
        if identity in seen:
            continue

        seen.add(identity)
        requirements.append(
            {
                "role": detect_requirement_role(context, len(requirements)),
                "materials": context_materials,
                "meters_per_100g": match["meters_per_100g"],
            }
        )

    if not requirements and all_materials:
        requirements.append(
            {
                "role": "główna",
                "materials": all_materials,
                "meters_per_100g": None,
            }
        )

    return requirements


def infer_description(title: str, text: str) -> str:
    folded = fold_text(f"{title}\n{text[:40_000]}")
    project_type = "projekt dziewiarski"

    for markers, label in PROJECT_TYPES:
        if any(fold_text(marker) in folded for marker in markers):
            project_type = label
            break

    techniques = [
        label
        for markers, label in TECHNIQUES
        if any(fold_text(marker) in folded for marker in markers)
    ]

    if project_type == "projekt dziewiarski":
        base = "Instrukcja wykonania projektu dziewiarskiego"
    else:
        base = f"Instrukcja wykonania projektu: {project_type}"

    if techniques:
        base += f", z {', '.join(techniques[:2])}"

    return f"{base}. Opis przygotowany na podstawie dokumentu źródłowego."


def extract_evidence(text: str) -> list[str]:
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    evidence = []
    keywords = (
        "yarn",
        "włócz",
        "wlocz",
        "material",
        "meter",
        "metre",
        "yard",
        "gram",
    )

    for index, line in enumerate(lines):
        folded_line = fold_text(line)
        if not line or not any(keyword in folded_line for keyword in keywords):
            continue

        start = max(0, index - 1)
        end = min(len(lines), index + 3)
        snippet = " | ".join(part for part in lines[start:end] if part)
        if snippet and snippet not in evidence:
            evidence.append(snippet[:600])
        if len(evidence) >= 4:
            break

    return evidence


def hash_file(pdf_path: Path) -> str:
    digest = hashlib.sha256()
    with pdf_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def create_candidate(pdf_path: Path) -> dict:
    text, page_count, needs_ocr, error = extract_text(pdf_path)
    title = clean_title_from_filename(pdf_path)
    materials = detect_materials(text)
    ratio_matches = find_meter_ratio_matches(text)
    ratios = extract_meter_ratios(ratio_matches)
    yarn_requirements = build_yarn_requirements(text, materials, ratio_matches)
    source_language = detect_language(text, pdf_path.name)
    evidence = extract_evidence(text)

    review_reasons = []
    if needs_ocr:
        review_reasons.append("requires_ocr")
    if not materials:
        review_reasons.append("material_not_found")
    if not ratios:
        review_reasons.append("meters_per_100g_not_found")
    elif len(ratios) > 1:
        review_reasons.append("multiple_meter_ratios")
    if source_language == "unknown":
        review_reasons.append("language_unknown")
    if error:
        review_reasons.append("read_error")

    return {
        "name": title,
        "description": infer_description(title, text),
        "materials": materials,
        "meters_per_100g": ratios[0] if len(ratios) == 1 else None,
        "yarn_requirements": yarn_requirements,
        "source_filename": pdf_path.name,
        "source_language": source_language,
        "needs_review": True,
        "review_reasons": review_reasons,
        "meter_ratio_candidates": ratios,
        "evidence": evidence,
        "page_count": page_count,
        "source_sha256": hash_file(pdf_path),
        "error": error,
    }


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    pdf_files = sorted(PDF_DIR.glob("*.pdf"), key=lambda path: path.name.casefold())
    candidates = [create_candidate(pdf_path) for pdf_path in pdf_files]

    hash_counts = {}
    for candidate in candidates:
        source_hash = candidate["source_sha256"]
        hash_counts[source_hash] = hash_counts.get(source_hash, 0) + 1

    for candidate in candidates:
        candidate["exact_duplicate_count"] = hash_counts[candidate["source_sha256"]]

    summary = {
        "candidate_count": len(candidates),
        "requires_ocr_count": sum(
            "requires_ocr" in item["review_reasons"] for item in candidates
        ),
        "material_found_count": sum(bool(item["materials"]) for item in candidates),
        "single_ratio_count": sum(item["meters_per_100g"] is not None for item in candidates),
        "multiple_ratio_count": sum(
            "multiple_meter_ratios" in item["review_reasons"] for item in candidates
        ),
        "multiple_yarn_requirement_count": sum(
            len(item["yarn_requirements"]) > 1 for item in candidates
        ),
        "exact_duplicate_file_count": sum(
            item["exact_duplicate_count"] > 1 for item in candidates
        ),
        "language_counts": {
            language: sum(item["source_language"] == language for item in candidates)
            for language in ("pl", "en", "mixed", "unknown")
        },
    }

    OUTPUT_PATH.write_text(
        json.dumps(
            {"summary": summary, "candidates": candidates},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"CANDIDATES_PATH={OUTPUT_PATH.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    main()
