import 'server-only';
import { createClient } from '@supabase/supabase-js';
export function adminDb() {
 if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error('Server database credentials are missing.');
 return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
