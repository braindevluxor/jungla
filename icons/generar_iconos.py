"""Genera los iconos PWA de La Jungla (herradura dorada sobre verde bosque).

Uso:  python icons/generar_iconos.py
Salida: icons/icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
"""
import os
from math import cos, radians, sin

from PIL import Image, ImageDraw

VERDE_CLARO = (23, 57, 45)      # #17392D
VERDE_OSCURO = (13, 34, 27)     # #0D221B
ORO = (224, 168, 62)            # #E0A83E
ORO_CLARO = (243, 209, 134)     # #F3D186


def degradado(tam):
    """Degradado diagonal suave de verde."""
    img = Image.new("RGB", (tam, tam))
    px = img.load()
    for y in range(tam):
        for x in range(tam):
            t = (x + y) / (2 * tam)
            px[x, y] = tuple(
                int(VERDE_CLARO[i] + (VERDE_OSCURO[i] - VERDE_CLARO[i]) * t) for i in range(3)
            )
    return img


def herradura(draw, cx, cy, radio, grosor, largo_pata, color):
    """Dibuja una herradura cuyo trazo central sigue: media luna superior + 2 patas.

    Toda la figura se construye con el mismo radio central `radio`, de modo que
    arcos y patas quedan alineados sin escalones.
    """
    mitad = grosor // 2
    bbox = [cx - radio - mitad, cy - radio - mitad, cx + radio + mitad, cy + radio + mitad]

    # Media luna (180° → 360°, mitad superior)
    draw.arc(bbox, 180, 360, fill=color, width=grosor)

    # Patas hacia abajo, alineadas al centro del trazo del arco
    for lado in (-1, 1):
        x = cx + lado * radio
        draw.line([(x, cy), (x, cy + largo_pata)], fill=color, width=grosor)
        # Punta redondeada
        draw.ellipse([x - mitad, cy + largo_pata - mitad, x + mitad, cy + largo_pata + mitad],
                     fill=color)
        # Unión arco↔pata (mismo radio central, sin escalón)
        draw.ellipse([x - mitad, cy - mitad, x + mitad, cy + mitad], fill=color)


def dibujar_clavos(draw, cx, cy, radio, grosor, largo_pata):
    """Clavos de la herradura: puntos oscuros sobre la línea central."""
    rr = max(2, grosor // 7)
    for ang in (198, 224, 250, 270, 290, 316, 342):
        a = radians(ang)
        px, py = cx + cos(a) * radio, cy + sin(a) * radio
        draw.ellipse([px - rr, py - rr, px + rr, py + rr], fill=VERDE_OSCURO)
    for lado in (-1, 1):
        for frac in (0.45, 0.78):
            px = cx + lado * radio
            py = cy + largo_pata * frac
            draw.ellipse([px - rr, py - rr, px + rr, py + rr], fill=VERDE_OSCURO)


def generar(tam, ruta, maskable=False):
    img = degradado(tam).convert("RGBA")
    cx = cy = tam // 2

    # Márgenes: maskable pide ~20% extra de zona segura
    margen = 0.30 if maskable else 0.22
    radio = int(tam * (0.5 - margen))          # radio del trazo central
    grosor = max(8, int(tam * 0.13))
    largo = int(radio * 0.95)

    # Halo suave detrás
    halo = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    dh = ImageDraw.Draw(halo)
    r_halo = int(tam * 0.36)
    dh.ellipse([cx - r_halo, cy - r_halo, cx + r_halo, cy + r_halo], fill=(255, 255, 255, 16))
    img = Image.alpha_composite(img, halo)

    # Sombra proyectada
    sombra = Image.new("RGBA", (tam, tam), (0, 0, 0, 0))
    ds = ImageDraw.Draw(sombra)
    off = max(2, tam // 80)
    herradura(ds, cx, cy + off, radio, grosor, largo, (0, 0, 0, 80))
    img = Image.alpha_composite(img, sombra)

    draw = ImageDraw.Draw(img)
    herradura(draw, cx, cy, radio, grosor, largo, ORO)

    # Brillo interior: mismo trazo central, grosor fino, centrado
    fino = max(2, grosor // 5)
    draw.arc(
        [cx - radio - fino // 2, cy - radio - fino // 2, cx + radio + fino // 2, cy + radio + fino // 2],
        195, 345, fill=ORO_CLARO, width=fino)
    for lado in (-1, 1):
        x = cx + lado * radio
        draw.line([(x, cy + grosor * 0.35), (x, cy + largo * 0.9)],
                  fill=ORO_CLARO, width=fino)

    # Clavos encima del brillo
    dibujar_clavos(draw, cx, cy, radio, grosor, largo)

    img.save(ruta, "PNG")
    print(f"OK  {ruta}  ({tam}x{tam})")


if __name__ == "__main__":
    base = os.path.dirname(os.path.abspath(__file__))
    generar(192, os.path.join(base, "icon-192.png"))
    generar(512, os.path.join(base, "icon-512.png"))
    generar(512, os.path.join(base, "icon-maskable-512.png"), maskable=True)
    generar(180, os.path.join(base, "apple-touch-icon.png"))
    Image.open(os.path.join(base, "icon-192.png")).save(
        os.path.join(base, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    print("OK  favicon.ico")
