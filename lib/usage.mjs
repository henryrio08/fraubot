export const SPEECH_SESSION_MINUTES = 10;
export const DAILY_LIMITS = { assist: { user: 60, site: 500 }, speech: { user: 6, site: 24 } };
const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });

// One conditional insert checks both limits atomically, across Worker instances.
// Speech reserves a complete ten-minute session before any provider connection.
export async function reserveUsage(db, userId, kind, now = Date.now()) {
  const limits = DAILY_LIMITS[kind];
  if (!db || !userId || !limits) return false;
  const day = dayFormat.format(new Date(now));
  const result = await db.prepare(`INSERT INTO ai_usage (id, user_id, day, kind, created_at)
    SELECT ?, ?, ?, ?, ? WHERE
    (SELECT COUNT(*) FROM ai_usage WHERE day = ? AND kind = ?) < ?
    AND (SELECT COUNT(*) FROM ai_usage WHERE day = ? AND kind = ? AND user_id = ?) < ?
    RETURNING id`).bind(crypto.randomUUID(), userId, day, kind, now, day, kind, limits.site, day, kind, userId, limits.user).first();
  return !!result;
}

export async function checkPaidAccess(request, env, kind) {
  const headers = { "Cache-Control": "no-store" };
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return Response.json({ error: "Sign in to use live translation and replies.", code: "sign_in_required" }, { status: 401, headers });
  if (!env.DB) return Response.json({ error: "Usage limits are unavailable. Try again shortly." }, { status: 503, headers });
  try {
    if (!await reserveUsage(env.DB, userId, kind)) return Response.json({ error: kind === "speech" ? "The daily listening limit has been reached. Try again tomorrow." : "The daily reply limit has been reached. Try again tomorrow.", code: "daily_limit" }, { status: 429, headers });
    return null;
  } catch {
    return Response.json({ error: "Usage limits could not be checked. Try again shortly." }, { status: 503, headers });
  }
}
