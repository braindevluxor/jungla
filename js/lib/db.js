/* ============================================================
   LA JUNGLA · cliente Supabase + capa de datos
   ============================================================ */

export const SUPABASE_URL = 'https://pypbnqeumxyqbwihyqbh.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGJucWV1bXh5cWJ3aWh5cWJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5ODExNTMsImV4cCI6MjEwOTU1NzE1M30.P6Af4rwEMqSY4BCgh4HeZH2l20AmncHekDi7Nzye3ww';

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Traduce errores de Supabase a mensajes amigables. */
export function mensajeError(err) {
  const m = err?.message || String(err || '');
  const codigo = err?.code || err?.error_code || '';

  if (codigo === 'usuario_no_encontrado') {
    return 'No existe ningún usuario activo con ese nombre. Comprueba el usuario o pide al dueño que te dé de alta.';
  }
  if (/email not confirmed/i.test(m) || codigo === 'email_not_confirmed') {
    return 'Cuenta pendiente de confirmación. Revisa tu correo o pide al dueño que la confirme.';
  }
  if (/duplicate key|unique constraint/i.test(m)) {
    return /usuario/i.test(m) ? 'Ese usuario ya está en uso.' : 'Ya existe un registro con ese valor.';
  }
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permisos para esta acción.';
  if (/invalid login credentials|invalid_credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con el servidor. Revisa tu red.';
  if (/Password should be/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/already registered|already been registered/i.test(m)) return 'Ese email ya está registrado.';
  if (/PGRST202|Could not find the function/i.test(m)) {
    return 'Función de acceso no encontrada. Ejecuta el script sql/03_login_con_usuario.sql en Supabase.';
  }
  return m || 'Error inesperado.';
}

/**
 * Resuelve un usuario (o un email) al email interno con el que
 * Supabase autentica. Devuelve null si no existe o está suspendido.
 */
export async function resolverLogin(texto) {
  const entrada = String(texto || '').trim();
  if (!entrada) return null;

  // Si teclea un email, se usa tal cual
  if (entrada.includes('@')) return entrada;

  const { data, error } = await supabase.rpc('login_email', { p_usuario: entrada.toLowerCase() });
  if (error) throw error;
  return data || null;
}

/** SELECT con manejo de errores. */
export async function listar(tabla, columnas = '*', opciones = {}) {
  let q = supabase.from(tabla).select(columnas);
  if (opciones.filtros) {
    for (const [col, val] of Object.entries(opciones.filtros)) {
      if (val !== undefined && val !== null && val !== '') q = q.eq(col, val);
    }
  }
  if (opciones.rango) q = q.rango(...opciones.rango);
  if (opciones.orden) q = q.order(opciones.orden, { ascending: opciones.asc !== false });
  if (opciones.limite) q = q.limit(opciones.limite);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** INSERT → devuelve la fila creada. */
export async function insertar(tabla, valores) {
  const { data, error } = await supabase.from(tabla).insert(valores).select().single();
  if (error) throw error;
  return data;
}

/** UPDATE por id → devuelve la fila actualizada. */
export async function actualizar(tabla, id, valores) {
  const { data, error } = await supabase.from(tabla).update(valores).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

/** DELETE por id. */
export async function eliminar(tabla, id) {
  const { error } = await supabase.from(tabla).delete().eq('id', id);
  if (error) throw error;
  return true;
}

/** Cuenta filas que cumplen filtros (head + count). */
export async function contar(tabla, filtros = {}) {
  let q = supabase.from(tabla).select('id', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filtros)) {
    if (val !== undefined && val !== null && val !== '') q = q.eq(col, val);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}
