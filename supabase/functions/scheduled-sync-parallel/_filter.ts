// Pure filter logic extracted from scheduled-sync-parallel so it can be
// unit-tested without touching the network or the database.
//
// Rules implemented:
//  1. Project must have at least one ad account configured (Meta or Google).
//  2. If webhook_status === 'retry_pending':
//       - Skip when sync_progress.will_retry === false (retries exhausted).
//       - Skip when sync_progress.next_retry_at is in the future (cooldown).
//  3. Anything else (success / error / null) is eligible.

export interface ProjectFilterInput {
  id: string;
  name?: string | null;
  ad_account_id?: string | null;
  google_customer_id?: string | null;
  webhook_status?: string | null;
  sync_progress?: Record<string, any> | null;
}

export interface FilterResult {
  eligible: ProjectFilterInput[];
  skippedScheduled: string[];
  skippedExhausted: string[];
  skippedNoAccount: string[];
}

export function filterProjectsForSync(
  projects: ProjectFilterInput[],
  nowMs: number = Date.now(),
): FilterResult {
  const eligible: ProjectFilterInput[] = [];
  const skippedScheduled: string[] = [];
  const skippedExhausted: string[] = [];
  const skippedNoAccount: string[] = [];

  for (const p of projects) {
    const hasAdAccount =
      !!p.ad_account_id?.startsWith('act_') ||
      !!p.google_customer_id?.trim();
    if (!hasAdAccount) {
      skippedNoAccount.push(p.name || p.id);
      continue;
    }

    if (p.webhook_status === 'retry_pending') {
      const sp = p.sync_progress || {};
      if (sp.will_retry === false) {
        skippedExhausted.push(p.name || p.id);
        continue;
      }
      if (sp.next_retry_at) {
        const nextMs = Date.parse(sp.next_retry_at);
        if (!isNaN(nextMs) && nextMs > nowMs) {
          skippedScheduled.push(p.name || p.id);
          continue;
        }
      }
    }
    eligible.push(p);
  }

  return { eligible, skippedScheduled, skippedExhausted, skippedNoAccount };
}
