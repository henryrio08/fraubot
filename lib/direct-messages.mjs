import { sameOrigin, takeRateLimit } from "./api.mjs";
const DAY = 86400000;
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error, status = 400) => json({ error }, status);
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const columns = "m.id, m.sender_id AS memberId, p.nickname, m.text, m.created_at AS createdAt";
async function bodyOf(request) {
  if (Number(request.headers.get("content-length")) > 8000) return null;
  try { const text = await request.text(); return text.length <= 8000 ? JSON.parse(text) : null; } catch { return null; }
}

export async function handleDirectMessages(request, env) {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return fail("Sign in to use direct messages.", 401);
  if (!["GET", "POST"].includes(request.method)) return fail("Use GET or POST.", 405);
  if (request.method === "POST" && !sameOrigin(request)) return fail("This request must come from the site.", 403);
  if (!env.DB) return fail("Direct messages are unavailable. Try again shortly.", 503);
  if (!takeRateLimit(request, "dm:" + request.method, request.method === "GET" ? 120 : 60)) return fail("Too many requests. Try again in a minute.", 429);
  const db = env.DB; const url = new URL(request.url); const now = Date.now();
  try {
    const me = await db.prepare("SELECT id, nickname FROM class_profiles WHERE user_id = ?").bind(userId).first();
    if (!me) return fail("Choose a nickname in class chat to use direct messages.", 403);
    if (url.pathname === "/api/chat/dm" && request.method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().slice(0, 40).replace(/[\\%_]/g, "\\$&");
      const [people, conversations] = await db.batch([
        db.prepare("SELECT id, nickname FROM class_profiles WHERE id != ? AND nickname LIKE ? ESCAPE '\\' ORDER BY nickname_key LIMIT 100").bind(me.id, "%" + q + "%"),
        db.prepare(`WITH mine AS (
          SELECT *, CASE WHEN sender_id = ? THEN recipient_id ELSE sender_id END AS peer_id
          FROM direct_messages WHERE (sender_id = ? OR recipient_id = ?) AND created_at > ?
        ), recent AS (
          SELECT peer_id, MAX(id) AS last_id, SUM(CASE WHEN recipient_id = ? AND read_at IS NULL THEN 1 ELSE 0 END) AS unread
          FROM mine GROUP BY peer_id
        ) SELECT p.id, p.nickname, m.text AS preview, m.created_at AS updatedAt, r.unread
        FROM recent r JOIN direct_messages m ON m.id = r.last_id JOIN class_profiles p ON p.id = r.peer_id
        ORDER BY m.id DESC LIMIT 100`).bind(me.id, me.id, me.id, now - DAY, me.id),
      ]);
      return json({ me, people: people.results, conversations: conversations.results, unread: conversations.results.reduce((sum, c) => sum + Number(c.unread), 0) });
    }
    const route = url.pathname.match(/^\/api\/chat\/dm\/([\da-f-]+)(?:\/(messages|read))?$/i);
    if (!route || !uuid.test(route[1])) return fail("Conversation not found.", 404);
    const [, peerId, action] = route;
    if (peerId === me.id) return fail("Choose another person to message.");
    const peer = await db.prepare("SELECT id, nickname FROM class_profiles WHERE id = ?").bind(peerId).first();
    if (!peer) return fail("That user could not be found.", 404);
    // Every read is scoped to the authenticated sender/recipient pair. A URL
    // or client-supplied member ID can never grant access to another pair.
    if (request.method === "GET" && !action) {
      const after = Number(url.searchParams.get("after") || 0);
      if (!Number.isSafeInteger(after) || after < 0) return fail("Invalid message cursor.");
      const pair = "((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))";
      const messages = after
        ? await db.prepare(`SELECT ${columns} FROM direct_messages m JOIN class_profiles p ON p.id = m.sender_id WHERE ${pair} AND m.created_at > ? AND m.id > ? ORDER BY m.id LIMIT 100`).bind(me.id, peer.id, peer.id, me.id, now - DAY, after).all()
        : await db.prepare(`SELECT * FROM (SELECT ${columns} FROM direct_messages m JOIN class_profiles p ON p.id = m.sender_id WHERE ${pair} AND m.created_at > ? ORDER BY m.id DESC LIMIT 100) ORDER BY id`).bind(me.id, peer.id, peer.id, me.id, now - DAY).all();
      return json({ me, peer, messages: messages.results, cursor: messages.results.at(-1)?.id ?? after });
    }
    if (request.method === "POST" && action === "read") {
      const body = await bodyOf(request);
      if (!Number.isSafeInteger(body?.throughId) || body.throughId < 0) return fail("Invalid message cursor.");
      await db.prepare("UPDATE direct_messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND id <= ? AND read_at IS NULL AND created_at > ?").bind(now, me.id, peer.id, body.throughId, now - DAY).run();
      return json({ read: true });
    }
    if (request.method === "POST" && action === "messages") {
      const body = await bodyOf(request);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text || text.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return fail("Write 1–1,000 characters.");
      if (typeof body?.clientId !== "string" || !uuid.test(body.clientId)) return fail("Message ID is missing. Try again.");
      const retry = () => db.prepare(`SELECT ${columns} FROM direct_messages m JOIN class_profiles p ON p.id = m.sender_id WHERE m.sender_id = ? AND m.recipient_id = ? AND m.client_id = ?`).bind(me.id, peer.id, body.clientId).first();
      const previous = await retry();
      if (previous) return json({ message: previous });
      await db.prepare("DELETE FROM direct_messages WHERE id IN (SELECT id FROM direct_messages WHERE created_at <= ? LIMIT 100)").bind(now - DAY).run();
      const sent = await db.prepare(`INSERT INTO direct_messages (sender_id, recipient_id, client_id, text, created_at)
        SELECT ?, ?, ?, ?, ? WHERE
        (SELECT COUNT(*) FROM direct_messages WHERE sender_id = ? AND created_at > ?) < 30
        AND (SELECT COUNT(*) FROM direct_messages WHERE created_at > ?) < 120
        ON CONFLICT(sender_id, recipient_id, client_id) DO NOTHING
        RETURNING id, sender_id AS memberId, text, created_at AS createdAt`).bind(me.id, peer.id, body.clientId, text, now, me.id, now - 60000, now - 60000).first();
      if (sent) return json({ message: { ...sent, nickname: me.nickname } }, 201);
      const existing = await retry();
      return existing ? json({ message: existing }) : fail("Too many messages. Try again in a minute.", 429);
    }
    return fail("Conversation not found.", 404);
  } catch { return fail("Direct messages could not connect. Try again.", 503); }
}
