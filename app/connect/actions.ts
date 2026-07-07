'use server';

import { redirect } from 'next/navigation';
import { importShooterFromNssa } from '@/lib/nssa-import';

export async function connectAccount(formData: FormData) {
  const memberId = String(formData.get('memberId') ?? '').trim();
  if (!/^\d+$/.test(memberId)) {
    redirect(`/connect?error=${encodeURIComponent('Enter a numeric NSSA member number.')}`);
  }

  let shooterId: string;
  try {
    const summary = await importShooterFromNssa(memberId);
    shooterId = summary.shooterId;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Import failed.';
    redirect(`/connect?error=${encodeURIComponent(message)}`);
  }

  redirect(`/profile/${shooterId}`);
}
