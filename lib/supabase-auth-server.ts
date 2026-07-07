import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Session-aware Supabase client for Server Components, Server Actions, and
// Route Handlers — carries the logged-in user's cookies, unlike
// lib/supabase-server.ts (anon-only, used for public reads with no session,
// e.g. the profile page and NSSA import writes).
export function createAuthServerClient() {
  const cookieStore = cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render, which can't set cookies —
          // the middleware already refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
