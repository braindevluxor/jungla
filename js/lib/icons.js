/* ============================================================
   LA JUNGLA · Set de iconos
   - SVG en línea (trazo) para la mayoría.
   - PNG de Flaticon para 'caballos' y 'herradura', pintados con
     CSS mask para que también hereden el color actual.
   Uso: icono('caballos', 20)  →  string HTML
   ============================================================ */

/** Iconos raster (Flaticon) → se pintan con el color actual (mask). */
const RASTER = {
  caballos: 'icons/flaticon/cabeza-de-caballo.png',
  herradura: 'icons/flaticon/herradura.png',
  herrajes: 'icons/flaticon/herradura.png',
};

const TRAZOS = {
  /* Navegación / panel */
  panel: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
  alimentacion:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.4 2"/>',
  inventario:
    '<path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  medicinas:
    '<path d="M9.5 3.8a4.6 4.6 0 0 1 6.5 6.5l-5.7 5.7a4.6 4.6 0 0 1-6.5-6.5l5.7-5.7Z"/><path d="m7.5 8.8 6.5 6.5"/>',
  veterinario:
    '<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M4.5 3h3M12.5 3h3"/><path d="M10 12v2.5a5.5 5.5 0 0 0 11 0V12"/><circle cx="21" cy="10" r="2"/>',
  competencias:
    '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5a0 0 0 0 0 0 0c0 2 1.2 3.6 3 4.2M17 6h2.5c0 2-1.2 3.6-3 4.2"/><path d="M12 14v3m-3.5 4h7m-5.5-4h4l.7 4h-5.4l.7-4Z"/>',
  usuarios:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.9c1.7.9 3 2.6 3 5.1"/>',
  perfil:
    '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-3.8 3.4-6.5 7.5-6.5s7.5 2.7 7.5 6.5"/>',

  /* Acciones */
  mas: '<path d="M12 5v14M5 12h14"/>',
  editar:
    '<path d="M4 20h4.5L20 8.5 15.5 4 4 15.5V20Z"/><path d="m14 5.5 4.5 4.5"/>',
  borrar:
    '<path d="M4 7h16"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7 7.6 20.5h8.8L17.5 7"/><path d="M10.5 10.5v6M13.5 10.5v6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.2-4.2"/>',
  cerrar: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m4.5 12.5 5 5 10-11"/>',
  volver: '<path d="M15 5.5 8.5 12l6.5 6.5"/>',
  adelante: '<path d="M9 5.5 15.5 12 9 18.5"/>',
  recargar: '<path d="M20 5.5v5h-5"/><path d="M19.3 10.5A7.5 7.5 0 1 0 19 15.5"/>',
  salir:
    '<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M11 12h10m-3.5-3.5L21 12l-3.5 3.5"/>',
  ajustes:
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6"/>',

  /* Estados / info */
  aviso: '<path d="M12 4 2.7 20h18.6L12 4Z"/><path d="M12 10v4.5M12 17.3v.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.2"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  calendario:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
  foto:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 5-4.5 4 3.5 3-2.5 3.5 3.5"/>',
  filtro: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  estadisticas:
    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  alerta_punto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V13M12 16.3v.2"/>',
  llave: '<circle cx="8" cy="14" r="4.5"/><path d="m11.5 11 8-8M17 5.5l2.5 2.5M14.5 8 17 10.5"/>',
};

/**
 * Devuelve el icono indicado como HTML en línea.
 * Los de `RASTER` son PNG que se pintan con el color actual (mask);
 * el resto son SVG de trazo.
 * @param {string} nombre clave del icono
 * @param {number} tam  tamaño en px
 * @param {string} clase clases CSS opcionales
 */
export function icono(nombre, tam = 20, clase = 'ico') {
  const src = RASTER[nombre];
  if (src) {
    return `<span class="${clase} ico--raster" role="img" aria-hidden="true"
      style="width:${tam}px;height:${tam}px;
             -webkit-mask-image:url('${src}');mask-image:url('${src}')"></span>`;
  }
  const d = TRAZOS[nombre] || TRAZOS.info;
  return `<svg class="${clase}" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${d}</svg>`;
}

export const ICONOS = Object.keys(TRAZOS);
