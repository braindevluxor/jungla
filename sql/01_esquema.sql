-- ============================================================
-- LA JUNGLA · PASO 1 — ESQUEMA DE LA BASE DE DATOS
-- Ejecutar DESPUÉS de 00_limpiar_todo.sql
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) Utilidades
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 1) Perfiles de usuario (roles: dueño · cuidador · veterinario)
-- ------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  usuario    text not null unique
             check (usuario ~ '^[a-z0-9._-]{3,20}$'),
  nombre     text not null,
  rol        text not null check (rol in ('dueno', 'cuidador', 'veterinario')),
  telefono   text,
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Usuarios de La Jungla y su rol.';
comment on column public.profiles.usuario is
  'Nombre de usuario para entrar (minúsculas, 3-20 caracteres: a-z 0-9 . _ -).';

-- ------------------------------------------------------------
-- 2) Caballos
-- ------------------------------------------------------------
create table public.caballos (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  raza             text,
  sexo             text check (sexo in ('macho', 'hembra')),
  fecha_nacimiento date,
  color            text,
  peso_kg          numeric(6,1) check (peso_kg is null or peso_kg > 0),
  numero_registro  text,
  estado           text not null default 'activo'
                   check (estado in ('activo', 'baja', 'vendido', 'fallecido')),
  ubicacion        text,
  foto_url         text,
  notas            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger caballos_touch before update on public.caballos
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 3) Tipos de alimento
-- ------------------------------------------------------------
create table public.tipos_alimento (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4) Horarios de alimentación (hora + tipo + porción)
-- ------------------------------------------------------------
create table public.horarios_alimentacion (
  id                uuid primary key default gen_random_uuid(),
  caballo_id        uuid not null references public.caballos(id) on delete cascade,
  hora              time not null,
  tipo_alimento_id  uuid references public.tipos_alimento(id) on delete set null,
  porcion_kg        numeric(6,2) not null check (porcion_kg > 0),
  notas             text,
  activo            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index horarios_caballo_hora_idx
  on public.horarios_alimentacion (caballo_id, hora);

create trigger horarios_touch before update on public.horarios_alimentacion
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 5) Inventario de alimentos
-- ------------------------------------------------------------
create table public.inventario_alimentos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  tipo_alimento_id  uuid references public.tipos_alimento(id) on delete set null,
  cantidad          numeric(10,2) not null default 0 check (cantidad >= 0),
  unidad            text not null default 'kg',
  proveedor         text,
  fecha_compra      date,
  fecha_vencimiento date,
  stock_minimo      numeric(10,2) not null default 0 check (stock_minimo >= 0),
  notas             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger alimentos_touch before update on public.inventario_alimentos
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 6) Inventario de medicinas
-- ------------------------------------------------------------
create table public.inventario_medicinas (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  principio_activo   text,
  cantidad           numeric(10,2) not null default 0 check (cantidad >= 0),
  unidad             text not null default 'ml',
  via_administracion text,
  proveedor          text,
  fecha_vencimiento  date,
  stock_minimo       numeric(10,2) not null default 0 check (stock_minimo >= 0),
  notas              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger medicinas_touch before update on public.inventario_medicinas
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 7) Cambios de herraje
-- ------------------------------------------------------------
create table public.herrajes (
  id             uuid primary key default gen_random_uuid(),
  caballo_id     uuid not null references public.caballos(id) on delete cascade,
  fecha          date not null default current_date,
  herrador       text,
  tipo           text not null default 'Herraje completo',
  detalle        text,
  coste          numeric(10,2) check (coste is null or coste >= 0),
  proxima_fecha  date,
  notas          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index herrajes_caballo_fecha_idx on public.herrajes (caballo_id, fecha desc);

create trigger herrajes_touch before update on public.herrajes
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 8) Historial veterinario
-- ------------------------------------------------------------
create table public.historial_veterinario (
  id             uuid primary key default gen_random_uuid(),
  caballo_id     uuid not null references public.caballos(id) on delete cascade,
  fecha          date not null default current_date,
  veterinario    text,
  motivo         text not null,
  diagnostico    text,
  tratamiento    text,
  medicamentos   text,
  peso_kg        numeric(6,1) check (peso_kg is null or peso_kg > 0),
  proxima_cita   date,
  coste          numeric(10,2) check (coste is null or coste >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index vet_caballo_fecha_idx on public.historial_veterinario (caballo_id, fecha desc);

create trigger vet_touch before update on public.historial_veterinario
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 9) Histórico de competencias
-- ------------------------------------------------------------
create table public.competencias (
  id           uuid primary key default gen_random_uuid(),
  caballo_id   uuid not null references public.caballos(id) on delete cascade,
  fecha        date not null,
  nombre       text not null,
  categoria    text,
  lugar        text,
  puesto       text,
  premio       numeric(10,2) check (premio is null or premio >= 0),
  observaciones text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index competencias_caballo_fecha_idx on public.competencias (caballo_id, fecha desc);

create trigger competencias_touch before update on public.competencias
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 10) Seguridad (RLS)
-- ------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.caballos                enable row level security;
alter table public.tipos_alimento          enable row level security;
alter table public.horarios_alimentacion   enable row level security;
alter table public.inventario_alimentos    enable row level security;
alter table public.inventario_medicinas    enable row level security;
alter table public.herrajes                enable row level security;
alter table public.historial_veterinario   enable row level security;
alter table public.competencias            enable row level security;

-- Rol del usuario autenticado (SECURITY DEFINER: evita bucle con RLS)
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.profiles where id = auth.uid() and activo;
$$;

-- ¿Es el usuario autenticado el dueño?
create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.mi_rol() = 'dueno', false);
$$;

