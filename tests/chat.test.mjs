import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handleChat } from "../lib/chat.mjs";

// Exercise the actual migrations and API queries, rather than mocking SQL results.
function database(t) {
  const sql = new DatabaseSync(":memory:");
  sql.exec("PRAGMA foreign_keys = ON");
  sql.exec(readFileSync(new URL("../drizzle/0000_outgoing_argent.sql", import.meta.url), "utf8"));
  t.after(() => sql.close());
  const prepare = query => {
    let args = [];
    const statement = sql.prepare(query);
    const bound = {
      bind(...values) { args = values; return bound; },
      async first() { return statement.get(...args) ?? null; },
      async all() { return { results: statement.all(...args) }; },
      async run() { return { meta: statement.run(...args) }; },
    };
    return bound;
  };
  return { sql, prepare };
}

// D1 .batch() returns metadata for both reads and writes.
function d1(t) {
  const source = database(t);
  const db = { sql: source.sql, prepare: query => {
    const statement = source.prepare(query);
    return { ...statement, isWrite: /^(INSERT|UPDATE|DELETE)/.test(query), bind(...args) { statement.bind(...args); return this; } };
  }, async batch(statements) {
    db.sql.exec("BEGIN");
    try {
      const results = [];
      for (const s of statements) results.push(await (s.isWrite ? s.run() : s.all()));
      db.sql.exec("COMMIT");
      return results;
    } catch (error) { db.sql.exec("ROLLBACK"); throw error; }
  } };
  return db;
}
const request = (path, user, body, origin = "https://leute.test") => new Request("https://leute.test/api/chat" + path, {
  method: body === undefined ? "GET" : "POST",
  headers: { ...(user ? { "oai-authenticated-user-id": user } : {}), origin, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const create = async (db, user, nickname = "Kartoffel") => {
  const response = await handleChat(request("/rooms", user, { nickname }), { DB: db });
  assert.equal(response.status, 201);
  return response.json();
};
const send = (db, code, user, text, clientId = crypto.randomUUID()) => handleChat(request(`/rooms/${code}/messages`, user, { text, clientId }), { DB: db });

test("chat requires signed-in identity and rejects cross-origin writes", async t => {
  const db = d1(t);
  assert.equal((await handleChat(request("/rooms", null, { nickname: "Hallo" }), { DB: db })).status, 401);
  assert.equal((await handleChat(request("/rooms", "boundary", { nickname: "Hallo" }, "https://other.test"), { DB: db })).status, 403);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM chat_rooms").get().n, 0);
});

test("two signed-in users exchange messages and poll in order without exposing identity IDs", async t => {
  const db = d1(t);
  const room = await create(db, "exchange-a");
  const code = room.room.code;
  const joined = await handleChat(request("/join", "exchange-b", { nickname: "Schnitzel", code: code.slice(0, 5).toLowerCase() + "-" + code.slice(5) }), { DB: db });
  assert.equal(joined.status, 200);
  assert.equal((await joined.json()).members.length, 2);
  const a = await (await send(db, code, "exchange-a", "LEUTE!")).json();
  assert.equal((await send(db, code, "exchange-b", "ich bin hier")).status, 201);
  const response = await handleChat(request(`/rooms/${code}?after=${a.message.id}`, "exchange-a"), { DB: db });
  const data = await response.json();
  assert.equal(data.messages.length, 1);
  assert.equal(data.messages[0].nickname, "Schnitzel");
  assert.equal(data.messages[0].text, "ich bin hier");
  assert.equal(data.cursor, data.messages[0].id);
  assert.doesNotMatch(JSON.stringify(data), /exchange-a|exchange-b|user_id|created_by/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("room membership isolates messages and leaving immediately revokes access", async t => {
  const db = d1(t);
  const room = await create(db, "private-a");
  const other = await create(db, "private-b");
  assert.equal((await handleChat(request(`/rooms/${room.room.code}`, "private-b"), { DB: db })).status, 403);
  assert.equal((await send(db, other.room.code, "private-a", "wrong room")).status, 403);
  assert.equal((await handleChat(request(`/rooms/${room.room.code}/leave`, "private-a", {}), { DB: db })).status, 200);
  assert.equal((await send(db, room.room.code, "private-a", "left already")).status, 403);
  const rejoined = await handleChat(request("/join", "private-a", { nickname: "Back again", code: room.room.code }), { DB: db });
  assert.equal(rejoined.status, 200);
  assert.equal((await rejoined.json()).me.id, room.me.id);
});

test("retries do not duplicate messages; nickname and message inputs stay bounded", async t => {
  const db = d1(t);
  const room = await create(db, "retry-a");
  const id = crypto.randomUUID();
  const first = await (await send(db, room.room.code, "retry-a", "<script>alert('hi')</script>", id)).json();
  const second = await (await send(db, room.room.code, "retry-a", "<script>alert('hi')</script>", id)).json();
  assert.equal(first.message.id, second.message.id);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM chat_messages").get().n, 1);
  assert.equal((await send(db, room.room.code, "retry-a", "x".repeat(1001))).status, 400);
  assert.equal((await handleChat(request("/join", "retry-b", { nickname: "kartoffel", code: room.room.code }), { DB: db })).status, 409);
  assert.equal((await handleChat(request("/rooms", "retry-b", { nickname: "x" }), { DB: db })).status, 400);
});

test("expired rooms cannot be read and cleanup cascades to members and messages", async t => {
  const db = d1(t);
  const room = await create(db, "expiry-a");
  await send(db, room.room.code, "expiry-a", "old message");
  db.sql.prepare("UPDATE chat_rooms SET expires_at = 0").run();
  assert.equal((await handleChat(request(`/rooms/${room.room.code}`, "expiry-a"), { DB: db })).status, 404);
  await create(db, "expiry-b");
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM chat_messages").get().n, 0);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM chat_members").get().n, 1);
});

test("durable per-member send limit is enforced by the database", async t => {
  const db = d1(t);
  const room = await create(db, "throttle-a");
  for (let i = 0; i < 30; i++) assert.equal((await send(db, room.room.code, "throttle-a", `Message ${i}`)).status, 201);
  assert.equal((await send(db, room.room.code, "throttle-a", "one too many")).status, 429);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM chat_messages").get().n, 30);
});

test("room creation and membership capacities are bounded", async t => {
  const db = d1(t);
  const room = await create(db, "capacity-a");
  for (let i = 1; i < 20; i++) {
    const r = await handleChat(request("/join", `capacity-${i}`, { nickname: `Friend ${i}`, code: room.room.code }), { DB: db });
    assert.equal(r.status, 200);
  }
  const full = await handleChat(request("/join", "capacity-extra", { nickname: "Too late", code: room.room.code }), { DB: db });
  assert.equal(full.status, 409);
  for (let i = 1; i < 5; i++) await create(db, "capacity-a");
  assert.equal((await handleChat(request("/rooms", "capacity-a", { nickname: "Sixth room" }), { DB: db })).status, 429);
});

test("history and polling cursors return bounded, ordered message pages", async t => {
  const db = d1(t);
  const room = await create(db, "pages-a");
  const roomId = db.sql.prepare("SELECT id FROM chat_rooms WHERE code = ?").get(room.room.code).id;
  const insert = db.sql.prepare("INSERT INTO chat_messages (room_id, member_id, client_id, nickname, text, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  for (let i = 0; i < 105; i++) insert.run(roomId, room.me.id, crypto.randomUUID(), "Kartoffel", `Message ${i}`, Date.now());
  const history = await (await handleChat(request(`/rooms/${room.room.code}`, "pages-a"), { DB: db })).json();
  assert.equal(history.messages.length, 100);
  assert.equal(history.messages[0].text, "Message 5");
  assert.equal(history.messages.at(-1).text, "Message 104");
  const page = await (await handleChat(request(`/rooms/${room.room.code}?after=1`, "pages-a"), { DB: db })).json();
  assert.equal(page.messages.length, 100);
  const next = await (await handleChat(request(`/rooms/${room.room.code}?after=${page.cursor}`, "pages-a"), { DB: db })).json();
  assert.equal(next.messages.length, 4);
  assert.equal(next.messages.at(-1).text, "Message 104");
});
