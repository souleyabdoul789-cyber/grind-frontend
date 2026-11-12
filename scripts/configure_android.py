#!/usr/bin/env python3
"""Configure le projet Android Capacitor généré pendant GitHub Actions."""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover - exécuté dans GitHub Actions
    raise SystemExit("Pillow est requis : python3 -m pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
RES = ANDROID / "app" / "src" / "main" / "res"
MANIFEST = ANDROID / "app" / "src" / "main" / "AndroidManifest.xml"
ICON_SOURCE = ROOT / "public" / "icon-512.png"
ANDROID_NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID_NS)


def android_attr(name: str) -> str:
    return f"{{{ANDROID_NS}}}{name}"


def configure_manifest() -> None:
    if not MANIFEST.is_file():
        raise SystemExit(f"Manifest Android introuvable : {MANIFEST}")

    tree = ET.parse(MANIFEST)
    root = tree.getroot()
    permissions = {
        element.get(android_attr("name"))
        for element in root.findall("uses-permission")
    }
    required_permissions = (
        "android.permission.INTERNET",
        "android.permission.CAMERA",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
    )
    for permission in required_permissions:
        if permission not in permissions:
            ET.SubElement(root, "uses-permission", {android_attr("name"): permission})

    features = {
        element.get(android_attr("name")): element
        for element in root.findall("uses-feature")
    }
    for feature in ("android.hardware.camera", "android.hardware.microphone"):
        element = features.get(feature)
        if element is None:
            element = ET.SubElement(root, "uses-feature", {android_attr("name"): feature})
        element.set(android_attr("required"), "false")

    ET.indent(tree, space="    ")
    tree.write(MANIFEST, encoding="utf-8", xml_declaration=True)


def configure_launcher_icons() -> None:
    if not ICON_SOURCE.is_file():
        raise SystemExit(f"Icône GRIND introuvable : {ICON_SOURCE}")

    source = Image.open(ICON_SOURCE).convert("RGBA")
    density_sizes = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    adaptive_foreground_sizes = {
        "mdpi": 108,
        "hdpi": 162,
        "xhdpi": 216,
        "xxhdpi": 324,
        "xxxhdpi": 432,
    }

    for density, size in density_sizes.items():
        directory = RES / f"mipmap-{density}"
        directory.mkdir(parents=True, exist_ok=True)
        icon = source.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(directory / "ic_launcher.png", optimize=True)
        icon.save(directory / "ic_launcher_round.png", optimize=True)

    # L'icône adaptative garde la palette du logo existant, avec un espace sûr
    # autour du cerveau afin que les masques circulaires/carrés ne le rognent pas.
    for density, size in adaptive_foreground_sizes.items():
        directory = RES / f"mipmap-{density}"
        directory.mkdir(parents=True, exist_ok=True)
        canvas = Image.new("RGBA", (size, size), (10, 10, 15, 255))
        margin = round(size * 0.10)
        artwork = source.resize((size - 2 * margin, size - 2 * margin), Image.Resampling.LANCZOS)
        canvas.alpha_composite(artwork, (margin, margin))
        canvas.save(directory / "ic_launcher_foreground.png", optimize=True)

    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    (drawable / "ic_launcher_background.xml").write_text(
        '''<?xml version="1.0" encoding="utf-8"?>\n'''
        '''<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n'''
        '''    <solid android:color="#0A0A0F" />\n'''
        '''</shape>\n''',
        encoding="utf-8",
    )

    adaptive = RES / "mipmap-anydpi-v26"
    adaptive.mkdir(parents=True, exist_ok=True)
    adaptive_xml = (
        '''<?xml version="1.0" encoding="utf-8"?>\n'''
        '''<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'''
        '''    <background android:drawable="@drawable/ic_launcher_background" />\n'''
        '''    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'''
        '''</adaptive-icon>\n'''
    )
    (adaptive / "ic_launcher.xml").write_text(adaptive_xml, encoding="utf-8")
    (adaptive / "ic_launcher_round.xml").write_text(adaptive_xml, encoding="utf-8")


def main() -> int:
    if not ANDROID.is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    configure_manifest()
    configure_launcher_icons()
    print("Manifest Android, permissions et icône GRIND configurés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
