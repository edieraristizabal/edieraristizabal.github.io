"""Actualiza data/publications.json desde Google Scholar y OpenAlex.

Uso (desde la raíz del repo):
    python scripts/update_publications.py

1. Descarga el perfil de Google Scholar (todas las páginas, por fecha).
2. Une los duplicados (versión en español e inglés del mismo artículo,
   entradas repetidas sin revista) y clasifica cada entrada en
   article / conference / preprint / thesis / other.
3. Busca el DOI y el enlace de acceso abierto en OpenAlex por título.
4. Conserva los campos editados a mano en data/publications_overrides.json.
"""
import html
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

SCHOLAR_USER = "jelk50QAAAAJ"
OPENALEX_AUTHORS = ["A5075901372", "A5063958790", "A5122525314", "A5154143647"]
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "publications.json"
OVERRIDES = ROOT / "data" / "publications_overrides.json"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# Entradas de Scholar que no son publicaciones reales (borradores, encabezados).
DROP_TITLES = ["earth sciences research journal", "version preliminar del articulo", "para la gestion ambiental en el valle de aburra"]


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8")


def norm(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()


def key(s):
    return " ".join(norm(s))


def scholar():
    pubs, profile = [], {}
    start = 0
    while True:
        url = f"https://scholar.google.com/citations?hl=en&user={SCHOLAR_USER}&cstart={start}&pagesize=100&sortby=pubdate"
        t = get(url)
        if start == 0:
            st = re.findall(r'class="gsc_rsb_std">(\d+)<', t)
            profile = {"citations": int(st[0]), "citations_5y": int(st[1]), "h_index": int(st[2]),
                       "h_index_5y": int(st[3]), "i10_index": int(st[4]), "i10_index_5y": int(st[5])}
        rows = re.findall(r'<tr class="gsc_a_tr">(.*?)</tr>', t, re.S)
        n = 0
        for row in rows:
            m = re.search(r'href="([^"]+)" class="gsc_a_at">(.*?)</a>', row, re.S)
            if not m:
                continue
            n += 1
            grays = re.findall(r'<div class="gs_gray">(.*?)</div>', row, re.S)
            yr = re.search(r'gsc_a_h gsc_a_hc gs_ibl">(\d*)<', row)
            ct = re.search(r'gsc_a_ac gs_ibl">(\d*)<', row)
            venue = html.unescape(re.sub(r"<span.*?</span>", "", grays[1])) if len(grays) > 1 else ""
            pubs.append({
                "title": html.unescape(m.group(2)).strip(),
                "authors": html.unescape(grays[0]).strip() if grays else "",
                "venue": re.sub(r"\s+", " ", venue).strip(" ,"),
                "year": int(yr.group(1)) if yr and yr.group(1) else None,
                "citations": int(ct.group(1)) if ct and ct.group(1) else 0,
                "scholar": "https://scholar.google.com" + html.unescape(m.group(1)),
            })
        if n < 100:
            break
        start += 100
        time.sleep(3)
    return pubs, profile


def classify(p):
    v = p["venue"].lower()
    if re.search(r"egusphere|ssrn|essoar|preprint|arxiv", v):
        return "preprint"
    if re.search(r"abstract|egu\d|egu |general assembly|agu |conference|congress|workshop|forum|e3s web|international conference|meeting|egu2", v + " "):
        return "conference"
    if re.search(r"universi|instituto tecnol|shimane", v) and not re.search(r"revista|bolet|journal|\(\d+\)", v):
        return "thesis"
    if not v:
        return "other"
    return "article"


def venue_parts(p):
    v = key(p["venue"])
    name = " ".join(w for w in v.split() if not w.isdigit())
    nums = [w for w in v.split() if w.isdigit()]
    return name, nums


def same_venue(p, q):
    # La versión ES y EN del mismo artículo comparten revista, año, volumen y
    # páginas; Scholar a veces omite parte de los números o alarga el nombre.
    (n1, a), (n2, b) = venue_parts(p), venue_parts(q)
    if not a or not b or len(n1) < 4 or len(n2) < 4 or abs(p["year"] - q["year"]) > 1:
        return False
    if not (n1.startswith(n2) or n2.startswith(n1)):
        return False
    k = min(len(a), len(b))
    return a[:k] == b[:k]


# Pares ES/EN que Scholar registra con revistas distintas (inicio de cada título normalizado).
MANUAL_SAME = [
    ("geomorphology applied to landslide occurrence", "geomorfologia aplicada a la ocurrencia"),
    ("comparacion del desempeno de modelo shia", "a comparison of linear and nonlinear model performance"),
]


def same_title(p, q):
    t1, t2 = key(p["title"]), key(q["title"])
    for a, b in MANUAL_SAME:
        if (t1.startswith(a) and t2.startswith(b)) or (t1.startswith(b) and t2.startswith(a)):
            return True
    if len(t1) >= 30 and len(t2) >= 30 and (t1.startswith(t2) or t2.startswith(t1)):
        return True
    return SequenceMatcher(None, t1, t2).ratio() > 0.9


def dedupe(pubs):
    out = []
    for p in pubs:
        if not p["year"] or any(d in key(p["title"]) for d in DROP_TITLES) or p["venue"].startswith("Instituto Tecnol"):
            # Las entradas "Instituto Tecnológico Metropolitano (ITM)" son la versión en inglés de TecnoLógicas.
            continue
        p["type"] = classify(p)
        dup = None
        dup = next((q for q in out if same_venue(p, q)), None) or next((q for q in out if same_title(p, q)), None)
        if dup is None and p["type"] == "other":
            continue  # sin revista ni duplicado identificable: suele ser una traducción suelta
        if dup is None:
            p["alt_titles"] = []
            out.append(p)
            continue
        # Se queda con la versión que tiene revista y más citas; suma las citas.
        a, b = (dup, p) if (dup["venue"] and dup["citations"] >= p["citations"]) or not p["venue"] else (p, dup)
        merged = dict(a)
        merged["citations"] = dup["citations"] + p["citations"]
        alt = set(dup.get("alt_titles", [])) | {b["title"]}
        alt.discard(a["title"])
        merged["alt_titles"] = sorted(alt)
        out[out.index(dup)] = merged
    return out


def openalex():
    works = []
    for aid in OPENALEX_AUTHORS:
        url = ("https://api.openalex.org/works?filter=author.id:" + aid +
               "&per-page=200&select=doi,title,publication_year,open_access,primary_location")
        works += json.loads(get(url))["results"]
    return works


def attach_dois(pubs, works):
    for p in pubs:
        best, score = None, 0.0
        for w in works:
            for t in [p["title"]] + p.get("alt_titles", []):
                r = SequenceMatcher(None, key(t), key(w.get("title") or "")).ratio()
                if r > score:
                    best, score = w, r
        if best and score > 0.88:
            if best.get("doi"):
                p["doi"] = best["doi"].replace("https://doi.org/", "")
            oa = (best.get("open_access") or {}).get("oa_url")
            if oa:
                p["oa_url"] = oa


def main():
    pubs, profile = scholar()
    print(f"Scholar: {len(pubs)} entradas", file=sys.stderr)
    pubs = dedupe(pubs)
    try:
        attach_dois(pubs, openalex())
    except Exception as e:  # OpenAlex es opcional
        print("OpenAlex falló:", e, file=sys.stderr)
    if OVERRIDES.exists():
        ov = json.loads(OVERRIDES.read_text(encoding="utf-8"))
        for p in pubs:
            p.update(ov.get(key(p["title"])[:60], {}))
    pubs.sort(key=lambda p: (-p["year"], -p["citations"]))
    counts = {}
    for p in pubs:
        counts[p["type"]] = counts.get(p["type"], 0) + 1
    data = {"updated": time.strftime("%Y-%m-%d"), "profile": profile, "counts": counts, "publications": pubs}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(pubs)} publicaciones únicas {counts} -> {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
