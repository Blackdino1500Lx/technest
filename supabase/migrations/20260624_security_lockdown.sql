-- ============================================================================
-- TeachNest — Security Lockdown Migration
-- Fecha: 2026-06-24
--
-- Cierra el acceso ANÓNIMO a datos sensibles que hoy están abiertos vía RLS
-- ("using (true)") y mueve el login de alumnos y la CALIFICACIÓN al servidor
-- mediante funciones SECURITY DEFINER, de modo que:
--   * Los PINs de alumnos dejan de ser legibles por anónimos.
--   * Los emails de docentes dejan de ser legibles por anónimos.
--   * Las respuestas correctas (correctOption) y exam_key dejan de viajar al alumno.
--   * El puntaje se calcula en el servidor (no se puede falsificar desde el cliente).
--
-- IMPORTANTE: desplegar JUNTO con el frontend parcheado (db.ts, StudentLogin.tsx,
-- StudentPortal.tsx). Probar primero en una Supabase branch / proyecto de staging.
-- Al final del archivo hay un bloque de ROLLBACK.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0) Verificación previa — listar políticas permisivas actuales.
--    (Ejecutá este SELECT por separado para ver qué políticas "abiertas" existen.)
--    select schemaname, tablename, policyname, cmd, qual, with_check
--    from pg_policies
--    where schemaname = 'public'
--      and (qual = 'true' or with_check = 'true');
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1) Eliminar políticas permisivas (lectura/inserción anónima abierta)
-- ----------------------------------------------------------------------------
drop policy if exists "students_anon_read"       on public.students;
drop policy if exists "lessons_anon_read"        on public.lessons;
drop policy if exists "practices_anon_read"      on public.practices;
drop policy if exists "submissions_anon_insert"  on public.submissions;

-- En PRODUCCIÓN existe además una política de lectura anónima sobre teachers
-- que NO está en supabase_schema.sql (confirmado: anon puede leer emails).
-- Cubrimos los nombres más probables; agregá el real si difiere (ver SELECT del paso 0).
drop policy if exists "teachers_anon_read"   on public.teachers;
drop policy if exists "teachers_public_read" on public.teachers;
drop policy if exists "teachers_select_all"  on public.teachers;

-- Si question_images tuviera lectura anónima abierta, también la cerramos.
drop policy if exists "question_images_anon_read" on public.question_images;

-- ----------------------------------------------------------------------------
-- 2) Asegurar que RLS está activo en todas las tablas
-- ----------------------------------------------------------------------------
alter table public.teachers    enable row level security;
alter table public.students    enable row level security;
alter table public.lessons     enable row level security;
alter table public.practices   enable row level security;
alter table public.submissions enable row level security;

-- Las políticas de DOCENTE AUTENTICADO se conservan tal cual:
--   teachers_self, students_teacher, lessons_teacher,
--   practices_teacher, submissions_teacher  (auth.uid() = teacher_id)
-- Con ellas, cada docente sigue viendo y administrando SOLO sus propios datos.

