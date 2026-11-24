import { sameOrigin, takeRateLimit } from "./api.mjs";
import { handleClassChat } from "./class-chat.mjs";

const DAY = 24 * 60 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const json = (value, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const fail = (error, status = 400, code) => json({ error, ...(code ? { code } : {}) }, status);
export const normalizeCode = value => typeof value === "string" ? value.toUpperCase().replace(/[\s-]/g, "") : "";
const validCode = code => /^[A-HJ-NP-Z2-9]{10}$/.test(code);
const nickname = value => typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/g, " ") : "";
const validName = value => [...value].length >= 2 && [...value].length <= 20 && !/[\p{Cc}\p{Cf}]/u.test(value);
const messageColumns = "id, client_id AS clientId, member_id AS memberId, nickname, text, created_at AS createdAt";
const makeCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), n => ALPHABET[n % ALPHABET.length]).join("");

async function readBody(request) {
  if (Number(request.headers.get("content-length")) > 8000) return null;
  try { const raw = await request.text(); return raw.length <= 8000 ? JSON.parse(raw) : null; } catch { return null; }
}

async function snapshot(db, room, member, after = 0) {
  const [members, messages] = await db.batch([
    db.prepare("SELECT id, nickname FROM chat_members WHERE room_id = ? AND active = 1 ORDER BY joined_at, id").bind(room.id),
    after
      ? db.prepare(`SELECT ${messageColumns} FROM chat_messages WHERE room_id = ? AND id > ? ORDER BY id LIMIT 100`).bind(room.id, after)
      : db.prepare(`SELECT * FROM (SELECT ${messageColumns} FROM chat_messages WHERE room_id = ? ORDER BY id DESC LIMIT 100) ORDER BY id`).bind(room.id),
  ]);
  return {
    room: { code: room.code, expiresAt: room.expires_at },
    me: { id: member.id, nickname: member.nickname },
    members: members.results,
    messages: messages.results,
    cursor: messages.results.at(-1)?.id ?? after,
  };
}

