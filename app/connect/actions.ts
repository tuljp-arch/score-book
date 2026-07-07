'use server';

import { redirect } from 'next/navigation';
import { importShooterFromNssa } from '@/lib/nssa-import';
import { createAuthServerClient } from '@/lib/supabase-auth-server';

export async function connectAccount(formData: FormData) {
  const supabase = createAuthServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/connect');

  const memberId = String(formData.get('memberId') ?? '').trim();
  if (!/^\d+$/.test(memberId)) {
    redirect(`/connect?error=${encodeURIComponent('Enter a numeric NSSA member number.')}`);
  }

  let shooterId: string;
  try {
    const summary = await importShooterFromNssa(memberId, user.id);
    shooterId = summary.shooterId;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed.';
    redirect(`/connect?error=${encodeURIComponent(message)}`);
  }

  redirect(`/profile/${shooterId}`);
}

export async function signOut() {
  const supabase = createAuthServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
