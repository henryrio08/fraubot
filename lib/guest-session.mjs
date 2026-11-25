import { normalizeNickname } from "./nickname.mjs";

const COOKIE = "fraubot_session";
const LIFETIME = 180 * 86400000;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", ...headers } });
async function hash(value) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), n => n.toString(16).padStart(2, "0")).join("");
}
function cookieToken(request) {
  const matches = (request.headers.get("cookie") || "").split(";").map(part => part.trim()).filter(part => part.startsWith(COOKIE + "="));
  const value = matches[0]?.slice(COOKIE.length + 1);
  return matches.length === 1 && /^[a-f0-9]{64}$/.test(value || "") ? value : null;
}
async function identity(request, db, now) {
  const token = cookieToken(request);
  if (!token) return null;
  if (!db) throw new Error("Session database unavailable");
  return db.prepare("SELECT user_id AS userId FROM guest_sessions WHERE token_hash = ? AND expires_at > ?").bind(await hash(token), now).first();
}

// Standalone hosting owns this identity boundary. Browser-supplied platform
// identity headers are discarded before any route, quota, chat, or DM handler.
export async function handleGuestRequest(request, env, next, { allowLocalHttp = false, now = Date.now() } = {}) {
  const headers = new Headers(request.headers);
  for (const name of [...headers.keys()]) if (name.startsWith("oai-authenticated-user-")) headers.delete(name);
  request = new Request(request, { headers });
  const url = new URL(request.url);
  if (["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"].includes(url.pathname)) return Response.redirect(new URL("/", url), 303);
  if (!url.pathname.startsWith("/api/")) return next(request);
  let me;
  try { me = await identity(request, env.DB, now); }
  catch { return json({ error: "Your session could not be checked. Try again shortly." }, 503); }
  if (me) headers.set("oai-authenticated-user-id", me.userId);
  if (url.pathname !== "/api/session") return next(new Request(request, { headers }));
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, { Allow: "POST" });
  if (request.headers.get("origin") !== url.origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "This request must come from the site." }, 403);
  const local = allowLocalHttp && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !local) return json({ error: "Open the HTTPS website to join." }, 400);
  if (!env.DB) return json({ error: "Chat is unavailable. Try again shortly." }, 503);
  let name;
  try {
    if (Number(request.headers.get("content-length")) > 2048) return json({ error: "Keep your nickname under 20 characters." }, 413);
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "Keep your nickname under 20 characters." }, 413);
    name = normalizeNickname(JSON.parse(raw).nickname);
  } catch { return json({ error: "Enter a nickname." }, 400); }
  if (!name) return json({ error: "Use a nickname with 2–20 visible characters." }, 400);
  try {
    if (me) {
      const profile = await env.DB.prepare("UPDATE class_profiles SET nickname = ?, nickname_key = ? WHERE user_id = ? RETURNING id, nickname").bind(name, name.toLowerCase(), me.userId).first();
      return profile ? json({ me: profile }) : json({ error: "Your nickname could not be found." }, 503);
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, "0")).join("");
    const tokenHash = await hash(token);
    const userId = "guest:" + crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const networkKey = await hash("fraubot-join:" + (request.headers.get("cf-connecting-ip") || "local"));
    const day = Math.floor(now / 86400000) * 86400000;
    // Both inserts commit together. A nickname collision rolls back the session,
    // and durable join limits supplement the existing AI and message quotas.
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO guest_sessions (token_hash, user_id, network_key, created_at, expires_at)
        SELECT ?, ?, ?, ?, ? WHERE
        (SELECT COUNT(*) FROM guest_sessions WHERE network_key = ? AND created_at >= ?) < 100
        AND (SELECT COUNT(*) FROM guest_sessions WHERE created_at >= ?) < 1000`).bind(tokenHash, userId, networkKey, now, now + LIFETIME, networkKey, day, day),
      env.DB.prepare(`INSERT INTO class_profiles (id, user_id, nickname, nickname_key)
        SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM guest_sessions WHERE token_hash = ?)`)
        .bind(memberId, userId, name, name.toLowerCase(), tokenHash),
    ]);
    const joined = await env.DB.prepare("SELECT user_id FROM guest_sessions WHERE token_hash = ?").bind(tokenHash).first();
    if (!joined) return json({ error: "Too many new visitors. Try again later." }, 429);
    try { await env.DB.prepare("DELETE FROM guest_sessions WHERE token_hash IN (SELECT token_hash FROM guest_sessions WHERE expires_at <= ? LIMIT 100)").bind(now).run(); } catch {}
    return json({ me: { id: memberId, nickname: name } }, 201, {
      "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=${LIFETIME / 1000}; HttpOnly; SameSite=Lax${local ? "" : "; Secure"}`,
    });
  } catch { return json({ error: "That nickname could not be saved. Try another." }, 409); }
}
