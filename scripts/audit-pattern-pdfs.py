import json
import re
from pathlib import Path

import fitz


PROJECT_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = PROJECT_DIR / "Wzory"
OUTPUT_DIR = PROJECT_DIR / "tmp" / "pdfs"
PREVIEW_DIR = OUTPUT_DIR / "previews"
MAX_PAGES_TO_SCAN = 12

MATERIAL_PATTERN = re.compile(
    r"\b(?:"
    r"wełn\w*|wel[nł]\w*|merino|bawełn\w*|baweln\w*|alpaka|alpaca|"
    r"moher\w*|mohair|akryl\w*|acrylic|len|linen|jedwab\w*|silk|"
    r"kaszmir\w*|cashmere|wiskoza|viscose|bambus\w*|bamboo|"
    r"poliamid\w*|polyamide|nylon|poliester\w*|polyester|"
    r"wool|cotton"
    r")\b",
    re.IGNORECASE,
)

METRIC_RATIO_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:m|metr(?:y|ów|ow)?)\s*[/x×]?\s*"
    r"\d+(?:[.,]\d+)?\s*(?:g|gram(?:y|ów|ow)?)\b",
    re.IGNORECASE,
)

IMPERIAL_RATIO_PATTERN = re.compile(
    r"\b\d+(?:[.,]\d+)?\s*(?:yds?|yards?)\s*[/x×]?\s*"
    r"\d+(?:[.,]\d+)?\s*(?:oz|ounces?)\b",
    re.IGNORECASE,
)


def scan_pdf(pdf_path: Path) -> dict:
    result = {
        "filename": pdf_path.name,
        "bytes": pdf_path.stat().st_size,
        "page_count": 0,
        "pages_scanned": 0,
        "text_characters": 0,
        "text_pages": 0,
        "has_material_terms": False,
        "has_metric_ratio": False,
        "has_imperial_ratio": False,
        "needs_ocr": False,
        "encrypted": False,
        "error": None,
    }

    try:
        with fitz.open(pdf_path) as document:
            result["page_count"] = document.page_count
            result["encrypted"] = bool(document.needs_pass)

            if document.needs_pass:
                result["needs_ocr"] = True
                return result

            extracted_parts = []
            pages_to_scan = min(document.page_count, MAX_PAGES_TO_SCAN)
            result["pages_scanned"] = pages_to_scan

            for page_number in range(pages_to_scan):
                page_text = document.load_page(page_number).get_text("text").strip()
                if page_text:
                    result["text_pages"] += 1
                    extracted_parts.append(page_text)

            extracted_text = "\n".join(extracted_parts)
            result["text_characters"] = len(extracted_text)
            result["has_material_terms"] = bool(MATERIAL_PATTERN.search(extracted_text))
            result["has_metric_ratio"] = bool(METRIC_RATIO_PATTERN.search(extracted_text))
            result["has_imperial_ratio"] = bool(IMPERIAL_RATIO_PATTERN.search(extracted_text))
            result["needs_ocr"] = len(extracted_text) < 200
    except Exception as error:
        result["error"] = f"{type(error).__name__}: {error}"
        result["needs_ocr"] = True

    return result


def render_preview(pdf_path: Path) -> str | None:
    try:
        with fitz.open(pdf_path) as document:
            if document.needs_pass or document.page_count == 0:
                return None

            safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", pdf_path.stem).strip("_")[:80]
            output_path = PREVIEW_DIR / f"{safe_name}.png"
            page = document.load_page(0)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            pixmap.save(output_path)
            return str(output_path.relative_to(PROJECT_DIR))
    except Exception:
        return None


def select_preview_files(pdf_files: list[Path]) -> list[Path]:
    by_size = sorted(pdf_files, key=lambda path: path.stat().st_size)
    selected = by_size[:2] + by_size[-2:]

    for language_hint in ("PL", "EN"):
        match = next(
            (
                path
                for path in pdf_files
                if language_hint.casefold() in path.name.casefold() and path not in selected
            ),
            None,
        )
        if match:
            selected.append(match)

    return selected


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)

    pdf_files = sorted(PDF_DIR.glob("*.pdf"), key=lambda path: path.name.casefold())
    audit = [scan_pdf(pdf_path) for pdf_path in pdf_files]
    preview_paths = [
        preview
        for pdf_path in select_preview_files(pdf_files)
        if (preview := render_preview(pdf_path))
    ]

    summary = {
        "pdf_count": len(audit),
        "readable_text_count": sum(not item["needs_ocr"] for item in audit),
        "needs_ocr_count": sum(item["needs_ocr"] for item in audit),
        "encrypted_count": sum(item["encrypted"] for item in audit),
        "error_count": sum(item["error"] is not None for item in audit),
        "material_terms_count": sum(item["has_material_terms"] for item in audit),
        "metric_ratio_count": sum(item["has_metric_ratio"] for item in audit),
        "imperial_ratio_count": sum(item["has_imperial_ratio"] for item in audit),
        "preview_paths": preview_paths,
    }

    output = {"summary": summary, "files": audit}
    output_path = OUTPUT_DIR / "pdf-audit.json"
    output_path.write_text(
        json.dumps(output, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"AUDIT_PATH={output_path.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    main()