-- Lectura: cualquier usuario activo con perfil
create or replace function public.puede_leer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = auth.uid() and p.activo
  );
$$;

-- Escritura: el dueño siempre; el resto según la tabla
-- (Los valores de esta función se replican en js/lib/permisos.js)
create or replace function public.puede_escribir(tabla text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.mi_rol()
    when 'dueno'       then true
    when 'cuidador'    then tabla in (
                          'caballos',
                          'horarios_alimentacion',
                          'tipos_alimento',
                          'inventario_alimentos',
                          'herrajes',
                          'competencias')
    when 'veterinario' then tabla in (
                          'inventario_medicinas',
                          'historial_veterinario')
    else false
  end;
$$;

-- profiles: cada cual ve su fila; el dueño ve y gestiona todas
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.es_dueno());

create policy "profiles_insert" on public.profiles
  for insert to authenticated
  with check (public.es_dueno());

create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (public.es_dueno());

-- Resto de tablas: lectura para todos los usuarios activos,
-- escritura según función puede_escribir()
do $$
declare
  t text;
begin
  foreach t in array array[
    'caballos',
    'tipos_alimento',
    'horarios_alimentacion',
    'inventario_alimentos',
    'inventario_medicinas',
    'herrajes',
    'historial_veterinario',
    'competencias'
  ] loop
    execute format(
      'create policy "%1$s_select" on public.%1$s
         for select to authenticated
         using (public.puede_leer())', t);

    execute format(
      'create policy "%1$s_write" on public.%1$s
         for all to authenticated
         using (public.puede_escribir(%2$L))
         with check (public.puede_escribir(%3$L))', t, t, t);
  end loop;
end $$;

-- Defensa en profundidad: el rol `anon` no necesita nada
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

-- ------------------------------------------------------------
-- 11) Acceso por USUARIO
--     Supabase solo autentica con email + contraseña; esta
--     función traduce el usuario tecleado en el email interno
--     de la cuenta. `anon` solo puede ejecutar ESTA función.
-- ------------------------------------------------------------
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

revoke all on function public.login_email(text) from public, anon, authenticated;
grant execute on function public.login_email(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 12) Datos semilla: tipos de alimento habituales
-- ------------------------------------------------------------
insert into public.tipos_alimento (nombre, descripcion) values
  ('Concentrado', 'Pienso concentrateado para caballos de trabajo'),
  ('Heno',        'Heno de hierba o alfalfa'),
  ('Avena',       'Avena en grano'),
  ('Maíz',        'Maíz partido'),
  ('Pasto',       'Pasto fresco / pastoreo'),
  ('Suplemento',  'Vitaminas y minerales')
on conflict (nombre) do nothing;

commit;

-- Verificación
select 'tablas' as elemento, count(*)::text as total
  from pg_tables where schemaname = 'public'
union all
select 'políticas RLS', count(*)::text
  from pg_policies where schemaname = 'public'
union all
select 'tipos de alimento', count(*)::text
  from public.tipos_alimento;
