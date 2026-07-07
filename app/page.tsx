import { createAuthServerClient } from '@/lib/supabase-auth-server';

export default async function Home() {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px' }}>
      <h1>The Score Book</h1>
      <p>Starter scaffold — first build milestone: get one shooter's data rendering at /profile/[shooterId].</p>
      <p>
        {user ? (
          <a href="/connect">Connect your NSSA account →</a>
        ) : (
          <a href="/login?next=/connect">Log in to connect your NSSA account →</a>
        )}
      </p>
      <p>
        <a href="/head-to-head">Compare two shooters head-to-head →</a>
      </p>
    </main>
  );
}
