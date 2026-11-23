import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { buildPayload, consumeEvents, partialResult, validResult, validateInput } from "../lib/assist.mjs";
import { handleApi } from "../lib/api.mjs";
import { normalizeAudioFrame } from "../lib/audio.mjs";

const request = (body, origin = "https://leute.example") => new Request("https://leute.example/api/assist", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const input = { text: "Was hast du gemacht?", mode: "funny" };
test("binary speech frames remain binary across Blob, buffer, and offset-view runtimes", async () => {
  const bytes = Uint8Array.of(0, 128, 255, 127);
  for (const input of [bytes.buffer, new Blob([bytes]), Uint8Array.of(9, ...bytes, 9).subarray(1, 5)]) {
    const result = await normalizeAudioFrame(input);
    assert.ok(result instanceof ArrayBuffer);
    assert.deepEqual([...new Uint8Array(result)], [...bytes]);
  }
  await assert.rejects(normalizeAudioFrame("not PCM"), /binary audio/);
});
test("validates bounded transcripts, modes, and context", () => {
  assert.equal(validateInput({ text: " ", mode: "natural" }), null);
  assert.equal(validateInput({ ...input, mode: "abuse" }), null);
  assert.equal(validateInput({ ...input, text: "x".repeat(2501) }), null);
  assert.deepEqual(validateInput({ ...input, context: [1, "a", "b", "c", "d", "e"] }).context, ["b", "c", "d", "e"]);
});
test("all modes preserve accurate translation and keep transcripts untrusted", () => {
  for (const mode of ["natural", "fluent", "funny", "gibberish"]) {
    const payload = buildPayload({ ...input, mode, context: [] });
    assert.match(payload.instructions, /Always translate the latest utterance accurately/);
    assert.match(payload.instructions, /untrusted speech/);
    assert.equal(payload.store, false); assert.equal(payload.reasoning.effort, "minimal");
    assert.equal(payload.text.format.strict, true);
  }
});
test("partial JSON decodes quoted umlauts without exposing unfinished fields", () => {
  assert.deepEqual(partialResult('{"translation":"He said \\"hi\\".","german":"Grüße","english":"unfin'), { translation: 'He said "hi".', german: "Grüße" });
  assert.equal(validResult({ german: "Hallo" }), false);
});
test("SSE parser handles split UTF-8 characters, events, CRLF and final unclosed line", async () => {
  const bytes = new TextEncoder().encode('event: response.output_text.delta\r\ndata: {"delta":"Grüße"}\r\n\r\ndata: {"type":"response.completed"}\n\ndata: [DONE]');
  const events = []; const body = new ReadableStream({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } });
  await consumeEvents(body, e => events.push(e)); assert.deepEqual(events, [{ delta: "Grüße" }, { type: "response.completed" }]);
});
test("cross-origin requests never reach the provider", async () => {
  let called = false;
  const r = await handleApi(request(input, "https://evil.example"), { MODEL_API_KEY: "test" }, async () => { called = true; });
  assert.equal(r.status, 403); assert.equal(called, false);
});
test("missing credentials return a clear configuration error without fake output", async () => {
  const r = await handleApi(request(input), {}); assert.equal(r.status, 503); assert.equal((await r.json()).code, "not_configured");
  const config = await handleApi(new Request("https://leute.example/api/config"), { MODEL_API_KEY: "secret" });
  const text = await config.text(); assert.doesNotMatch(text, /secret/); assert.match(text, /"configured":true/);
});
test("credentials travel only to the fixed Meta endpoint and provider errors are sanitized", async () => {
  const r = await handleApi(request(input), { MODEL_API_KEY: "private-test-value" }, async (url, options) => {
    assert.equal(url, "https://api.meta.ai/v1/responses"); assert.equal(options.headers.Authorization, "Bearer private-test-value");
    assert.doesNotMatch(options.body, /private-test-value/);
    return new Response('private diagnostic private-test-value', { status: 401 });
  });
  assert.equal(r.status, 502); assert.doesNotMatch(await r.text(), /private-test-value/);
});
test("successful generation stays streamed and uncached", async () => {
  const stream = 'data: {"type":"response.completed"}\n\n';
  const r = await handleApi(request(input), { MODEL_API_KEY: "test" }, async () => new Response(stream));
  assert.equal(r.headers.get("content-type"), "text/event-stream"); assert.equal(r.headers.get("cache-control"), "no-store"); assert.equal(await r.text(), stream);
});
test("audio worklet emits mono little-endian PCM16 at 24 kHz", () => {
  for (const rate of [24000, 44100, 48000]) {
    let Processor; const sent = [];
    const scope = { sampleRate: rate, AudioWorkletProcessor: class { port = { postMessage: b => sent.push(b) }; }, registerProcessor: (_name, p) => { Processor = p; } };
    vm.runInNewContext(readFileSync(new URL("../public/pcm-worklet.js", import.meta.url), "utf8"), scope);
    const p = new Processor();
    for (let i = 0; i < Math.ceil(rate / 128); i++) p.process([[new Float32Array(128).fill(.5)]]);
    const count = sent.reduce((n, b) => n + b.byteLength / 2, 0);
    assert.ok(count > 21000 && count < 25000, `24 kHz output at source rate ${rate}: ${count}`);
    assert.equal(new DataView(sent[0]).getInt16(0, true), 16384);
  }
});
