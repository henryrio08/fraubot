import reference from "../data/humor-reference.json" with { type: "json" };

const defaults = ["h22", "h14", "h20", "h11", "h12", "h24", "h07", "h01"];

// Only reviewed, original German examples enter the system prompt. Source
// excerpts, social-media text, URLs, and commenter data are never injected.
export function selectHumorExamples(text) {
  const query = String(text || "").normalize("NFC").toLocaleLowerCase("de").replace(/\s+/g, " ");
  const relevant = reference.examples.map((example, position) => ({
    example, position, score: example.triggers.reduce((n, term) => n + (query.includes(term) ? 1 : 0), 0),
  })).filter(item => item.score > 0).sort((a, b) => b.score - a.score || a.position - b.position).slice(0, 3).map(item => item.example);
  const selected = [...relevant];
  for (const id of defaults) {
    if (selected.length >= 8) break;
    if (!selected.some(example => example.id === id)) selected.push(reference.examples.find(example => example.id === id));
  }
  return selected;
}

export function humorCalibration(text) {
  return selectHumorExamples(text).map(example => `${example.question} → ${example.reply}`).join("\n");
}
