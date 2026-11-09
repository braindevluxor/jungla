"""Valida sql/05_datos_prueba.sql recorriendo el AST de PostgreSQL (pglast).

Lo que el parser NO puede comprobar y sí aquí:
  · nº de columnas de cada INSERT frente a cada fila de VALUES
  · que el SELECT, la lista de alias y las filas coincidan en ancho
  · que los nombres de caballo/tipo referenciados existan de verdad
  · coherencia de cifras (stock vs consumo, podios, premios, citas)
"""
import re
import sys

import pglast
from pglast import ast

# La consola de Windows usa cp1252: sin esto, los acentos rompen la salida
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SQL = "sql/05_datos_prueba.sql"
src = open(SQL, encoding="utf-8").read()
tree = pglast.parse_sql(src)


def walk(nodo, salida):
    """Caminador genérico: pglast v8 usa __slots__, no _fields."""
    if isinstance(nodo, (list, tuple)):
        for x in nodo:
            walk(x, salida)
        return
    if isinstance(nodo, ast.Node):
        salida.append(nodo)
        for clave in type(nodo).__slots__:
            walk(getattr(nodo, clave, None), salida)


def valor(v):
    """Valor Python de una constante del AST."""
    if v is None:
        return None
    if isinstance(v, ast.A_Const):
        val = v.val
        if val is None:
            return None
        if isinstance(val, ast.String):
            return val.sval
        if isinstance(val, ast.Integer):
            return val.ival
        if isinstance(val, ast.Float):
            return float(val.fval)
        if isinstance(val, ast.Boolean):
            return bool(val.boolval)
        return str(val)
    if isinstance(v, ast.TypeCast):
        return valor(v.arg)
    return "<expr>"


nodos = []
walk(tree, nodos)

# -----------------------------------------------------------
# 1) Recoger cada INSERT con sus columnas y sus filas
#    · directo:   INSERT ... VALUES (...)
#    · subselect: INSERT ... SELECT ... FROM (VALUES ...) AS x(a, b, ...)
# -----------------------------------------------------------
errores = []
inserts = []

for s in nodos:
    if not isinstance(s, ast.InsertStmt):
        continue

    tabla = s.relation.relname
    cols = [c.name for c in (s.cols or [])]
    sel = s.selectStmt
    filas, alias, n_select = [], cols, None

    if sel is not None and getattr(sel, "valuesLists", None):
        # INSERT ... VALUES directo
        filas = [[valor(v) for v in fila] for fila in sel.valuesLists]
    else:
        # Buscar el subrango con alias DENTRO de este statement
        # (recorrer todo el documento daría el primer VALUES del fichero)
        propios = []
        walk(s, propios)
        n_select = len(sel.targetList) if sel is not None else None
        sub = next((n for n in propios
                    if isinstance(n, ast.RangeSubselect)
                    and getattr(n, "subquery", None) is not None
                    and getattr(n.subquery, "valuesLists", None)), None)
        if sub is None:
            errores.append(f"{tabla}: no se encontró la lista de valores")
            continue
        alias = [c.sval for c in (sub.alias.colnames or [])]
        filas = [[valor(v) for v in fila] for fila in sub.subquery.valuesLists]

    inserts.append({"tabla": tabla, "cols": cols, "alias": alias,
                    "filas": filas, "n_select": n_select})

# -----------------------------------------------------------
# 2) Anchos: columnas ↔ SELECT ↔ alias ↔ filas
# -----------------------------------------------------------
for ins in inserts:
    t, cols, alias, filas = ins["tabla"], ins["cols"], ins["alias"], ins["filas"]
    if ins["n_select"] is not None and ins["n_select"] != len(cols):
        errores.append(f"{t}: SELECT con {ins['n_select']} expresiones "
                       f"pero {len(cols)} columnas de destino")
    if len(alias) != len(cols):
        errores.append(f"{t}: alias con {len(alias)} nombres "
                       f"pero {len(cols)} columnas {cols}")
    for i, fila in enumerate(filas, 1):
        if len(fila) != len(alias):
            errores.append(f"{t}: fila {i} tiene {len(fila)} valores "
                           f"pero el alias declara {len(alias)} ({alias})")

# -----------------------------------------------------------
# 3) Referencias cruzadas: caballos y tipos
# -----------------------------------------------------------
def filas_de(tabla):
    return next((i for i in inserts if i["tabla"] == tabla), None)


cab_ins = filas_de("caballos")
caballos = []
if cab_ins:
    i = cab_ins["alias"].index("nombre")
    caballos = [f[i] for f in cab_ins["filas"]]

TIPOS_BASE = ["Concentrado", "Heno", "Avena", "Maíz", "Pasto", "Suplemento"]
tip_ins = filas_de("tipos_alimento")
tipos = list(TIPOS_BASE)
if tip_ins:
    i = tip_ins["alias"].index("nombre")
    tipos = sorted(set(tipos) | {f[i] for f in tip_ins["filas"]})

if len(caballos) != len(set(caballos)):
    dup = sorted({c for c in caballos if caballos.count(c) > 1})
    errores.append(f"nombres de caballo duplicados: {dup}")

