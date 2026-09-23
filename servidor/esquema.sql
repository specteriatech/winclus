-- Winclus · esquema del servidor (Supabase / Postgres). Cuentas de cliente, sitios con su clave, cifras de uso
-- anónimas, monitor alojado y escáner en línea. Se aplica entero en un proyecto vacío; es idempotente.
-- Migrar a otra cuenta de Supabase: aplicar este archivo allí y copiar los datos (pg_dump --data-only).

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ cuentas --
-- Una fila por persona que entra al panel (auth.users). El plan lo pone Winclus a mano (o la facturación, más adelante).
create table if not exists public.cuentas (
  id uuid primary key references auth.users (id) on delete cascade,
  correo text not null,
  nombre text,
  plan text not null default 'gratis' check (plan in ('gratis', 'entidad', 'entidad_plus', 'medida')),
  creado timestamptz not null default now()
);
create or replace function public.crear_cuenta() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.cuentas (id, correo) values (new.id, coalesce(new.email, '')) on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario after insert on auth.users for each row execute function public.crear_cuenta();

-- ------------------------------------------------------------------- sitios --
-- Cada sitio tiene una clave pública (data-clave) con la que el widget pide su configuración y manda cifras.
create table if not exists public.sitios (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id) on delete cascade,
  dominio text not null,
  nombre text,
  clave text not null unique default encode(gen_random_bytes(12), 'hex'),
  prueba boolean not null default false,          -- sitio de prueba o preparación (no cuenta como sitio principal)
  config jsonb not null default '{}'::jsonb,       -- logo, nombre, color, posicion, ocultar, camara, idioma, contacto, arreglos, webhook
  creado timestamptz not null default now(),
  unique (cuenta_id, dominio)
);
create index if not exists sitios_cuenta on public.sitios (cuenta_id);

-- Personas del equipo con acceso a los sitios de una cuenta (entran con su propio correo).
create table if not exists public.miembros (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references public.cuentas (id) on delete cascade,
  correo text not null,
  rol text not null default 'editor' check (rol in ('editor', 'lector')),
  creado timestamptz not null default now(),
  unique (cuenta_id, correo)
);
create index if not exists miembros_correo on public.miembros (lower(correo));

