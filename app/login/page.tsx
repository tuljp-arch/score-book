import { redirect } from 'next/navigation';
import { createAuthServerClient } from '@/lib/supabase-auth-server';
import ui from '@/components/ui.module.css';
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
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>Members only</div>
        <h1>Log in</h1>
        <p>No password to remember — we&apos;ll email you a one-time link.</p>
      </div>
      <div className={ui.wrap}>
        <div className={ui.card}>
          {searchParams.error && <p className={ui.error}>{searchParams.error}</p>}
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
