import { assertEquals, assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseRetryAfter, parseUsageHeader, MAX_RETRY_AFTER_MS } from './_retry_helpers.ts';

Deno.test('parseRetryAfter — null/empty header returns null', () => {
  assertEquals(parseRetryAfter(null), null);
  assertEquals(parseRetryAfter(''), null);
  assertEquals(parseRetryAfter('   '), null);
});

Deno.test('parseRetryAfter — numeric (delta-seconds) header', () => {
  assertEquals(parseRetryAfter('30'), 30_000);
  assertEquals(parseRetryAfter('  10  '), 10_000);
  assertEquals(parseRetryAfter('0'), 0);
});

Deno.test('parseRetryAfter — numeric value is capped at MAX_RETRY_AFTER_MS', () => {
  assertEquals(parseRetryAfter('99999'), MAX_RETRY_AFTER_MS);
});

Deno.test('parseRetryAfter — HTTP-date header in the future', () => {
  const future = new Date(Date.now() + 45_000).toUTCString();
  const result = parseRetryAfter(future);
  assert(result !== null, 'expected number for valid date');
  // Allow 2s of slack for clock granularity
  assert(result! >= 43_000 && result! <= 46_000, `unexpected delay: ${result}`);
});

Deno.test('parseRetryAfter — HTTP-date in the past resolves to 0', () => {
  const past = new Date(Date.now() - 60_000).toUTCString();
  assertEquals(parseRetryAfter(past), 0);
});

Deno.test('parseRetryAfter — HTTP-date far in the future is capped', () => {
  const farFuture = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  assertEquals(parseRetryAfter(farFuture), MAX_RETRY_AFTER_MS);
});

Deno.test('parseRetryAfter — invalid string returns null', () => {
  assertEquals(parseRetryAfter('not-a-date'), null);
  assertEquals(parseRetryAfter('soon'), null);
});

Deno.test('parseUsageHeader — null/invalid JSON returns null', () => {
  assertEquals(parseUsageHeader(null), null);
  assertEquals(parseUsageHeader(''), null);
  assertEquals(parseUsageHeader('{not json'), null);
});

Deno.test('parseUsageHeader — payload without estimated_time_to_regain_access returns null', () => {
  assertEquals(parseUsageHeader('{"call_count":50,"total_cputime":20}'), null);
  assertEquals(parseUsageHeader('{"123":[{"type":"ads_management","call_count":10}]}'), null);
});

Deno.test('parseUsageHeader — single estimated_time_to_regain_access (minutes → ms)', () => {
  // 2 minutes -> 120_000ms
  const payload = JSON.stringify({ '123': [{ type: 'ads_management', estimated_time_to_regain_access: 2 }] });
  assertEquals(parseUsageHeader(payload), 120_000);
});

Deno.test('parseUsageHeader — picks the maximum across nested entries', () => {
  const payload = JSON.stringify({
    '123': [
      { type: 'ads_management', estimated_time_to_regain_access: 1 },
      { type: 'ads_insights', estimated_time_to_regain_access: 3 },
    ],
    '456': [{ type: 'pages', estimated_time_to_regain_access: 2 }],
  });
  // max = 3 minutes -> 180_000ms which equals the cap
  assertEquals(parseUsageHeader(payload), 180_000);
});

Deno.test('parseUsageHeader — value is capped at MAX_RETRY_AFTER_MS', () => {
  const payload = JSON.stringify({ a: { estimated_time_to_regain_access: 60 } }); // 60 min
  assertEquals(parseUsageHeader(payload), MAX_RETRY_AFTER_MS);
});
