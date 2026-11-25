import { sameOrigin, takeRateLimit } from "./api.mjs";
import { normalizeNickname } from "./nickname.mjs";
const DAY = 86400000;
const columns = "id, member_id AS memberId, nickname, text, created_at AS createdAt";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error, status = 400) => json({ error }, status);
async function bodyOf(request) {
  if (Number(request.headers.get("content-length")) > 8000) return null;
  try { const text = await request.text(); return text.length <= 8000 ? JSON.parse(text) : null; } catch { return null; }
}
async function profile(db, userId) {
  return userId ? db.prepare("SELECT id, nickname FROM class_profiles WHERE user_id = ?").bind(userId).first() : null;
}

export async function handleClassChat(request, env) {
  const url = new URL(request.url);
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!["GET", "POST"].includes(request.method)) return fail("Use GET or POST.", 405);
  if (request.method === "POST" && !sameOrigin(request)) return fail("This request must come from the site.", 403);
  if (request.method === "POST" && !userId) return fail("Sign in to post in class chat.", 401);
  if (!env.DB) return fail("Chat is unavailable. Try again shortly.", 503);
  if (!takeRateLimit(request, "class-chat:" + request.method, request.method === "GET" ? 120 : 45)) return fail("Too many requests. Try again in a minute.", 429);
  const db = env.DB; const now = Date.now();
  try {
    if (url.pathname === "/api/chat/classroom" && request.method === "GET") {
      const after = Number(url.searchParams.get("after") || 0);
      if (!Number.isSafeInteger(after) || after < 0) return fail("Invalid message cursor.");
      const messages = after
        ? await db.prepare(`SELECT ${columns} FROM class_messages WHERE id > ? AND created_at > ? ORDER BY id LIMIT 100`).bind(after, now - DAY).all()
        : await db.prepare(`SELECT * FROM (SELECT ${columns} FROM class_messages WHERE created_at > ? ORDER BY id DESC LIMIT 100) ORDER BY id`).bind(now - DAY).all();
      return json({ signedIn: !!userId, me: await profile(db, userId), messages: messages.results, cursor: messages.results.at(-1)?.id ?? after });
    }
    if (url.pathname === "/api/chat/classroom/profile" && request.method === "POST") {
      const body = await bodyOf(request);
      const name = normalizeNickname(body?.nickname);
      if (!name) return fail("Use a nickname with 2–20 visible characters.");
      const taken = await db.prepare("SELECT id FROM class_profiles WHERE nickname_key = ? AND user_id != ?").bind(name.toLowerCase(), userId).first();
      if (taken) return fail("That nickname is taken. Choose another.", 409);
      try {
        const me = await db.prepare("INSERT INTO class_profiles (id, user_id, nickname, nickname_key) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET nickname = excluded.nickname, nickname_key = excluded.nickname_key RETURNING id, nickname").bind(crypto.randomUUID(), userId, name, name.toLowerCase()).first();
        return json({ me });
      } catch { return fail("That nickname could not be saved. Try another.", 409); }
    }
    if (url.pathname === "/api/chat/classroom/messages" && request.method === "POST") {
      const me = await profile(db, userId);
      if (!me) return fail("Choose a nickname before posting.", 403);
      const body = await bodyOf(request);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text || text.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return fail("Write 1–1,000 characters.");
      if (typeof body?.clientId !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.clientId)) return fail("Message ID is missing. Try again.");
      const previous = await db.prepare(`SELECT ${columns} FROM class_messages WHERE member_id = ? AND client_id = ?`).bind(me.id, body.clientId).first();
      if (previous) return json({ message: previous });
      await db.prepare("DELETE FROM class_messages WHERE id IN (SELECT id FROM class_messages WHERE created_at <= ? LIMIT 100)").bind(now - DAY).run();
      const sent = await db.prepare(`INSERT INTO class_messages (member_id, client_id, nickname, text, created_at)
        SELECT ?, ?, ?, ?, ? WHERE
        (SELECT COUNT(*) FROM class_messages WHERE member_id = ? AND created_at > ?) < 30
        AND (SELECT COUNT(*) FROM class_messages WHERE created_at > ?) < 120
        ON CONFLICT(member_id, client_id) DO NOTHING RETURNING ${columns}`).bind(me.id, body.clientId, me.nickname, text, now, me.id, now - 60000, now - 60000).first();
      if (sent) return json({ message: sent }, 201);
      const retry = await db.prepare(`SELECT ${columns} FROM class_messages WHERE member_id = ? AND client_id = ?`).bind(me.id, body.clientId).first();
      return retry ? json({ message: retry }) : fail("Too many messages. Try again in a minute.", 429);
    }
    return fail("Chat route not found.", 404);
  } catch { return fail("Chat could not connect. Try again.", 503); }
}
