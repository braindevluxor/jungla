-- ============================================================
-- LA JUNGLA · PASO 5 — DATOS DE PRUEBA
-- Ejecutar DESPUÉS de 01_esquema.sql y sobre una base VACÍA.
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================
-- Carga 6 caballos con su alimentación, inventario de alimentos y
-- medicinas, herrajes, historial veterinario y competencias.
--
-- Coherencia de los datos:
--   · Fechas relativas a `current_date`, así las alertas de stock,
--     los vencimientos y las citas siguen siendo relevantes cuando
--     lo ejecutes (no se queda en fechas muertas).
--   · Stock en relación con el consumo real del plantel
--     (~11 kg/día de concentrado y ~26 kg/día de heno).
--   · Un caballo vendido (Nube) para probar el filtro de estados.
--   · Un horario pausado, un herraje vencido, una medicina agotada
--     y otra vencida: los estados que la app debe mostrar.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) Guardia: solo en una base sin datos de caballos
--    (evita duplicar o pisar datos reales por error)
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.caballos limit 1) then
    raise exception 'Ya hay caballos en la base. Este script es de PRUEBAS y solo debe ejecutarse sobre una base vacía (usa 00_limpiar_todo.sql para empezar de cero).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) Tipos de alimento (idempotente: ya los crea el 01)
-- ------------------------------------------------------------
insert into public.tipos_alimento (nombre, descripcion) values
  ('Concentrado', 'Pienso concentrateado para caballos de trabajo'),
  ('Heno',        'Heno de hierba o alfalfa'),
  ('Avena',       'Avena en grano'),
  ('Maíz',        'Maíz partido'),
  ('Pasto',       'Pasto fresco / pastoreo'),
  ('Suplemento',  'Vitaminas y minerales')
on conflict (nombre) do nothing;

-- ------------------------------------------------------------
-- 2) CABALLOS (6): 5 activos + 1 vendido
--    Los offsets (días) van SIN comillas para que PostgreSQL infiera
--    integer y `current_date - offset` resuelva a date sin ambigüedad.
-- ------------------------------------------------------------
insert into public.caballos
  (nombre, raza, sexo, fecha_nacimiento, color, peso_kg, numero_registro, estado, ubicacion, notas)
values
  ('Relámpago', 'Pura Raza Española', 'macho',   '2018-04-12', 'Alazán',   480.0, 'ES-PRE-00114', 'activo',  'Box 1',
   'Caballo principal de salto. Muy noble, sensible por el costado izquierdo.'),
  ('Sombra',    'Árabe',              'hembra', '2020-09-01', 'Negro',    410.0, 'ES-ARA-02310', 'activo',  'Box 2',
   'En tratamiento por cojera en miembro posterior derecho. Evitar trabajo fuerte.'),
  ('Duque',     'Hanoveriano',        'macho',   '2017-03-25', 'Castaño',  520.0, 'DE-HAN-00877', 'activo',  'Box 3',
   'Deportivo de doma. Requiere herraje de deporte cada 6 semanas.'),
  ('Estrella',  'Pura Raza Española', 'hembra', '2019-06-18', 'Pechina',  445.0, 'ES-PRE-00298', 'activo',  'Box 4',
   'En control reproductivo. Buena para doma y exhibición morfológica.'),
  ('Trueno',    'Frisón',             'macho',   '2016-05-30', 'Negro',    550.0, 'NL-FRI-00451', 'activo',  'Potrero sur',
   'Pesa de más: dieta baja en almidón. Concentrado pausado hasta nueva orden.'),
  ('Nube',      'Cuarto de As',       'hembra', '2014-08-09', 'Tordillo', 490.0, 'US-QHA-01902', 'vendido', '—',
   'Vendida en noviembre. Se mantiene el histórico por si vuelve a competir.');

