-- SIMK ITP B — initial production schema
-- Apply to a NEW Supabase project or a reviewed staging project first.
-- No student passwords are seeded here. Auth accounts are provisioned server-side.

begin;
create extension if not exists pgcrypto;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nim text not null unique check (nim ~ '^Q1A126[0-9]{3}$'),
  full_name text not null,
  is_active boolean not null default true,
  needs_verification boolean not null default false,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  student_id uuid not null unique references public.students(id),
  nim text not null unique references public.students(nim),
  full_name text not null,
  role text not null default 'STUDENT' check (role in ('ADMIN','STUDENT')),
  is_active boolean not null default true,
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role = 'ADMIN' and nim = 'Q1A126065') or role = 'STUDENT')
);
create unique index if not exists simk_only_one_admin on public.profiles ((role)) where role = 'ADMIN';

create table if not exists public.semesters (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester_type text not null check (semester_type in ('GANJIL','GENAP')),
  display_name text not null,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create unique index if not exists simk_one_active_semester on public.semesters ((is_active)) where is_active = true;

create table if not exists public.student_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  semester_id uuid not null references public.semesters(id),
  enrollment_status text not null default 'ACTIVE' check (enrollment_status in ('ACTIVE','INACTIVE','ARCHIVED')),
  created_at timestamptz not null default now(),
  unique(student_id, semester_id)
);

create table if not exists public.lecturers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  academic_title text,
  department text,
  official_contact text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id),
  course_code text,
  course_name text not null,
  sks integer check (sks is null or sks between 1 and 12),
  class_name text not null default 'ITP B',
  is_active boolean not null default true,
  source_note text,
  created_at timestamptz not null default now(),
  unique(semester_id, course_code)
);

create table if not exists public.course_lecturers (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null references public.course_offerings(id) on delete cascade,
  lecturer_id uuid not null references public.lecturers(id),
  sequence_no integer,
  assignment_mode text not null default 'MANUAL' check (assignment_mode in ('ORDERED','MANUAL')),
  is_current boolean not null default false,
  confirmed_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique(course_offering_id, lecturer_id),
  check (sequence_no is null or sequence_no > 0)
);

create table if not exists public.roster_imports (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id),
  original_file_path text not null,
  original_file_name text not null,
  file_sha256 text,
  extraction_method text not null check (extraction_method in ('PDF_TEXT','OCR','MIXED','MANUAL')),
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','REJECTED','CANCELLED')),
  extracted_json jsonb not null default '[]'::jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  extraction_notes text,
  uploaded_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.roster_import_rows (
  id uuid primary key default gen_random_uuid(),
  roster_import_id uuid not null references public.roster_imports(id) on delete cascade,
  row_number integer not null,
  source_page integer,
  source_text text,
  extracted_payload jsonb not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  validation_status text not null default 'NEEDS_REVIEW' check (validation_status in ('VALID','NEEDS_REVIEW','DUPLICATE','CONFLICT','REJECTED')),
  correction_payload jsonb,
  created_at timestamptz not null default now(),
  unique(roster_import_id, row_number)
);

