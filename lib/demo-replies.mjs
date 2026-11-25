import replies from "../data/demo-replies.json" with { type: "json" };
import { replyLengthProfile } from "./reply-length.mjs";

const noTranslation = "No literal translation. These are invented German-sounding words with no actual meaning.";
const beginnings = ["Schrömp", "Flümm", "Knörz", "Brömm", "Zwäff", "Drüff", "Plömm", "Krümp", "Quörz", "Schnüff", "Glömm", "Trümm", "Fräff", "Zwürm", "Klömp", "Prüff"];
const endings = ["elkratz", "enplöck", "erquast", "igdratz", "elbrüff", "enwümpf", "erklösch", "igzwatz", "elknüff", "engräpp"];

/** @param {number} index @param {"natural" | "fluent" | "funny" | "gibberish"} mode @param {import("./reply-length.mjs").ResponseLength} [length] */
export function demoReply(index, mode, length) {
  const { min, max } = replyLengthProfile(mode, length);
  if (mode === "gibberish") {
    const count = Math.round((min + max) / 2);
    const words = Array.from({ length: count }, (_, n) => {
      const offset = (n + index * 17) % (beginnings.length * endings.length);
      return beginnings[offset % beginnings.length] + endings[Math.floor(offset / beginnings.length)];
    });
    return { german: words.map((word, n) => word + ((n + 1) % 10 === 0 || n === words.length - 1 ? "." : "")).join(" "), english: noTranslation };
  }
  // Add complete, paired sentences so length changes never cut a sentence or
  // leave its English meaning out of sync with the German.
  const selected = [];
  let count = 0;
  for (const pair of replies[index % replies.length][mode]) {
    if (count >= min) break;
    const words = pair[0].trim().split(/\s+/).length;
    if (count + words > max) throw new Error("Demo sentence exceeds the length target.");
    selected.push(pair); count += words;
  }
  if (count < min) throw new Error("Demo needs more sentences for this length.");
  return { german: selected.map(pair => pair[0]).join(" "), english: selected.map(pair => pair[1]).join(" ") };
}
