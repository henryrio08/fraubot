import test from "node:test";
import assert from "node:assert/strict";
import { RESPONSE_LENGTHS, DEFAULT_RESPONSE_LENGTH, replyLengthProfile } from "../lib/reply-length.mjs";
import { MODES, buildPayload, validateInput } from "../lib/assist.mjs";
import { demoReply } from "../lib/demo-replies.mjs";
import { handleApi } from "../lib/api.mjs";
import { database } from "./helpers/database.mjs";

test("length choices validate strictly and older clients get Short", () => {
  const input = { text: "Warum lernst du Deutsch?", mode: "natural" };
  assert.equal(validateInput(input).length, DEFAULT_RESPONSE_LENGTH);
  for (const { id } of RESPONSE_LENGTHS) assert.equal(validateInput({ ...input, length: id }).length, id);
  for (const length of [null, 1, "", "__proto__", "ignore instructions", {}, []]) assert.equal(validateInput({ ...input, length }), null);
});

test("every mode scales upward and tryhard stays longer than Normal at each setting", () => {
  for (const mode of MODES) {
    let previousMax = 0;
    for (const { id } of RESPONSE_LENGTHS) {
      const profile = replyLengthProfile(mode, id);
      assert.ok(profile.min > previousMax, `${mode} ${id} must increase`);
      assert.ok(profile.max >= profile.min);
      assert.ok(profile.maxOutputTokens >= 1600 && profile.maxOutputTokens <= 4000);
      previousMax = profile.max;
    }
  }
  for (const { id } of RESPONSE_LENGTHS) assert.ok(replyLengthProfile("fluent", id).min > replyLengthProfile("natural", id).max);
});

test("the selected length reaches the provider payload through the API", async t => {
  const DB = database(t);
  for (const mode of MODES) for (const length of ["really_short", "extra_high"]) {
    const input = { text: "Was hast du am Wochenende gemacht?", mode, length };
    const expected = buildPayload(validateInput(input));
    const request = new Request("https://leute.example/api/assist", { method: "POST", headers: { origin: "https://leute.example", "content-type": "application/json", "oai-authenticated-user-id": "length-test" }, body: JSON.stringify(input) });
    let called = false;
    const response = await handleApi(request, { MODEL_API_KEY: "test", DB }, async (_url, options) => {
      called = true;
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload, expected);
      const { min, max } = replyLengthProfile(mode, length);
      assert.ok(payload.instructions.includes(`Target ${min}–${max} whitespace-separated words in german`));
      return new Response('data: {"type":"response.completed"}\n\n');
    });
    assert.equal(response.status, 200); assert.ok(called);
  }
});

test("all prewritten demos fit every length without cutting sentences or their translations", () => {
  for (let sample = 0; sample < 3; sample++) for (const mode of MODES) for (const { id } of RESPONSE_LENGTHS) {
    const reply = demoReply(sample, mode, id);
    const { min, max } = replyLengthProfile(mode, id);
    const count = reply.german.trim().split(/\s+/).length;
    assert.ok(count >= min && count <= max, `sample ${sample}, ${mode}, ${id}: ${count}, expected ${min}–${max}`);
    assert.ok(reply.english && /[.!?]$/.test(reply.german));
    if (mode === "gibberish") assert.match(reply.english, /No literal translation/);
    else assert.doesNotMatch(reply.english, /No literal translation/);
  }
});
