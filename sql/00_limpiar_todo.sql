-- ============================================================
-- LA JUNGLA · PASO 0 — LIMPIEZA TOTAL DEL PROYECTO SUPABASE
-- URL: https://pypbnqeumxyqbwihyqbh.supabase.co
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- ADVERTENCIA: borra TODAS las tablas, vistas, funciones y tipos
-- del esquema `public` de este proyecto (incluye datos existentes
-- como `horses` y `medical_records`). No se puede deshacer.
-- ============================================================

begin;

do $$
declare
  r record;
begin
  -- 1) Tablas
  for r in
    select schemaname, tablename from pg_tables where schemaname = 'public'
  loop
    execute format('drop table if exists %I.%I cascade', r.schemaname, r.tablename);
  end loop;

  -- 2) Vistas
  for r in
    select schemaname, viewname from pg_views where schemaname = 'public'
  loop
    execute format('drop view if exists %I.%I cascade', r.schemaname, r.viewname);
  end loop;

  -- 3) Vistas materializadas
  for r in
    select schemaname, matviewname from pg_matviews where schemaname = 'public'
  loop
    execute format('drop materialized view if exists %I.%I cascade', r.schemaname, r.matviewname);
  end loop;

  -- 4) Funciones (excluye las que pertenecen a extensiones)
  for r in
    select n.nspname as esquema,
           p.proname as funcion,
           pg_get_function_identity_arguments(p.oid) as argumentos
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and not exists (
             select 1 from pg_depend d
              where d.objid = p.oid and d.deptype = 'e'
           )
  loop
    execute format('drop function if exists %I.%I(%s) cascade',
                   r.esquema, r.funcion, r.argumentos);
  end loop;

  -- 5) Tipos enumerados / compuestos
  for r in
    select t.typname
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
       and t.typtype in ('e', 'c')
       and not exists (
             select 1 from pg_depend d
              where d.objid = t.oid and d.deptype = 'e'
           )
  loop
    execute format('drop type if exists %I cascade', r.typname);
  end loop;

  -- 6) Secuencias huérfanas
  for r in
    select schemaname, sequencename from pg_sequences where schemaname = 'public'
  loop
    execute format('drop sequence if exists %I.%I cascade', r.schemaname, r.sequencename);
  end loop;

  -- 7) Sequences tipo identity ya cubiertas arriba; limpiar secueltas
  raise notice 'Esquema public limpiado.';
end $$;

-- ============================================================
-- (Opcional) Borrar también los datos de autenticación.
-- Descomentar SOLO si quieres eliminar también las cuentas de
-- usuario creadas hasta ahora. NO borra los usuarios del
-- Dashboard de Supabase que crees después de este script.
-- ============================================================
-- delete from auth.identities;
-- delete from auth.refresh_tokens;
-- delete from auth.sessions;
-- delete from auth.users;

-- ============================================================
-- (Opcional) Borrar imágenes subidas a Storage (buckets).
-- Descomentar si tienes buckets con archivos que ya no usas.
-- ============================================================
-- delete from storage.objects;
-- delete from storage.buckets;

commit;

-- Verificación: debe devolver 0 filas
select 'Tablas restantes en public:' as info, count(*) as total
  from pg_tables where schemaname = 'public';
