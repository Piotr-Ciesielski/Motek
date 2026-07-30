import json
from collections import Counter
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parent.parent
IMPORT_PATH = PROJECT_DIR / "data" / "patterns-import.json"


def main() -> None:
    records = json.loads(IMPORT_PATH.read_text(encoding="utf-8"))["records"]
    counts = Counter(record["project_type"] for record in records)

    print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False, indent=2))
    print("\nOTHER_RECORDS")
    for record in records:
        if record["project_type"] == "other":
            print(f"{record['source_filename']} | {record['name']}")


if __name__ == "__main__":
    main()
