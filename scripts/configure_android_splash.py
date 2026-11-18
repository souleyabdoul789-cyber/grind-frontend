#!/usr/bin/env python3
"""Supprime le visuel personnalisé de lancement GRIND sur Android.

Android 12+ impose une transition système au démarrage à froid/chaud.
Cette transition ne peut pas être désactivée par une application ; ce script
la rend neutre : fond identique à l'application, icône transparente et aucune
image/logo sur les anciennes versions Android.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android" / "app" / "src" / "main" / "res"
BACKGROUND_RGB = (10, 10, 15)  # #0A0A0F
ANDROID_NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID_NS)


def upsert_item(style: ET.Element, name: str, value: str) -> None:
    item = next((node for node in style.findall("item") if node.get("name") == name), None)
    if item is None:
        item = ET.SubElement(style, "item", {"name": name})
    item.text = value


def write_transparent_drawable() -> None:
    drawable_dir = RES / "drawable"
    drawable_dir.mkdir(parents=True, exist_ok=True)
    target = drawable_dir / "grind_splash_transparent.xml"
    target.write_text(
        """<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <size android:width="1dp" android:height="1dp" />
    <solid android:color="@android:color/transparent" />
</shape>
""",
        encoding="utf-8",
    )


def neutralize_android_12_splash() -> int:
    theme_files = sorted(RES.glob("values*/styles.xml")) + sorted(RES.glob("values*/themes.xml"))
    if not theme_files:
        raise SystemExit(f"Aucun fichier de thème Android trouvé sous {RES}.")

    updated = 0
    for theme_file in theme_files:
        tree = ET.parse(theme_file)
        root = tree.getroot()
        changed = False
        for style in root.findall("style"):
            name = style.get("name", "")
            if not name.startswith("AppTheme") or not ("Launch" in name or "Splash" in name):
                continue
            upsert_item(style, "android:windowSplashScreenBackground", "@color/grind_window_background")
            upsert_item(style, "android:windowSplashScreenAnimatedIcon", "@drawable/grind_splash_transparent")
            upsert_item(style, "android:windowSplashScreenIconBackgroundColor", "@android:color/transparent")
            upsert_item(style, "android:windowBackground", "@color/grind_window_background")
            changed = True
            updated += 1
        if changed:
            ET.indent(tree, space="    ")
            tree.write(theme_file, encoding="utf-8", xml_declaration=True)

    if updated == 0:
        raise SystemExit("Aucun thème AppTheme de lancement trouvé ; suppression du visuel impossible.")
    return updated


def neutralize_legacy_splash_images() -> int:
    splash_files = sorted(RES.glob("drawable*/splash.png"))
    if not splash_files:
        raise SystemExit(f"Aucune ressource splash.png Capacitor trouvée sous {RES}.")
    updated = 0
    for path in splash_files:
        with Image.open(path) as existing:
            width, height = existing.size
        if width < 1 or height < 1:
            raise SystemExit(f"Dimensions invalides pour la ressource : {path}")
        blank = Image.new("RGB", (width, height), BACKGROUND_RGB)
        blank.save(path, format="PNG", optimize=True)
        updated += 1
    return updated


def main() -> int:
    if not (ROOT / "android").is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    write_transparent_drawable()
    themes = neutralize_android_12_splash()
    images = neutralize_legacy_splash_images()
    print(
        "Visuel personnalisé de lancement supprimé : "
        f"{images} image(s) neutralisée(s), {themes} thème(s) Android ajusté(s). "
        "La transition système obligatoire Android 12+ reste sans logo."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
