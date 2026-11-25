import replies from "../data/demo-replies.json" with { type: "json" };
import { replyLengthProfile } from "./reply-length.mjs";

const noTranslation = "No literal translation. These are invented German-sounding words with no actual meaning.";
const beginnings = ["Schrömp", "Flümm", "Knörz", "Brömm", "Zwäff", "Drüff", "Plömm", "Krümp", "Quörz", "Schnüff", "Glömm", "Trümm", "Fräff", "Zwürm", "Klömp", "Prüff"];
const middles = ["el", "an", "ür", "en", "or", "i", "am", "ä", "ul", "ev", "un", "ol"];
const endings = ["ern", "ösel", "aut", "eck", "um", "aren", "isch", "eig", "ünt", "abel", "or", "eit", "aug", "empf", "alin", "eusch", "arf", "öde", "un", "eld"];
const onsets = ["vr", "kn", "pl", "zw", "fl", "dr", "kr", "sn", "br", "gr", "fr"];
const vowels = ["ai", "ö", "ü", "au", "ei", "u", "e", "a"];
const codas = ["m", "v", "ff", "l", "n", "sch", "p", "t"];
const verbEndings = ["elt", "iert", "ümt", "erte", "esch", "eift", "ant"];

function inventedWord(n, sample) {
  const offset = n * 37 + sample * 53;
  const kind = n % 7;
  let word;
  if (kind === 0 || kind === 3) {
    word = onsets[offset % onsets.length] + vowels[Math.floor(offset / onsets.length) % vowels.length] + codas[Math.floor(offset / (onsets.length * vowels.length)) % codas.length];
  } else {
    const root = beginnings[offset % beginnings.length];
    const ending = kind === 2 || kind === 6 ? verbEndings[(Math.floor(n / 7) * 3 + kind + sample) % verbEndings.length] : endings[(n * 7 + sample * 3) % endings.length];
    word = root + (kind === 1 || kind === 5 ? middles[(n * 5 + sample) % middles.length] : "") + ending;
    if (kind !== 1 && kind !== 5) word = word.toLocaleLowerCase("de");
  }
  return n % 10 === 0 ? word[0].toLocaleUpperCase("de") + word.slice(1) : word;
}

/** @param {number} index @param {"natural" | "fluent" | "funny" | "gibberish"} mode @param {import("./reply-length.mjs").ResponseLength} [length] */
export function demoReply(index, mode, length) {
  const { min, max } = replyLengthProfile(mode, length);
  if (mode === "gibberish") {
    const count = Math.round((min + max) / 2);
    const words = Array.from({ length: count }, (_, n) => inventedWord(n, index));
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
