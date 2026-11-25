import test from "node:test";
import assert from "node:assert/strict";
import { database } from "./helpers/database.mjs";
import { handleGuestRequest } from "../lib/guest-session.mjs";
import { handleChat } from "../lib/chat.mjs";
import { handleApi } from "../lib/api.mjs";

const origin = "https://fraubot.test";
const request = (path, cookie, body, extra = {}) => new Request(origin + path, {
  method: body ? "POST" : "GET", headers: { origin, "content-type": "application/json", "cf-connecting-ip": "192.0.2.10", ...(cookie ? { cookie } : {}), ...extra },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const route = (db, req, options) => handleGuestRequest(req, { DB: db }, authed => {
  if (new URL(authed.url).pathname.startsWith("/api/chat/")) return handleChat(authed, { DB: db });
  return handleApi(authed, { DB: db, MODEL_API_KEY: "test", AUTH_MODE: "nickname" }, async () => new Response('data: {"type":"response.completed"}\n\n'));
}, options);
async function join(db, nickname) {
  const response = await route(db, request("/api/session", null, { nickname }));
  assert.equal(response.status, 201);
  return { cookie: response.headers.get("set-cookie").split(";")[0], ...(await response.json()).me };
}

test("nickname entry issues an opaque private cookie and persists the same identity", async t => {
  const db = database(t);
  const response = await route(db, request("/api/session", null, { nickname: "  Guest One  " }));
  assert.equal(response.status, 201);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//);
  const body = await response.text();
  assert.doesNotMatch(body, /token|guest:|user_id/);
  const raw = cookie.split(";")[0];
  const stored = db.sql.prepare("SELECT token_hash FROM guest_sessions").get();
  assert.notEqual(stored.token_hash, raw.split("=")[1]);
  const config = await (await route(db, request("/api/config", raw))).json();
  assert.equal(config.signedIn, true); assert.equal(config.authMode, "nickname");
  const profile = await (await route(db, request("/api/chat/classroom", raw))).json();
  assert.equal(profile.me.nickname, "Guest One");
  assert.equal((await route(db, request("/api/assist", raw, { text: "Hallo", mode: "natural" }))).status, 200);
});

test("forged platform headers, invalid cookies, and expired sessions never grant identity", async t => {
  const db = database(t); const person = await join(db, "Original");
  const realId = db.sql.prepare("SELECT user_id FROM guest_sessions").get().user_id;
  for (const cookie of [null, "fraubot_session=forged", person.cookie + "; " + person.cookie]) {
    const response = await route(db, request("/api/chat/dm", cookie, null, { "oai-authenticated-user-id": realId, "oai-authenticated-user-email": "forged@example.test" }));
    assert.equal(response.status, 401);
  }
  db.sql.prepare("UPDATE guest_sessions SET expires_at = 0").run();
  assert.equal((await route(db, request("/api/chat/dm", person.cookie))).status, 401);
  assert.equal((await route(db, request("/api/assist", person.cookie, { text: "Hallo", mode: "natural" }))).status, 401);
  let called = false;
  const unavailable = await handleGuestRequest(request("/api/chat/dm", person.cookie), {}, () => { called = true; });
  assert.equal(unavailable.status, 503); assert.equal(called, false);
});

test("guest sessions keep DMs private even when another visitor forges identity headers", async t => {
  const db = database(t);
  const a = await join(db, "Alice"), b = await join(db, "Bob"), c = await join(db, "Clara");
  const send = await route(db, request(`/api/chat/dm/${b.id}/messages`, a.cookie, { text: "PRIVATE TEST", clientId: crypto.randomUUID() }));
  assert.equal(send.status, 201);
  const received = await (await route(db, request(`/api/chat/dm/${a.id}`, b.cookie))).json();
  assert.equal(received.messages[0].text, "PRIVATE TEST");
  const aliceUserId = db.sql.prepare("SELECT user_id FROM class_profiles WHERE id = ?").get(a.id).user_id;
  const outside = await route(db, request(`/api/chat/dm/${b.id}`, c.cookie, null, { "oai-authenticated-user-id": aliceUserId }));
  assert.deepEqual((await outside.json()).messages, []);
  assert.doesNotMatch(await (await route(db, request("/api/chat/classroom", null))).text(), /PRIVATE TEST/);
});

test("entry rejects CSRF and nickname collisions without leaving orphan sessions", async t => {
  const db = database(t); await join(db, "Taken");
  assert.equal((await route(db, request("/api/session", null, { nickname: "Other" }, { origin: "https://other.test" }))).status, 403);
  assert.equal((await route(db, request("/api/session", null, { nickname: "taken" }))).status, 409);
  for (const nickname of ["a", "x".repeat(21), "bad\u0000name"]) assert.equal((await route(db, request("/api/session", null, { nickname }))).status, 400);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM guest_sessions").get().n, 1);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM class_profiles").get().n, 1);
});

test("new-browser limits are durable and do not create a profile when exhausted", async t => {
  const db = database(t); await join(db, "First");
  const source = db.sql.prepare("SELECT network_key, created_at, expires_at FROM guest_sessions").get();
  const insert = db.sql.prepare("INSERT INTO guest_sessions VALUES (?, ?, ?, ?, ?)");
  for (let i = 0; i < 99; i++) insert.run("seed-" + i, "seed-user-" + i, source.network_key, source.created_at, source.expires_at);
  assert.equal((await route(db, request("/api/session", null, { nickname: "Excess" }))).status, 429);
  assert.equal(db.sql.prepare("SELECT COUNT(*) AS n FROM class_profiles").get().n, 1);
});
