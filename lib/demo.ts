import { demoReply } from "./demo-replies.mjs";
import type { ResponseLength } from "./reply-length.mjs";

export type Mode = "natural" | "fluent" | "funny" | "gibberish";
export type Answer = { translation: string; german: string; english: string; note: string };
export const samples = [
  { text: "Leute, was habt ihr am Wochenende gemacht?", translation: "Everyone, what did you do at the weekend?", },
  { text: "Warum ist es wichtig, eine Fremdsprache zu lernen?", translation: "Why is it important to learn a foreign language?", },
  { text: "Wenn ihr eine Superkraft haben könntet, welche wäre das?", translation: "If you could have a superpower, which one would it be?", },
];
export function demoAnswer(index: number, mode: Mode, length?: ResponseLength): Answer {
  const sample = samples[index % samples.length];
  return {
    translation: sample.translation, ...demoReply(index, mode, length),
    note: mode === "gibberish" ? "Invented words with no literal meaning. This is not real German." : mode === "funny" ? "Crude, sarcastic situational humor with German profanity." : mode === "fluent" ? "Deliberately excessive academic German." : "Everyday German.",
  };
}
