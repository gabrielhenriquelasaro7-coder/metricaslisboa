// Integration tests for Row-Level Security.
//
// Strategy: hit the public REST API with the *anon* key (no JWT) and the
// *service-role* key, and verify that:
//   - Anonymous clients cannot read tenant data they shouldn't see.
//   - Anonymous clients cannot mutate write-protected tables.
//   - Service role can still read everything (sanity check).
//
// These tests are read-mostly and INSERT to a no-PII table (sync_logs is not
// reachable to anon either) so they're safe to run against a live project.
//
// Run with: deno test --allow-net --allow-env supabase/functions/_tests/
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://chxetrmrupvxqbuyjvph.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const service = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  : null;

// ---------- Read isolation (anon must NOT see tenant data) ----------

const TENANT_TABLES = [
  'projects',
  'campaigns',
  'ad_sets',
  'ads',
  'ads_daily_metrics',
  'google_campaigns',
  'google_ads_daily_metrics',
  'crm_deals',
  'crm_connections',
  'diagnostic_reports',
  'demographic_insights',
  'anomaly_alerts',
];

for (const table of TENANT_TABLES) {
  Deno.test(`anon cannot read rows from ${table}`, async () => {
    const { data, error } = await anon.from(table).select('*').limit(1);
    // RLS blocks the rows: either an empty array OR a permission error.
    if (error) {
      // Acceptable: explicit denial.
      assert(
        /permission|row-level|RLS|not allowed/i.test(error.message),
        `unexpected error on ${table}: ${error.message}`,
      );
    } else {
      assertEquals(data?.length ?? 0, 0, `${table} leaked ${data?.length} row(s) to anon`);
    }
  });
}

// ---------- Write blocking (anon must NOT be able to mutate) ----------

Deno.test('anon cannot insert into projects', async () => {
  const { error } = await anon.from('projects').insert({
    name: 'pwn',
    user_id: '00000000-0000-0000-0000-000000000000',
  });
  assert(error, 'expected RLS violation when anon inserts into projects');
});

Deno.test('anon cannot insert into campaigns (service-role only)', async () => {
  const { error } = await anon.from('campaigns').insert({
    id: 'pwn-' + crypto.randomUUID(),
    project_id: '00000000-0000-0000-0000-000000000000',
    name: 'pwn',
  });
  assert(error, 'expected RLS violation when anon inserts into campaigns');
});

Deno.test('anon cannot insert into ads_daily_metrics (service-role only)', async () => {
  const { error } = await anon.from('ads_daily_metrics').insert({
    project_id: '00000000-0000-0000-0000-000000000000',
    date: '2026-01-01',
    ad_account_id: 'act_x',
    campaign_id: 'c', campaign_name: 'c',
    adset_id: 'a', adset_name: 'a',
    ad_id: 'ad', ad_name: 'ad',
  });
  assert(error, 'expected RLS violation when anon inserts into ads_daily_metrics');
});

Deno.test('anon cannot escalate role (insert into user_roles)', async () => {
  const { error } = await anon.from('user_roles').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    cargo: 'tech',
    is_master: true,
  } as any);
  assert(error, 'CRITICAL: anon was able to write to user_roles');
});

Deno.test('anon cannot read user_roles of other users', async () => {
  const { data, error } = await anon.from('user_roles').select('*').limit(5);
  if (!error) {
    assertEquals(data?.length ?? 0, 0, 'anon leaked user_roles rows');
  }
});

Deno.test('anon cannot read admin_access_grants', async () => {
  const { data, error } = await anon.from('admin_access_grants').select('*').limit(1);
  if (!error) assertEquals(data?.length ?? 0, 0);
});

// ---------- Sanity: service role can still read ----------

Deno.test({
  name: 'service role can read projects (sanity)',
  ignore: !service,
  async fn() {
    const { error } = await service!.from('projects').select('id').limit(1);
    assertEquals(error, null);
  },
});
