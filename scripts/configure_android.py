#!/usr/bin/env python3
"""Configure le projet Android Capacitor généré pendant GitHub Actions."""
from __future__ import annotations

import re
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
        "android.permission.POST_NOTIFICATIONS",
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
    application = root.find("application")
    if application is None:
        raise SystemExit("Balise application absente du manifeste Android.")
    metadata = next((node for node in application.findall("meta-data")
                     if node.get(android_attr("name")) == "com.google.mlkit.vision.DEPENDENCIES"), None)
    if metadata is None:
        metadata = ET.SubElement(application, "meta-data")
    metadata.set(android_attr("name"), "com.google.mlkit.vision.DEPENDENCIES")
    metadata.set(android_attr("value"), "barcode_ui")
    ET.indent(tree, space="    ")
    tree.write(MANIFEST, encoding="utf-8", xml_declaration=True)


def _upsert_style_item(style: ET.Element, name: str, value: str) -> None:
    item = next((node for node in style.findall("item") if node.get("name") == name), None)
    if item is None:
        item = ET.SubElement(style, "item", {"name": name})
    item.text = value


def configure_native_window_theme() -> None:
    """Évite les bandes natives blanches autour de la WebView et du splash Android."""
    values_dir = RES / "values"
    values_dir.mkdir(parents=True, exist_ok=True)

    # Couleur de secours de la fenêtre native, visible derrière les barres système
    # et pendant les transitions avant le premier rendu React.
    colors_file = values_dir / "colors.xml"
    if colors_file.is_file():
        colors_tree = ET.parse(colors_file)
        colors_root = colors_tree.getroot()
    else:
        colors_root = ET.Element("resources")
        colors_tree = ET.ElementTree(colors_root)

    background = next(
        (node for node in colors_root.findall("color") if node.get("name") == "grind_window_background"),
        None,
    )
    if background is None:
        background = ET.SubElement(colors_root, "color", {"name": "grind_window_background"})
    background.text = "#0A0A0F"
    ET.indent(colors_tree, space="    ")
    colors_tree.write(colors_file, encoding="utf-8", xml_declaration=True)

    # Capacitor génère ces thèmes à chaque build : on les corrige à la génération,
    # sans ajouter de fichiers Android générés au dépôt Git.
    theme_files = sorted(RES.glob("values*/styles.xml")) + sorted(RES.glob("values*/themes.xml"))
    if not theme_files:
        raise SystemExit(f"Aucun fichier styles.xml/themes.xml trouvé sous {RES}")

    themes_updated = 0
    for theme_file in theme_files:
        tree = ET.parse(theme_file)
        root = tree.getroot()
        changed = False
        for style in root.findall("style"):
            style_name = style.get("name", "")
            if not style_name.startswith("AppTheme"):
                continue

            # Même fond sur le décor natif, la WebView et les transitions.
            _upsert_style_item(style, "android:windowBackground", "@color/grind_window_background")
            _upsert_style_item(style, "android:statusBarColor", "@android:color/transparent")
            _upsert_style_item(style, "android:navigationBarColor", "@android:color/transparent")
            _upsert_style_item(style, "android:windowLightStatusBar", "false")
            _upsert_style_item(style, "android:windowLightNavigationBar", "false")
            _upsert_style_item(style, "windowActionBar", "false")
            _upsert_style_item(style, "android:windowNoTitle", "true")

            if "Launch" in style_name:
                _upsert_style_item(
                    style,
                    "android:windowSplashScreenBackground",
                    "@color/grind_window_background",
                )
            changed = True

        if changed:
            ET.indent(tree, space="    ")
            tree.write(theme_file, encoding="utf-8", xml_declaration=True)
            themes_updated += 1

    if themes_updated == 0:
        raise SystemExit("Aucun thème AppTheme trouvé : impossible de corriger le fond natif GRIND.")