create table if not exists public.timetables (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null references public.course_offerings(id) on delete cascade,
  day_of_week text not null check (day_of_week in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')),
  starts_at time not null,
  ends_at time not null,
  room text,
  delivery_mode text not null default 'OFFLINE' check (delivery_mode in ('OFFLINE','ONLINE')),
  meeting_link text,
  roster_import_id uuid references public.roster_imports(id),
  source_note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null references public.course_offerings(id),
  lecturer_id uuid references public.lecturers(id),
  timetable_id uuid references public.timetables(id),
  meeting_number integer check (meeting_number is null or meeting_number > 0),
  meeting_date date,
  starts_at time,
  ends_at time,
  topic text,
  description text,
  delivery_mode text not null default 'OFFLINE' check (delivery_mode in ('OFFLINE','ONLINE')),
  room text,
  meeting_link text,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','HELD','CANCELLED','RESCHEDULED','NOT_RECORDED')),
  assignment_notes text,
  materials_path text,
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  student_id uuid not null references public.students(id),
  status text not null default '?' check (status in ('H','I','S','A','?')),
  source text not null default 'MANUAL' check (source in ('MANUAL','PHOTO_IMPORT')),
  notes text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(meeting_id, student_id)
);

create table if not exists public.attendance_imports (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id),
  original_file_path text not null,
  original_file_name text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','REJECTED','CANCELLED')),
  extraction_json jsonb not null default '[]'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.attendance_import_rows (
  id uuid primary key default gen_random_uuid(),
  attendance_import_id uuid not null references public.attendance_imports(id) on delete cascade,
  student_id uuid references public.students(id),
  source_text text,
  proposed_status text check (proposed_status is null or proposed_status in ('H','I','S','A','?')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  needs_review boolean not null default true,
  corrected_status text check (corrected_status is null or corrected_status in ('H','I','S','A','?')),
  created_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null references public.course_offerings(id),
  exam_type text not null check (exam_type in ('UTS','UAS')),
  exam_date date,
  starts_at time,
  ends_at time,
  room text,
  confirmation_deadline timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.exam_confirmations (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id),
  response text not null check (response in ('YES','NO')),
  responded_at timestamptz not null default now(),
  unique(exam_id, student_id)
);
create table if not exists public.exam_attendance (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id),
  student_id uuid not null references public.students(id),
  status text not null default '?' check (status in ('H','I','S','A','?')),
  recorded_by uuid references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique(exam_id, student_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_offering_id uuid not null references public.course_offerings(id),
  lecturer_id uuid references public.lecturers(id),
  meeting_id uuid references public.meetings(id),
  title text not null,
  instructions text,
  assigned_at timestamptz,
  deadline timestamptz,
  attachment_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid references public.semesters(id),
  course_offering_id uuid references public.course_offerings(id),
  lecturer_id uuid references public.lecturers(id),
  title text not null,
  body text not null,
  category text not null default 'INFORMATION',
  is_public boolean not null default true,
  published_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  course_offering_id uuid references public.course_offerings(id),
  meeting_id uuid references public.meetings(id),
  leave_date date not null,
  reason text not null,
  attachment_path text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id),
  created_at timestamptz not null default now(),
  unique(student_id)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references public.profiles(id),
  body text not null check (length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_drafts (
  id uuid primary key default gen_random_uuid(),
  module_key text not null check (module_key in ('coordinator','roster_reader','schedule_checker','attendance_reader','attendance_analyst','learning_assistant','exam_assignment','announcement_writer','report_writer','data_quality')),
  action_type text not null check (action_type in ('CREATE_ANNOUNCEMENT','UPDATE_ATTENDANCE','CREATE_ASSIGNMENT')),
  proposed_payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_by uuid not null references public.profiles(id),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  semester_id uuid not null references public.semesters(id),
  course_offering_id uuid not null references public.course_offerings(id),
  lecturer_id uuid references public.lecturers(id),
  generated_by uuid not null references public.profiles(id),
  snapshot_json jsonb not null,
  file_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  target_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id),
  action text not null,
  entity_table text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_enrollments_semester_student on public.student_enrollments(semester_id, student_id);
create index if not exists idx_offerings_semester on public.course_offerings(semester_id);
create index if not exists idx_timetables_offering_day on public.timetables(course_offering_id, day_of_week);
create index if not exists idx_meetings_offering_date on public.meetings(course_offering_id, meeting_date);
create index if not exists idx_attendance_student on public.attendance_records(student_id, meeting_id);
create index if not exists idx_exams_offering on public.exams(course_offering_id);
create index if not exists idx_assignments_deadline on public.assignments(deadline);
create index if not exists idx_announcements_published on public.announcements(published_at desc);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at);
create index if not exists idx_notifications_recipient on public.notifications(recipient_profile_id, read_at);

create or replace function public.is_simk_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'ADMIN'
      and p.is_active = true
      and p.nim = 'Q1A126065'
  );
$$;

create or replace function public.is_simk_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_active = true
  );
$$;

create or replace function public.current_simk_student_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.student_id from public.profiles p
  where p.id = (select auth.uid()) and p.is_active = true
  limit 1;
$$;

-- Profile identity and role are never editable by ordinary authenticated clients.
create or replace function public.protect_profile_identity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id <> old.id or new.student_id <> old.student_id or new.nim <> old.nim or new.role <> old.role then
    raise exception 'Perubahan identitas dan role hanya dapat dilakukan melalui proses server yang terlindungi';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_protect_profile_identity on public.profiles;
