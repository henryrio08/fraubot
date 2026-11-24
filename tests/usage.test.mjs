import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database.mjs';
import { checkPaidAccess, DAILY_LIMITS, reserveUsage } from '../lib/usage.mjs';

test('anonymous and unavailable quota checks fail closed before paid work', async t => {
  const db = database(t);
  const request = new Request('https://fraubot.test/api/assist');
  assert.equal((await checkPaidAccess(request, { DB: db }, 'assist')).status, 401);
  const signedIn = new Request(request, { headers: { 'oai-authenticated-user-id': 'quota-user' } });
  assert.equal((await checkPaidAccess(signedIn, {}, 'assist')).status, 503);
  assert.equal((await checkPaidAccess(signedIn, { DB: { prepare() { throw new Error('offline'); } } }, 'assist')).status, 503);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM ai_usage').get().n, 0);
});

test('daily per-user quotas survive independent requests and reset at Chicago midnight', async t => {
  const db = database(t);
  const before = Date.parse('2026-11-24T05:59:00Z');
  for (let i = 0; i < DAILY_LIMITS.speech.user; i++) assert.equal(await reserveUsage(db, 'speaker', 'speech', before), true);
  assert.equal(await reserveUsage(db, 'speaker', 'speech', before), false);
  assert.equal(await reserveUsage(db, 'speaker', 'speech', Date.parse('2026-11-24T06:01:00Z')), true);
});

test('shared daily limits hold across users and concurrent reservations', async t => {
  const db = database(t);
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => reserveUsage(db, 'speaker-' + i, 'speech')));
  assert.equal(results.filter(Boolean).length, DAILY_LIMITS.speech.site);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM ai_usage').get().n, DAILY_LIMITS.speech.site);
  assert.equal(await reserveUsage(db, 'another-person', 'speech'), false);
  assert.equal(await reserveUsage(db, 'another-person', 'assist'), true);
});
