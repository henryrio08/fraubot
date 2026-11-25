export type Mode = "natural" | "fluent" | "funny" | "gibberish";
export type Answer = { translation: string; german: string; english: string; note: string };
const noTranslation = "No literal translation. These are invented German-sounding words with no actual meaning.";
export const samples = [
  {
    text: "Leute, was habt ihr am Wochenende gemacht?",
    translation: "Everyone, what did you do at the weekend?",
    answers: {
      natural: [
        "Ich habe Musik gehört und meine Freunde getroffen.",
        "I listened to music and met my friends.",
      ],
      fluent: [
        "Am Wochenende unterzog ich meine Freizeitgestaltung einer metakognitiven Effizienzprüfung, um das Spannungsverhältnis zwischen Regenerationsbedürfnis, sozialer Interaktionsdichte und langfristiger Selbstwirksamkeitserwartung systematisch zu analysieren. Unter Berücksichtigung erkenntnistheoretischer Unsicherheiten entwickelte ich anschließend eine ressourcenorientierte Priorisierungsstrategie, deren Umsetzung eine nachhaltige Verbesserung meiner psychophysischen Belastungsregulation ermöglichen soll.",
        "At the weekend, I subjected my leisure activities to a metacognitive efficiency assessment to systematically analyze the tension between the need for recovery, density of social interaction, and long-term expectations of self-efficacy. Taking epistemological uncertainties into account, I then developed a resource-oriented prioritization strategy intended to enable a sustained improvement in my psychophysical stress regulation.",
      ],
      funny: [
        "Gezockt. Für die Scheißhausaufgaben war plötzlich keine Zeit mehr.",
        "Played games. Suddenly there was no time left for the shitty homework.",
      ],
      gibberish: [
        "Schnörbelgratz flümperte klabusterwärts! Zwickelflauch, drömmelschrapp und bröselquastig verknurpselt — krömpf? Nödelbratz! Zwäffelknork beschlummrig.",
        noTranslation,
      ],
    },
  },
  {
    text: "Warum ist es wichtig, eine Fremdsprache zu lernen?",
    translation: "Why is it important to learn a foreign language?",
    answers: {
      natural: [
        "Man kann mit mehr Menschen sprechen und andere Kulturen kennenlernen.",
        "You can talk to more people and get to know other cultures.",
      ],
      fluent: [
        "Der Fremdsprachenerwerb konstituiert einen fundamentalen Prozess interkultureller Perspektivenerweiterung, durch den habitualisierte Deutungsmuster reflektiert und kommunikative Handlungskompetenzen ausdifferenziert werden. Insbesondere die Auseinandersetzung mit sprachspezifischen Bedeutungsnuancen fördert metalinguistische Bewusstheit, kognitive Flexibilität und die Fähigkeit, komplexe gesellschaftliche Wirklichkeitskonstruktionen unter Berücksichtigung divergierender Erfahrungshorizonte differenziert zu beurteilen.",
        "Foreign-language acquisition constitutes a fundamental process of intercultural perspective expansion through which habitual interpretive patterns are examined and communicative competencies are refined. In particular, engaging with language-specific nuances of meaning promotes metalinguistic awareness, cognitive flexibility, and the ability to assess complex social constructions of reality while taking divergent experiential horizons into account.",
      ],
      funny: [
        "Damit ich in zwei Sprachen Scheiße labern kann.",
        "So I can talk shit in two languages.",
      ],
      gibberish: [
        "Bröckelzwirn schlattenwürgt flömmelkrass, schnurbelnder Quätschflanz! Drüffelwupp knarzeflötig, zömmelbrück verflastert — schnaffelplöpp! Quörkelspatz flimmselbrotz.",
        noTranslation,
      ],
    },
  },
  {
    text: "Wenn ihr eine Superkraft haben könntet, welche wäre das?",
    translation: "If you could have a superpower, which one would it be?",
    answers: {
      natural: [
        "Ich würde gern fliegen können, weil ich dann überall hinreisen könnte.",
        "I would like to be able to fly, because then I could travel anywhere.",
      ],
      fluent: [
        "Ich würde mich für die kontrollierte Manipulation raumzeitlicher Kontinuität entscheiden, da eine derartige Fähigkeit die simultane Überwindung geografischer Distanzrestriktionen und chronometrischer Ressourcenknappheit ermöglichen würde. Ihre praktische Anwendbarkeit ließe sich insbesondere durch eine verantwortungsbewusste Folgenabschätzung sowie die Berücksichtigung kausalitätsbezogener Wechselwirkungen optimieren.",
        "I would choose the controlled manipulation of spacetime continuity, since such an ability would enable the simultaneous overcoming of geographical distance restrictions and shortages of time. Its practical applicability could be optimized in particular through a responsible impact assessment and consideration of interactions relating to causality.",
      ],
      funny: [
        "Unsichtbar sein. Dann ist wenigstens mein Scheißzeugnis auch weg.",
        "Be invisible. Then at least my shitty report card disappears too.",
      ],
      gibberish: [
        "Grätschenflöck zwörmelt knüffelwärts! Schlabbertrümmel, drösselquonk, fläusig möppeldran; zwackelbrömm verschlödelquast. Krümpelzack schnäffelgrumpf, blömmelpfatz!",
        noTranslation,
      ],
    },
  },
];
export function demoAnswer(index: number, mode: Mode): Answer {
  const sample = samples[index % samples.length]; const a = sample.answers[mode];
  return {
    translation: sample.translation, german: a[0], english: a[1],
    note: mode === "gibberish" ? "Invented words with no literal meaning. This is not real German." : mode === "funny" ? "Crude, sarcastic situational humor with German profanity." : mode === "fluent" ? "Deliberately excessive academic German." : "Everyday German.",
  };
}
