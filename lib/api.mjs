import { buildPayload, validateInput } from "./assist.mjs";
const attempts = new Map();
const json = (data, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function sameOrigin(request) { return request.headers.get("origin") === new URL(request.url).origin; }
// Best-effort per-isolate protection. Private Sites access is the primary boundary.
export function takeRateLimit(request, bucket = "assist", limit = 30) {
  const key = bucket + ":" + (request.headers.get("oai-authenticated-user-id") || request.headers.get("cf-connecting-ip") || "local");
  const now = Date.now();
  if (attempts.size > 2000) for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  const current = attempts.get(key);
  if (!current || current.reset < now) { attempts.set(key, { count: 1, reset: now + 60000 }); return true; }
  if (current.count >= limit) return false;
  current.count++; return true;
}
export async function handleApi(request, env = {}, upstreamFetch = fetch) {
  const path = new URL(request.url).pathname;
  if (path === "/api/config" && request.method === "GET") return json({ configured: !!env.MODEL_API_KEY, provider: "Meta", isolation: false });
  if (path !== "/api/assist") return json({ error: "Not found." }, 404);
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);
  if (!sameOrigin(request)) return json({ error: "This request must come from the site." }, 403);
  if (Number(request.headers.get("content-length")) > 16000) return json({ error: "Keep your text under 2,500 characters." }, 413);
  let body;
  try { const raw = await request.text(); if (raw.length > 16000) return json({ error: "Request too large." }, 413); body = JSON.parse(raw); }
  catch { return json({ error: "Send valid JSON." }, 400); }
  const input = validateInput(body);
  if (!input) return json({ error: "Enter up to 2,500 characters and choose a valid reply mode." }, 400);
  if (!env.MODEL_API_KEY) return json({ error: "Connect your Meta API key to enable translation and replies. You can try the example session without a key.", code: "not_configured" }, 503);
  if (!takeRateLimit(request)) return json({ error: "A little too fast. Try again in a minute." }, 429);
  try {
    const response = await upstreamFetch("https://api.meta.ai/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${env.MODEL_API_KEY}`, "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(buildPayload(input, env.META_TEXT_MODEL || "muse-ember-1.0")),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    if (!response.ok) {
      const messages = { 401: "Meta rejected the API key. Check the server secret.", 403: "This Meta account does not have access to the selected model.", 429: "Meta's usage limit was reached. Check credits or try again shortly." };
      return json({ error: messages[response.status] || "Meta could not complete this request. Please try again." }, response.status === 429 ? 429 : 502);
    }
    if (!response.body) return json({ error: "Meta returned an empty response." }, 502);
    return new Response(response.body, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
  } catch (error) { return json({ error: error.name === "TimeoutError" ? "The request took too long. Try a shorter phrase." : "The AI connection was interrupted. Please try again." }, 502); }
}