-- ----------------------------------------------------------------------------
-- 3) RPC: login de alumno (sin exponer la tabla ni emails de docentes)
--    Devuelve UNA sola fila con el alumno + branding del aula. Nunca el email.
-- ----------------------------------------------------------------------------
create or replace function public.student_login(p_class_code text, p_pin text)
returns table (
  student_id      uuid,
  first_name      text,
  last_name       text,
  grade           text,
  level           text,
  teacher_id      uuid,
  school_name     text,
  plan            text,
  add_ons         text[],
  primary_color   text,
  secondary_color text,
  logo_text       text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Validación de entrada (defensa en profundidad)
  if p_pin is null or p_pin !~ '^\d{4,6}$' then
    return;
  end if;
  if p_class_code is null or length(btrim(p_class_code)) < 2 then
    return;
  end if;

  return query
  select s.id, s.first_name, s.last_name, s.grade, s.level,
         t.id, t.school_name, t.plan, t.add_ons,
         t.primary_color, t.secondary_color, t.logo_text
  from public.students s
  join public.teachers t on t.id = s.teacher_id
  where s.pin = p_pin
    and t.school_name ilike '%' || p_class_code || '%'
  limit 1;
end;
$$;

revoke all on function public.student_login(text, text) from public;
grant execute on function public.student_login(text, text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4) RPC: lecciones del alumno (OMITE exam_key)
-- ----------------------------------------------------------------------------
create or replace function public.student_get_lessons(p_student_id uuid, p_teacher_id uuid)
returns table (
  id          uuid,
  teacher_id  uuid,
  title       text,
  subject     text,
  content     text,
  file_url    text,
  file_name   text,
  youtube_url text,
  page_images text[],
  assigned_to text[],
  is_active   boolean,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select l.id, l.teacher_id, l.title, l.subject, l.content,
         l.file_url, l.file_name, l.youtube_url, l.page_images,
         l.assigned_to, l.is_active, l.created_at
  from public.lessons l
  where l.teacher_id = p_teacher_id
    and l.is_active = true
    and p_student_id::text = any(l.assigned_to);
$$;

revoke all on function public.student_get_lessons(uuid, uuid) from public;
grant execute on function public.student_get_lessons(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5) RPC: prácticas del alumno (ELIMINA correctOption de cada pregunta)
-- ----------------------------------------------------------------------------
create or replace function public.student_get_practices(p_student_id uuid, p_teacher_id uuid)
returns table (
  id          uuid,
  teacher_id  uuid,
  title       text,
  subject     text,
  description text,
  questions   jsonb,
  assigned_to text[],
  due_date    date,
  is_active   boolean,
  lesson_id   uuid,
  created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.teacher_id, p.title, p.subject, p.description,
         coalesce(
           (select jsonb_agg(q - 'correctOption')
              from jsonb_array_elements(p.questions) as q),
           '[]'::jsonb
         ) as questions,
         p.assigned_to, p.due_date, p.is_active, p.lesson_id, p.created_at
  from public.practices p
  where p.teacher_id = p_teacher_id
    and p.is_active = true
    and p_student_id::text = any(p.assigned_to);
$$;

revoke all on function public.student_get_practices(uuid, uuid) from public;
grant execute on function public.student_get_practices(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6) RPC: enviar práctica y CALIFICAR en el servidor
--    Replica exactamente la fórmula del cliente:
--      score = round( correctMCQ / totalMCQ * sum(points de TODAS las preguntas) )
--      (si no hay preguntas de opción múltiple, score = null → lo califica el docente)
--    Valida pertenencia/asignación y evita doble envío.
-- ----------------------------------------------------------------------------
create or replace function public.student_submit_practice(
  p_student_id       uuid,
  p_practice_id      uuid,
  p_answers          jsonb,
  p_anti_cheat_flags text[] default '{}'
)
returns table (submission_id uuid, score int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_questions  jsonb;
  q            jsonb;
  v_total_mcq  int := 0;
  v_correct    int := 0;
  v_total_pts  int := 0;
  v_score      int;
  v_new_id     uuid;
begin
  -- La práctica debe existir y estar activa
  select p.teacher_id, p.questions
    into v_teacher_id, v_questions
  from public.practices p
  where p.id = p_practice_id and p.is_active = true;

  if v_teacher_id is null then
    raise exception 'Práctica no encontrada o inactiva';
  end if;

  -- El alumno debe pertenecer al mismo docente
  if not exists (
    select 1 from public.students s
    where s.id = p_student_id and s.teacher_id = v_teacher_id
  ) then
    raise exception 'Alumno inválido para esta práctica';
  end if;

  -- El alumno debe estar asignado a la práctica
  if not exists (
    select 1 from public.practices p
    where p.id = p_practice_id and p_student_id::text = any(p.assigned_to)
  ) then
    raise exception 'Práctica no asignada a este alumno';
  end if;

  -- Evitar doble envío
  if exists (
    select 1 from public.submissions
    where student_id = p_student_id and practice_id = p_practice_id
  ) then
    raise exception 'Esta práctica ya fue enviada';
  end if;

  -- Calificar opción múltiple en el servidor
  for q in select * from jsonb_array_elements(v_questions)
  loop
    v_total_pts := v_total_pts + coalesce((q->>'points')::int, 0);
    if (q->>'type') = 'multiple' then
      v_total_mcq := v_total_mcq + 1;
      if exists (
        select 1
        from jsonb_array_elements(p_answers) a
        where a->>'questionId' = q->>'id'
          and a->>'value'      = q->>'correctOption'
      ) then
        v_correct := v_correct + 1;
      end if;
    end if;
  end loop;

  if v_total_mcq > 0 then
    v_score := round((v_correct::numeric / v_total_mcq) * v_total_pts);
  else
    v_score := null;  -- sin MCQ → lo califica el docente
  end if;

  insert into public.submissions
    (teacher_id, practice_id, student_id, answers, score, reviewed, anti_cheat_flags)
  values
    (v_teacher_id, p_practice_id, p_student_id, p_answers, v_score, false,
     coalesce(p_anti_cheat_flags, '{}'))
  returning id into v_new_id;

  return query select v_new_id, v_score;
end;
$$;

revoke all on function public.student_submit_practice(uuid, uuid, jsonb, text[]) from public;
grant execute on function public.student_submit_practice(uuid, uuid, jsonb, text[]) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7) RPC: saber si el alumno ya envió una práctica (sin abrir la tabla)
-- ----------------------------------------------------------------------------
create or replace function public.student_submission_exists(p_student_id uuid, p_practice_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.submissions
    where student_id = p_student_id and practice_id = p_practice_id
  );
$$;

revoke all on function public.student_submission_exists(uuid, uuid) from public;
grant execute on function public.student_submission_exists(uuid, uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 8) Retirar el RPC viejo que aceptaba el score desde el cliente (falsificable).
--    Ajustá la firma si difiere (ver: \df insert_student_submission).
-- ----------------------------------------------------------------------------
drop function if exists public.insert_student_submission(uuid, uuid, uuid, jsonb, int, text[]);

commit;

-- ============================================================================
-- VERIFICACIÓN POST-DESPLIEGUE (ejecutar como anónimo / desde el navegador):
--   GET /rest/v1/students?select=pin            -> debe devolver []
--   GET /rest/v1/teachers?select=email          -> debe devolver []
--   GET /rest/v1/lessons?select=exam_key        -> debe devolver []
--   GET /rest/v1/practices?select=questions     -> debe devolver []
--   POST /rest/v1/submissions  (con check=true) -> debe fallar (403/permission)
-- y el login/lecciones/prácticas del alumno deben seguir funcionando vía RPC.
-- ============================================================================

-- ============================================================================
-- ROLLBACK (si algo se rompe; revierte SOLO el cierre de RLS, no borra datos):
--   begin;
--   create policy "students_anon_read"      on public.students    for select using (true);
--   create policy "lessons_anon_read"       on public.lessons     for select using (true);
--   create policy "practices_anon_read"     on public.practices   for select using (true);
--   create policy "submissions_anon_insert" on public.submissions for insert with check (true);
--   -- (recrear la política anónima de teachers si la necesitabas)
--   commit;
-- ============================================================================