-- ------------------------------------------------------------
-- 3) HORARIOS DE ALIMENTACIÓN (15)
--    3 tomas/día en box, 2 en potrero. Un horario pausado (Trueno).
-- ------------------------------------------------------------
insert into public.horarios_alimentacion
  (caballo_id, hora, tipo_alimento_id, porcion_kg, notas, activo)
select c.id,
       x.hora::time,
       t.id,
       x.porcion,
       x.notas,
       x.activo
  from (values
    -- caballo      hora      tipo           porc  notas                            activo
    ('Relámpago', '07:00', 'Concentrado', 2.50, 'Mezclar con suplemento mineral',  true),
    ('Relámpago', '14:00', 'Heno',        4.00, null,                             true),
    ('Relámpago', '20:00', 'Concentrado', 2.00, null,                             true),
    ('Sombra',    '07:30', 'Concentrado', 2.00, null,                             true),
    ('Sombra',    '14:00', 'Heno',        3.50, null,                             true),
    ('Sombra',    '19:30', 'Avena',       1.50, 'Avena remojada 12 horas',         true),
    ('Duque',     '06:30', 'Avena',       2.00, 'Antes del trabajo de la mañana',  true),
    ('Duque',     '13:00', 'Concentrado', 3.00, 'Ración de recuperación',          true),
    ('Duque',     '19:00', 'Heno',        5.00, null,                             true),
    ('Estrella',  '07:00', 'Concentrado', 2.00, null,                             true),
    ('Estrella',  '15:00', 'Heno',        4.00, null,                             true),
    ('Estrella',  '20:00', 'Suplemento',  0.50, 'Vitaminas prenatales',           true),
    ('Trueno',    '08:00', 'Heno',        5.00, null,                             true),
    ('Trueno',    '14:00', 'Concentrado', 2.00, 'PAUSADO: dieta baja en almidón',  false),
    ('Trueno',    '18:00', 'Heno',        5.00, null,                             true)
  ) as x(caballo, hora, tipo, porcion, notas, activo)
  join public.caballos c       on c.nombre = x.caballo
  join public.tipos_alimento t on t.nombre = x.tipo;

-- ------------------------------------------------------------
-- 4) INVENTARIO DE ALIMENTOS (6)
--    · Avena y suplemento por debajo del mínimo → alerta de stock.
--    · Bloque mineral vence en 15 días → chip ámbar.
-- ------------------------------------------------------------
insert into public.inventario_alimentos
  (nombre, tipo_alimento_id, cantidad, unidad, proveedor, fecha_compra, fecha_vencimiento, stock_minimo, notas)
select x.nombre,
       t.id,
       x.cantidad,
       x.unidad,
       x.proveedor,
       current_date - x.dcompra,
       case when x.dvence is null then null else current_date + x.dvence end,
       x.minimo,
       x.notas
  from (values
    -- nombre                      tipo          cant   ud        proveedor              compra  vence  minio  notas
    ('Concentrado Pienso 12%',    'Concentrado', 850,   'kg',     'NutriCaballo S.L.',     20,   160,   300, 'Sacos de 25 kg. Consumo ~11 kg/día'),
    ('Heno de alfalfa 2ª corte',  'Heno',        420,   'kg',     'Guadalajara Forrajes',  15,    90,   400, 'Fardos de 20 kg. Consumo ~26 kg/día'),
    ('Avena en grano',            'Avena',        45,   'kg',     'Granos del Sur',        45,   120,   100, 'Quedan ~13 días al ritmo actual'),
    ('Maíz partido',              'Maíz',        260,   'kg',     'Granos del Sur',        30,   150,    60, null),
    ('Bloque mineral para pasto', 'Suplemento',   18,   'unidad', 'NutriCaballo S.L.',     60,    15,    10, 'Vence pronto: pedir reposición'),
    ('Suplemento vitamínico ADE', 'Suplemento',    6,   'kg',     'NutriCaballo S.L.',     75,   200,     8, 'Polvo, dosis 50 g/día')
  ) as x(nombre, tipo, cantidad, unidad, proveedor, dcompra, dvence, minimo, notas)
  join public.tipos_alimento t on t.nombre = x.tipo;

