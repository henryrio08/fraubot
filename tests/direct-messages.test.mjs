import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database.mjs';
import { handleChat } from '../lib/chat.mjs';
const origin = 'https://fraubot.test';
const request = (path = '', user, body, source = origin) => new Request(origin + '/api/chat/dm' + path, {
  method: body ? 'POST' : 'GET', headers: { origin: source, 'Content-Type': 'application/json', ...(user ? { 'oai-authenticated-user-id': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
async function users(db, prefix) {
  const people = {};
  for (const name of ['Alice', 'Bob', 'Clara']) {
    const user = prefix + '-' + name;
    const r = await handleChat(new Request(origin + '/api/chat/classroom/profile', { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'oai-authenticated-user-id': user }, body: JSON.stringify({ nickname: name }) }), { DB: db });
    assert.equal(r.status, 200);
    people[name] = { ...(await r.json()).me, user };
  }
  return people;
}
const inbox = (db, user) => handleChat(request('', user), { DB: db });
const thread = (db, user, peer, after = 0) => handleChat(request('/' + peer + '?after=' + after, user), { DB: db });
const send = (db, user, peer, text, clientId = crypto.randomUUID()) => handleChat(request('/' + peer + '/messages', user, { text, clientId }), { DB: db });

test('DM endpoints require identity, a nickname, and same-origin writes', async t => {
  const db = database(t);
  assert.equal((await inbox(db)).status, 401);
  assert.equal((await inbox(db, 'no-profile')).status, 403);
  const { Alice, Bob } = await users(db, 'auth');
  assert.equal((await handleChat(request('/' + Bob.id + '/messages', Alice.user, { text: 'bad origin', clientId: crypto.randomUUID() }, 'https://other.test'), { DB: db })).status, 403);
  assert.equal((await send(db, Alice.user, Alice.id, 'myself')).status, 400);
  assert.equal((await thread(db, Alice.user, crypto.randomUUID())).status, 404);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM direct_messages').get().n, 0);
});

test('participants exchange DMs while outsiders and public class chat cannot read them', async t => {
  const db = database(t);
  const { Alice, Bob, Clara } = await users(db, 'privacy');
  const a = await (await send(db, Alice.user, Bob.id, 'PRIVATE hello Bob')).json();
  await send(db, Bob.user, Alice.id, 'PRIVATE hello Alice');
  const own = await (await thread(db, Alice.user, Bob.id)).json();
  assert.deepEqual(own.messages.map(m => m.nickname), ['Alice', 'Bob']);
  const received = await (await thread(db, Bob.user, Alice.id, a.message.id)).json();
  assert.equal(received.messages.length, 1);
  for (const peer of [Alice, Bob]) assert.deepEqual((await (await thread(db, Clara.user, peer.id)).json()).messages, []);
  assert.deepEqual((await (await inbox(db, Clara.user)).json()).conversations, []);
  const publicChat = await handleChat(new Request(origin + '/api/chat/classroom'), { DB: db });
  assert.doesNotMatch(await publicChat.text(), /PRIVATE/);
  const raw = JSON.stringify(own);
  assert.doesNotMatch(raw, /privacy-Alice|privacy-Bob|user_id/);
});

test('unread state is durable and only the recipient can acknowledge their messages', async t => {
  const db = database(t);
  const { Alice, Bob, Clara } = await users(db, 'unread');
  const a = await (await send(db, Alice.user, Bob.id, 'First')).json();
  await send(db, Bob.user, Alice.id, 'Reply');
  assert.equal((await (await inbox(db, Bob.user)).json()).unread, 1);
  await handleChat(request('/' + Alice.id + '/read', Clara.user, { throughId: a.message.id }), { DB: db });
  assert.equal((await (await inbox(db, Bob.user)).json()).unread, 1);
  assert.equal((await handleChat(request('/' + Alice.id + '/read', Bob.user, { throughId: a.message.id }), { DB: db })).status, 200);
  assert.equal((await (await inbox(db, Bob.user)).json()).unread, 0);
  assert.equal((await (await inbox(db, Alice.user)).json()).unread, 1);
  assert.equal((await handleChat(request('/' + Alice.id + '/read', Bob.user, { throughId: -1 }), { DB: db })).status, 400);
});

test('send retries are idempotent within a pair, and inputs and retention stay bounded', async t => {
  const db = database(t);
  const { Alice, Bob, Clara } = await users(db, 'retry');
  const id = crypto.randomUUID();
  const first = await (await send(db, Alice.user, Bob.id, '<script>hello</script>', id)).json();
  const retry = await (await send(db, Alice.user, Bob.id, '<script>hello</script>', id)).json();
  assert.equal(first.message.id, retry.message.id);
  assert.equal((await send(db, Alice.user, Clara.id, 'Different pair', id)).status, 201);
  assert.equal((await send(db, Alice.user, Bob.id, 'x'.repeat(1001))).status, 400);
  db.sql.prepare('UPDATE direct_messages SET created_at = 0').run();
  assert.deepEqual((await (await thread(db, Bob.user, Alice.id)).json()).messages, []);
  assert.deepEqual((await (await inbox(db, Alice.user)).json()).conversations, []);
  await send(db, Alice.user, Bob.id, 'New message');
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM direct_messages').get().n, 1);
});

test('sender limits apply atomically across multiple recipients', async t => {
  const db = database(t);
  const { Alice, Bob, Clara } = await users(db, 'limits');
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => send(db, Alice.user, i % 2 ? Bob.id : Clara.id, 'Message ' + i)));
  assert.equal(results.filter(r => r.status === 201).length, 30);
  assert.equal(results.filter(r => r.status === 429).length, 10);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM direct_messages').get().n, 30);
  const people = await (await handleChat(request('?q=bo', Alice.user), { DB: db })).json();
  assert.deepEqual(people.people.map(p => p.nickname), ['Bob']);
});
