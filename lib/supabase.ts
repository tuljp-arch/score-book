import { createBrowserClient } from '@supabase/ssr';

// Client-side Supabase client. For server components / API routes that need
// elevated privileges, add a separate server client using @supabase/ssr's
// createServerClient — don't reuse this one server-side.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
