-- Run this in your Supabase SQL editor to set up TeachNest

-- Teachers profile (extends auth.users)
create table if not exists teachers (
  id              uuid references auth.users on delete cascade primary key,
  email           text not null,
  full_name       text not null,
  school_name     text default '',
  plan            text default 'basic',
  add_ons         text[] default '{}',
  primary_color   text default '#e85d3f',
  secondary_color text default '#0d9488',
  logo_text       text default 'TeachNest',
  students_limit  int  default 30,
  created_at      timestamptz default now()
);

-- Students
create table if not exists students (
  id          uuid default gen_random_uuid() primary key,
  teacher_id  uuid references teachers(id) on delete cascade not null,
  first_name  text not null,
  last_name   text not null,
  grade       text not null,
  level       text not null,
  pin         text not null,
  created_at  timestamptz default now()
);

-- Lessons
create table if not exists lessons (
  id           uuid default gen_random_uuid() primary key,
  teacher_id   uuid references teachers(id) on delete cascade not null,
  title        text not null,
  subject      text not null,
  content      text,
  file_url     text,
  file_name    text,
  exam_key     text,
  youtube_url  text,
  page_images  text[],
  assigned_to  text[] default '{}',
  is_active    boolean default true,
  created_at   timestamptz default now()
);

-- Practices
create table if not exists practices (
  id          uuid default gen_random_uuid() primary key,
  teacher_id  uuid references teachers(id) on delete cascade not null,
  title       text not null,
  subject     text not null,
  description text default '',
  questions   jsonb default '[]',
  assigned_to text[] default '{}',
  due_date    date,
  is_active   boolean default true,
  lesson_id   uuid,
  created_at  timestamptz default now()
);

-- Submissions
create table if not exists submissions (
  id               uuid default gen_random_uuid() primary key,
  teacher_id       uuid references teachers(id) on delete cascade not null,
  practice_id      uuid not null,
  student_id       uuid not null,
  answers          jsonb default '[]',
  score            int,
  reviewed         boolean default false,
  teacher_note     text,
  anti_cheat_flags text[] default '{}',
  submitted_at     timestamptz default now()
);

-- Storage bucket for materials
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict do nothing;

-- RLS Policies (enable Row Level Security)
alter table teachers    enable row level security;
alter table students    enable row level security;
alter table lessons     enable row level security;
alter table practices   enable row level security;
alter table submissions enable row level security;

-- Teachers: only see own profile
create policy "teachers_self" on teachers for all using (auth.uid() = id);

-- Students: teacher sees own, student access via function
create policy "students_teacher" on students for all using (auth.uid() = teacher_id);
create policy "students_anon_read" on students for select using (true);

-- Lessons, Practices, Submissions: teacher sees own
create policy "lessons_teacher"     on lessons     for all using (auth.uid() = teacher_id);
create policy "practices_teacher"   on practices   for all using (auth.uid() = teacher_id);
create policy "submissions_teacher" on submissions for all using (auth.uid() = teacher_id);

-- Allow anonymous inserts for student submissions
create policy "lessons_anon_read"     on lessons     for select using (true);
create policy "practices_anon_read"   on practices   for select using (true);
create policy "submissions_anon_insert" on submissions for insert with check (true);

-- Storage
create policy "materials_public_read" on storage.objects for select using (bucket_id = 'materials');
create policy "materials_auth_upload" on storage.objects for insert with check (bucket_id = 'materials' and auth.role() = 'authenticated');
