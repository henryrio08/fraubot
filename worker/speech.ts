import { sameOrigin, takeRateLimit } from "../lib/api.mjs";
import { normalizeAudioFrame } from "../lib/audio.mjs";
import { checkPaidAccess, SPEECH_SESSION_MINUTES } from "../lib/usage.mjs";
type SpeechEnv = { MODEL_API_KEY?: string; META_SPEECH_MODEL?: string; DB?: D1Database };
export async function handleSpeech(request: Request, env: SpeechEnv): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") return Response.json({ error: "WebSocket required." }, { status: 426 });
  if (!sameOrigin(request)) return Response.json({ error: "Unexpected origin." }, { status: 403 });
  if (!env.MODEL_API_KEY) return Response.json({ error: "Connect your Meta API key first." }, { status: 503 });
  if (!takeRateLimit(request, "speech", 8)) return Response.json({ error: "Wait a minute before starting another session." }, { status: 429 });
  const denied = await checkPaidAccess(request, env, "speech");
  if (denied) return denied;
  let upstream: WebSocket;
  try {
    const response = await fetch("https://api.meta.ai/v1/asr/realtime", { headers: { Upgrade: "websocket" }, signal: AbortSignal.timeout(15000) });
    if (!response.webSocket) return Response.json({ error: "Meta speech is unavailable." }, { status: 502 });
    upstream = response.webSocket; upstream.accept();
  } catch { return Response.json({ error: "Could not connect to Meta speech." }, { status: 502 }); }
  const pair = new WebSocketPair(); const client = pair[0]; const server = pair[1]; server.accept();
  let ready = false; let ended = false; let bytes = 0; let closed = false;
  let sendQueue = Promise.resolve();
  const close = (code = 1000, reason = "Session ended") => {
    if (closed) return; closed = true;
    clearTimeout(expiry); clearTimeout(deadline);
    try { server.close(code, reason); } catch {} try { upstream.close(code, reason); } catch {}
  };
  const expiry = setTimeout(() => {
    try { server.send(JSON.stringify({ type: "error", message: `The ${SPEECH_SESSION_MINUTES}-minute session limit was reached. Start a new session to continue.` })); } catch {}
    close(1000, "Session limit");
  }, SPEECH_SESSION_MINUTES * 60 * 1000);
  const deadline = setTimeout(() => close(1011, "Speech handshake timed out"), 12000);
  upstream.addEventListener("message", event => {
    if (typeof event.data !== "string") return;
    try {
      const message = JSON.parse(event.data);
      if (message.sessionId && !message.type) { ready = true; clearTimeout(deadline); server.send(JSON.stringify({ type: "ready" })); return; }
      if (["transcript", "speechStart", "speechEnd", "speechComplete", "speaker", "audioProgress"].includes(message.type)) {
        const safe = Object.fromEntries(Object.entries(message).filter(([key]) => ["type", "transcript", "final", "turnId", "label", "audioProcessedMs"].includes(key)));
        server.send(JSON.stringify(safe));
      } else if (message.type === "error") { server.send(JSON.stringify({ type: "error", message: "Meta speech reported an error. Check API access and restart." })); close(1011, "Speech error"); }
    } catch { close(1011, "Invalid speech response"); }
  });
  server.addEventListener("message", event => {
    if (!ready || ended) return;
    if (typeof event.data === "string") {
      if (event.data === '{"type":"endStream"}') { ended = true; sendQueue = sendQueue.then(() => { if (!closed) upstream.send('{"type":"endStream"}'); }).catch(() => close(1011, "Audio send failed")); }
      return;
    }
    const data = event.data;
    sendQueue = sendQueue.then(async () => {
      if (closed) return;
      const audio = await normalizeAudioFrame(data);
      bytes += audio.byteLength;
      if (audio.byteLength > 48000 || bytes > 48000 * SPEECH_SESSION_MINUTES * 60 || upstream.bufferedAmount > 240000) { close(1008, "Audio limit exceeded"); return; }
      if (!closed) upstream.send(audio);
    }).catch(() => close(1011, "Audio send failed"));
  });
  server.addEventListener("close", () => close()); server.addEventListener("error", () => close(1011, "Connection error"));
  upstream.addEventListener("close", event => close(event.code === 1000 ? 1000 : 1011, "Speech connection closed"));
  upstream.addEventListener("error", () => close(1011, "Speech connection error"));
  upstream.send(JSON.stringify({
    authorization: { accessToken: `Bearer ${env.MODEL_API_KEY}` }, audioEncoding: "PCM_24KHZ",
    model: env.META_SPEECH_MODEL || "muse-voice-transcribe-1.0",
    mode: new URL(request.url).searchParams.get("speakers") === "1" ? "DIARIZATION" : "ENDPOINTING",
    partialMode: "CUMULATIVE", languageBias: ["German", "English"], keywords: ["Leute"], emitAudioProgress: false,
  }));
  return new Response(null, { status: 101, webSocket: client });
}
