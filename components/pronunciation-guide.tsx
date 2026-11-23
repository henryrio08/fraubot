import { Square, Volume2 } from "lucide-react";

type Props = {
  text?: string;
  loading?: boolean;
  onSlow?: () => void;
  onStop?: () => void;
  speaking?: boolean;
};

export default function PronunciationGuide({ text, loading, onSlow, onStop, speaking = false }: Props) {
  return <section className="pronunciation" aria-label="Pronunciation guide">
    <div className="pronunciation-heading">
      <h3>SAY IT LIKE THIS</h3>
      {onSlow && <button className="pronunciation-audio" onClick={speaking ? onStop : onSlow} aria-label={speaking ? "Stop pronunciation audio" : "Play German reply slowly"}>
        {speaking ? <Square size={13} /> : <Volume2 size={15} />}{speaking ? "Stop audio" : "Slow audio"}
      </button>}
    </div>
    <p className="pronunciation-text" lang="en">
      {text ? text.split(/([-\s]+)/).map((part, i) => /[A-ZÄÖÜ]/.test(part) && part === part.toUpperCase()
        ? <strong key={i}>{part}</strong>
        : <span key={i}>{part}</span>)
        : <span className="pronunciation-pending">{loading ? "Sounding it out…" : "Use the audio if a written guide is unavailable."}</span>}
    </p>
    <div className="pronunciation-help"><span><b>CAPS</b> = stress · hyphens = syllables</span><span>Approximate</span></div>
    <details className="sound-key">
      <summary>Sound key</summary>
      <dl>
        <div><dt>KH</dt><dd>A breathy German “ch,” not a hard “k.”</dd></div>
        <div><dt>UE / Ü</dt><dd>Start with “ee” and round your lips.</dd></div>
        <div><dt>OE / Ö</dt><dd>Start with “eh” and round your lips.</dd></div>
        <div><dt>OY</dt><dd>Like “oy” in “toy.” <i>Leute</i> is roughly <b>LOY-tuh</b>.</dd></div>
      </dl>
      <a href="https://www.goethe.de/prj/dlp/en/teachingmaterials/series/elementary_german_activities_and_exercises/pronunciation_training" target="_blank" rel="noreferrer">German sound examples</a>
    </details>
  </section>;
}
