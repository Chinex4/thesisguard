import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { configured } from '@/lib/config';
export async function serverDb() {
 if (!configured()) throw new Error('Supabase is not configured. Follow the setup guide in README.md.');
 const jar = await cookies();
 return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => jar.getAll(), setAll: (items) => { try { items.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Server Components refresh through proxy. */ } } } });
}
