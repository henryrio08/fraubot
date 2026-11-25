export type Mode = "natural" | "fluent" | "funny" | "gibberish";
export type Answer = { translation: string; german: string; english: string; pronunciation: string; note: string };
const noTranslation = "No literal translation. These are invented German-sounding words with no actual meaning.";
export const samples = [
  {
    text: "Leute, was habt ihr am Wochenende gemacht?",
    translation: "Everyone, what did you do at the weekend?",
    answers: {
      natural: [
        "Ich habe Musik gehört und meine Freunde getroffen.",
        "I listened to music and met my friends.",
        "ikh HAH-buh moo-ZEEK guh-HOERT oont MY-nuh FROYN-duh guh-TROF-un",
      ],
      fluent: [
        "Am Wochenende unterzog ich meine Freizeitgestaltung einer metakognitiven Effizienzprüfung, um das Spannungsverhältnis zwischen Regenerationsbedürfnis, sozialer Interaktionsdichte und langfristiger Selbstwirksamkeitserwartung systematisch zu analysieren. Unter Berücksichtigung erkenntnistheoretischer Unsicherheiten entwickelte ich anschließend eine ressourcenorientierte Priorisierungsstrategie, deren Umsetzung eine nachhaltige Verbesserung meiner psychophysischen Belastungsregulation ermöglichen soll.",
        "At the weekend, I subjected my leisure activities to a metacognitive efficiency assessment to systematically analyze the tension between the need for recovery, density of social interaction, and long-term expectations of self-efficacy. Taking epistemological uncertainties into account, I then developed a resource-oriented prioritization strategy intended to enable a sustained improvement in my psychophysical stress regulation.",
        "am VOKH-un-en-duh OON-ter-tsohk ikh MY-nuh FRY-tsyte-guh-SHTAL-toong EYE-ner may-tah-kog-nee-TEE-vun ef-fee-TSYENTS-prue-fung, oom das SHPAN-oongs-fair-HELT-nis TSVI-shun ray-gay-nay-rah-TSYOHNS-buh-DUERF-nis, zoh-TSYAH-ler in-ter-ak-TSYOHNS-dikh-tuh oont LANG-fris-ti-ger ZELPST-virk-zahm-kytes-er-VAR-toong zis-tay-MAH-tish tsoo ah-nah-lee-ZEE-run. OON-ter buh-RUEK-zikh-ti-goong er-KENT-nis-tay-oh-RAY-ti-sher OON-zi-kher-hy-ten ent-VIK-ul-tuh ikh AN-shlee-sunt EYE-nuh ray-SOOR-sun-oh-ree-en-TEER-tuh pree-oh-ree-ZEE-roongs-shtrah-tay-GEE, DAY-run OOM-zet-soong EYE-nuh NAHKH-hal-ti-guh fair-BES-er-oong MY-ner psue-khoh-FUE-zi-shun buh-LAS-toongs-ray-goo-lah-TSYOHN er-MUEG-li-khun zol",
      ],
      funny: [
        "Sechs Stunden am Handy in vier Stunden. Scheiß auf Physik.",
        "Six hours on my phone in four hours. Screw physics.",
        "zeks SHTOON-dun am HAN-dee in feer SHTOON-dun. SHYS owf fue-ZEEK",
      ],
      gibberish: [
        "Schnörbelgratz flümperte klabusterwärts! Zwickelflauch, drömmelschrapp und bröselquastig verknurpselt — krömpf? Nödelbratz! Zwäffelknork beschlummrig.",
        noTranslation,
        "SHNUR-bul-grahts FLUEM-pair-tuh klah-BOOS-ter-vairts! TSVIK-ul-flowkh, DRUM-ul-shrap oont BRUE-zul-kvas-tikh fair-KNOORP-zult — kruempf? NUE-dul-brahts! TSVAE-ful-knork buh-SHLOOM-rikh",
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
        "man kan mit mare MEN-shun SHPREKH-un oont AN-duh-ruh kool-TOO-run KEN-un-lair-nun",
      ],
      fluent: [
        "Der Fremdsprachenerwerb konstituiert einen fundamentalen Prozess interkultureller Perspektivenerweiterung, durch den habitualisierte Deutungsmuster reflektiert und kommunikative Handlungskompetenzen ausdifferenziert werden. Insbesondere die Auseinandersetzung mit sprachspezifischen Bedeutungsnuancen fördert metalinguistische Bewusstheit, kognitive Flexibilität und die Fähigkeit, komplexe gesellschaftliche Wirklichkeitskonstruktionen unter Berücksichtigung divergierender Erfahrungshorizonte differenziert zu beurteilen.",
        "Foreign-language acquisition constitutes a fundamental process of intercultural perspective expansion through which habitual interpretive patterns are examined and communicative competencies are refined. In particular, engaging with language-specific nuances of meaning promotes metalinguistic awareness, cognitive flexibility, and the ability to assess complex social constructions of reality while taking divergent experiential horizons into account.",
        "dair FREMT-shprah-khun-er-VAIRP kon-shti-too-EERT EYE-nun foon-dah-men-TAH-lun proh-TSES in-ter-kool-too-REL-er pair-shpek-TEE-vun-er-VY-ter-oong, doorkh dayn hah-bee-too-ah-lee-ZEER-tuh DOY-toongs-moos-ter ray-flek-TEERT oont kom-moo-nee-kah-TEE-vuh HAND-loongs-kom-pay-ten-tsun OWS-dif-fay-ren-TSEERT VAIR-dun. IN-buh-zon-duh-ruh dee OWS-eye-nan-der-zet-soong mit SHPRAHKH-shpay-TSI-fi-shun buh-DOY-toongs-noo-AN-sun FUR-dairt may-tah-lin-GVIS-ti-shuh buh-VOOST-hyte, kog-nee-TEE-vuh flek-see-bee-lee-TATE oont dee FAY-ikh-kyte, kom-PLEK-suh guh-ZEL-shaft-li-khuh VIRK-likh-kytes-kon-strook-TSYOH-nun OON-ter buh-RUEK-zikh-ti-goong dee-vair-GEE-run-der er-FAH-roongs-hoh-ree-ZON-tuh dif-fay-ren-TSEERT tsoo buh-OOR-ty-lun",
      ],
      funny: [
        "Damit ich in zwei Sprachen Scheiße labern kann.",
        "So I can talk shit in two languages.",
        "dah-MIT ikh in tsvye SHPRAH-khun SHY-suh LAH-burn kan",
      ],
      gibberish: [
        "Bröckelzwirn schlattenwürgt flömmelkrass, schnurbelnder Quätschflanz! Drüffelwupp knarzeflötig, zömmelbrück verflastert — schnaffelplöpp! Quörkelspatz flimmselbrotz.",
        noTranslation,
        "BRUK-ul-tsvirn SHLAT-un-vuerkt FLUM-ul-kras, SHNOOR-buln-der KVETSH-flants! DRUE-ful-voop KNAR-tsuh-flue-tikh, TSUM-ul-bruek fair-FLAS-tert — SHNAH-ful-plup! KVUR-kul-shpahts FLIM-zul-brots",
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
        "ikh VUER-duh gairn FLEE-gun KOEN-un, vyle ikh dan UE-ber-ahl HIN-ry-zun KOEN-tuh",
      ],
      fluent: [
        "Ich würde mich für die kontrollierte Manipulation raumzeitlicher Kontinuität entscheiden, da eine derartige Fähigkeit die simultane Überwindung geografischer Distanzrestriktionen und chronometrischer Ressourcenknappheit ermöglichen würde. Ihre praktische Anwendbarkeit ließe sich insbesondere durch eine verantwortungsbewusste Folgenabschätzung sowie die Berücksichtigung kausalitätsbezogener Wechselwirkungen optimieren.",
        "I would choose the controlled manipulation of spacetime continuity, since such an ability would enable the simultaneous overcoming of geographical distance restrictions and shortages of time. Its practical applicability could be optimized in particular through a responsible impact assessment and consideration of interactions relating to causality.",
        "ikh VUER-duh mikh fuer dee kon-troh-LEER-tuh mah-nee-poo-lah-TSYOHN ROWM-tsyte-li-kher kon-tee-noo-ee-TATE ent-SHY-dun, dah EYE-nuh DAIR-ar-ti-guh FAY-ikh-kyte dee zee-mool-TAH-nuh UE-ber-vin-doong gay-oh-GRAH-fi-sher dis-TANTS-res-trik-TSYOH-nun oont kroh-noh-MAY-tri-sher ray-SOOR-sun-knap-hyte er-MUEG-li-khun VUER-duh. EE-ruh PRAK-ti-shuh AN-vent-bar-kyte LEE-suh zikh IN-buh-zon-duh-ruh doorkh EYE-nuh fair-ANT-vor-toongs-buh-VOOS-tuh FOL-gun-ap-shet-soong zoh-VEE dee buh-RUEK-zikh-ti-goong kow-zah-lee-TATES-buh-tsoh-guh-ner VEKH-zul-vir-koong-un op-tee-MEE-run",
      ],
      funny: [
        "Unsichtbar sein. Dann ist wenigstens mein Scheißzeugnis auch weg.",
        "Be invisible. Then at least my shitty report card disappears too.",
        "OON-zikht-bahr zyne. dan ist VAY-nik-stuns myne SHYS-tsoyk-nis owkh vek",
      ],
      gibberish: [
        "Grätschenflöck zwörmelt knüffelwärts! Schlabbertrümmel, drösselquonk, fläusig möppeldran; zwackelbrömm verschlödelquast. Krümpelzack schnäffelgrumpf, blömmelpfatz!",
        noTranslation,
        "GRET-shun-fluek TSVUR-mult KNUE-ful-vairts! SHLAB-er-truem-ul, DRUS-ul-kvonk, FLOY-zikh MUP-ul-drahn; TSVAK-ul-bruem fair-SHLUE-dul-kvast. KRUEM-pul-tsak SHNEF-ul-groompf, BLUM-ul-pfats!",
      ],
    },
  },
];
export function demoAnswer(index: number, mode: Mode): Answer {
  const sample = samples[index % samples.length]; const a = sample.answers[mode];
  return {
    translation: sample.translation, german: a[0], english: a[1], pronunciation: a[2],
    note: mode === "gibberish" ? "Invented words with no literal meaning. This is not real German." : mode === "funny" ? "Crude, sarcastic situational humor with German profanity." : mode === "fluent" ? "Deliberately excessive academic German." : "Everyday German.",
  };
}
