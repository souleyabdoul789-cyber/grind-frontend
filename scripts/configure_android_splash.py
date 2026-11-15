#!/usr/bin/env python3
"""Configure les écrans de lancement Android générés par Capacitor pour GRIND.

Le projet Android est régénéré par `npx cap add android` à chaque build CI.
Ce fichier configure donc les ressources natives créées pendant cette génération :
- remplace chaque splash.png Capacitor (portrait, paysage et drawable générique) ;
- conserve les dimensions propres à chaque densité et orientation ;
- centre l'icône officielle GRIND sur le fond sombre de l'application ;
- configure aussi le splash natif Android 12+ avec l'icône du lanceur GRIND.
"""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError as exc:  # pragma: no cover - exécuté dans GitHub Actions
    raise SystemExit("Pillow est requis : python3 -m pip install pillow") from exc

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
RES = ANDROID / "app" / "src" / "main" / "res"
ICON_SOURCE = ROOT / "public" / "icon-512.png"
ANDROID_NS = "http://schemas.android.com/apk/res/android"
BACKGROUND_RGB = (10, 10, 15)  # #0A0A0F — fond noir doux de GRIND
# L'icône garde son carré de fond #0A0A0F, identique au fond du splash.
# Sa taille est calculée à partir du petit côté pour rester cohérente en portrait/paysage.
SPLASH_ICON_RATIO = 0.28
ET.register_namespace("android", ANDROID_NS)


def upsert_style_item(style: ET.Element, name: str, value: str) -> None:
    item = next((node for node in style.findall("item") if node.get("name") == name), None)
    if item is None:
        item = ET.SubElement(style, "item", {"name": name})
    item.text = value


def configure_native_splash_themes() -> int:
    """Définit le fond et l'icône GRIND sur le thème de lancement natif."""
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
        raise SystemExit(
            "Aucun thème AppTheme.*Launch/Splash trouvé. "
            "Le splash natif GRIND n'a pas été configuré."
        )

    return splash_themes_updated


def configure_legacy_splash_images() -> int:
    """Remplace les PNG Capacitor blancs par le logo officiel GRIND centré."""
    if not ICON_SOURCE.is_file():
        raise SystemExit(f"Icône officielle GRIND introuvable : {ICON_SOURCE}")

    icon = Image.open(ICON_SOURCE).convert("RGBA")
    if icon.width < 1 or icon.height < 1:
        raise SystemExit(f"Icône GRIND vide ou invalide : {ICON_SOURCE}")

    # Capacitor génère un splash.png générique et des variantes port/land par densité.
    # On remplace uniquement ces images de lancement, pas les autres ressources.
    splash_files = sorted(RES.glob("drawable*/splash.png"))
    if not splash_files:
        raise SystemExit(
            f"Aucune ressource splash.png Capacitor trouvée sous {RES}. "
            "Le format du projet Android généré a peut-être changé."
        )

    updated = 0
    for splash_file in splash_files:
        with Image.open(splash_file) as existing:
            width, height = existing.size

        if width < 1 or height < 1:
            raise SystemExit(f"Dimensions invalides pour la ressource : {splash_file}")

        icon_side = max(1, round(min(width, height) * SPLASH_ICON_RATIO))
        resized_icon = icon.resize((icon_side, icon_side), Image.Resampling.LANCZOS)

        # L'icône du lanceur contient déjà son fond noir. On détecte les pixels
        # du dessin qui diffèrent du fond, puis on centre ce dessin visible lui-même.
        # Cela évite de conserver un éventuel décalage interne de quelques pixels
        # présent dans le carré d'origine.
        icon_rgb = Image.new("RGB", resized_icon.size, BACKGROUND_RGB)
        icon_rgb.paste(resized_icon, (0, 0), resized_icon.getchannel("A"))
        fond = Image.new("RGB", resized_icon.size, BACKGROUND_RGB)
        difference = ImageChops.difference(icon_rgb, fond).convert("L")
        bounds = difference.point(lambda value: 255 if value > 8 else 0).getbbox()
        if bounds is None:
            raise SystemExit(f"Aucun dessin visible dans l'icône GRIND : {ICON_SOURCE}")
        logo_visible = resized_icon.crop(bounds)

        # Position calculée à partir des limites visibles : le centre géométrique
        # du logo coïncide avec celui de chaque splash, quelle que soit l'orientation.
        x = (width - logo_visible.width) // 2
        y = (height - logo_visible.height) // 2
        canvas = Image.new("RGB", (width, height), BACKGROUND_RGB)
        canvas.paste(logo_visible, (x, y), logo_visible.getchannel("A"))
        canvas.save(splash_file, format="PNG", optimize=True)
        updated += 1

    return updated


def verify_launcher_icon() -> None:
    """Vérifie que configure_android.py a bien généré l'icône utilisée sur Android 12+."""
    launcher_icons = list(RES.glob("mipmap-*/ic_launcher.png"))
    if not launcher_icons:
        raise SystemExit(
            "Icône mipmap GRIND absente : configure_android.py doit précéder ce script."
        )


def configure_splash() -> None:
    verify_launcher_icon()
    themes_updated = configure_native_splash_themes()
    images_updated = configure_legacy_splash_images()
    print(
        "Splash Android GRIND configuré : "
        f"{images_updated} image(s) Capacitor remplacée(s), "
        f"{themes_updated} thème(s) natif(s) mis à jour, "
        "fond #0A0A0F et icône officielle centrée."
    )


def main() -> int:
    if not ANDROID.is_dir():
        raise SystemExit("Projet Android absent : lancer d'abord `npx cap add android`.")
    configure_splash()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
