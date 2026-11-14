#!/usr/bin/env python3
"""Configure l'écran de lancement Android avec l'icône GRIND officielle.

Le script est lancé après configure_android.py : ce dernier génère les icônes
launcher depuis public/icon-512.png. On réutilise cette même icône pour le splash
Android 12+ et on garde le fond sombre GRIND déjà déclaré dans le thème."""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANDROID = ROOT / "android"
RES = ANDROID / "app" / "src" / "main" / "res"
ANDROID_NS = "http://schemas.android.com/apk/res/android"
ET.register_namespace("android", ANDROID_NS)


def upsert_style_item(style: ET.Element, name: str, value: str) -> None:
    item = next((node for node in style.findall("item") if node.get("name") == name), None)
    if item is None:
        item = ET.SubElement(style, "item", {"name": name})
    item.text = value


def configure_splash() -> None:
    theme_files = sorted(RES.glob("values*/styles.xml")) + sorted(RES.glob("values*/themes.xml"))
    if not theme_files:
        raise SystemExit(f"Aucun fichier de thème Android trouvé sous {RES}.")

    splash_themes_updated = 0
    for theme_file in theme_files:
        tree = ET.parse(theme_file)
        root = tree.getroot()
        changed = False
        for style in root.findall("style"):
            name = style.get("name", "")
            if "AppTheme" not in name or not ("Launch" in name or "Splash" in name):
                continue
            upsert_style_item(style, "android:windowSplashScreenBackground", "@color/grind_window_background")
            upsert_style_item(style, "android:windowSplashScreenAnimatedIcon", "@mipmap/ic_launcher")
            upsert_style_item(style, "android:windowSplashScreenIconBackgroundColor", "@color/grind_window_background")
            upsert_style_item(style, "android:windowBackground", "@color/grind_window_background")
            splash_themes_updated += 1
            changed = True

        if changed:
            ET.indent(tree, space="    ")
            tree.write(theme_file, encoding="utf-8", xml_declaration=True)

    if not splash_themes_updated:
        raise SystemExit("Aucun thème AppTheme.*Launch/Splash trouvé. Le splash n'a pas été modifié.")

    # L'icône est produite par configure_android.py à partir du logo GRIND officiel.
    if not list(RES.glob("mipmap-*/ic_launcher.png")):
        raise SystemExit("Icône mipmap GRIND absente : configure_android.py doit précéder ce script.")


def main() -> int:
    if not ANDROID.is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    configure_splash()
    print("Splash Android GRIND configuré depuis l'icône officielle de l'application.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
