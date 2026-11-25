/** @typedef {"really_short" | "short" | "medium" | "high" | "extra_high"} ResponseLength */
/** @type {ReadonlyArray<{ id: ResponseLength, label: string }>} */
export const RESPONSE_LENGTHS = [
  { id: "really_short", label: "Really short" },
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "extra_high", label: "Extra high" },
];
/** @type {ResponseLength} */
export const DEFAULT_RESPONSE_LENGTH = "short";
const targets = {
  natural: [[3, 7], [8, 18], [25, 40], [55, 80], [100, 140]],
  fluent: [[10, 16], [22, 35], [45, 65], [90, 120], [155, 200]],
  funny: [[8, 14], [22, 35], [45, 65], [80, 110], [130, 170]],
  gibberish: [[4, 8], [10, 18], [25, 40], [50, 75], [90, 130]],
};

/** @param {unknown} value @returns {value is ResponseLength} */
export function isResponseLength(value) {
  return RESPONSE_LENGTHS.some(option => option.id === value);
}

/** @param {keyof typeof targets} mode @param {ResponseLength} [length] */
export function replyLengthProfile(mode, length = DEFAULT_RESPONSE_LENGTH) {
  const index = RESPONSE_LENGTHS.findIndex(option => option.id === length);
  const [min, max] = targets[mode][index < 0 ? 1 : index];
  return { min, max, label: RESPONSE_LENGTHS[index < 0 ? 1 : index].label,
    maxOutputTokens: Math.max(1600, 1200 + max * (mode === "gibberish" ? 12 : mode === "fluent" ? 10 : 8)) };
}

/** @param {keyof typeof targets} mode @param {ResponseLength} [length] */
export function replyLengthInstructions(mode, length = DEFAULT_RESPONSE_LENGTH) {
  const { min, max, label } = replyLengthProfile(mode, length);
  return `RESPONSE LENGTH: ${label}. Target ${min}–${max} whitespace-separated words in german. This is the controlling length instruction; calibration examples show tone, not length. ${mode === "funny" ? "For Short and above, use at least two connected sentences: a direct answer and a pointed reaction to the classroom demand. At longer lengths, add relevant details and finish on the strongest line. Do not compress the reply into a tiny one-liner or repeat the same point." : mode === "fluent" ? "Keep the elaborate academic style even at short lengths. At longer lengths, develop the answer in connected sentences." : mode === "natural" ? "Keep everyday vocabulary at every length. Add relevant details at longer lengths." : "Scale the number of invented words, keeping the same German-like sound."} Aim inside the range, then check the word count before finalizing. The range applies only to the suggested German reply; always translate the entire original utterance accurately and give the reply's complete English meaning.`;
}
