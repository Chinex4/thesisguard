-- Server-only finalization: thesis and chunks commit together, once per upload UUID.
create or replace function public.finalize_thesis_upload(p_thesis jsonb, p_chunks jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  v public.theses;
  existing public.theses;
begin
  v := jsonb_populate_record(null::public.theses, p_thesis);
  perform pg_advisory_xact_lock(hashtextextended(v.id::text, 0));
  select * into existing from public.theses where id = v.id;
  if found then
    if existing.student_id <> v.student_id or existing.document_path <> v.document_path then
      raise exception 'Upload identity conflict';
    end if;
    return existing.id;
  end if;
  insert into public.theses(id, student_id, supervisor_id, title, abstract, keywords, faculty_id, department_id, academic_year, document_path, original_filename, mime_type, file_size, status, extracted_text, normalized_text, word_count, version_of)
  values(v.id, v.student_id, v.supervisor_id, v.title, v.abstract, v.keywords, v.faculty_id, v.department_id, v.academic_year, v.document_path, v.original_filename, v.mime_type, v.file_size, v.status, v.extracted_text, v.normalized_text, v.word_count, v.version_of);
  insert into public.thesis_chunks(thesis_id, chunk_index, original_text, normalized_text, token_count, fingerprint_data)
  select v.id, c.chunk_index, c.original_text, c.normalized_text, c.token_count, c.fingerprint_data
  from jsonb_to_recordset(p_chunks) as c(chunk_index int, original_text text, normalized_text text, token_count int, fingerprint_data bigint[]);
  return v.id;
end;
$$;
revoke all on function public.finalize_thesis_upload(jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_thesis_upload(jsonb,jsonb) to service_role;
