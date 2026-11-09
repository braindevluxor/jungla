"""Vista previa de los iconos de Flaticon sobre el verde de la app."""
import os

from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.abspath(__file__))
VERDE = (23, 57, 45)
ORO = (224, 168, 62)

ARCHIVOS = [
    ("cabeza-de-caballo.png", "Caballo"),
    ("herradura.png", "Herradura"),
]

TAM = 512
lienzo = Image.new("RGB", (TAM * len(ARCHIVOS), TAM + 46), VERDE)
d = ImageDraw.Draw(lienzo)

for i, (nombre, etiqueta) in enumerate(ARCHIVOS):
    img = Image.open(os.path.join(BASE, nombre)).convert("RGBA")
    x = i * TAM
    lienzo.paste(img, (x, 0), img)
    d.text((x + 14, TAM + 14), f"{etiqueta}  ({nombre})", fill=ORO)

salida = os.path.join(BASE, "_preview.png")
lienzo.save(salida)
print("OK", salida, lienzo.size)
