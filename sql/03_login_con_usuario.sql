-- ============================================================
-- LA JUNGLA · PASO 3 — ACCESO POR USUARIO
-- Ejecutar DESPUÉS de 01_esquema.sql
-- (Si acabas de crear el esquema con el 01 actualizado, este
--  script es inocuo: solo añade lo que falte.)
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Supabase solo autentica con email + contraseña. Para que se
-- entre con USUARIO, guardamos `usuario` en profiles y creamos
-- esta función que lo traduce en el email interno de la cuenta.
-- ============================================================

begin;

-- 1) Columna `usuario` (por si el esquema se creó antes de este cambio)
alter table public.profiles
  add column if not exists usuario text;

-- 2) Rellena `usuario` con el prefijo del email de las cuentas existentes
--    (solo si todavía no lo tienen) y lo normaliza a minúsculas.
do $$
declare
  r record;
  base text;
  cand text;
  n int;
begin
  for r in
    select p.id, u.email
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.usuario is null or p.usuario = ''
  loop
    base := lower(regexp_replace(split_part(coalesce(r.email, 'usuario'), '@', 1),
                                 '[^a-z0-9._-]', '', 'g'));
    base := left(base, 17);
    if length(base) < 3 then
      base := rpad(base, 3, '0');
    end if;

    cand := base;
    n := 1;
    while exists (select 1 from public.profiles where usuario = cand) loop
      n := n + 1;
      cand := left(base, 20 - length('_' || n::text)) || '_' || n;
    end loop;

    update public.profiles set usuario = cand where id = r.id;
  end loop;

  -- Normaliza mayúsculas de los que ya existan
  update public.profiles
     set usuario = lower(usuario)
   where usuario is distinct from lower(usuario);
end $$;

-- 3) Restricciones
alter table public.profiles
  alter column usuario set not null;

do $$
begin
  if not exists (
    select 1 from pg_index i
      join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
     where i.indrelid = 'public.profiles'::regclass
       and i.indisunique
       and a.attname = 'usuario'
  ) then
    create unique index profiles_usuario_key on public.profiles (usuario);
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and conname = 'profiles_usuario_formato'
  ) then
    alter table public.profiles
      add constraint profiles_usuario_formato
      check (usuario ~ '^[a-z0-9._-]{3,20}$');
  end if;
end $$;

-- 4) Traduce usuario → email de la cuenta (para iniciar sesión).
--    SECURITY DEFINER: solo lee, no devuelve nada más, y únicamente
--    para cuentas activas.
create or replace function public.login_email(p_usuario text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.activo
     and p.usuario = lower(trim(coalesce(p_usuario, '')))
   limit 1;
$$;

comment on function public.login_email(text) is
  'Devuelve el email interno de una cuenta a partir de su usuario (solo activas).';

-- 5) Concesión explícita: el script 01 revoca todo a `anon`,
--    así que hay que devolverle SOLO esta función.
revoke all on function public.login_email(text) from public, anon, authenticated;
grant execute on function public.login_email(text) to anon, authenticated;

commit;

-- Verificación
select p.usuario, p.rol, p.activo,
       public.login_email(p.usuario) is not null as acceso_ok
  from public.profiles p
 order by p.usuario;
