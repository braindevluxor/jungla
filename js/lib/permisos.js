/* ============================================================
   LA JUNGLA · permisos por rol
   (Espejo exacto de las funciones SQL mi_rol() y puede_escribir())
   ============================================================ */

export const ROLES = ['dueno', 'cuidador', 'veterinario'];

export const ETIQUETA_ROL = {
  dueno: 'Dueño',
  cuidador: 'Cuidador',
  veterinario: 'Veterinario',
};

/** Secciones del menú visibles para cada rol. */
export const MENU = [
  { id: 'panel',        etiqueta: 'Panel',        icono: 'panel',        roles: ['dueno', 'cuidador', 'veterinario'] },
  { id: 'caballos',     etiqueta: 'Caballos',     icono: 'caballos',     roles: ['dueno', 'cuidador', 'veterinario'] },
  { id: 'alimentacion', etiqueta: 'Alimentación', icono: 'alimentacion', roles: ['dueno', 'cuidador'] },
  { id: 'inventario',   etiqueta: 'Inventario',   icono: 'inventario',   roles: ['dueno', 'cuidador', 'veterinario'] },
  { id: 'herrajes',     etiqueta: 'Herrajes',     icono: 'herrajes',     roles: ['dueno', 'cuidador'] },
  { id: 'veterinario',  etiqueta: 'Veterinario',  icono: 'veterinario',  roles: ['dueno', 'veterinario'] },
  { id: 'competencias', etiqueta: 'Competencias', icono: 'competencias', roles: ['dueno', 'cuidador', 'veterinario'] },
  { id: 'usuarios',     etiqueta: 'Usuarios',     icono: 'usuarios',     roles: ['dueno'] },
];

/** Tablas en las que cada rol puede escribir (crear/editar/borrar). */
const ESCRITURA = {
  dueno: null, // null = todas
  cuidador: new Set([
    'caballos', 'horarios_alimentacion', 'tipos_alimento',
    'inventario_alimentos', 'herrajes', 'competencias',
  ]),
  veterinario: new Set(['inventario_medicinas', 'historial_veterinario']),
};

/** ¿Puede el rol escribir en la tabla? (lectura: todos los roles autenticados) */
export function puedeEscribir(rol, tabla) {
  if (!rol) return false;
  const permitido = ESCRITURA[rol];
  if (permitido === null) return true;
  return permitido.has(tabla);
}

/** ¿Puede el rol ver la sección del menú? */
export function puedeVer(rol, seccion) {
  return MENU.find((m) => m.id === seccion)?.roles.includes(rol) ?? false;
}

/** Secciones visibles para un rol. */
export function menuDe(rol) {
  return MENU.filter((m) => m.roles.includes(rol));
}
