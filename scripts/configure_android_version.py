#!/usr/bin/env python3
"""Applique la version Android à partir de l'unique source package.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = ROOT / "package.json"
GRADLE = ROOT / "android" / "app" / "build.gradle"


def lire_version() -> tuple[str, int]:
    try:
        donnees = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        version = str(donnees["version"])
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as erreur:
        raise SystemExit(f"Impossible de lire la version de {PACKAGE_JSON}: {erreur}") from erreur

    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise SystemExit(f"Version invalide dans package.json: {version!r} (format X.Y.Z requis).")

    majeur, mineur, correctif = (int(partie) for partie in match.groups())
    if majeur > 99 or mineur > 99 or correctif > 99:
        raise SystemExit("Chaque partie de la version doit être comprise entre 0 et 99 pour le versionCode Android.")

    # Formule monotone utilisée par GRIND : 2.10.16 -> 21016.
    version_code = majeur * 10000 + mineur * 100 + correctif
    return version, version_code


def remplacer_bloc_default_config(source: str, version: str, version_code: int) -> str:
    match = re.search(r"defaultConfig\s*\{", source)
    if not match:
        raise SystemExit("Bloc defaultConfig introuvable dans app/build.gradle.")

    debut = match.end()
    profondeur = 1
    index = debut
    while index < len(source) and profondeur:
        if source[index] == "{":
            profondeur += 1
        elif source[index] == "}":
            profondeur -= 1
        index += 1
    if profondeur:
        raise SystemExit("Bloc defaultConfig Gradle incomplet.")

    bloc = source[debut:index - 1]
    valeurs = (("versionCode", str(version_code)), ("versionName", f'"{version}"'))
    for cle, valeur in valeurs:
        motif = rf"(?m)^([ \t]*){cle}\s+[^\n]+$"
        if re.search(motif, bloc):
            bloc = re.sub(motif, lambda element: f"{element.group(1)}{cle} {valeur}", bloc, count=1)
        else:
            bloc = bloc.rstrip() + f"\n        {cle} {valeur}\n    "

    return source[:debut] + bloc + source[index - 1:]


def main() -> int:
    if not GRADLE.is_file():
        raise SystemExit(f"Fichier Gradle Android introuvable : {GRADLE}")

    version, version_code = lire_version()
    source = GRADLE.read_text(encoding="utf-8")
    mis_a_jour = remplacer_bloc_default_config(source, version, version_code)
    GRADLE.write_text(mis_a_jour, encoding="utf-8")

    verifie = GRADLE.read_text(encoding="utf-8")
    if not re.search(rf"(?m)^\s*versionCode\s+{version_code}\s*$", verifie):
        raise SystemExit("Le versionCode Android final ne correspond pas à package.json.")
    if not re.search(rf'(?m)^\s*versionName\s+"{re.escape(version)}"\s*$', verifie):
        raise SystemExit("Le versionName Android final ne correspond pas à package.json.")

    print(f"Version Android GRIND configurée et vérifiée : {version} ({version_code}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
