from pathlib import Path

def w(p,s):
 p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
w('.env.example','''NEXT_PUBLIC_APP_NAME=ThesisGuard
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
WEB_SEARCH_PROVIDER=tavily
OPENALEX_API_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
MAX_UPLOAD_SIZE_MB=20
MAX_WEB_SEARCH_QUERIES_PER_SCAN=15
MAX_ACADEMIC_SEARCH_QUERIES_PER_SCAN=10
MAX_AI_ANALYSIS_MATCHES=20
''')
w('src/types/index.ts','''export type Role = 'STUDENT' | 'SUPERVISOR' | 'ADMIN';
export type ThesisStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
export type ScanStatus = 'QUEUED' | 'EXTRACTING' | 'SEARCHING_REPOSITORY' | 'SEARCHING_WEB' | 'SEARCHING_ACADEMIC' | 'COMPARING' | 'AI_ANALYSIS' | 'COMPLETED' | 'FAILED';
export interface Profile { id: string; full_name: string; email: string; role: Role; matric_number: string | null; staff_number: string | null; department_id: string | null; faculty_id: string | null; }
export interface Thesis { id: string; student_id: string; supervisor_id: string | null; title: string; abstract: string; keywords: string[]; academic_year: number; status: ThesisStatus; department_id: string; faculty_id: string; document_path: string; original_filename: string; mime_type: string; file_size: number; word_count: number; extracted_text: string | null; normalized_text: string | null; created_at: string; approved_at: string | null; version_of: string | null; student?: { full_name: string; matric_number: string | null }; department?: { name: string }; faculty?: { name: string }; supervisor?: {full_name:string}; }
export interface Scan { id: string; thesis_id: string; status: ScanStatus; overall_similarity: number; repository_similarity: number; web_similarity: number; academic_similarity: number; total_sources: number; total_matches: number; eligible_word_count: number; matched_word_count: number; warnings: string[]; ai_status: string; created_at: string; completed_at: string | null; error_message: string | null; thesis?: Thesis; }
export interface Settings { id: boolean; similarity_warning_threshold: number; similarity_high_threshold: number; maximum_file_size: number; maximum_daily_scans: number; allow_student_resubmission: boolean; external_search_enabled: boolean; academic_search_enabled: boolean; }
export const DISCLAIMER = 'A similarity score indicates textual overlap and should not by itself be treated as proof of plagiarism. Human academic review is recommended.';
export const LIMITATIONS = 'ThesisGuard checks accessible sources. It cannot access every private database or paywalled publication, reproduce Turnitin’s proprietary student-paper database, or detect every sophisticated paraphrase.';
''')
w('src/lib/config.ts','''export function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export function limit(name: string, fallback: number, max = 100) { const n = Number(process.env[name]); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback; }
''')
w('src/lib/supabase/server.ts','''import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { configured } from '@/lib/config';
export async function serverDb() {
 if (!configured()) throw new Error('Supabase is not configured. Follow the setup guide in README.md.');
 const jar = await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => jar.getAll(), setAll: (items) => { try { items.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Server Components refresh through proxy. */ } } } });
}
''')
w('src/lib/supabase/client.ts','''import { createBrowserClient } from '@supabase/ssr';
export function browserDb() { return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!); }
''')
w('src/lib/supabase/admin.ts','''import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function adminDb() {
 if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Server database credentials are missing.');
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
''')
w('src/lib/auth/session.ts','''import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { configured } from '@/lib/config';
import { serverDb } from '@/lib/supabase/server';
import type { Profile, Role } from '@/types';
export const session = cache(async (): Promise<Profile | null> => {
 if (!configured()) return null;
 const db = await serverDb(); const {data:{user}} = await db.auth.getUser();
 if (!user) return null;
 const { data,error } = await db.from('profiles').select('*').eq('id',user.id).single();
 if (error) throw new Error('Your profile could not be loaded. Check database setup or contact your administrator.');
 return data as Profile;
});
export async function requirePage(roles?: Role[]) { const user=await session(); if(!user) redirect('/login'); if(roles && !roles.includes(user.role)) redirect('/dashboard'); return user; }
export async function requireApi(roles?: Role[]) { const user=await session(); if(!user) throw new HttpError(401,'Please sign in to continue.'); if(roles && !roles.includes(user.role)) throw new HttpError(403,'You do not have permission for this action.'); return user; }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
''')
w('src/proxy.ts','''import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { configured } from '@/lib/config';
export async function proxy(request: NextRequest) {
 let response=NextResponse.next({request}); if(!configured()) return response;
 const db=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>request.cookies.getAll(),setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 await db.auth.getClaims(); return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|ico)$).*)']};
''')
w('next.config.ts','''import type { NextConfig } from 'next';
const nextConfig: NextConfig = { serverExternalPackages: ['pdf-parse','mammoth','undici'], experimental: { serverActions: { bodySizeLimit: '1mb' } }, async headers() { return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'X-Frame-Options',value:'DENY'}]}]; } };
export default nextConfig;
''')
