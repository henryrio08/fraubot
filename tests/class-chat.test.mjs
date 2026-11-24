import test from 'node:test';
import assert from 'node:assert/strict';
import { database } from './helpers/database.mjs';
import { handleChat } from '../lib/chat.mjs';
const request = (path = '', user, body, origin = 'https://fraubot.test') => new Request('https://fraubot.test/api/chat/classroom' + path, {
  method: body ? 'POST' : 'GET', headers: { origin, 'Content-Type': 'application/json', ...(user ? { 'oai-authenticated-user-id': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const save = (db, user, nickname) => handleChat(request('/profile', user, { nickname }), { DB: db });
const send = (db, user, text, clientId = crypto.randomUUID()) => handleChat(request('/messages', user, { text, clientId }), { DB: db });

test('the public channel is readable without login, but posting requires identity and nickname', async t => {
  const db = database(t);
  const publicRead = await handleChat(request(), { DB: db });
  assert.equal(publicRead.status, 200);
  assert.deepEqual((await publicRead.json()).messages, []);
  assert.equal((await send(db, null, 'anonymous')).status, 401);
  assert.equal((await send(db, 'no-profile', 'no nickname')).status, 403);
  assert.equal((await handleChat(request('/profile', 'origin-test', { nickname: 'Hallo' }, 'https://other.test'), { DB: db })).status, 403);
});

test('all visitors see the same channel, and retries never duplicate a message', async t => {
  const db = database(t);
  assert.equal((await save(db, 'class-a', 'Anton')).status, 200);
  assert.equal((await save(db, 'class-b', 'Berta')).status, 200);
  const id = crypto.randomUUID();
  const a = await (await send(db, 'class-a', 'Hallo zusammen', id)).json();
  assert.equal((await (await send(db, 'class-a', 'Hallo zusammen', id)).json()).message.id, a.message.id);
  await send(db, 'class-b', 'Guten Morgen');
  const data = await (await handleChat(request(), { DB: db })).json();
  assert.equal(data.messages.length, 2);
  assert.deepEqual(data.messages.map(m => m.nickname), ['Anton', 'Berta']);
  assert.doesNotMatch(JSON.stringify(data), /class-a|class-b|user_id/);
  const next = await (await handleChat(request('?after=' + a.message.id), { DB: db })).json();
  assert.equal(next.messages.length, 1);
  assert.equal(next.messages[0].text, 'Guten Morgen');
});

test('private room history is never included in public class chat', async t => {
  const db = database(t);
  const now = Date.now();
  db.sql.prepare('INSERT INTO chat_rooms VALUES (?, ?, ?, ?, ?)').run('secret-room', 'AAAAAAAAAA', 'owner', now, now + 86400000);
  db.sql.prepare('INSERT INTO chat_members VALUES (?, ?, ?, ?, ?, ?, ?)').run('secret-member', 'secret-room', 'owner', 'Private', 'private', 1, now);
  db.sql.prepare('INSERT INTO chat_messages (room_id, member_id, client_id, nickname, text, created_at) VALUES (?, ?, ?, ?, ?, ?)').run('secret-room', 'secret-member', crypto.randomUUID(), 'Private', 'PRIVATE HISTORY', now);
  const response = await handleChat(request(), { DB: db });
  assert.doesNotMatch(await response.text(), /PRIVATE HISTORY/);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM chat_messages').get().n, 1);
});

test('nickname uniqueness, message bounds, retention, and durable send limits apply', async t => {
  const db = database(t);
  await save(db, 'bounds-a', 'User A');
  assert.equal((await save(db, 'bounds-b', 'user a')).status, 409);
  assert.equal((await send(db, 'bounds-a', 'x'.repeat(1001))).status, 400);
  const profile = db.sql.prepare('SELECT id FROM class_profiles WHERE user_id = ?').get('bounds-a');
  db.sql.prepare('INSERT INTO class_messages (member_id, client_id, nickname, text, created_at) VALUES (?, ?, ?, ?, ?)').run(profile.id, crypto.randomUUID(), 'User A', 'expired', Date.now() - 86400001);
  assert.equal((await (await handleChat(request(), { DB: db })).json()).messages.length, 0);
  for (let i = 0; i < 30; i++) assert.equal((await send(db, 'bounds-a', `Message ${i}`)).status, 201);
  assert.equal((await send(db, 'bounds-a', 'too many')).status, 429);
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM class_messages').get().n, 30);
});
