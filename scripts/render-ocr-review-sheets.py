import json
import re
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


PROJECT_DIR = Path(__file__).resolve().parent.parent
PDF_DIR = PROJECT_DIR / "Wzory"
CANDIDATES_PATH = PROJECT_DIR / "tmp" / "pdfs" / "pattern-candidates.json"
OUTPUT_DIR = PROJECT_DIR / "tmp" / "pdfs" / "ocr-review"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
PAGES_PER_FILE = 6
TILE_WIDTH = 700
MARGIN = 24
LABEL_HEIGHT = 36
COLUMNS = 2


def safe_filename(value: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_-]+", "_", value).strip("_")
    return normalized[:100] or "document"


def render_page(page: fitz.Page) -> Image.Image:
    source_width = page.rect.width
    scale = max(TILE_WIDTH / source_width, 1.0)
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
    return Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)


def create_review_sheet(pdf_path: Path) -> Path | None:
    with fitz.open(pdf_path) as document:
        if document.needs_pass or document.page_count == 0:
            return None

        page_images = [
            render_page(document.load_page(page_number))
            for page_number in range(min(document.page_count, PAGES_PER_FILE))
        ]

    rows = (len(page_images) + COLUMNS - 1) // COLUMNS
    row_heights = []
    for row_index in range(rows):
        row_images = page_images[row_index * COLUMNS : (row_index + 1) * COLUMNS]
        row_heights.append(max(image.height for image in row_images) + LABEL_HEIGHT)

    sheet_width = COLUMNS * TILE_WIDTH + (COLUMNS + 1) * MARGIN
    sheet_height = sum(row_heights) + (rows + 1) * MARGIN
    sheet = Image.new("RGB", (sheet_width, sheet_height), "white")
    draw = ImageDraw.Draw(sheet)

    current_y = MARGIN
    for row_index in range(rows):
        row_images = page_images[row_index * COLUMNS : (row_index + 1) * COLUMNS]
        for column_index, image in enumerate(row_images):
            page_number = row_index * COLUMNS + column_index + 1
            x = MARGIN + column_index * (TILE_WIDTH + MARGIN)
            draw.text((x, current_y), f"Strona {page_number}", fill="black")
            sheet.paste(image, (x, current_y + LABEL_HEIGHT))
        current_y += row_heights[row_index] + MARGIN

    output_path = OUTPUT_DIR / f"{safe_filename(pdf_path.stem)}.jpg"
    sheet.save(output_path, "JPEG", quality=88, optimize=True)
    return output_path


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    candidate_data = json.loads(CANDIDATES_PATH.read_text(encoding="utf-8"))
    ocr_candidates = [
        item
        for item in candidate_data["candidates"]
        if "requires_ocr" in item["review_reasons"]
    ]

    manifest = []
    for candidate in ocr_candidates:
        pdf_path = PDF_DIR / candidate["source_filename"]
        output_path = create_review_sheet(pdf_path)
        manifest.append(
            {
                "source_filename": candidate["source_filename"],
                "review_sheet": (
                    str(output_path.relative_to(PROJECT_DIR)) if output_path else None
                ),
            }
        )

    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"REVIEW_SHEET_COUNT={sum(item['review_sheet'] is not None for item in manifest)}")
    print(f"MANIFEST_PATH={MANIFEST_PATH.relative_to(PROJECT_DIR)}")


if __name__ == "__main__":
    main()
