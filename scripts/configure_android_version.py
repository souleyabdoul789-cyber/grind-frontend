#!/usr/bin/env python3
"""Applique la version GRIND courante après la configuration Android Capacitor."""
from __future__ import annotations

import re
from pathlib import Path

VERSION_CODE = "21009"
VERSION_NAME = '"2.10.9"'
GRADLE = Path(__file__).resolve().parents[1] / "android" / "app" / "build.gradle"


def main() -> int:
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
    for key, value in (("versionCode", VERSION_CODE), ("versionName", VERSION_NAME)):
        pattern = rf"(?m)^([ \t]*){key}\s+[^\n]+$"
        if re.search(pattern, block):
            block = re.sub(pattern, lambda item: f"{item.group(1)}{key} {value}", block, count=1)
        else:
            block = block.rstrip() + f"\n        {key} {value}\n    "
    GRADLE.write_text(source[:start] + block + source[index - 1:], encoding="utf-8")

    updated = GRADLE.read_text(encoding="utf-8")
    if not re.search(r"(?m)^\s*versionCode\s+21009\s*$", updated):
        raise SystemExit("La versionCode Android n'a pas été mise à jour.")
    if not re.search(r'(?m)^\s*versionName\s+"2\.10\.9"\s*$', updated):
        raise SystemExit("La versionName Android n'a pas été mise à jour.")
    print("Version Android GRIND configurée : 2.10.9 (21009).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