-- ------------------------------------------------------------
-- 5) INVENTARIO DE MEDICINAS (6)
--    · Penicilina agotada (0) → alerta roja.
--    · Suero vencido → chip «vencido hace…».
--    · Vacuna vence en 20 días → chip ámbar.
-- ------------------------------------------------------------
insert into public.inventario_medicinas
  (nombre, principio_activo, cantidad, unidad, via_administracion, proveedor, fecha_vencimiento, stock_minimo, notas)
values
  ('Penicilina G procaina',    'Benzilpenicilina', 0,   'ml',    'Inyectable', 'VetLab Distribución', (current_date + 90)::date,  50, 'AGOTADA: pedir reposición urgente'),
  ('Fenilbutazona',            'Fenilbutazona',    180, 'ml',    'Inyectable', 'VetLab Distribución', (current_date + 240)::date, 60, 'Antiinflamatorio. Sombra: 10 ml/día máx. 5 días'),
  ('Ivermectina',              'Ivermectina',      90,  'ml',    'Oral',       'VetLab Distribución', (current_date + 300)::date, 40, 'Desparasitación interna y externa'),
  ('Povidona yodada',          'Povidona yodada',  500, 'ml',    'Tópica',     'Farmacia Equina',     (current_date + 400)::date, 150, 'Antiséptico de heridas'),
  ('Toxóide tetánico',         'Toxóide tetánico', 8,   'dosis', 'Inyectable', 'VetLab Distribución', (current_date + 20)::date,  4,  'Vacuna anual. Vence pronto'),
  ('Suero rehidratación oral', 'Electrolitos',     3,   'l',     'Oral',       'Farmacia Equina',     (current_date - 12)::date,  2,  'VENCIDO: no usar, retirar del armario');

-- ------------------------------------------------------------
-- 6) HERRAJES (6) — ciclo de 6-8 semanas
--    · Sombra con la próxima fecha vencida → chip rojo.
--    · Estrella (1 día) y Relámpago (5 días) → chip ámbar.
--    · Duque y Trueno a futuro → chip gris.
--    · Nube sin próxima fecha (caballo vendido).
-- ------------------------------------------------------------
insert into public.herrajes
  (caballo_id, fecha, herrador, tipo, detalle, coste, proxima_fecha, notas)
select c.id,
       current_date - x.dfecha,
       x.herrador,
       x.tipo,
       x.detalle,
       x.coste,
       case when x.dprox is null then null else current_date + x.dprox end,
       x.notas
  from (values
    -- caballo      atrás  herrador             tipo                            detalle                                 coste  prox   notas
    ('Relámpago',   45,    'Pedro Méndez',      'Herraje completo',             'Frontales y traseros, casco sano',      110,    5,    null),
    ('Sombra',      52,    'Pedro Méndez',      'Cambio de cascos',             'Trasero derecho con desgaste',           95,   -3,    'RETRASADO: coincidió con la cojera'),
    ('Duque',       12,    'Talleres Ferrum',   'Colocación de herraje de deporto', 'Herradura de concurso, plantillas',   165,   35,    'Ciclo más corto por trabajo intenso'),
    ('Estrella',    60,    'Pedro Méndez',      'Herraje completo',             'Correctivo por fisura en cuarto',        130,    1,    'Revisar fisura en la próxima sesión'),
    ('Trueno',      30,    'Talleres Ferrum',   'Revisión',                     'Ajuste de herraduras traseras',           60,   20,    null),
    ('Nube',       210,    'Pedro Méndez',      'Herraje completo',             'Último antes de la venta',              100, null,    'Sin próxima fecha: caballo vendido')
  ) as x(caballo, dfecha, herrador, tipo, detalle, coste, dprox, notas)
  join public.caballos c on c.nombre = x.caballo;