create trigger trg_protect_profile_identity before update on public.profiles
for each row execute function public.protect_profile_identity();



create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'Sesi login diperlukan'; end if;
  if not public.is_simk_admin() and not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id and c.student_id = public.current_simk_student_id()
  ) then
    raise exception 'Percakapan tidak dapat diakses';
  end if;
  update public.messages
    set read_at = now()
    where conversation_id = p_conversation_id
      and sender_profile_id <> (select auth.uid())
      and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Admin-only, allowlisted AI actions. The AI itself never writes to official tables.
create or replace function public.approve_ai_draft(p_draft_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_draft public.ai_drafts%rowtype;
  v_actor uuid := (select auth.uid());
  v_status text;
  v_id uuid;
begin
  if not public.is_simk_admin() then raise exception 'Hanya Admin yang dapat menyetujui draft AI'; end if;
  select * into v_draft from public.ai_drafts where id = p_draft_id for update;
  if not found then raise exception 'Draft tidak ditemukan'; end if;
  if v_draft.status <> 'PENDING' then raise exception 'Draft sudah diproses'; end if;

  if v_draft.action_type = 'CREATE_ANNOUNCEMENT' then
    insert into public.announcements(semester_id, course_offering_id, title, body, category, is_public, created_by)
    values (
      nullif(v_draft.proposed_payload->>'semester_id','')::uuid,
      nullif(v_draft.proposed_payload->>'course_offering_id','')::uuid,
      v_draft.proposed_payload->>'title',
      v_draft.proposed_payload->>'body',
      coalesce(v_draft.proposed_payload->>'category','INFORMATION'),
      coalesce((v_draft.proposed_payload->>'is_public')::boolean,true), v_actor
    ) returning id into v_id;
  elsif v_draft.action_type = 'UPDATE_ATTENDANCE' then
    update public.attendance_records set status = v_draft.proposed_payload->>'status', updated_by = v_actor, updated_at = now()
    where id = (v_draft.proposed_payload->>'attendance_record_id')::uuid
      and (v_draft.proposed_payload->>'status') in ('H','I','S','A','?')
    returning id into v_id;
    if v_id is null then raise exception 'Data presensi tidak ditemukan atau status tidak valid'; end if;
  elsif v_draft.action_type = 'CREATE_ASSIGNMENT' then
    insert into public.assignments(course_offering_id, lecturer_id, meeting_id, title, instructions, assigned_at, deadline)
    values (
      (v_draft.proposed_payload->>'course_offering_id')::uuid,
      nullif(v_draft.proposed_payload->>'lecturer_id','')::uuid,
      nullif(v_draft.proposed_payload->>'meeting_id','')::uuid,
      v_draft.proposed_payload->>'title',
      v_draft.proposed_payload->>'instructions',
      nullif(v_draft.proposed_payload->>'assigned_at','')::timestamptz,
      nullif(v_draft.proposed_payload->>'deadline','')::timestamptz
    ) returning id into v_id;
  else
    raise exception 'Jenis tindakan AI tidak diizinkan';
  end if;

  update public.ai_drafts set status = 'APPROVED', reviewed_by = v_actor, reviewed_at = now() where id = p_draft_id;
  insert into public.audit_logs(actor_profile_id, action, entity_table, entity_id, new_values)
  values (v_actor, 'AI_DRAFT_APPROVED', v_draft.action_type, v_id, jsonb_build_object('draft_id', p_draft_id));
  return jsonb_build_object('ok', true, 'created_or_updated_id', v_id, 'draft_id', p_draft_id);
end;
$$;

create or replace function public.reject_ai_draft(p_draft_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_simk_admin() then raise exception 'Hanya Admin yang dapat menolak draft AI'; end if;
  update public.ai_drafts set status='REJECTED', reviewed_by=(select auth.uid()), reviewed_at=now()
  where id=p_draft_id and status='PENDING';
  if not found then raise exception 'Draft tidak ditemukan atau sudah diproses'; end if;
end;
$$;

-- Updated timestamps
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create or replace function public.write_simk_audit_log()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_row jsonb;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
    v_row := v_new;
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    v_row := v_new;
  else
    v_old := to_jsonb(old);
    v_row := v_old;
  end if;
  v_entity_id := nullif(v_row->>'id','')::uuid;
  insert into public.audit_logs(actor_profile_id, action, entity_table, entity_id, old_values, new_values)
  values ((select auth.uid()), tg_op, tg_table_name, v_entity_id, v_old, v_new);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'students','semesters','student_enrollments','lecturers','course_offerings','course_lecturers',
    'roster_imports','roster_import_rows','timetables','meetings','attendance_records','attendance_imports',
    'attendance_import_rows','exams','exam_confirmations','exam_attendance','assignments','announcements',
    'leave_requests','conversations','messages','ai_drafts','report_snapshots'
  ] LOOP
    EXECUTE format('drop trigger if exists %I on public.%I', 'trg_audit_' || table_name, table_name);
    EXECUTE format('create trigger %I after insert or update or delete on public.%I for each row execute function public.write_simk_audit_log()', 'trg_audit_' || table_name, table_name);
  END LOOP;
END $$;

drop trigger if exists trg_students_updated_at on public.students;
create trigger trg_students_updated_at before update on public.students for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- Data source is the user's photos. Rows 1–40 are deliberately not fabricated.
insert into public.students(nim, full_name, needs_verification, source_note) values
('Q1A126041','ANDI ALIF INZANIAL DZAKWAN',false,null),
('Q1A126042','ANDINI DESYA PUTRI',false,null),
('Q1A126043','ARIEL REZKY PRATAMA',false,null),
('Q1A126044','ARYA DWI PANGGA',false,null),
('Q1A126045','ARYO BANYUBIRU24',true,'Nama persis seperti terbaca pada foto; verifikasi ejaan sebelum akun diaktifkan.'),
('Q1A126046','ASRUL ANSI SABARA',false,null),
('Q1A126047','EGI ANDIKA NURYADIN',false,null),
('Q1A126048','ERIKA FEBRIANI',false,null),
('Q1A126049','FARIS DAWLAH NASIR',false,null),
('Q1A126050','GIAT ALFARIZI',false,null),
('Q1A126051','JIHAN NURAFIFAH',true,'Nama pada foto sumber perlu diverifikasi; jangan melengkapi atau mengubah tanpa konfirmasi.'),
('Q1A126052','LA ODE MUH. HASRAT. H',false,null),
('Q1A126053','LISMINA JULIYANA ODE',false,null),
('Q1A126054','MASIANI ALFIN',false,null),
('Q1A126055','MUH ARBAINI ALFATHA',false,null),
('Q1A126056','MUHAMMAD ABDILLAH HADARUL',false,null),
('Q1A126057','MUHAMMAD KENZIE SULTAN',false,null),
('Q1A126058','MUHAMMAD ZOULTAN FAHREZI',false,null),
('Q1A126059','NADIAH FATHINA AINIYAH AZMI',false,null),
('Q1A126060','NAILA IRENE YUSNADI',false,null),
('Q1A126061','NARISYA ZAHRATUN NADIRA SYAM KADIR',false,null),
('Q1A126062','NISBA BERKAH ABADI',false,null),
('Q1A126063','NUR AZIZAH MUBARAQ',false,null),
('Q1A126064','NURFAIDA GITA LESTARI',false,null),
('Q1A126065','RAMAN DZULFITRA',false,'Ketua Tingkat; satu-satunya Admin utama saat bootstrap'),
('Q1A126066','RESTIKA SARI',false,null),
('Q1A126067','SALMAN ALFARIZI',false,null),
('Q1A126068','SALWA RIZQULLAH',false,null),
('Q1A126069','SARMILA AULIA FUTRI',false,null),
('Q1A126070','SELPI SELPI',false,null),
('Q1A126071','SITTI SELA YUNIARSI',false,null),
('Q1A126072','SYANIA DWI ZAFIRA',false,null),
('Q1A126073','TANTI NADA',false,null),
('Q1A126074','VINA CANDRAWATI',false,null),
('Q1A126075','WA ODE SITTI HAJRA',false,null),
('Q1A126076','WAODE FETRA',false,null),
('Q1A126077','YUNANDA',false,null),
('Q1A126078','ZAITUN AMALIAH',false,null)
on conflict (nim) do nothing;

-- RLS on every table in public schema created by this migration.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'students','profiles','semesters','student_enrollments','lecturers','course_offerings','course_lecturers',
    'roster_imports','roster_import_rows','timetables','meetings','attendance_records','attendance_imports',
    'attendance_import_rows','exams','exam_confirmations','exam_attendance','assignments','announcements',
    'leave_requests','conversations','messages','ai_drafts','report_snapshots','notifications','audit_logs'
  ] LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
  END LOOP;