export async function handleChat(request, env = {}) {
  const url = new URL(request.url);
  if (url.pathname === "/api/chat/classroom" || url.pathname.startsWith("/api/chat/classroom/")) return handleClassChat(request, env);
  const userId = request.headers.get("oai-authenticated-user-id");
  if (url.pathname === "/api/chat/status" && request.method === "GET") return json({ signedIn: !!userId, available: !!env.DB });
  if (!userId) return fail("Sign in to use chat.", 401, "sign_in_required");
  if (!["GET", "POST"].includes(request.method)) return fail("Use GET or POST.", 405);
  if (request.method === "POST" && !sameOrigin(request)) return fail("This request must come from the site.", 403);
  if (!env.DB) return fail("Chat is getting ready. Try again shortly.", 503);
  if (!takeRateLimit(request, "chat:" + request.method, request.method === "GET" ? 120 : 45)) return fail("Too fast. Give it a minute.", 429);
  const db = env.DB;
  const now = Date.now();
  try {
    if (request.method === "POST" && ["/api/chat/rooms", "/api/chat/join"].includes(url.pathname)) {
      const body = await readBody(request);
      const name = nickname(body?.nickname);
      if (!validName(name)) return fail("Pick a nickname with 2–20 visible characters.");
      // Expired rooms cannot be read; bounded cleanup also removes their messages.
      await db.prepare("DELETE FROM chat_rooms WHERE id IN (SELECT id FROM chat_rooms WHERE expires_at <= ? LIMIT 50)").bind(now).run();
      if (url.pathname === "/api/chat/rooms") {
        const room = { id: crypto.randomUUID(), code: makeCode(), expires_at: now + DAY };
        const member = { id: crypto.randomUUID(), nickname: name };
        const created = await db.batch([
          db.prepare("INSERT INTO chat_rooms (id, code, created_by, created_at, expires_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM chat_rooms WHERE created_by = ? AND expires_at > ?) < 5").bind(room.id, room.code, userId, now, room.expires_at, userId, now),
          db.prepare("INSERT INTO chat_members (id, room_id, user_id, nickname, nickname_key, active, joined_at) SELECT ?, id, ?, ?, ?, 1, ? FROM chat_rooms WHERE id = ?").bind(member.id, userId, name, name.toLowerCase(), now, room.id),
        ]);
        if (!created[0].meta.changes) return fail("You already have 5 active rooms. Join one of those for now.", 429);
        return json(await snapshot(db, room, member), 201);
      }
      const code = normalizeCode(body?.code);
      if (!validCode(code)) return fail("Enter the 10-character room code.");
      const room = await db.prepare("SELECT id, code, expires_at FROM chat_rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
      if (!room) return fail("That room is missing or expired. Check the code.", 404, "room_unavailable");
      const existing = await db.prepare("SELECT id, nickname, active FROM chat_members WHERE room_id = ? AND user_id = ?").bind(room.id, userId).first();
      if (existing?.active) return json(await snapshot(db, room, existing));
      const joined = await db.prepare(`INSERT INTO chat_members (id, room_id, user_id, nickname, nickname_key, active, joined_at)
        SELECT ?, ?, ?, ?, ?, 1, ? WHERE
        (SELECT COUNT(*) FROM chat_members WHERE room_id = ? AND active = 1) < 20
        AND NOT EXISTS (SELECT 1 FROM chat_members WHERE room_id = ? AND nickname_key = ? AND active = 1 AND user_id != ?)
        ON CONFLICT(room_id, user_id) DO UPDATE SET nickname = excluded.nickname, nickname_key = excluded.nickname_key, active = 1, joined_at = excluded.joined_at
        RETURNING id, nickname`).bind(crypto.randomUUID(), room.id, userId, name, name.toLowerCase(), now, room.id, room.id, name.toLowerCase(), userId).first();
      if (!joined) return fail("That nickname is taken, or the room has 20 people. Try another nickname or room.", 409);
      return json(await snapshot(db, room, joined));
    }

    const route = url.pathname.match(/^\/api\/chat\/rooms\/([A-HJ-NP-Z2-9]{10})(?:\/(messages|leave))?$/);
    if (!route) return fail("Chat route not found.", 404);
    const [, code, action] = route;
    const room = await db.prepare("SELECT id, code, expires_at FROM chat_rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
    if (!room) return fail("This room has expired. Make a new one.", 404, "room_unavailable");
    const member = await db.prepare("SELECT id, nickname FROM chat_members WHERE room_id = ? AND user_id = ? AND active = 1").bind(room.id, userId).first();
    if (!member) return fail("Join this room before reading or sending messages.", 403, "not_a_member");
    if (request.method === "GET" && !action) {
      const after = Number(url.searchParams.get("after") || 0);
      if (!Number.isSafeInteger(after) || after < 0) return fail("Invalid message cursor.");
      return json(await snapshot(db, room, member, after));
    }
    if (request.method === "POST" && action === "leave") {
      await db.prepare("UPDATE chat_members SET active = 0 WHERE id = ?").bind(member.id).run();
      return json({ left: true });
    }
    if (request.method === "POST" && action === "messages") {
      const body = await readBody(request);
      const text = typeof body?.text === "string" ? body.text.trim() : "";
      if (!text || text.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return fail("Write 1–1,000 characters.");
      if (typeof body?.clientId !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.clientId)) return fail("Message ID is missing. Try again.");
      const previous = await db.prepare(`SELECT ${messageColumns} FROM chat_messages WHERE room_id = ? AND member_id = ? AND client_id = ?`).bind(room.id, member.id, body.clientId).first();
      if (previous) return json({ message: previous });
      // Check limits and insert together so simultaneous sends cannot bypass them.
      const sent = await db.prepare(`INSERT INTO chat_messages (room_id, member_id, client_id, nickname, text, created_at)
        SELECT ?, ?, ?, ?, ?, ? WHERE
        (SELECT COUNT(*) FROM chat_messages WHERE member_id = ? AND created_at > ?) < 30
        AND (SELECT COUNT(*) FROM chat_messages WHERE room_id = ?) < 1000
        ON CONFLICT(room_id, member_id, client_id) DO NOTHING
        RETURNING ${messageColumns}`).bind(room.id, member.id, body.clientId, member.nickname, text, now, member.id, now - 60000, room.id).first();
      if (!sent) {
        const retry = await db.prepare(`SELECT ${messageColumns} FROM chat_messages WHERE room_id = ? AND member_id = ? AND client_id = ?`).bind(room.id, member.id, body.clientId).first();
        if (retry) return json({ message: retry });
        return fail("Message limit reached. Wait a minute; if the room is full, start a new one.", 429);
      }
      return json({ message: sent }, 201);
    }
    return fail("Chat route not found.", 404);
  } catch (error) {
    console.error("Chat request failed:", error?.name || "Error");
    return fail("Chat hit a snag. Your message was not confirmed; try again.", 503);
  }
}