-- ------------------------------------------------------------
-- 7) HISTORIAL VETERINARIO (8)
--    Dos citas futuras (Sombra +3, Estrella +5) para el panel.
-- ------------------------------------------------------------
insert into public.historial_veterinario
  (caballo_id, fecha, veterinario, motivo, diagnostico, tratamiento, medicamentos, peso_kg, proxima_cita, coste)
select c.id,
       current_date - x.dfecha,
       x.veterinario,
       x.motivo,
       x.diagnostico,
       x.tratamiento,
       x.medicamentos,
       x.peso,
       case when x.dcita is null then null else current_date + x.dcita end,
       x.coste
  from (values
    -- caballo      atrás  vet                  motivo                          diagnostico                            tratamiento                        medicamentos                        peso   cita  coste
    ('Relámpago',   90,   'Dra. Lucía Fernández', 'Revisión anual',             'Sin novedades, buen estado corporal',  'Mantenimiento',                    null,                               480.0,   75,  70.0),
    ('Relámpago',  180,   'Dra. Lucía Fernández', 'Vacunación influenza',       'Correctamente inmunizado',            'Vacunación anual',                 'Vacuna influenza, 1 dosis',        null,  null,  45.0),
    ('Sombra',      20,   'Dr. Marcos Rivas',     'Cojera miembro posterior derecho', 'Esguince leve de ligamento colateral', 'Reposo 10 días y antiinflamatorio', 'Fenilbutazona 10 ml/día 5 días', 410.0,    3, 180.0),
    ('Duque',       15,   'Dra. Lucía Fernández', 'Vacunación anual',           'Sin novedades',                       'Vacunación y desparasitación',     'Toxóide tetánico + Ivermectina',  520.0,  null,  95.0),
    ('Estrella',    45,   'Dra. Lucía Fernández', 'Control reproductivo',       'Ciclo regular, sin alteraciones',      'Continuar control mensual',        null,                               445.0,    5,  85.0),
    ('Trueno',      15,   'Dr. Marcos Rivas',     'Desparasitación interna',    'Sin novedades',                       'Dosis única',                      'Ivermectina 15 ml',                550.0,  null,  60.0),
    ('Trueno',     130,   'Dr. Marcos Rivas',     'Cólica leve',                'Cólica espasmódica por forraje',      'Ayuno 12 h y espasmolítico',       'Buscapina 20 ml',                  null,  null, 320.0),
    ('Nube',       500,   'Dr. Marcos Rivas',     'Revisión general',           'Sin novedades',                       'Ninguno',                          null,                               null,  null,  55.0)
  ) as x(caballo, dfecha, veterinario, motivo, diagnostico, tratamiento, medicamentos, peso, dcita, coste)
  join public.caballos c on c.nombre = x.caballo;

-- ------------------------------------------------------------
-- 8) COMPETENCIAS (6): 6 participaciones, 5 podios, 1.700 en premios
--    (Duque queda 4º: sin premio, sirve para ver un resultado sin podio)
-- ------------------------------------------------------------
insert into public.competencias
  (caballo_id, fecha, nombre, categoria, lugar, puesto, premio, observaciones)
