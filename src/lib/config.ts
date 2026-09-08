export function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
export function limit(name: string, fallback: number, max = 100) { const n = Number(process.env[name]); return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : fallback; }