END $$;

-- Security-definer helpers are never callable by anonymous users or PUBLIC.
revoke all on function public.is_simk_admin() from PUBLIC, anon;
revoke all on function public.is_simk_active_user() from PUBLIC, anon;
revoke all on function public.current_simk_student_id() from PUBLIC, anon;
revoke all on function public.mark_conversation_read(uuid) from PUBLIC, anon;
revoke all on function public.approve_ai_draft(uuid) from PUBLIC, anon;
revoke all on function public.reject_ai_draft(uuid) from PUBLIC, anon;
revoke all on function public.protect_profile_identity() from PUBLIC, anon, authenticated;
revoke all on function public.write_simk_audit_log() from PUBLIC, anon, authenticated;
revoke all on function public.set_updated_at() from PUBLIC, anon, authenticated;

-- Revoke implicit client grants, then grant only required table operations.
revoke all on table public.students, public.profiles, public.semesters, public.student_enrollments,
  public.lecturers, public.course_offerings, public.course_lecturers, public.roster_imports,
  public.roster_import_rows, public.timetables, public.meetings, public.attendance_records,
  public.attendance_imports, public.attendance_import_rows, public.exams, public.exam_confirmations,
  public.exam_attendance, public.assignments, public.announcements, public.leave_requests,
  public.conversations, public.messages, public.ai_drafts, public.report_snapshots,
  public.notifications, public.audit_logs from anon, authenticated;

