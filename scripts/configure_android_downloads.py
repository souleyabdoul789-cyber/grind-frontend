#!/usr/bin/env python3
"""Installe le plugin Android GRIND qui publie les PDF dans Téléchargements."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
PLUGIN_SOURCE = ROOT / "scripts" / "android" / "GrindDownloadsPlugin.java"
JAVA_ROOT = ANDROID / "app" / "src" / "main" / "java"


def main() -> int:
    if not ANDROID.is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    if not PLUGIN_SOURCE.is_file():
        raise SystemExit(f"Source du plugin GRIND Downloads introuvable : {PLUGIN_SOURCE}")

    candidates = sorted(JAVA_ROOT.rglob("MainActivity.java")) if JAVA_ROOT.is_dir() else []
    if not candidates:
        raise SystemExit(f"MainActivity.java introuvable sous : {JAVA_ROOT}")

    activity = candidates[0]
    source = activity.read_text(encoding="utf-8")
    package_match = re.search(r"^package\s+([\w.]+);", source, re.MULTILINE)
    if not package_match:
        raise SystemExit(f"Package Android introuvable dans : {activity}")
    package_name = package_match.group(1)

    package_dir = JAVA_ROOT / Path(*package_name.split("."))
    package_dir.mkdir(parents=True, exist_ok=True)
    plugin_destination = package_dir / "GrindDownloadsPlugin.java"
    plugin_source = PLUGIN_SOURCE.read_text(encoding="utf-8").replace("__APP_PACKAGE__", package_name)
    plugin_destination.write_text(plugin_source, encoding="utf-8")

    plugin_import = f"import {package_name}.GrindDownloadsPlugin;"
    if plugin_import not in source:
        bridge_import = "import com.getcapacitor.BridgeActivity;"
        if bridge_import not in source:
            raise SystemExit(f"Import BridgeActivity introuvable dans : {activity}")
        source = source.replace(bridge_import, bridge_import + "\n" + plugin_import, 1)

    registration = "registerPlugin(GrindDownloadsPlugin.class);"
    if registration not in source:
        super_call = re.search(r"super\.onCreate\(\s*savedInstanceState\s*\)\s*;", source)
        if not super_call:
            raise SystemExit(f"Appel super.onCreate introuvable dans : {activity}")
        source = source[:super_call.start()] + "        " + registration + "\n        " + source[super_call.start():]

    activity.write_text(source, encoding="utf-8")
    print("Plugin GrindDownloads installé et enregistré dans MainActivity.java.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
