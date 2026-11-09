/* ============================================================
   LA JUNGLA · utilidades de formato (fechas, números, texto)
   ============================================================ */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** 'YYYY-MM-DD' → '12 mar 2026' (sin desfases de zona horaria) */
export function fecha(iso, { largo = false } = {}) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return largo ? `${d} de ${MESES_LARGO[m - 1]} de ${y}` : `${d} ${MESES[m - 1]} ${y}`;
}

/** 'HH:MM:SS' → 'HH:MM' */
export function hora(iso) {
  if (!iso) return '—';
  return String(iso).slice(0, 5);
}

/** Hoy en 'YYYY-MM-DD' (hora local) */
export function hoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días entre hoy y una fecha ISO. Positivo = futuro. */
export function diasDesde(iso) {
  if (!iso) return null;
  const a = new Date(hoy() + 'T00:00:00');
  const b = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/** 1234.5 → '1.234,5' */
export function num(v, decimales = null) {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  const d = decimales === null
    ? (Number.isInteger(n) ? 0 : (String(n).split('.')[1] || '').length)
    : decimales;
  return n.toLocaleString('es', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** 1234 → '$1.234' */
export function moneda(v) {
  if (v === null || v === undefined || v === '') return '—';
  return '$' + num(v, 0);
}

/** Texto libre → iniciales para avatar */
export function iniciales(texto) {
  if (!texto) return '?';
  return texto.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

/** Escapa HTML para insertar datos de usuario */
export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Días restantes hasta vencimiento → { texto, clase } */
export function vencimiento(iso) {
  const d = diasDesde(iso);
  if (d === null) return { texto: '—', clase: 'chip--gris' };
  if (d < 0) return { texto: `vencido hace ${Math.abs(d)} d`, clase: 'chip--rojo' };
  if (d <= 30) return { texto: `vence en ${d} d`, clase: 'chip--ambar' };
  return { texto: `vence ${fecha(iso)}`, clase: 'chip--gris' };
}

/** Etiquetas legibles para valores guardados en la BD */
export const ETIQUETAS = {
  sexo: { macho: 'Macho', hembra: 'Hembra' },
  estado: {
    activo: 'Activo', baja: 'De baja',
    vendido: 'Vendido', fallecido: 'Fallecido',
  },
  rol: { dueno: 'Dueño', cuidador: 'Cuidador', veterinario: 'Veterinario' },
};

export function etiqueta(grupo, valor) {
  return ETIQUETAS[grupo]?.[valor] || valor || '—';
}