-- General academic information is public; personal records remain behind RLS.
grant select on public.semesters, public.lecturers, public.course_offerings, public.course_lecturers,
  public.timetables, public.meetings, public.exams, public.assignments, public.announcements to anon, authenticated;
grant select on public.profiles, public.students, public.student_enrollments, public.attendance_records,
  public.exam_confirmations, public.exam_attendance, public.leave_requests, public.conversations,
  public.messages, public.notifications to authenticated;
grant insert, update, delete on public.students, public.semesters, public.student_enrollments, public.lecturers,
  public.course_offerings, public.course_lecturers, public.roster_imports, public.roster_import_rows,
  public.timetables, public.meetings, public.attendance_records, public.attendance_imports,
  public.attendance_import_rows, public.exams, public.assignments, public.announcements,
  public.leave_requests, public.conversations, public.messages, public.ai_drafts,
  public.report_snapshots to authenticated;
grant insert, update on public.exam_confirmations to authenticated;
grant insert on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.roster_imports, public.roster_import_rows, public.attendance_imports,
  public.attendance_import_rows, public.ai_drafts, public.report_snapshots, public.audit_logs to authenticated;
grant execute on function public.is_simk_admin(), public.is_simk_active_user(), public.current_simk_student_id(),
  public.mark_conversation_read(uuid), public.approve_ai_draft(uuid),
  public.reject_ai_draft(uuid) to authenticated;

-- Profiles: self-read and Admin read; no browser can assign or modify role.
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_simk_admin());
create policy profiles_admin_update on public.profiles for update to authenticated
using (public.is_simk_admin()) with check (public.is_simk_admin());

create policy students_read_self_or_admin on public.students for select to authenticated
using (id = public.current_simk_student_id() or public.is_simk_admin());
create policy students_admin_insert on public.students for insert to authenticated with check (public.is_simk_admin());
create policy students_admin_update on public.students for update to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy students_admin_delete on public.students for delete to authenticated using (public.is_simk_admin());

