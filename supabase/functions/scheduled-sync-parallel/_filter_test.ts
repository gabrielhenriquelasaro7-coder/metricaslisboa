import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { filterProjectsForSync, ProjectFilterInput } from './_filter.ts';

const NOW = Date.parse('2026-05-11T18:00:00Z');

function p(over: Partial<ProjectFilterInput>): ProjectFilterInput {
  return {
    id: over.id ?? crypto.randomUUID(),
    name: over.name ?? 'P',
    ad_account_id: 'act_123',
    ...over,
  };
}

Deno.test('skips projects without any ad account', () => {
  const r = filterProjectsForSync(
    [p({ id: '1', ad_account_id: null, google_customer_id: null })],
    NOW,
  );
  assertEquals(r.eligible.length, 0);
  assertEquals(r.skippedNoAccount.length, 1);
});

Deno.test('includes healthy projects with Meta or Google', () => {
  const r = filterProjectsForSync([
    p({ id: '1', ad_account_id: 'act_99' }),
    p({ id: '2', ad_account_id: null, google_customer_id: '123-456-7890' }),
  ], NOW);
  assertEquals(r.eligible.length, 2);
});

Deno.test('skips retry_pending project whose retries are exhausted (will_retry=false)', () => {
  const r = filterProjectsForSync([
    p({ id: 'x', webhook_status: 'retry_pending', sync_progress: { will_retry: false } }),
  ], NOW);
  assertEquals(r.eligible.length, 0);
  assertEquals(r.skippedExhausted.length, 1);
});

Deno.test('skips retry_pending project whose next_retry_at is in the future', () => {
  const futureIso = new Date(NOW + 10 * 60_000).toISOString();
  const r = filterProjectsForSync([
    p({ id: 'x', webhook_status: 'retry_pending', sync_progress: { will_retry: true, next_retry_at: futureIso } }),
  ], NOW);
  assertEquals(r.eligible.length, 0);
  assertEquals(r.skippedScheduled.length, 1);
});

Deno.test('reprocesses retry_pending project once next_retry_at has passed', () => {
  const pastIso = new Date(NOW - 60_000).toISOString();
  const r = filterProjectsForSync([
    p({ id: 'x', webhook_status: 'retry_pending', sync_progress: { will_retry: true, next_retry_at: pastIso } }),
  ], NOW);
  assertEquals(r.eligible.length, 1);
});

Deno.test('reprocesses retry_pending project with no next_retry_at and will_retry=true', () => {
  const r = filterProjectsForSync([
    p({ id: 'x', webhook_status: 'retry_pending', sync_progress: { will_retry: true } }),
  ], NOW);
  assertEquals(r.eligible.length, 1);
});

Deno.test('does not loop: exhausted retry_pending stays skipped on every run', () => {
  const project = p({ id: 'x', webhook_status: 'retry_pending', sync_progress: { will_retry: false, retry_count: 5 } });
  for (const t of [NOW, NOW + 3600_000, NOW + 86_400_000]) {
    const r = filterProjectsForSync([project], t);
    assertEquals(r.eligible.length, 0, `should stay skipped at t=${t}`);
    assertEquals(r.skippedExhausted.length, 1);
  }
});

Deno.test('does not affect non-retry projects (success/error/null are eligible)', () => {
  const r = filterProjectsForSync([
    p({ id: '1', webhook_status: 'success' }),
    p({ id: '2', webhook_status: 'error' }),
    p({ id: '3', webhook_status: null }),
  ], NOW);
  assertEquals(r.eligible.length, 3);
});

Deno.test('mixed batch: only the right projects pass through', () => {
  const futureIso = new Date(NOW + 5 * 60_000).toISOString();
  const pastIso = new Date(NOW - 5 * 60_000).toISOString();
  const r = filterProjectsForSync([
    p({ id: 'ok', webhook_status: 'success' }),
    p({ id: 'no-acct', ad_account_id: null }),
    p({ id: 'cooldown', webhook_status: 'retry_pending', sync_progress: { will_retry: true, next_retry_at: futureIso } }),
    p({ id: 'ready', webhook_status: 'retry_pending', sync_progress: { will_retry: true, next_retry_at: pastIso } }),
    p({ id: 'dead', webhook_status: 'retry_pending', sync_progress: { will_retry: false } }),
  ], NOW);
  assertEquals(r.eligible.map(e => e.id).sort(), ['ok', 'ready']);
  assertEquals(r.skippedNoAccount.length, 1);
  assertEquals(r.skippedScheduled.length, 1);
  assertEquals(r.skippedExhausted.length, 1);
});