select c.id,
       current_date - x.dfecha,
       x.nombre,
       x.categoria,
       x.lugar,
       x.puesto,
       x.premio,
       x.observaciones
  from (values
    -- caballo      atrás  nombre                            categoria                lugar        puesto  premio  observaciones
    ('Relámpago',  120,   'Concurso Hípico de Madrid',       'Salto 1,10 m',          'Madrid',    '1º',   600.0, 'Ronda limpia en 0 faltas'),
    ('Relámpago',   65,   'Copa de Primavera',               'Salto 1,15 m',          'Valencia',  '3º',   250.0, null),
    ('Duque',      100,   'CDI Doma Clásica',                'Doma clásica',          'Sevilla',   '2º',   400.0, 'Puntuación 68,4%'),
    ('Duque',       40,   'Prueba de clasificación territorial', 'Doma clásica',       'Córdoba',   '4º',   null,  'Sin premio, se clasifica para la final'),
    ('Estrella',    55,   'Muestra de Pura Raza Española',    'Exposición morfológica', 'Córdoba',  '1º',   300.0, 'Premio a la mejor cabeza'),
    ('Trueno',     200,   'Trote y Galope',                   'Enganches',             'Toledo',    '2º',   150.0, null)
  ) as x(caballo, dfecha, nombre, categoria, lugar, puesto, premio, observaciones)
  join public.caballos c on c.nombre = x.caballo;

commit;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
select 'caballos' as concepto, count(*)::text as total from public.caballos
union all select 'caballos activos',       count(*)::text from public.caballos where estado = 'activo'
union all select 'horarios de comida',     count(*)::text from public.horarios_alimentacion
union all select 'horarios activos',       count(*)::text from public.horarios_alimentacion where activo
union all select 'tipos de alimento',      count(*)::text from public.tipos_alimento
union all select 'alimentos',              count(*)::text from public.inventario_alimentos
union all select 'medicinas',              count(*)::text from public.inventario_medicinas
union all select 'herrajes',               count(*)::text from public.herrajes
union all select 'registros veterinarios', count(*)::text from public.historial_veterinario
union all select 'competencias',           count(*)::text from public.competencias
order by 1;

-- Lo que la app debe marcar como alerta (panel → Stock bajo)
select 'ALERTA stock bajo' as aviso, nombre, cantidad::text, stock_minimo::text, unidad
  from public.inventario_alimentos where cantidad <= stock_minimo
union all
select 'ALERTA stock bajo', nombre, cantidad::text, stock_minimo::text, unidad
  from public.inventario_medicinas where cantidad <= stock_minimo
order by 1, 2;

-- Vencimientos (chip rojo/ámbar en Inventario)
select 'VENCIDO' as aviso, nombre, fecha_vencimiento, unidad
  from public.inventario_medicinas where fecha_vencimiento < current_date
union all
select 'VENCE PRONTO', nombre, fecha_vencimiento, unidad
  from public.inventario_medicinas
 where fecha_vencimiento >= current_date and fecha_vencimiento <= current_date + 30
union all
select 'VENCIDO', nombre, fecha_vencimiento, unidad
  from public.inventario_alimentos
 where fecha_vencimiento is not null and fecha_vencimiento < current_date
union all
select 'VENCE PRONTO', nombre, fecha_vencimiento, unidad
  from public.inventario_alimentos
 where fecha_vencimiento is not null
   and fecha_vencimiento between current_date and current_date + 30
order by 1, 3;

-- Citas y herrajes pendientes
select 'CITA próxima' as aviso, c.nombre, h.motivo, h.proxima_cita
  from public.historial_veterinario h
  join public.caballos c on c.id = h.caballo_id
 where h.proxima_cita >= current_date
 order by h.proxima_cita;

select 'HERRAJE' as aviso, c.nombre, h.tipo, h.proxima_fecha,
       case when h.proxima_fecha < current_date then 'VENCIDO'
            when h.proxima_fecha <= current_date + 14 then 'PRÓXIMO'
            else 'OK' end as estado
  from public.herrajes h
  join public.caballos c on c.id = h.caballo_id
 where h.proxima_fecha is not null
 order by h.proxima_fecha;

-- Consumo diario frente al stock (coherencia)
select c.nombre,
       sum(h.porcion_kg) filter (where h.activo) as kg_dia,
       count(*) filter (where h.activo)          as comidas_dia
  from public.horarios_alimentacion h
  join public.caballos c on c.id = h.caballo_id
 group by c.nombre
 order by c.nombre;