create policy semesters_active_read on public.semesters for select to authenticated using (public.is_simk_active_user());
create policy semesters_admin_all on public.semesters for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy enrollment_self_or_admin_read on public.student_enrollments for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy enrollment_admin_all on public.student_enrollments for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['semesters','lecturers','course_offerings','course_lecturers','timetables','meetings','exams','assignments'] LOOP
    EXECUTE format('create policy %I on public.%I for select to anon using (true)', t || '_public_read', t);
    EXECUTE format('create policy %I on public.%I for select to authenticated using (public.is_simk_active_user())', t || '_active_read', t);
    EXECUTE format('create policy %I on public.%I for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin())', t || '_admin_all', t);
  END LOOP;
END $$;

create policy roster_imports_admin_all on public.roster_imports for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy roster_rows_admin_all on public.roster_import_rows for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy attendance_imports_admin_all on public.attendance_imports for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy attendance_import_rows_admin_all on public.attendance_import_rows for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());

create policy attendance_read_self_or_admin on public.attendance_records for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy attendance_admin_insert on public.attendance_records for insert to authenticated with check (public.is_simk_admin());
create policy attendance_admin_update on public.attendance_records for update to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy attendance_admin_delete on public.attendance_records for delete to authenticated using (public.is_simk_admin());

create policy exam_confirmation_self_or_admin_read on public.exam_confirmations for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy exam_confirmation_self_insert on public.exam_confirmations for insert to authenticated
with check (student_id = public.current_simk_student_id() and public.is_simk_active_user());
create policy exam_confirmation_self_update on public.exam_confirmations for update to authenticated
using (student_id = public.current_simk_student_id()) with check (student_id = public.current_simk_student_id());
create policy exam_attendance_self_or_admin_read on public.exam_attendance for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy exam_attendance_admin_all on public.exam_attendance for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());

create policy announcements_public_read on public.announcements for select to anon using (is_public = true);
create policy announcements_active_read on public.announcements for select to authenticated
using (is_public = true or (public.is_simk_active_user() and not is_public));
create policy announcements_admin_all on public.announcements for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());

create policy leave_read_self_or_admin on public.leave_requests for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy leave_self_insert on public.leave_requests for insert to authenticated
with check (student_id = public.current_simk_student_id() and public.is_simk_active_user());
create policy leave_admin_update on public.leave_requests for update to authenticated
using (public.is_simk_admin()) with check (public.is_simk_admin());

create policy conversations_read_self_or_admin on public.conversations for select to authenticated
using (student_id = public.current_simk_student_id() or public.is_simk_admin());
create policy conversations_student_create_own on public.conversations for insert to authenticated
with check (student_id = public.current_simk_student_id());
create policy messages_read_self_or_admin on public.messages for select to authenticated
using (public.is_simk_admin() or exists (
  select 1 from public.conversations c where c.id = conversation_id and c.student_id = public.current_simk_student_id()
));
create policy messages_insert_scoped on public.messages for insert to authenticated
with check (sender_profile_id = (select auth.uid()) and (
  public.is_simk_admin() or exists (
    select 1 from public.conversations c where c.id = conversation_id and c.student_id = public.current_simk_student_id()
  )
));

create policy ai_drafts_admin_all on public.ai_drafts for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy report_snapshots_admin_all on public.report_snapshots for all to authenticated using (public.is_simk_admin()) with check (public.is_simk_admin());
create policy notifications_self_or_admin_read on public.notifications for select to authenticated
using (recipient_profile_id = (select auth.uid()) or public.is_simk_admin());
create policy notifications_self_update on public.notifications for update to authenticated
using (recipient_profile_id = (select auth.uid())) with check (recipient_profile_id = (select auth.uid()));
create policy notifications_admin_insert on public.notifications for insert to authenticated with check (public.is_simk_admin());
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_simk_admin());

-- Private storage bucket; files are not public URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('simk-private','simk-private',false,26214400,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
create policy simk_private_admin_all on storage.objects for all to authenticated
using (bucket_id = 'simk-private' and public.is_simk_admin())
with check (bucket_id = 'simk-private' and public.is_simk_admin());
create policy simk_private_student_leave_read on storage.objects for select to authenticated
using (
  bucket_id = 'simk-private'
  and (storage.foldername(name))[1] = 'leave'
  and (storage.foldername(name))[2] = public.current_simk_student_id()::text
);
create policy simk_private_student_leave_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'simk-private'
  and (storage.foldername(name))[1] = 'leave'
  and (storage.foldername(name))[2] = public.current_simk_student_id()::text
);

commit;
