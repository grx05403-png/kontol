-- SIMK ITP B — migration 002: security hardening for student exam confirmations.
-- Apply after 202611230001_initial.sql. Test on a staging Supabase project first.

begin;

-- A first-login user must not be able to call a public RPC to clear this flag.
-- Only the authenticated change-password Edge Function updates the flag via server-side secret.
drop function if exists public.mark_password_changed();

create or replace function public.validate_exam_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deadline timestamptz;
  v_offering_id uuid;
  v_semester_id uuid;
  v_student_active boolean;
  v_enrolled boolean;
begin
  if (select auth.uid()) is null then
    raise exception 'Sesi login diperlukan';
  end if;

  if not public.is_simk_admin() then
    if new.student_id <> public.current_simk_student_id() then
      raise exception 'Mahasiswa hanya dapat mengonfirmasi ujian miliknya sendiri';
    end if;

    select e.confirmation_deadline, e.course_offering_id, o.semester_id
      into v_deadline, v_offering_id, v_semester_id
    from public.exams e
    join public.course_offerings o on o.id = e.course_offering_id
    where e.id = new.exam_id;

    if not found then raise exception 'Sesi ujian tidak ditemukan'; end if;
    if v_deadline is not null and now() > v_deadline then
      raise exception 'Batas waktu konfirmasi ujian sudah lewat';
    end if;

    select s.is_active and not s.needs_verification
      into v_student_active
    from public.students s
    where s.id = new.student_id;
    if coalesce(v_student_active, false) is not true then
      raise exception 'Akun mahasiswa tidak aktif atau identitas belum diverifikasi';
    end if;

    select exists (
      select 1 from public.student_enrollments se
      where se.student_id = new.student_id
        and se.semester_id = v_semester_id
        and se.enrollment_status = 'ACTIVE'
    ) into v_enrolled;
    if not v_enrolled then
      raise exception 'Mahasiswa belum terdaftar pada semester mata kuliah ini';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.exam_id <> old.exam_id or new.student_id <> old.student_id then
      raise exception 'Identitas konfirmasi tidak dapat dipindahkan';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.validate_exam_confirmation() from PUBLIC, anon, authenticated;

drop trigger if exists trg_validate_exam_confirmation on public.exam_confirmations;
create trigger trg_validate_exam_confirmation
before insert or update on public.exam_confirmations
for each row execute function public.validate_exam_confirmation();

-- Admin can correct confirmations. Students remain limited to their own row and deadline.
drop policy if exists exam_confirmation_admin_all on public.exam_confirmations;
create policy exam_confirmation_admin_all
on public.exam_confirmations
for all to authenticated
using (public.is_simk_admin())
with check (public.is_simk_admin());


-- Atomic Admin activation/deactivation to keep roster and account status synchronized.
create or replace function public.admin_set_student_active(p_nim text, p_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_profile public.profiles%rowtype;
  v_has_profile boolean := false;
  v_actor uuid := (select auth.uid());
begin
  if not public.is_simk_admin() then raise exception 'Hanya Admin utama yang dapat mengubah status mahasiswa'; end if;
  if p_nim = 'Q1A126065' then raise exception 'Status Admin utama tidak dapat diubah melalui fungsi mahasiswa'; end if;
  select * into v_student from public.students where nim = p_nim for update;
  if not found then raise exception 'Mahasiswa tidak ditemukan'; end if;
  if p_active and v_student.needs_verification then
    raise exception 'Identitas mahasiswa harus diverifikasi sebelum akun diaktifkan';
  end if;
  select * into v_profile from public.profiles where student_id = v_student.id for update;
  v_has_profile := found;

  update public.students set is_active = p_active, updated_at = now() where id = v_student.id;
  if v_has_profile then
    update public.profiles set is_active = p_active, updated_at = now() where id = v_profile.id;
  end if;
  insert into public.audit_logs(actor_profile_id, action, entity_table, entity_id, old_values, new_values)
  values (
    v_actor,
    case when p_active then 'STUDENT_ACCOUNT_ACTIVATED' else 'STUDENT_ACCOUNT_DEACTIVATED' end,
    'students', v_student.id,
    jsonb_build_object('student_active', v_student.is_active, 'profile_active', case when v_has_profile then v_profile.is_active else null end),
    jsonb_build_object('student_active', p_active, 'profile_active', case when v_has_profile then p_active else null end)
  );
  return jsonb_build_object('ok', true, 'nim', p_nim, 'is_active', p_active, 'has_profile', v_has_profile);
end;
$$;
revoke all on function public.admin_set_student_active(text, boolean) from PUBLIC, anon;
grant execute on function public.admin_set_student_active(text, boolean) to authenticated;

-- Prevent duplicate ordered lecturer slots within one course offering.
create unique index if not exists simk_ordered_lecturer_sequence_unique
on public.course_lecturers(course_offering_id, sequence_no)
where assignment_mode = 'ORDERED' and sequence_no is not null;

commit;
