import { createAuthServerClient } from '@/lib/supabase-auth-server';
import { getClaimInfo } from '@/lib/casual';
import ui from '@/components/ui.module.css';
import { claimAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ClaimPage({ params }: { params: { token: string } }) {
  const info = await getClaimInfo(params.token);

  if (!info) {
    return (
      <div className={ui.page}>
        <div className={ui.wrap} style={{ paddingTop: 56 }}>
          <div className={ui.emptyState}>That invite link isn&apos;t valid.</div>
        </div>
      </div>
    );
  }

  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className={ui.page}>
      <div className={ui.hero}>
        <div className={ui.eyebrow}>You&apos;ve been invited</div>
        <h1>{info.eventName}</h1>
        <p>
          {info.guestName ? `Hi ${info.guestName} — ` : ''}claim your spot in this casual round to see
          and manage your score. It&apos;s free, no NSSA number needed yet.
        </p>
      </div>
      <div className={ui.wrap}>
        {info.alreadyClaimed ? (
          <div className={ui.emptyState}>This invite has already been claimed.</div>
        ) : (
          <div className={ui.card}>
            {user ? (
              <form action={claimAction}>
                <input type="hidden" name="token" value={params.token} />
                <button type="submit" className={ui.button}>
                  Claim my spot
                </button>
              </form>
            ) : (
              <>
                <p className={ui.helpText}>Log in (or create an account) to claim this invite.</p>
                <a href={`/login?next=${encodeURIComponent(`/casual/claim/${params.token}`)}`} className={ui.button} style={{ display: 'inline-block', textDecoration: 'none' }}>
                  Log in to claim
                </a>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
