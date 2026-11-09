"""Convierte public/logo.png (dorado, fondo transparente) en public/logo.webp.

El logo es dorado, así que se coloca sobre una base cuadrada verde bosque
(el mismo de la app) para que siempre destaque. La base cuadrada permite
recortes circulares (encabezado, login) sin cortar el dibujo.

Uso:  python public/convertir_logo.py
"""
import os

from PIL import Image

BASE = os.path.dirname(os.path.abspath(__file__))
ORIGEN = os.path.join(BASE, "logo.png")
SALIDA = os.path.join(BASE, "logo.webp")

TAM = 512            # lienzo cuadrado
RELLENO = 0.80       # porcentaje del lienzo que ocupa el logo

VERDE_CENTRO = (23, 57, 45)    # #17392D  (verde-700)
VERDE_BORDE = (13, 34, 27)     # #0D221B  (verde-900)


def degradado_verde(tam):
    """Degradado radial suave: el centro algo más claro resalta el oro."""
    img = Image.new("RGB", (tam, tam))
    px = img.load()
    cx = cy = tam / 2
    max_d = (cx ** 2 + cy ** 2) ** 0.5
    for y in range(tam):
        for x in range(tam):
            d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 / max_d
            t = d ** 1.15
            px[x, y] = tuple(
                int(VERDE_CENTRO[i] + (VERDE_BORDE[i] - VERDE_CENTRO[i]) * t) for i in range(3)
            )
    return img


def main():
    logo = Image.open(ORIGEN).convert("RGBA")

    # Recortar el aire transparente alrededor del dibujo
    bbox = logo.split()[-1].getbbox()
    if bbox:
        logo = logo.crop(bbox)

    # Ajustar al lienzo respetando proporción
    objetivo = int(TAM * RELLENO)
    escala = min(objetivo / logo.width, objetivo / logo.height)
    nuevo = logo.resize(
        (max(1, round(logo.width * escala)), max(1, round(logo.height * escala))),
        Image.LANCZOS,
    )

    lienzo = degradado_verde(TAM).convert("RGBA")
    lienzo.paste(nuevo, ((TAM - nuevo.width) // 2, (TAM - nuevo.height) // 2), nuevo)

    lienzo.convert("RGB").save(SALIDA, "WEBP", quality=92, method=6)
    print(f"OK  {SALIDA}  ({TAM}x{TAM}, WebP, base verde)")


if __name__ == "__main__":
    main()
