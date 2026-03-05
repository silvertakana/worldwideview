import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Returns a singleton Supabase client for server-side use.
 * Returns null if environment variables are not configured.
 */
export function getSupabaseClient() {
    if (client) return client;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) return null;

    client = createClient(url, key, {
        auth: { persistSession: false },
    });
    return client;
}
