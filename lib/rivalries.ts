import { createServerClient } from '@/lib/supabase-server';

// Per CLAUDE_CODE_PROJECT_BRIEF.md, item 7: any shooter can flag another as
// a rival. One-directional to create (A flags B), but the comparison
// itself is symmetric — it's just the existing head-to-head view (now
// with net scores) saved as a quick-access relationship rather than
// re-picked every time. No accept/reject flow: like a follow, not a
// friend request, to keep this a single self-contained piece.

export interface Rival {
  rivalryId: string;
  otherShooterId: string;
  otherShooterName: string;
  createdAt: string;
}

export async function getShooterIdForUser(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase.from('shooters').select('shooter_id').eq('user_id', userId).maybeSingle();
  return data?.shooter_id ?? null;
}

export async function getRivalsFor(shooterId: string): Promise<Rival[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from('rivalries')
    .select('rivalry_id, shooter_id_a, shooter_id_b, created_at')
    .or(`shooter_id_a.eq.${shooterId},shooter_id_b.eq.${shooterId}`)
    .eq('status', 'active');

  const rows = data ?? [];
  if (rows.length === 0) return [];

  const otherIds = rows.map((r) => (r.shooter_id_a === shooterId ? r.shooter_id_b : r.shooter_id_a));
  const { data: others } = await supabase.from('shooters').select('shooter_id, full_name').in('shooter_id', otherIds);
  const nameById = new Map((others ?? []).map((s) => [s.shooter_id, s.full_name]));

  return rows.map((r) => {
    const otherId = r.shooter_id_a === shooterId ? r.shooter_id_b : r.shooter_id_a;
    return {
      rivalryId: r.rivalry_id,
      otherShooterId: otherId,
      otherShooterName: nameById.get(otherId) ?? 'Unknown shooter',
      createdAt: r.created_at,
    };
  });
}

export async function addRival(shooterId: string, otherShooterId: string): Promise<void> {
  if (shooterId === otherShooterId) throw new Error("You can't rival yourself.");

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from('rivalries')
    .select('rivalry_id, status')
    .or(
      `and(shooter_id_a.eq.${shooterId},shooter_id_b.eq.${otherShooterId}),and(shooter_id_a.eq.${otherShooterId},shooter_id_b.eq.${shooterId})`
    )
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active') return; // already rivals
    await supabase.from('rivalries').update({ status: 'active' }).eq('rivalry_id', existing.rivalry_id);
    return;
  }

  const { error } = await supabase
    .from('rivalries')
    .insert({ shooter_id_a: shooterId, shooter_id_b: otherShooterId, status: 'active' });
  if (error) throw error;
}

export async function archiveRival(rivalryId: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.from('rivalries').update({ status: 'archived' }).eq('rivalry_id', rivalryId);
  if (error) throw error;
}