-- ¿Puede quien está conectado ver este sitio? Dueño de la cuenta o miembro invitado.
create or replace function public.acceso_sitio(sid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.sitios s
    where s.id = sid and (
      s.cuenta_id = auth.uid()
      or exists (select 1 from public.miembros m where m.cuenta_id = s.cuenta_id and lower(m.correo) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
  );
$$;
create or replace function public.acceso_cuenta(cid uuid) returns boolean language sql stable security definer set search_path = public as $$
  select cid = auth.uid() or exists (select 1 from public.miembros m where m.cuenta_id = cid and lower(m.correo) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- Límites por plan (sitios principales, sitios de prueba, páginas vigiladas, personas del equipo).
create or replace function public.limites(p_plan text) returns jsonb language sql immutable as $$
  select case p_plan
    when 'entidad' then '{"sitios":1,"prueba":2,"paginas":50,"miembros":3}'::jsonb
    when 'entidad_plus' then '{"sitios":3,"prueba":5,"paginas":300,"miembros":10}'::jsonb
    when 'medida' then '{"sitios":1000,"prueba":1000,"paginas":100000,"miembros":1000}'::jsonb
    else '{"sitios":1,"prueba":1,"paginas":3,"miembros":1}'::jsonb
  end;
$$;

-- ---------------------------------------------------------------- uso diario --
-- Cifras agregadas por sitio y día: cuántas veces se abrió el panel y qué opciones se tocaron. Nada por persona.
create table if not exists public.uso_diario (
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  fecha date not null default current_date,
  evento text not null,
  n integer not null default 0,
  primary key (sitio_id, fecha, evento)
);
-- La API (con la clave de servicio) suma lo que manda el widget; nunca guarda quién.
create or replace function public.sumar_uso(p_clave text, p_eventos jsonb) returns void language plpgsql security definer set search_path = public as $$
declare sid uuid; k text; v text; n int;
begin
  select id into sid from public.sitios where clave = p_clave;
  if sid is null then return; end if;
  for k, v in select key, value from jsonb_each_text(p_eventos) loop
    n := nullif(regexp_replace(v, '[^0-9]', '', 'g'), '')::int;
    if n is not null and n between 1 and 1000 then
      insert into public.uso_diario (sitio_id, fecha, evento, n) values (sid, current_date, left(k, 60), n)
      on conflict (sitio_id, fecha, evento) do update set n = uso_diario.n + excluded.n;
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------------ monitor --
create table if not exists public.monitor_paginas (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  url text not null,
  creado timestamptz not null default now(),
  unique (sitio_id, url)
);
create table if not exists public.monitor_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.sitios (id) on delete cascade,
  fecha timestamptz not null default now(),
  paginas integer not null default 0,
  paginas_ok integer not null default 0,
  total integer not null default 0,
  sev jsonb not null default '{}'::jsonb,
  avisos jsonb not null default '[]'::jsonb,
  nuevos integer not null default 0,
  resueltos integer not null default 0
);
create index if not exists monitor_ejecuciones_sitio on public.monitor_ejecuciones (sitio_id, fecha desc);
create table if not exists public.monitor_resultados (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.monitor_ejecuciones (id) on delete cascade,
  url text not null,
  ok boolean not null default false,
  error text,
  total integer not null default 0,
  problemas jsonb not null default '[]'::jsonb,   -- [{id, help, criterio, impact, n, ejemplo}]
  titulo text,
  winclus boolean,
  declaracion boolean,
  captura_escritorio text,                         -- ruta en el bucket «capturas»
  captura_movil text
);
create index if not exists monitor_resultados_ejecucion on public.monitor_resultados (ejecucion_id);

-- Solo se vigilan tantas páginas como permite el plan.
create or replace function public.limite_paginas() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid; p text; maximo int; actuales int;
begin
  select cuenta_id into cid from public.sitios where id = new.sitio_id;
  select plan into p from public.cuentas where id = cid;
  maximo := (public.limites(p) ->> 'paginas')::int;
  select count(*) into actuales from public.monitor_paginas mp join public.sitios s on s.id = mp.sitio_id where s.cuenta_id = cid;
  if actuales >= maximo then raise exception 'El plan % permite vigilar % página(s)', p, maximo using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists antes_de_vigilar on public.monitor_paginas;
create trigger antes_de_vigilar before insert on public.monitor_paginas for each row execute function public.limite_paginas();

-- Sitios y miembros: también con límite por plan.
create or replace function public.limite_sitios() returns trigger language plpgsql security definer set search_path = public as $$
declare p text; maximo int; actuales int;
begin
  select plan into p from public.cuentas where id = new.cuenta_id;
  maximo := (public.limites(p) ->> (case when new.prueba then 'prueba' else 'sitios' end))::int;
  select count(*) into actuales from public.sitios where cuenta_id = new.cuenta_id and prueba = new.prueba;
  if actuales >= maximo then raise exception 'El plan % permite % sitio(s) %', p, maximo, case when new.prueba then 'de prueba' else 'principal(es)' end using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists antes_de_crear_sitio on public.sitios;
create trigger antes_de_crear_sitio before insert on public.sitios for each row execute function public.limite_sitios();
create or replace function public.limite_miembros() returns trigger language plpgsql security definer set search_path = public as $$
declare p text; maximo int; actuales int;
begin
  select plan into p from public.cuentas where id = new.cuenta_id;
  maximo := (public.limites(p) ->> 'miembros')::int;
  select count(*) into actuales from public.miembros where cuenta_id = new.cuenta_id;
  if actuales + 1 >= maximo then raise exception 'El plan % permite % persona(s) en el equipo (contando a quien creó la cuenta)', p, maximo using errcode = 'P0001'; end if;
  return new;
end $$;
drop trigger if exists antes_de_invitar on public.miembros;
create trigger antes_de_invitar before insert on public.miembros for each row execute function public.limite_miembros();

-- ------------------------------------------------------------------ escáner --
-- Lo que se escaneó desde winclus.com/escanear (para el informe y para limitar abusos). ip_hash: hash con sal, no la IP.
create table if not exists public.escaneos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  fecha timestamptz not null default now(),
  total integer not null default 0,
  sev jsonb not null default '{}'::jsonb,
  resultado jsonb not null default '{}'::jsonb,
  ip_hash text
);
create index if not exists escaneos_ip on public.escaneos (ip_hash, fecha desc);

-- ---------------------------------------------------------------- seguridad --
alter table public.cuentas enable row level security;
alter table public.sitios enable row level security;
alter table public.miembros enable row level security;
alter table public.uso_diario enable row level security;
alter table public.monitor_paginas enable row level security;
alter table public.monitor_ejecuciones enable row level security;
alter table public.monitor_resultados enable row level security;
alter table public.escaneos enable row level security;

drop policy if exists cuentas_propia on public.cuentas;
create policy cuentas_propia on public.cuentas for select to authenticated using (id = auth.uid() or public.acceso_cuenta(id));
drop policy if exists cuentas_editar on public.cuentas;
create policy cuentas_editar on public.cuentas for update to authenticated using (id = auth.uid()) with check (id = auth.uid() and plan = (select plan from public.cuentas c where c.id = auth.uid()));

drop policy if exists sitios_ver on public.sitios;
create policy sitios_ver on public.sitios for select to authenticated using (public.acceso_sitio(id));
drop policy if exists sitios_crear on public.sitios;
create policy sitios_crear on public.sitios for insert to authenticated with check (cuenta_id = auth.uid());
drop policy if exists sitios_editar on public.sitios;
create policy sitios_editar on public.sitios for update to authenticated using (public.acceso_sitio(id)) with check (public.acceso_sitio(id));
drop policy if exists sitios_borrar on public.sitios;
create policy sitios_borrar on public.sitios for delete to authenticated using (cuenta_id = auth.uid());

drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select to authenticated using (public.acceso_cuenta(cuenta_id));
drop policy if exists miembros_gestionar on public.miembros;
create policy miembros_gestionar on public.miembros for all to authenticated using (cuenta_id = auth.uid()) with check (cuenta_id = auth.uid());

drop policy if exists uso_ver on public.uso_diario;
create policy uso_ver on public.uso_diario for select to authenticated using (public.acceso_sitio(sitio_id));

drop policy if exists paginas_ver on public.monitor_paginas;
create policy paginas_ver on public.monitor_paginas for select to authenticated using (public.acceso_sitio(sitio_id));
drop policy if exists paginas_gestionar on public.monitor_paginas;
create policy paginas_gestionar on public.monitor_paginas for all to authenticated using (public.acceso_sitio(sitio_id)) with check (public.acceso_sitio(sitio_id));

drop policy if exists ejecuciones_ver on public.monitor_ejecuciones;
create policy ejecuciones_ver on public.monitor_ejecuciones for select to authenticated using (public.acceso_sitio(sitio_id));
drop policy if exists resultados_ver on public.monitor_resultados;
create policy resultados_ver on public.monitor_resultados for select to authenticated using (exists (select 1 from public.monitor_ejecuciones e where e.id = ejecucion_id and public.acceso_sitio(e.sitio_id)));
-- escaneos: solo la API con la clave de servicio.

-- Capturas de pantalla del monitor: bucket público de solo lectura (las escribe el monitor con la clave de servicio).
insert into storage.buckets (id, name, public) values ('capturas', 'capturas', true) on conflict (id) do nothing;
drop policy if exists capturas_publicas on storage.objects;
create policy capturas_publicas on storage.objects for select to public using (bucket_id = 'capturas');