# Tablas que referencian un caballo por nombre (1ª columna)
for t in ("horarios_alimentacion", "herrajes", "historial_veterinario", "competencias"):
    ins = filas_de(t)
    if not ins:
        errores.append(f"{t}: falta el INSERT")
        continue
    i = ins["alias"].index("caballo")
    for n, f in enumerate(ins["filas"], 1):
        if f[i] not in caballos:
            errores.append(f"{t} fila {n}: caballo '{f[i]}' no existe")

# horarios → tipo; inventario_alimentos → tipo
ins = filas_de("horarios_alimentacion")
if ins:
    i = ins["alias"].index("tipo")
    for n, f in enumerate(ins["filas"], 1):
        if f[i] not in tipos:
            errores.append(f"horarios fila {n}: tipo '{f[i]}' no existe")

ins = filas_de("inventario_alimentos")
if ins:
    i = ins["alias"].index("tipo")
    for n, f in enumerate(ins["filas"], 1):
        if f[i] not in tipos:
            errores.append(f"inventario_alimentos fila {n}: tipo '{f[i]}' no existe")

# -----------------------------------------------------------
# 4) Coherencia numérica
# -----------------------------------------------------------
resumen = {}


def col(ins, nombre):
    return ins["alias"].index(nombre)


for ins in inserts:
    t, f = ins["tabla"], ins["filas"]

    if t == "caballos":
        resumen["caballos"] = len(f)
        i = col(ins, "estado")
        resumen["caballos_activos"] = sum(1 for x in f if x[i] == "activo")

    elif t == "horarios_alimentacion":
        resumen["horarios"] = len(f)
        i_a = col(ins, "activo")
        resumen["horarios_activos"] = sum(1 for x in f if x[i_a] is True)
        i_p = col(ins, "porcion")
        por = {}
        for x in f:
            if x[i_a] is True:
                por[x[col(ins, "caballo")]] = round(
                    por.get(x[col(ins, "caballo")], 0.0) + float(x[i_p]), 2)
        resumen["kg_por_caballo"] = por

    elif t == "inventario_alimentos":
        resumen["alimentos"] = len(f)
        i_c, i_m = col(ins, "cantidad"), col(ins, "minimo")
        resumen["alertas_alim"] = [x[0] for x in f if float(x[i_c]) <= float(x[i_m])]

    elif t == "inventario_medicinas":
        resumen["medicinas"] = len(f)
        i_c, i_m = col(ins, "cantidad"), col(ins, "stock_minimo")
        resumen["alertas_med"] = [x[0] for x in f if float(x[i_c]) <= float(x[i_m])]

    elif t == "herrajes":
        resumen["herrajes"] = len(f)
        i_p = col(ins, "dprox")
        resumen["herraje_vencido"] = [x[0] for x in f
                                      if isinstance(x[i_p], int) and x[i_p] < 0]
        resumen["herraje_en_14d"] = [x[0] for x in f
                                     if isinstance(x[i_p], int) and 0 <= x[i_p] <= 14]

    elif t == "historial_veterinario":
        resumen["vet"] = len(f)
        i_c = col(ins, "dcita")
        resumen["citas_futuras"] = sorted(
            (x[0], x[i_c]) for x in f if isinstance(x[i_c], int) and x[i_c] >= 0)

    elif t == "competencias":
        resumen["competencias"] = len(f)
        i_p, i_pr = col(ins, "puesto"), col(ins, "premio")
        resumen["podios"] = sum(1 for x in f
                                if x[i_p] and re.match(r"^[123]", str(x[i_p])))
        resumen["premios_total"] = sum(float(x[i_pr]) for x in f if x[i_pr] is not None)

    elif t == "inventario_medicinas":
        pass

# -----------------------------------------------------------
# Informe
# -----------------------------------------------------------
print("=== INSERT detectados ===")
for ins in inserts:
    print(f"  {ins['tabla']:26} cols={len(ins['cols']):2}  filas={len(ins['filas']):2}")

print("\n=== Resumen ===")
for k, v in resumen.items():
    print(f"  {k}: {v}")

print("\n=== Referencias ===")
print(f"  caballos ({len(caballos)}): {caballos}")
print(f"  tipos    ({len(tipos)}): {tipos}")

if "kg_por_caballo" in resumen:
    total = sum(resumen["kg_por_caballo"].values())
    print("\n=== Consumo diario por caballo (horarios activos) ===")
    for k, v in resumen["kg_por_caballo"].items():
        print(f"  {k:12} {v:5.2f} kg")
    print(f"  {'TOTAL':12} {total:5.2f} kg")

    ins = filas_de("inventario_alimentos")
    if ins:
        i_c = col(ins, "cantidad")
        conc = next((x for x in ins["filas"] if "Concentrado" in str(x[0])), None)
        heno = next((x for x in ins["filas"] if str(x[0]).startswith("Heno")), None)
        if conc:
            print(f"\n  concentrado {conc[i_c]} kg = "
                  f"{float(conc[i_c]) / 11:.0f} dias a 11 kg/dia")
        if heno:
            print(f"  heno        {heno[i_c]} kg = "
                  f"{float(heno[i_c]) / 26:.0f} dias a 26 kg/dia")

print()
if errores:
    print("!!! ERRORES !!!")
    for e in errores:
        print("  -", e)
else:
    print("OK: anchos de columna y referencias cruzadas correctos.")

sys.exit(1 if errores else 0)
