# -*- coding: utf-8 -*-
#!/usr/bin/env python3
"""
Organiza imágenes de Proyectos/ hacia assets/img/projects/{categoria}/{id}/,
actualiza data/projects.json (thumbs + galerías) y crea entradas nuevas
con tags: ["nuevo"] cuando el trabajo no estaba en el portafolio.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "Proyectos"
OUT = ROOT / "assets" / "img" / "projects"
JSON_PATH = ROOT / "data" / "projects.json"

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
MAX_SIDE = 1400
GALLERY_MAX = 6
JPEG_QUALITY = 78

# Preferencias al elegir thumb / galería
BOOST = (
    "render", "final", "logo", "cover", "hero", "mockup", "portada",
    "isotipo", "imagotipo", "logotipo", "cuadrado", "horiz", "foto",
)
PENALTY = ("proceso", "wa00", "screenshot", "captura", "tmp", "copy", "copia")


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def slugify(s: str) -> str:
    s = nfc(s).lower().strip()
    s = re.sub(r"[áàäâ]", "a", s)
    s = re.sub(r"[éèëê]", "e", s)
    s = re.sub(r"[íìïî]", "i", s)
    s = re.sub(r"[óòöô]", "o", s)
    s = re.sub(r"[úùüû]", "u", s)
    s = s.replace("ñ", "n")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "item"


def find_dir(*parts: str) -> Path | None:
    """Resuelve una ruta bajo Proyectos/ tolerando NFD/NFC en macOS."""
    cur = SRC
    for part in parts:
        if not cur.exists():
            return None
        want = nfc(part).casefold()
        match = None
        for child in cur.iterdir():
            if nfc(child.name).casefold() == want:
                match = child
                break
        if match is None:
            return None
        cur = match
    return cur


def collect_images(*folder_parts: str) -> list[Path]:
    d = find_dir(*folder_parts)
    if not d:
        return []
    files = [
        f for f in d.rglob("*")
        if f.is_file() and f.suffix.lower() in IMG_EXT and not f.name.startswith(".")
    ]
    # Evitar fuentes / basura embebida en rutas raras
    files = [f for f in files if "fuentes" not in nfc(str(f)).casefold()]
    return files


def score(path: Path) -> float:
    name = nfc(path.name).casefold()
    s = 0.0
    try:
        size = path.stat().st_size
    except OSError:
        return -1e9
    # Preferir archivos con algo de peso, pero no monstruos
    if size < 8_000:
        s -= 50
    elif size < 40_000:
        s -= 10
    elif 80_000 <= size <= 4_000_000:
        s += 20
    elif size > 12_000_000:
        s -= 15
    for w in BOOST:
        if w in name:
            s += 12
    for w in PENALTY:
        if w in name:
            s -= 8
    # PNG de logo a menudo es buen thumb
    if path.suffix.lower() == ".png" and any(k in name for k in ("logo", "iso", "imago", "cuadrado")):
        s += 8
    return s


def pick(files: list[Path], n: int) -> list[Path]:
    ranked = sorted(files, key=score, reverse=True)
    chosen: list[Path] = []
    seen = set()
    for f in ranked:
        key = (f.stat().st_size, f.name.casefold())
        if key in seen:
            continue
        seen.add(key)
        chosen.append(f)
        if len(chosen) >= n:
            break
    return chosen


def export_image(src: Path, dest: Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    # Siempre JPEG web para peso predecible
    dest = dest.with_suffix(".jpg")
    tmp = dest.with_suffix(".tmp.jpg")
    try:
        cmd = [
            "sips",
            "-Z", str(MAX_SIDE),
            "-s", "format", "jpeg",
            "-s", "formatOptions", str(JPEG_QUALITY),
            str(src),
            "--out", str(tmp),
        ]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not tmp.exists() or tmp.stat().st_size < 500:
            # Fallback: copiar original si sips falla (p.ej. CMYK raros)
            shutil.copy2(src, dest.with_suffix(src.suffix.lower()))
            if tmp.exists():
                tmp.unlink()
            return dest.with_suffix(src.suffix.lower()).exists()
        tmp.replace(dest)
        return True
    except Exception as e:
        print(f"  ! fallo {src.name}: {e}")
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        return False


def materialize(project_id: str, category: str, sources: list[Path]) -> tuple[str | None, list[str]]:
    if not sources:
        return None, []
    selected = pick(sources, GALLERY_MAX)
    dest_dir = OUT / category / project_id
    if dest_dir.exists():
        shutil.rmtree(dest_dir)
    paths: list[str] = []
    for i, src in enumerate(selected):
        name = "thumb.jpg" if i == 0 else f"{i:02d}.jpg"
        dest = dest_dir / name
        ok = export_image(src, dest)
        final = dest if dest.exists() else dest.with_suffix(src.suffix.lower())
        if ok and final.exists():
            rel = final.relative_to(ROOT).as_posix()
            paths.append(rel)
    thumb = paths[0] if paths else None
    return thumb, paths


# ---------------------------------------------------------------------------
# Mapeo: id existente o nuevo ? carpetas fuente + meta si es nuevo
# ---------------------------------------------------------------------------
# Cada entrada: (id, category, [folder_parts...], new_meta|None)
# folder_parts es lista de segmentos bajo Proyectos/

EXISTING: list[tuple] = [
    ("aiesec-awards", "graphic", [("Experiencias", "eventos", "awards")]),
    ("zonalito-2020-1", "graphic", [("Experiencias", "eventos", "confidencialito")]),
    ("zonalito-2020-2", "graphic", [("Experiencias", "eventos", "big hero")]),
    ("zonalito-2019", "graphic", [("Experiencias", "eventos", "KCA")]),
    ("mi-centro", "experience", [("Experiencias", "Mi centro")]),
    ("thor-machine", "experience", [
        ("Experiencias", "Thor Machine", "THOR"),
        ("Experiencias", "Thor Machine"),
    ]),
    ("fwd", "engineering", [("Ingenieria", "fdw")]),
    ("joha", "engineering", [("Ingenieria", "JOHA")]),  # puede no tener imgs
    ("kory", "engineering", [("Ingenieria", "kory")]),
    ("grid-1", "research", [("Investigación", "comparasiones materiales")]),
    ("grid-3", "research", [("Investigación", "viabilidad de Albatros")]),
    ("center-box", "design", [("Diseño", "Center box")]),
    ("overlap", "design", [("Diseño", "Overlap")]),
    ("diesel-chair", "design", [("Diseño", "Silla Disiel")]),
    ("stad", "design", [("Diseño", "Stad")]),
    ("tengu", "design", [("Diseño", "Tengu")]),
    # SBS software: sin imágenes de producto; la marca va a proyecto graphic nuevo
]

NEW: list[tuple] = [
    # --- Diseño ---
    ("twist-lamp", "design", [("Diseño", "Twist Lamp")], {
        "title": "Twist Lamp",
        "summary": "Lámpara de mesa con geometría torsionada; modelado y prototipo.",
        "year": 2018,
        "tech": ["Rhino", "Prototipado"],
    }),
    ("perchero-arana", "design", [("Diseño", "Perchero araña")], {
        "title": "Perchero Araña",
        "summary": "Perchero de pie con estructura radial; diseño y construcción.",
        "year": 2018,
        "tech": ["Madera", "Prototipado"],
    }),
    ("eslovensa", "design", [("Diseño", "Eslovensa")], {
        "title": "Eslovensa",
        "summary": "Proyecto de diseño de producto / mobiliario.",
        "year": 2018,
        "tech": ["Diseño industrial"],
    }),
    ("control-headset", "design", [("Diseño", "Control and Headset")], {
        "title": "Control and Headset",
        "summary": "Concepto de control y headset; modelado 3D.",
        "year": 2017,
        "tech": ["Creo", "Rhino"],
    }),
    ("premios-design", "design", [("Diseño", "Premios")], {
        "title": "Premios  Piezas de diseño",
        "summary": "Piezas y reconocimientos de diseño.",
        "year": 2018,
        "tech": ["Diseño"],
    }),
    ("kangooru", "design", [("Diseño", "kangooru")], {
        "title": "Kangooru",
        "summary": "Proyecto de diseño de producto.",
        "year": 2017,
        "tech": ["Diseño industrial"],
    }),
    # --- Makers / freelance (fuera de dominios previos ? design + tag nuevo) ---
    ("open-mate", "design", [("FreeLance", "Open-Mate")], {
        "title": "Open-Mate  Destapadores",
        "summary": "Diseño freelance de destapadores; planos DXF y pieza final.",
        "year": 2020,
        "tech": ["DXF", "Fabricación"],
        "client": "Freelance",
    }),
    ("caja-de-gatos", "design", [("mkdas varias", "caja de gatos")], {
        "title": "Caja de gatos",
        "summary": "Maker project: caja / mueble para gatos.",
        "year": 2019,
        "tech": ["Maker", "Madera"],
    }),
    ("viana", "design", [("mkdas varias", "Viana")], {
        "title": "Viana",
        "summary": "Proyecto maker / ilustración de personaje.",
        "year": 2019,
        "tech": ["Ilustración", "Maker"],
    }),
    # --- Ingeniería ---
    ("try-engine", "engineering", [("Ingenieria", "try")], {
        "title": "TRY  Vehículo / motor",
        "summary": "Exploración de ingeniería: vistas, proceso y componentes de motor.",
        "year": 2019,
        "tech": ["Ingeniería", "CAD"],
    }),
    # --- Investigación ---
    ("aero-social", "research", [("Investigación", "Aero social")], {
        "title": "Aero Social",
        "summary": "Investigación sobre aerogeneración / impacto social.",
        "year": 2019,
        "tech": ["Investigación"],
    }),
    ("tensoestructuras", "research", [("Investigación", "tensoestructuras")], {
        "title": "Tensoestructuras",
        "summary": "Estudio y resultados de tensoestructuras.",
        "year": 2019,
        "tech": ["Estructuras", "Investigación"],
    }),
    # --- Diseño gráfico: ilustración ---
    ("ilustracion-game", "graphic", [("Diseño Grafico", "ilustraciones", "Game")], {
        "title": "Ilustraciones  Game",
        "summary": "Serie de ilustraciones con estética gamer.",
        "year": 2020,
        "tech": ["Illustrator", "Photoshop"],
    }),
    ("ilustracion-kombi", "graphic", [("Diseño Grafico", "ilustraciones", "kombi")], {
        "title": "Ilustraciones  Kombi",
        "summary": "Ilustraciones inspiradas en la Volkswagen Kombi.",
        "year": 2020,
        "tech": ["Illustrator", "Photoshop"],
    }),
    ("ilustracion-liveseo", "graphic", [("Diseño Grafico", "ilustraciones", "LiveSEO")], {
        "title": "Ilustraciones  LiveSEO",
        "summary": "Ilustraciones para marca LiveSEO.",
        "year": 2020,
        "tech": ["Illustrator"],
        "client": "LiveSEO",
    }),
    ("ilustracion-minimalism", "graphic", [("Diseño Grafico", "ilustraciones", "minimalism")], {
        "title": "Ilustraciones  Minimalism",
        "summary": "Serie de ilustraciones minimalistas.",
        "year": 2020,
        "tech": ["Illustrator"],
    }),
    # --- Imagen de marca ---
    ("brand-estilistas", "graphic", [("Diseño Grafico", "Imagen de marca", "estilistas de corazones")], {
        "title": "Estilistas de Corazones  Marca",
        "summary": "Identidad visual y logo para Estilistas de Corazones.",
        "year": 2021,
        "tech": ["Illustrator", "Photoshop"],
    }),
    ("brand-evolucion", "graphic", [("Diseño Grafico", "Imagen de marca", "Evolucion tecnologica")], {
        "title": "Evolución Tecnológica  Marca",
        "summary": "Sistema de marca: isotipo, imagotipo y logotipo.",
        "year": 2021,
        "tech": ["Illustrator"],
    }),
    ("brand-jonathan", "graphic", [("Diseño Grafico", "Imagen de marca", "Jonathan sandoval")], {
        "title": "Marca personal  Jonathan Sandoval",
        "summary": "Exploración de identidad visual personal.",
        "year": 2021,
        "tech": ["Illustrator"],
    }),
    ("brand-sbs", "graphic", [("Diseño Grafico", "Imagen de marca", "sbs")], {
        "title": "SBS  Imagen de marca",
        "summary": "Identidad visual y piezas gráficas para SBS.",
        "year": 2020,
        "tech": ["Illustrator", "Photoshop"],
    }),
    ("brand-via", "graphic", [("Diseño Grafico", "Imagen de marca", "VIA ingenieria")], {
        "title": "VIA Ingeniería  Marca",
        "summary": "Identidad visual, logos y aplicaciones para VIA Ingeniería.",
        "year": 2021,
        "tech": ["Illustrator"],
        "client": "VIA Ingeniería",
    }),
    # --- Publicidad ---
    ("pub-amigos-caninos", "graphic", [("Diseño Grafico", "publicidad", "Amigos caninos")], {
        "title": "Publicidad  Amigos Caninos",
        "summary": "Piezas publicitarias para Amigos Caninos.",
        "year": 2020,
        "tech": ["Photoshop", "Illustrator"],
    }),
    ("pub-atletas", "graphic", [("Diseño Grafico", "publicidad", "atletas recordistas")], {
        "title": "Publicidad  Atletas Recordistas",
        "summary": "Campaña gráfica para atletas recordistas.",
        "year": 2020,
        "tech": ["Photoshop"],
    }),
    ("pub-clases", "graphic", [("Diseño Grafico", "publicidad", "Clases")], {
        "title": "Publicidad  Clases",
        "summary": "Piezas promocionales para clases / formación.",
        "year": 2020,
        "tech": ["Photoshop"],
    }),
    ("pub-conciertos", "graphic", [("Diseño Grafico", "publicidad", "conciertos")], {
        "title": "Publicidad  Conciertos",
        "summary": "Piezas gráficas para conciertos y eventos musicales.",
        "year": 2020,
        "tech": ["Photoshop"],
    }),
    ("pub-ivan-sports", "graphic", [("Diseño Grafico", "publicidad", "Ivan Sports")], {
        "title": "Publicidad  Ivan Sports",
        "summary": "Material publicitario para Ivan Sports.",
        "year": 2020,
        "tech": ["Photoshop", "Illustrator"],
        "client": "Ivan Sports",
    }),
    ("pub-maxifrio", "graphic", [("Diseño Grafico", "publicidad", "MaxiFrio")], {
        "title": "Publicidad  MaxiFrio",
        "summary": "Piezas publicitarias para MaxiFrio.",
        "year": 2020,
        "tech": ["Photoshop"],
        "client": "MaxiFrio",
    }),
    ("pub-party", "graphic", [("Diseño Grafico", "publicidad", "party")], {
        "title": "Publicidad  Party",
        "summary": "Diseño gráfico para eventos / party.",
        "year": 2020,
        "tech": ["Photoshop"],
    }),
    ("pub-liveseo", "graphic", [("Diseño Grafico", "publicidad", "LiveSEO")], {
        "title": "Publicidad  LiveSEO",
        "summary": "Piezas publicitarias para LiveSEO.",
        "year": 2020,
        "tech": ["Photoshop", "Illustrator"],
        "client": "LiveSEO",
    }),
    # --- Redes sociales ---
    ("social-adis", "graphic", [("Diseño Grafico", "Redes sociales", "ADIS")], {
        "title": "Redes  ADIS",
        "summary": "Contenido visual para redes sociales de ADIS.",
        "year": 2021,
        "tech": ["Photoshop", "Illustrator"],
        "client": "ADIS",
    }),
    ("social-liveseo", "graphic", [("Diseño Grafico", "Redes sociales", "liveSEO")], {
        "title": "Redes  LiveSEO",
        "summary": "Contenido para redes sociales de LiveSEO.",
        "year": 2020,
        "tech": ["Photoshop"],
        "client": "LiveSEO",
    }),
    ("social-muimia", "graphic", [("Diseño Grafico", "Redes sociales", "Muimia")], {
        "title": "Redes  Muimia",
        "summary": "Contenido visual para redes de Muimia.",
        "year": 2021,
        "tech": ["Photoshop"],
    }),
    ("social-opg", "graphic", [("Diseño Grafico", "Redes sociales", "OPG")], {
        "title": "Redes  OPG",
        "summary": "Contenido para redes sociales de OPG.",
        "year": 2021,
        "tech": ["Photoshop"],
        "client": "OPG",
    }),
]


def gather(folder_list: list[tuple]) -> list[Path]:
    files: list[Path] = []
    seen = set()
    for parts in folder_list:
        for f in collect_images(*parts):
            key = str(f.resolve())
            if key not in seen:
                seen.add(key)
                files.append(f)
    return files


def main() -> None:
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    by_id = {p["id"]: p for p in data["projects"]}
    report = []

    OUT.mkdir(parents=True, exist_ok=True)

    # --- Actualizar existentes ---
    for pid, cat, folders in EXISTING:
        files = gather(folders)
        # Para Thor: si pedimos THOR + raíz, priorizar THOR en el score ya está;
        # limitar loose: si hay muchas, quedarnos con las mejores globales.
        thumb, images = materialize(pid, cat, files)
        if pid not in by_id:
            report.append(f"SKIP missing id {pid}")
            continue
        p = by_id[pid]
        if thumb:
            p["thumb"] = thumb
            p["images"] = images
            # Quitar placeholder HOme
            report.append(f"OK  {pid:24} {len(images)} imgs  ({len(files)} fuente)")
        else:
            report.append(f"--  {pid:24} sin imágenes útiles ({len(files)} fuente)")

    # --- Crear / refrescar nuevos ---
    for pid, cat, folders, meta in NEW:
        files = gather(folders)
        thumb, images = materialize(pid, cat, files)
        if not thumb:
            report.append(f"--  NEW {pid:20} sin imágenes ({len(files)} fuente)")
            continue
        entry = {
            "id": pid,
            "category": cat,
            "title": meta["title"],
            "summary": meta.get("summary", ""),
            "year": meta.get("year"),
            "tech": meta.get("tech", []),
            "thumb": thumb,
            "images": images,
            "tags": ["nuevo"],
            "status": "Documented",
            "visible": True,
        }
        if meta.get("client"):
            entry["client"] = meta["client"]
        if pid in by_id:
            # Conservar campos manuales, refrescar media + tag
            old = by_id[pid]
            old["thumb"] = thumb
            old["images"] = images
            tags = list(old.get("tags") or [])
            if "nuevo" not in tags:
                tags.append("nuevo")
            old["tags"] = tags
            old["category"] = cat
            for k, v in entry.items():
                if k in ("thumb", "images", "tags", "id"):
                    continue
                if k not in old or old.get(k) in (None, "", [], {}):
                    old[k] = v
            report.append(f"UPD {pid:24} {len(images)} imgs + tag nuevo")
        else:
            data["projects"].append(entry)
            by_id[pid] = entry
            report.append(f"NEW {pid:24} {len(images)} imgs + tag nuevo")

    # Limpiar thumbs placeholder HOme en software si siguen
    for p in data["projects"]:
        t = p.get("thumb") or ""
        if "HOme.png" in t:
            p["thumb"] = ""
            if p.get("images") == ["assets/img/brand/HOme.png"] or (
                isinstance(p.get("images"), list)
                and all("HOme.png" in str(x) for x in p["images"])
            ):
                p["images"] = []

    # Documentación
    data["_documentacion"] = (
        "Proyectos del portafolio. Lo lee projects.js. Cada proyecto: id, "
        "category (graphic|experience|engineering|research|software|design), "
        "title, summary, year, tech, thumb/images, links, visible, order, tags "
        "(p.ej. [\"nuevo\"]), y campos opcionales (status, client, features). "
        "Imágenes en assets/img/projects/{category}/{id}/. "
        "visible:false oculta. order: menor = primero."
    )

    JSON_PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Contar peso
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print("\n".join(report))
    print(f"\nProyectos en JSON: {len(data['projects'])}")
    print(f"assets/img/projects: {total/1024/1024:.1f} MB")


if __name__ == "__main__":
    main()
