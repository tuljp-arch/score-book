import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = searchParams.next ?? '/connect';

  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(next);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '48px', maxWidth: 480, margin: '0 auto' }}>
      <h1>Log in</h1>
      {searchParams.error && <p style={{ color: 'crimson' }}>{searchParams.error}</p>}
      <LoginForm next={next} />
    </main>
  );
}
