import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const db = new PGlite();
const student = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  supervisor = "10000000-0000-4000-8000-000000000003",
  admin = "10000000-0000-4000-8000-000000000004",
  faculty = "20000000-0000-4000-8000-000000000001",
  department = "30000000-0000-4000-8000-000000000001",
  draft = "40000000-0000-4000-8000-000000000001",
  approved = "40000000-0000-4000-8000-000000000002";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;`,
  );
  for (const filename of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await db.exec(readFileSync("supabase/migrations/" + filename, "utf8"));
  }
  await db.exec(
    `insert into faculties(id,name,code) values('${faculty}','Science','SCI');insert into departments(id,faculty_id,name,code) values('${department}','${faculty}','Computer Science','CSC');insert into auth.users(id,email,raw_user_meta_data) values('${student}','student@example.test','{"full_name":"Student One","role":"ADMIN"}'),('${other}','other@example.test','{"full_name":"Student Two"}'),('${supervisor}','supervisor@example.test','{"full_name":"Supervisor"}'),('${admin}','admin@example.test','{"full_name":"Admin"}');update profiles set role='SUPERVISOR' where id='${supervisor}';update profiles set role='ADMIN' where id='${admin}';insert into theses(id,student_id,supervisor_id,title,abstract,faculty_id,department_id,academic_year,document_path,original_filename,mime_type,file_size,status) values('${draft}','${student}','${supervisor}','Private research thesis','A private research abstract','${faculty}','${department}',2026,'private.pdf','private.pdf','application/pdf',100,'SUBMITTED'),('${approved}','${other}',null,'Approved research thesis','An approved research abstract','${faculty}','${department}',2026,'approved.pdf','approved.pdf','application/pdf',100,'APPROVED');insert into plagiarism_scans(thesis_id,requested_by,status) values('${draft}','${student}','COMPLETED'),('${approved}','${other}','COMPLETED');insert into storage.objects(bucket_id,name) values('theses','private.pdf'),('theses','approved.pdf');`,
  );
});
afterAll(() => db.close());
async function asUser<T>(id: string, sql: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query<T>(sql);
  } finally {
    await db.exec("reset role;");
  }
}
describe("migration and real PostgreSQL RLS", () => {
  it("forces public registration to STUDENT despite forged role metadata", async () => {
    const r = await db.query<{ role: string }>(
      `select role from profiles where id='${student}'`,
    );
    expect(r.rows[0].role).toBe("STUDENT");
  });
  it("enables RLS on every application table", async () => {
    const r = await db.query<{ relname: string }>(
      `select relname from pg_class join pg_namespace on pg_namespace.oid=relnamespace where nspname='public' and relkind='r' and not relrowsecurity`,
    );
    expect(r.rows).toEqual([]);
  });
  it("students see their private thesis and approved repository documents", async () => {
    const r = await asUser(student, "select id from theses");
    expect(r.rows).toHaveLength(2);
  });
  it("another student cannot read private theses, scans, or files", async () => {
    expect(
      (await asUser(other, `select id from theses where id='${draft}'`)).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          other,
          `select id from plagiarism_scans where thesis_id='${draft}'`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await asUser(
          other,
          `select name from storage.objects where name='private.pdf'`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("repository approval does not publish another student’s scan", async () => {
    expect(
      (
        await asUser(
          student,
          `select id from plagiarism_scans where thesis_id='${approved}'`,
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("assigned supervisors can read private scans", async () => {
    expect(
      (
        await asUser(
          supervisor,
          `select id from plagiarism_scans where thesis_id='${draft}'`,
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("admins can read every scan", async () => {
    expect(
      (await asUser(admin, "select id from plagiarism_scans")).rows,
    ).toHaveLength(2);
  });
  it("students cannot update their role or forge thesis approval", async () => {
    await expect(
      asUser(student, `update profiles set role='ADMIN' where id='${student}'`),
    ).rejects.toThrow();
    await expect(
      asUser(
        student,
        `update theses set status='APPROVED' where id='${draft}'`,
      ),
    ).rejects.toThrow();
  });
  it("students can edit basic fields only on their own profile", async () => {
    await asUser(
      student,
      `update profiles set full_name='Updated Name' where id='${student}'`,
    );
    await asUser(
      student,
      `update profiles set full_name='Forged Name' where id='${other}'`,
    );
    const result = await db.query<{ full_name: string }>(
      `select full_name from profiles where id='${other}'`,
    );
    expect(result.rows[0].full_name).toBe("Student Two");
  });
  it("public users cannot execute privileged scan functions", async () => {
    await expect(
      asUser(student, `select enqueue_scan('${draft}','${student}')`),
    ).rejects.toThrow();
  });
  it("rejects concurrent active scans and enforces daily quota", async () => {
    await db.exec(`select enqueue_scan('${draft}','${student}');`);
    await expect(
      db.exec(`select enqueue_scan('${draft}','${student}')`),
    ).rejects.toThrow();
    await db.exec(
      `update plagiarism_scans set status='FAILED' where status='QUEUED';update system_settings set maximum_daily_scans=1;`,
    );
    await expect(
      db.exec(`select enqueue_scan('${draft}','${student}')`),
    ).rejects.toThrow("Daily scan limit");
  });
  it("review transaction rejects unassigned students and records legitimate decisions", async () => {
    await expect(
      db.exec(
        `select review_thesis('${draft}','${other}','APPROVED','Forged review');`,
      ),
    ).rejects.toThrow("Review not allowed");
    await db.exec(
      `select review_thesis('${draft}','${supervisor}','APPROVED','Reviewed the evidence.');`,
    );
    const r = await db.query<{ status: string }>(
      `select status from theses where id='${draft}'`,
    );
    expect(r.rows[0].status).toBe("APPROVED");
    expect(
      (await db.query("select * from supervisor_reviews")).rows,
    ).toHaveLength(1);
  });
  it("keeps the thesis bucket private", async () => {
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='theses'",
        )
      ).rows[0].public,
    ).toBe(false);
  });
});

describe("atomic upload finalization", () => {
  const id = "50000000-0000-4000-8000-000000000001";
  const record = {
    id,
    student_id: student,
    title: "Atomic upload test thesis",
    abstract: "A test abstract",
    keywords: ["testing"],
    faculty_id: faculty,
    department_id: department,
    academic_year: 2026,
    document_path: student + "/" + id + "/test.pdf",
    original_filename: "test.pdf",
    mime_type: "application/pdf",
    file_size: 100,
    status: "DRAFT",
    word_count: 10,
  };
  const chunk = {
    chunk_index: 0,
    original_text: "Test words",
    normalized_text: "test words",
    token_count: 2,
    fingerprint_data: [12],
  };
  it("rolls back the thesis when chunk persistence fails", async () => {
    await expect(
      db.query("select public.finalize_thesis_upload($1::jsonb,$2::jsonb)", [
        JSON.stringify(record),
        JSON.stringify([chunk, chunk]),
      ]),
    ).rejects.toThrow();
    expect(
      (await db.query("select id from theses where id=$1", [id])).rows,
    ).toHaveLength(0);
  });
  it("returns the same thesis on retry without duplicating or changing its status", async () => {
    await db.query(
      "select public.finalize_thesis_upload($1::jsonb,$2::jsonb)",
      [JSON.stringify(record), JSON.stringify([chunk])],
    );
    await db.query(
      "select public.finalize_thesis_upload($1::jsonb,$2::jsonb)",
      [
        JSON.stringify({ ...record, status: "SUBMITTED" }),
        JSON.stringify([chunk]),
      ],
    );
    expect(
      (await db.query("select status from theses where id=$1", [id])).rows,
    ).toEqual([{ status: "DRAFT" }]);
    expect(
      (await db.query("select id from thesis_chunks where thesis_id=$1", [id]))
        .rows,
    ).toHaveLength(1);
  });
  it("does not grant students direct access to privileged finalization", async () => {
    await expect(
      asUser(student, "select public.finalize_thesis_upload('{}','[]')"),
    ).rejects.toThrow(/permission denied/);
  });
});
