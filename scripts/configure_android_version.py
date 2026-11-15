#!/usr/bin/env python3
"""Synchronise la version Android sur le numéro déclaré dans package.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACKAGE_JSON = ROOT / "package.json"
GRADLE = ROOT / "android" / "app" / "build.gradle"


def lire_version() -> tuple[str, int]:
    if not PACKAGE_JSON.is_file():
        raise SystemExit(f"package.json introuvable : {PACKAGE_JSON}")
    try:
        donnees = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
        version = str(donnees["version"])
    except (OSError, KeyError, TypeError, json.JSONDecodeError) as erreur:
        raise SystemExit(f"Version GRIND illisible dans package.json : {erreur}") from erreur

    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        raise SystemExit("La version doit respecter le format strict MAJOR.MINOR.PATCH (ex. 2.10.17).")
    majeur, mineur, correctif = (int(partie) for partie in match.groups())
    if mineur > 99 or correctif > 99:
        raise SystemExit("Pour le versionCode Android, MINOR et PATCH doivent rester inférieurs ou égaux à 99.")
    version_code = majeur * 10000 + mineur * 100 + correctif
    if version_code <= 0 or version_code > 2100000000:
        raise SystemExit("Le versionCode Android calculé est hors limites.")
    return version, version_code


def main() -> int:
    version, version_code = lire_version()
    if not GRADLE.is_file():
        raise SystemExit(f"Fichier Gradle Android introuvable : {GRADLE}")
    source = GRADLE.read_text(encoding="utf-8")
    match = re.search(r"defaultConfig\s*\{", source)
    if not match:
        raise SystemExit("Bloc defaultConfig introuvable dans app/build.gradle.")
    start = match.end()
    depth = 1
    index = start
    while index < len(source) and depth:
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
        index += 1
    if depth:
        raise SystemExit("Bloc defaultConfig Gradle incomplet.")

    block = source[start:index - 1]
    values = (("versionCode", str(version_code)), ("versionName", f'"{version}"'))
    for key, value in values:
        pattern = rf"(?m)^([ \t]*){key}\s+[^\n]+$"
        if re.search(pattern, block):
            block = re.sub(pattern, lambda item: f"{item.group(1)}{key} {value}", block, count=1)
        else:
            block = block.rstrip() + f"\n        {key} {value}\n    "
    updated = source[:start] + block + source[index - 1:]
    GRADLE.write_text(updated, encoding="utf-8")

    controle = GRADLE.read_text(encoding="utf-8")
    if not re.search(rf"(?m)^\s*versionCode\s+{version_code}\s*$", controle):
        raise SystemExit("La versionCode Android n'a pas été mise à jour correctement.")
    if not re.search(rf'(?m)^\s*versionName\s+"{re.escape(version)}"\s*$', controle):
        raise SystemExit("La versionName Android n'a pas été mise à jour correctement.")

    print(f"Version Android GRIND configurée : {version} ({version_code}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
