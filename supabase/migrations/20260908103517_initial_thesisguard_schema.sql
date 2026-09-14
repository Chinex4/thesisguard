create type public.user_role as enum ('STUDENT','SUPERVISOR','ADMIN');
create type public.thesis_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','ARCHIVED');
create type public.scan_status as enum ('QUEUED','EXTRACTING','SEARCHING_REPOSITORY','SEARCHING_WEB','SEARCHING_ACADEMIC','COMPARING','AI_ANALYSIS','COMPLETED','FAILED');
create type public.source_type as enum ('REPOSITORY','WEB','ACADEMIC');
create table public.faculties(id uuid primary key default gen_random_uuid(),name text not null unique,code text not null unique,created_at timestamptz not null default now());
create table public.departments(id uuid primary key default gen_random_uuid(),faculty_id uuid not null references public.faculties,name text not null,code text not null unique,created_at timestamptz not null default now());
create table public.profiles(id uuid primary key references auth.users on delete cascade,full_name text not null,email text not null,role public.user_role not null default 'STUDENT',matric_number text,staff_number text,faculty_id uuid references public.faculties,department_id uuid references public.departments,avatar_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.theses(id uuid primary key default gen_random_uuid(),student_id uuid not null references public.profiles,supervisor_id uuid references public.profiles,title text not null check(length(title) between 10 and 300),abstract text not null,keywords text[] not null default '{}',faculty_id uuid not null references public.faculties,department_id uuid not null references public.departments,academic_year int not null,document_path text not null unique,original_filename text not null,mime_type text not null,file_size bigint not null, status public.thesis_status not null default 'DRAFT',extracted_text text,normalized_text text,word_count int not null default 0,approved_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version_of uuid references public.theses);
create table public.thesis_chunks(id uuid primary key default gen_random_uuid(),thesis_id uuid not null references public.theses on delete cascade,chunk_index int not null,original_text text not null,normalized_text text not null,token_count int not null,fingerprint_data bigint[] not null,created_at timestamptz not null default now(),unique(thesis_id,chunk_index));
create table public.plagiarism_scans(id uuid primary key default gen_random_uuid(),thesis_id uuid not null references public.theses on delete cascade,requested_by uuid not null references public.profiles,status public.scan_status not null default 'QUEUED',overall_similarity numeric not null default 0,repository_similarity numeric not null default 0,web_similarity numeric not null default 0,academic_similarity numeric not null default 0,total_sources int not null default 0,total_matches int not null default 0,eligible_word_count int not null default 0,matched_word_count int not null default 0,started_at timestamptz,completed_at timestamptz,error_message text,warnings jsonb not null default '[]',ai_status text not null default 'PENDING',created_at timestamptz not null default now(),heartbeat_at timestamptz,attempts int not null default 0);
create unique index one_active_scan on public.plagiarism_scans(thesis_id) where status not in ('COMPLETED','FAILED');
create table public.scan_sources(id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.plagiarism_scans on delete cascade,source_type public.source_type not null,source_title text not null,source_url text,author text,publication_year int,doi text,repository_thesis_id uuid references public.theses on delete set null,similarity_score numeric not null default 0,metadata jsonb not null default '{}',created_at timestamptz not null default now());
create table public.similarity_matches(id uuid primary key default gen_random_uuid(),scan_id uuid not null references public.plagiarism_scans on delete cascade,source_id uuid not null references public.scan_sources on delete cascade,thesis_chunk_id uuid references public.thesis_chunks on delete set null,submitted_text text not null,source_text text not null,similarity_score numeric not null,match_type text not null check(match_type in ('EXACT','NEAR_EXACT','FINGERPRINT','LEXICAL','SEMANTIC')),start_position int,end_position int,start_word int not null,end_word int not null,is_quoted boolean not null default false,is_cited boolean not null default false,in_references boolean not null default false,excluded_from_score boolean not null default false,ai_classification text,ai_explanation text,citation_concern text,recommendation text,created_at timestamptz not null default now());
create table public.supervisor_reviews(id uuid primary key default gen_random_uuid(),thesis_id uuid not null references public.theses on delete cascade,supervisor_id uuid not null references public.profiles,decision public.thesis_status not null check(decision in ('UNDER_REVIEW','APPROVED','REJECTED')),comment text not null,created_at timestamptz not null default now());
create table public.system_settings(id boolean primary key default true check(id),similarity_warning_threshold int not null default 15 check(similarity_warning_threshold between 0 and 100),similarity_high_threshold int not null default 30 check(similarity_high_threshold between 0 and 100),maximum_file_size int not null default 20 check(maximum_file_size between 1 and 20),maximum_daily_scans int not null default 5 check(maximum_daily_scans between 1 and 100),allow_student_resubmission boolean not null default true,external_search_enabled boolean not null default true,academic_search_enabled boolean not null default true,check(similarity_warning_threshold<similarity_high_threshold));
insert into public.system_settings(id) values(true);
create index chunks_fingerprints_gin on public.thesis_chunks using gin(fingerprint_data);
create index theses_search on public.theses using gin(to_tsvector('english',title||' '||abstract));
create index theses_student on public.theses(student_id);
create index theses_supervisor on public.theses(supervisor_id);
create index theses_repository on public.theses(status,department_id,academic_year);
create index scans_user_date on public.plagiarism_scans(requested_by,created_at);
create index scans_thesis on public.plagiarism_scans(thesis_id);
create index sources_scan on public.scan_sources(scan_id);
create index matches_scan on public.similarity_matches(scan_id);
create index reviews_thesis on public.supervisor_reviews(thesis_id);
create schema if not exists private;
grant usage on schema private to authenticated;
-- Security-definer lookups avoid recursive profile RLS, are outside the Data API,
-- have a fixed search_path, and derive identity exclusively from auth.uid().
create function private.current_role() returns public.user_role language sql stable security definer set search_path='' as $$select role from public.profiles where id=(select auth.uid()) and auth.uid() is not null$$;
create function private.can_read_thesis(target uuid, include_repository boolean default false) returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and exists(select 1 from public.theses t where t.id=target and (t.student_id=auth.uid() or t.supervisor_id=auth.uid() or private.current_role()='ADMIN' or (include_repository and t.status='APPROVED')))$$;
revoke all on function private.current_role() from public;
revoke all on function private.can_read_thesis(uuid,boolean) from public;
grant execute on function private.current_role(), private.can_read_thesis(uuid,boolean) to authenticated;
create function private.new_profile() returns trigger language plpgsql security definer set search_path='' as $$begin
insert into public.profiles(id,full_name,email,role,matric_number,faculty_id,department_id) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Student'),coalesce(new.email,''),'STUDENT',new.raw_user_meta_data->>'matric_number',nullif(new.raw_user_meta_data->>'faculty_id','')::uuid,nullif(new.raw_user_meta_data->>'department_id','')::uuid);return new;end$$;
revoke all on function private.new_profile() from public;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.new_profile();
create function private.touch_updated() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now();return new;end$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated();
create trigger theses_updated before update on public.theses for each row execute function private.touch_updated();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant all on public.profiles to service_role;
create policy admin_all on public.profiles for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.faculties enable row level security;
revoke all on public.faculties from anon, authenticated;
grant select on public.faculties to authenticated;
grant all on public.faculties to service_role;
create policy admin_all on public.faculties for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.departments enable row level security;
revoke all on public.departments from anon, authenticated;
grant select on public.departments to authenticated;
grant all on public.departments to service_role;
create policy admin_all on public.departments for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.theses enable row level security;
revoke all on public.theses from anon, authenticated;
grant select on public.theses to authenticated;
grant all on public.theses to service_role;
create policy admin_all on public.theses for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.thesis_chunks enable row level security;
revoke all on public.thesis_chunks from anon, authenticated;
grant select on public.thesis_chunks to authenticated;
grant all on public.thesis_chunks to service_role;
create policy admin_all on public.thesis_chunks for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.plagiarism_scans enable row level security;
revoke all on public.plagiarism_scans from anon, authenticated;
grant select on public.plagiarism_scans to authenticated;
grant all on public.plagiarism_scans to service_role;
create policy admin_all on public.plagiarism_scans for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.scan_sources enable row level security;
revoke all on public.scan_sources from anon, authenticated;
grant select on public.scan_sources to authenticated;
grant all on public.scan_sources to service_role;
create policy admin_all on public.scan_sources for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.similarity_matches enable row level security;
revoke all on public.similarity_matches from anon, authenticated;
grant select on public.similarity_matches to authenticated;
grant all on public.similarity_matches to service_role;
create policy admin_all on public.similarity_matches for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.supervisor_reviews enable row level security;
revoke all on public.supervisor_reviews from anon, authenticated;
grant select on public.supervisor_reviews to authenticated;
grant all on public.supervisor_reviews to service_role;
create policy admin_all on public.supervisor_reviews for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');

alter table public.system_settings enable row level security;
revoke all on public.system_settings from anon, authenticated;
grant select on public.system_settings to authenticated;
grant all on public.system_settings to service_role;
create policy admin_all on public.system_settings for all to authenticated using (private.current_role()='ADMIN') with check (private.current_role()='ADMIN');
grant select on public.faculties,public.departments to anon;
create policy directory_faculties on public.faculties for select to anon,authenticated using(true);
create policy directory_departments on public.departments for select to anon,authenticated using(true);
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or role='SUPERVISOR' or exists(select 1 from public.theses t where t.student_id=profiles.id and (t.status='APPROVED' or t.supervisor_id=auth.uid())));
create policy own_profile_edit on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant update(full_name,matric_number,avatar_url) on public.profiles to authenticated;
create policy thesis_read on public.theses for select to authenticated using(private.can_read_thesis(id,true));
create policy chunk_read on public.thesis_chunks for select to authenticated using(private.can_read_thesis(thesis_id,true));
create policy scan_read on public.plagiarism_scans for select to authenticated using(private.can_read_thesis(thesis_id,false));
create policy source_read on public.scan_sources for select to authenticated using(exists(select 1 from public.plagiarism_scans s where s.id=scan_id));
create policy match_read on public.similarity_matches for select to authenticated using(exists(select 1 from public.plagiarism_scans s where s.id=scan_id));
create policy review_read on public.supervisor_reviews for select to authenticated using(private.can_read_thesis(thesis_id,false));
create policy settings_read on public.system_settings for select to authenticated using(true);
-- All workflow mutations use server services with explicit ownership checks. Direct
-- Data API writes are intentionally revoked so status/role/score fields cannot be forged.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('theses','theses',false,20971520,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
create policy thesis_file_read on storage.objects for select to authenticated using(bucket_id='theses' and exists(select 1 from public.theses t where t.document_path=name and private.can_read_thesis(t.id,true)));
-- Atomic admission serializes scans per requester, preventing quota races.
create function public.enqueue_scan(p_thesis uuid,p_user uuid) returns uuid language plpgsql set search_path='' as $$declare result uuid; daily_limit int; begin
perform pg_advisory_xact_lock(hashtext(p_user::text));
if not exists(select 1 from public.theses t join public.profiles p on p.id=p_user where t.id=p_thesis and (t.student_id=p_user or t.supervisor_id=p_user or p.role='ADMIN') and t.status<>'ARCHIVED') then raise exception 'Thesis unavailable';end if;
select maximum_daily_scans into daily_limit from public.system_settings where id;
if (select count(*) from public.plagiarism_scans where requested_by=p_user and created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=daily_limit then raise exception 'Daily scan limit reached';end if;
insert into public.plagiarism_scans(thesis_id,requested_by) values(p_thesis,p_user) returning id into result;return result;end$$;
revoke all on function public.enqueue_scan(uuid,uuid) from public,anon,authenticated;
grant execute on function public.enqueue_scan(uuid,uuid) to service_role;
create function public.claim_scan() returns uuid language plpgsql set search_path='' as $$declare result uuid;begin
-- A crashed worker lease expires. Partial results are removed by the next attempt.
update public.plagiarism_scans set status='FAILED',error_message='Scan worker stopped repeatedly. Please start a new scan.' where status not in ('QUEUED','COMPLETED','FAILED') and heartbeat_at<now()-interval '3 minutes' and attempts>=3;
select id into result from public.plagiarism_scans where (status='QUEUED' or (status not in ('COMPLETED','FAILED') and heartbeat_at<now()-interval '3 minutes' and attempts<3)) order by created_at for update skip locked limit 1;
if result is not null then update public.plagiarism_scans set status='EXTRACTING',started_at=coalesce(started_at,now()),heartbeat_at=now(),attempts=attempts+1 where id=result;end if;return result;end$$;
revoke all on function public.claim_scan() from public,anon,authenticated;
grant execute on function public.claim_scan() to service_role;
create function public.repository_candidates(p_fingerprints bigint[],p_exclude uuid) returns setof public.thesis_chunks language sql set search_path='' as $$select c.* from public.thesis_chunks c join public.theses t on t.id=c.thesis_id where t.status='APPROVED' and t.id<>p_exclude and t.student_id<>(select student_id from public.theses where id=p_exclude) and c.fingerprint_data && p_fingerprints limit 400$$;
revoke all on function public.repository_candidates(bigint[],uuid) from public,anon,authenticated;
grant execute on function public.repository_candidates(bigint[],uuid) to service_role;
create function public.review_thesis(p_thesis uuid,p_reviewer uuid,p_decision public.thesis_status,p_comment text) returns void language plpgsql set search_path='' as $$begin
perform 1 from public.theses where id=p_thesis for update;
if p_decision not in ('UNDER_REVIEW','APPROVED','REJECTED') or not exists(select 1 from public.theses t join public.profiles p on p.id=p_reviewer where t.id=p_thesis and t.status in ('SUBMITTED','UNDER_REVIEW') and (p.role='ADMIN' or (p.role='SUPERVISOR' and t.supervisor_id=p_reviewer))) then raise exception 'Review not allowed';end if;
insert into public.supervisor_reviews(thesis_id,supervisor_id,decision,comment) values(p_thesis,p_reviewer,p_decision,p_comment);
update public.theses set status=p_decision,approved_at=case when p_decision='APPROVED' then now() else null end where id=p_thesis;end$$;
revoke all on function public.review_thesis(uuid,uuid,public.thesis_status,text) from public,anon,authenticated;
grant execute on function public.review_thesis(uuid,uuid,public.thesis_status,text) to service_role;
