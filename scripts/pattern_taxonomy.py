import re
import unicodedata


PROJECT_TYPES = (
    ((r"\bsocks?\b", r"\bskarpet\w*", r"\bchaussettes?\b"), "socks", "skarpetki"),
    ((r"\bcardigan\w*", r"\bkardigan\w*", r"\bcardi\b", r"\bpenguono\b"), "cardigan", "kardigan"),
    ((r"\bsweater\w*", r"\bsweter\w*", r"\bjumper\w*", r"\bpullover\w*"), "sweater", "sweter"),
    ((r"\btee\b", r"\bt-?shirt\w*", r"\btop\b", r"\bbluzk\w*", r"\bkoszulk\w*"), "top", "top lub bluzkę"),
    ((r"\bshawl\w*", r"\bchust\w*", r"\bscarf\w*", r"\bszal\w*", r"\bcapucharpe\b", r"\bwrap\b"), "shawl_scarf", "chustę lub szal"),
    ((r"\bhats?\b", r"\bbeanie\w*", r"\bczapk\w*", r"\b\w*huen\b", r"\bbonnet\w*", r"\bcowl\w*", r"\bkomin\w*", r"\bheadband\w*", r"\bopask\w*"), "head_accessory", "czapkę, opaskę lub komin"),
    ((r"\bmittens?\b", r"\bgloves?\b", r"\brekawicz\w*"), "gloves", "rękawiczki"),
    ((r"\bvest\w*", r"\bkamizel\w*"), "vest", "kamizelkę"),
    ((r"\bskirts?\b", r"\bspodnic\w*", r"\bdress\w*", r"\bsukien\w*"), "skirt_dress", "spódnicę lub sukienkę"),
    ((r"\bblankets?\b", r"\bkoc\w*"), "blanket", "koc"),
    ((r"\bhoodie\w*", r"\bhood\b"), "other", "projekt z kapturem"),
)


def fold_taxonomy_text(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(character)
    )


def match_project_type(value: str) -> tuple[str, str] | None:
    folded = fold_taxonomy_text(value)
    for patterns, project_type, label in PROJECT_TYPES:
        if any(re.search(pattern, folded) for pattern in patterns):
            return project_type, label
    return None


def infer_project_type(title: str, text: str) -> tuple[str, str]:
    title_match = match_project_type(title)
    if title_match is not None:
        return title_match

    text_match = match_project_type(text[:40_000])
    if text_match is not None:
        return text_match

    return "other", "projekt dziewiarski"
