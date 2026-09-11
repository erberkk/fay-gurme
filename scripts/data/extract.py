"""Archive the public Fay Gurme menu and its media, retaining source provenance."""

from pathlib import Path
from urllib.parse import urljoin, urlparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib, json, re, time
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[2]
BASE = "https://faygurme.goatmenu.net/menu"
raw = (ROOT / "source/original-menu.html").read_text(encoding="utf-8-sig")
soup = BeautifulSoup(raw, "html.parser")
assets = {}


def asset(url, role):
    if not url or url.startswith("data:"):
        return None
    url = urljoin(BASE, url)
    ext = Path(urlparse(url).path).suffix.lower()
    key = hashlib.sha256(url.encode()).hexdigest()[:16]
    local = f"/media/{key}{ext}"
    if url not in assets:
        assets[url] = dict(source=url, local=local, roles=[], status="pending")
    if role not in assets[url]["roles"]:
        assets[url]["roles"].append(role)
    return local


def txt(el, selector):
    target = el.select_one(selector)
    return target.get_text(" ", strip=True) if target else ""


def background(el):
    match = re.search(r"url\(['\"]?(.*?)['\"]?\)", el.get("style", "")) if el else None
    return match.group(1) if match else None


categories, products = [], []
featured = [el["data-product-id"] for el in soup.select(".featured-item[data-product-id]")]
for cat in soup.select(".category[data-cat-id]"):
    cid = cat["data-cat-id"]
    header = cat.select_one(".category-header")
    video = header.select_one("source[src]")
    category = dict(
        id=cid,
        name=txt(header, ".translatable"),
        image=asset(background(header), f"category:{cid}"),
        video=asset(video["src"], f"category-video:{cid}") if video else None,
        productIds=[],
    )
    for el in cat.select(".item[data-product-id]"):
        pid = el["data-product-id"]
        img = el.select_one("img[src]")
        price_text = txt(el, ".item-price")
        number = re.sub(r"[^\d,.]", "", price_text)
        price = float(number.replace(".", "").replace(",", ".")) if number else None
        labels = [e.get_text(strip=True) for e in el.select(".item-labels span")]
        sub = el.find_parent(class_="subcategory")
        products.append(
            dict(
                id=pid,
                categoryId=cid,
                name=txt(el, ".item-name"),
                description=txt(el, ".item-desc"),
                price=price,
                priceText=price_text,
                image=asset(img["src"], f"product:{pid}") if img else None,
                allergens=[s for s in el.get("data-product-allergens", "").split(",") if s],
                labels=labels,
                featured=pid in featured,
                subcategory=txt(sub, "summary") if sub else None,
            )
        )
        category["productIds"].append(pid)
    categories.append(category)

logo = soup.select_one(".logo img")
landing = soup.select_one("#landingFallbackImg")
hero_video = soup.select_one("#landingVideo source")
data = dict(
    source=BASE,
    capturedAt=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    brand=dict(
        name="FAY Gurme",
        tagline=txt(soup, "header p"),
        logo=asset(logo["src"], "brand-logo"),
        heroImage=asset(landing["src"], "hero-image"),
        heroVideo=asset(hero_video["src"], "hero-video"),
        links=[
            dict(label=a.get("aria-label", ""), href=a["href"])
            for a in soup.select(".header-content a[href]")
        ],
    ),
    categories=categories,
    products=products,
    featured=featured,
)
for el in soup.select("img[src], video[src], source[src]"):
    asset(el["src"], "page-media")
for url in re.findall(r"url\(['\"]?([^)'\"]+)['\"]?\)", raw):
    if re.search(r"\.(png|jpg|jpeg|webp|svg)(\?|$)", url, re.I):
        asset(url, "background")
(ROOT / "public/data/menu.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
(ROOT / "source/page-text.txt").write_text(soup.get_text("\n", strip=True), encoding="utf-8")
print(
    json.dumps(
        dict(categories=len(categories), products=len(products), featured=len(featured), assets=len(assets)),
        ensure_ascii=True,
    ),
    flush=True,
)


def download(entry):
    path = ROOT / "public" / entry["local"].lstrip("/")
    if path.exists() and path.stat().st_size > 0:
        entry.update(status="downloaded", bytes=path.stat().st_size)
        return entry
    for attempt in range(3):
        try:
            r = requests.get(
                entry["source"],
                headers={
                    "Referer": "https://faygurme.goatmenu.net/",
                    "Origin": "https://faygurme.goatmenu.net",
                    "User-Agent": "Mozilla/5.0",
                },
                timeout=90,
            )
            if r.status_code == 404 and entry["source"].endswith(".mp4"):
                for quality in ("360", "240", "720"):
                    fallback = re.sub(r"play_\d+p", f"play_{quality}p", entry["source"])
                    r = requests.get(
                        fallback,
                        headers={"Referer": "https://faygurme.goatmenu.net/", "User-Agent": "Mozilla/5.0"},
                        timeout=90,
                    )
                    if r.ok:
                        entry["downloadedFrom"] = fallback
                        break
            r.raise_for_status()
            path.write_bytes(r.content)
            entry.update(status="downloaded", bytes=len(r.content), contentType=r.headers.get("Content-Type"))
            return entry
        except Exception as error:
            entry.update(status="failed", error=str(error))
            time.sleep(attempt + 1)
    return entry


with ThreadPoolExecutor(max_workers=6) as pool:
    futures = [pool.submit(download, e) for e in assets.values()]
    for i, future in enumerate(as_completed(futures), 1):
        future.result()
        if i % 25 == 0:
            print(f"Downloaded {i}/{len(futures)}", flush=True)
manifest = list(assets.values())
(ROOT / "source/asset-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(
    json.dumps(
        dict(
            downloaded=sum(e["status"] == "downloaded" for e in manifest),
            failed=[e for e in manifest if e["status"] == "failed"],
            bytes=sum(e.get("bytes", 0) for e in manifest),
        ),
        ensure_ascii=True,
    ),
    flush=True,
)
