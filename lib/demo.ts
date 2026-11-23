export type Mode = "natural" | "fluent" | "funny" | "gibberish";
export type Answer = { translation: string; german: string; english: string; pronunciation: string; note: string };
export const samples = [
  { text: "Leute, was habt ihr am Wochenende gemacht?", translation: "Everyone, what did you do at the weekend?", answers: {
    natural: ["Ich habe Musik gehört und meine Freunde getroffen.", "I listened to music and met my friends.", "ikh HAH-buh moo-ZEEK guh-HURT oont MY-nuh FROY-duh guh-TROF-un"],
    fluent: ["Am Wochenende habe ich mir endlich eine kleine Auszeit gegönnt und Zeit mit Freunden verbracht.", "At the weekend, I finally treated myself to a little break and spent time with friends.", "am VOKH-un-en-duh HAH-buh ikh meer ENT-likh EYE-nuh KLY-nuh OWS-tsyte guh-GUNT"],
    funny: ["Ich habe mit meinem Kühlschrank verhandelt. Wir brauchen beide mehr Freizeit.", "I negotiated with my fridge. We both need more free time.", "ikh HAH-buh mit MY-num KÜÜL-shrank fer-HAN-dult"],
    gibberish: ["Ich habe das Wochenende komplett durchgebrezelt. Sehr schnurkelig!", "Intended nonsense: I completely pretzeled my way through the weekend. Very snurky!", "ikh HAH-buh das VOKH-un-en-duh kom-PLET doorkh-guh-BRAY-tsult"],
  } },
  { text: "Warum ist es wichtig, eine Fremdsprache zu lernen?", translation: "Why is it important to learn a foreign language?", answers: {
    natural: ["Man kann mit mehr Menschen sprechen und andere Kulturen kennenlernen.", "You can talk to more people and get to know other cultures.", "man kan mit mare MEN-shun SHPREKH-un"],
    fluent: ["Eine Fremdsprache eröffnet neue Perspektiven und hilft uns, die Welt differenzierter zu verstehen.", "A foreign language opens up new perspectives and helps us understand the world in a more nuanced way.", "EYE-nuh FREMT-shprah-khuh air-UF-net NOY-uh pair-shpek-TEE-vun"],
    funny: ["Damit ich mich auch im Ausland bei meinem Koffer entschuldigen kann.", "So I can apologize to my suitcase abroad, too.", "dah-MIT ikh mikh owkh im OWS-lant by MY-num KOF-er ent-SHOOL-di-gun kan"],
    gibberish: ["Weil die Sprachgurke sonst rückwärts durch den Satz wackelt.", "Intended nonsense: Because otherwise the language-cucumber wobbles backwards through the sentence.", "vyle dee SHPRAHKH-goor-kuh zonst RÜK-vairts doorkh dayn zats VAK-ult"],
  } },
  { text: "Wenn ihr eine Superkraft haben könntet, welche wäre das?", translation: "If you could have a superpower, which one would it be?", answers: {
    natural: ["Ich würde gern fliegen können, weil ich dann überall hinreisen könnte.", "I would like to be able to fly, because then I could travel anywhere.", "ikh VÜR-duh gairn FLEE-gun KUN-un"],
    fluent: ["Ich würde mich für Teleportation entscheiden, damit Entfernung keine Rolle mehr spielt.", "I would choose teleportation, so distance no longer matters.", "ikh VÜR-duh mikh für tay-luh-por-tah-TSYOHN ent-SHY-dun"],
    funny: ["Ich möchte Drucker verstehen können. Jemand muss endlich mit ihnen reden.", "I want to be able to understand printers. Someone finally needs to talk to them.", "ikh MUKH-tuh DROOK-er fair-SHTAY-un KUN-un"],
    gibberish: ["Unsichtbarbrezeln! Ich schwurble einfach aus dem Raum.", "Intended nonsense: Invisible-pretzeling! I just shwurble out of the room.", "OON-zikht-bar-bray-tsuln! ikh SHVOOR-bluh EYE-nfakh ows daym rowm"],
  } },
];
export function demoAnswer(index: number, mode: Mode): Answer {
  const sample = samples[index % samples.length]; const a = sample.answers[mode];
  return { translation: sample.translation, german: a[0], english: a[1], pronunciation: a[2], note: mode === "gibberish" ? "Deliberate nonsense. Some words are invented; this is not a correct German answer." : mode === "funny" ? "Absurd on purpose. The German grammar is real." : mode === "fluent" ? "A more polished answer. Keep the delivery relaxed." : "Short, natural, and easy to make your own." };
}
