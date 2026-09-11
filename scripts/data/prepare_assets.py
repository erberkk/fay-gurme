"""Self-host the Google Fonts used by the site and export the menu as a CSV.

Downloads the latin/latin-ext WOFF2 files into public/fonts/, rewrites
public/css/fonts.css to point at them and writes source/menu-export.csv
(UTF-8 with BOM so it opens cleanly in Excel).
"""

from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import csv, hashlib, json, re
import requests

ROOT = Path(__file__).resolve().parents[2]
fontdir = ROOT / "public/fonts"
fontdir.mkdir(exist_ok=True)
url = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Manrope:wght@400;500;600;700&display=swap"
response = requests.get(
    url,
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36"
    },
    timeout=30,
)
response.raise_for_status()
raw = response.text
blocks = re.findall(r"(?:/\*\s*([^*]+)\*/\s*)?(@font-face\s*\{.*?\})", raw, re.S)
selected = [block for subset, block in blocks if subset.strip() in ("latin", "latin-ext", "")]
mapping = {}
for block in selected:
    for src in re.findall(r"url\((https://[^)]+)\)", block):
        mapping[src] = (
            "/fonts/"
            + hashlib.sha256(src.encode()).hexdigest()[:16]
            + (".woff2" if ".woff2" in src else ".ttf")
        )


def download(pair):
    src, local = pair
    path = ROOT / "public" / local.lstrip("/")
    if not path.exists():
        r = requests.get(src, timeout=30)
        r.raise_for_status()
        path.write_bytes(r.content)


with ThreadPoolExecutor(max_workers=4) as pool:
    list(pool.map(download, mapping.items()))
css = "\n".join(selected)
for src, local in mapping.items():
    css = css.replace(src, local)
(ROOT / "public/css/fonts.css").write_text(css, encoding="utf-8")
(ROOT / "source/font-manifest.json").write_text(json.dumps(mapping, indent=2), encoding="utf-8")
data = json.loads((ROOT / "public/data/menu.json").read_text("utf-8"))
cats = {c["id"]: c["name"] for c in data["categories"]}
with (ROOT / "source/menu-export.csv").open("w", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    writer.writerow(["id", "category", "name", "description", "price_try", "allergens", "labels", "image"])
    for p in data["products"]:
        writer.writerow(
            [
                p["id"],
                cats[p["categoryId"]],
                p["name"],
                p["description"],
                p["price"],
                ",".join(p["allergens"]),
                ",".join(p["labels"]),
                p["image"],
            ]
        )
print(f"Prepared {len(mapping)} local font subsets and {len(data['products'])} CSV rows.")