def configure_edge_to_edge() -> None:
    """Active le bord-à-bord et colore la surface native de la palette GRIND."""
    java_root = ANDROID / "app" / "src" / "main" / "java"
    candidates = sorted(java_root.rglob("MainActivity.java")) if java_root.is_dir() else []
    if not candidates:
        raise SystemExit(f"MainActivity.java introuvable sous : {java_root}")
    activity = candidates[0]
    source = activity.read_text(encoding="utf-8")

    if not re.search(r"^package\s+[\w.]+;", source, re.MULTILINE):
        raise SystemExit(f"Déclaration package introuvable dans : {activity}")
    if not re.search(r"public\s+class\s+MainActivity\s+extends\s+BridgeActivity", source):
        raise SystemExit(f"MainActivity n'étend pas BridgeActivity : {activity}")

    if "import androidx.activity.EdgeToEdge;" not in source:
        bridge_import = "import com.getcapacitor.BridgeActivity;"
        if bridge_import not in source:
            raise SystemExit(f"Import BridgeActivity introuvable dans : {activity}")
        source = source.replace(
            bridge_import,
            "import androidx.activity.EdgeToEdge;\n" + bridge_import,
            1,
        )

    if "EdgeToEdge.enable(this);" not in source:
        super_call = re.search(r"super\.onCreate\(\s*savedInstanceState\s*\)\s*;", source)
        if super_call:
            source = source[:super_call.start()] + "EdgeToEdge.enable(this);\n        " + source[super_call.start():]
        else:
            class_open = re.search(
                r"public\s+class\s+MainActivity\s+extends\s+BridgeActivity\s*\{",
                source,
            )
            if not class_open:
                raise SystemExit(f"Début de classe MainActivity introuvable dans : {activity}")
            method = (
                "\n    @Override\n"
                "    public void onCreate(android.os.Bundle savedInstanceState) {\n"
                "        EdgeToEdge.enable(this);\n"
                "        super.onCreate(savedInstanceState);\n"
                "    }\n"
            )
            source = source[:class_open.end()] + method + source[class_open.end():]

    # EdgeToEdge rend les barres transparentes. Le décor natif doit aussi avoir
    # un fond sombre, sinon Android laisse apparaître un rectangle blanc dans les
    # zones d'insets que la WebView ne recouvre pas (notamment sur certains WebView).
    if "getWindow().getDecorView().setBackgroundColor" not in source:
        super_call = re.search(r"super\.onCreate\(\s*savedInstanceState\s*\)\s*;", source)
        if not super_call:
            raise SystemExit(f"Appel super.onCreate introuvable dans : {activity}")
        insertion = (
            "\n        getWindow().getDecorView().setBackgroundColor("
            "android.graphics.Color.rgb(10, 10, 15));"
            "\n        getWindow().setStatusBarColor(android.graphics.Color.TRANSPARENT);"
            "\n        getWindow().setNavigationBarColor(android.graphics.Color.TRANSPARENT);"
        )
        source = source[:super_call.end()] + insertion + source[super_call.end():]

    activity.write_text(source, encoding="utf-8")


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


def configure_app_version() -> None:
    """Expose le numéro de version GRIND dans les informations Android."""
    gradle = ANDROID / "app" / "build.gradle"
    if not gradle.is_file():
        raise SystemExit(f"Fichier Gradle Android introuvable : {gradle}")
    source = gradle.read_text(encoding="utf-8")
    match = re.search(r"defaultConfig\s*\{", source)
    if not match:
        raise SystemExit("Bloc defaultConfig introuvable dans app/build.gradle.")
    start = match.end()
    depth = 1
    index = start
    while index < len(source) and depth:
        if source[index] == "{": depth += 1
        elif source[index] == "}": depth -= 1
        index += 1
    if depth:
        raise SystemExit("Bloc defaultConfig Gradle incomplet.")
    block = source[start:index - 1]
    for key, value in (("versionCode", "21003"), ("versionName", '"2.10.3"')):
        pattern = rf"(?m)^([ \t]*){key}\s+[^\n]+$"
        if re.search(pattern, block):
            block = re.sub(pattern, lambda m: f"{m.group(1)}{key} {value}", block, count=1)
        else:
            block = block.rstrip() + f"\n        {key} {value}\n    "
    gradle.write_text(source[:start] + block + source[index - 1:], encoding="utf-8")


def main() -> int:
    if not ANDROID.is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    configure_manifest()
    configure_app_version()
    configure_native_window_theme()
    configure_edge_to_edge()
    configure_launcher_icons()
    print("Manifest, QR scanner ML Kit, version 2.10.3, thème natif, bord-à-bord, permissions et icône GRIND configurés.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
