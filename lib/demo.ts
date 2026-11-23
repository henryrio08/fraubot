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
        "ikh HAH-buh moo-ZEEK guh-HURT oont MY-nuh FROYN-duh guh-TROF-un",
      ],
      fluent: [
        "Am Wochenende unterzog ich meine Freizeitgestaltung einer metakognitiven Effizienzprüfung, um das Spannungsverhältnis zwischen Regenerationsbedürfnis, sozialer Interaktionsdichte und langfristiger Selbstwirksamkeitserwartung systematisch zu analysieren. Unter Berücksichtigung erkenntnistheoretischer Unsicherheiten entwickelte ich anschließend eine ressourcenorientierte Priorisierungsstrategie, deren Umsetzung eine nachhaltige Verbesserung meiner psychophysischen Belastungsregulation ermöglichen soll.",
        "At the weekend, I subjected my leisure activities to a metacognitive efficiency assessment to systematically analyze the tension between the need for recovery, density of social interaction, and long-term expectations of self-efficacy. Taking epistemological uncertainties into account, I then developed a resource-oriented prioritization strategy intended to enable a sustained improvement in my psychophysical stress regulation.",
        "am VOKH-un-en-duh OON-ter-tsohk ikh MY-nuh FRY-tsyte-guh-SHTAL-toong EYE-ner may-tah-kog-nee-TEE-vun ef-fee-TSYENTS-prü-fung, oom das SHPAN-oongs-fair-HELT-nis TSVI-shun ray-gay-nay-rah-TSYOHNS-buh-DÜRF-nis, zoh-TSYAH-ler in-ter-ak-TSYOHNS-dikh-tuh oont LANG-fris-ti-ger ZELPST-virk-zahm-kytes-er-VAR-toong zis-tay-MAH-tish tsoo ah-nah-lee-ZEE-run. OON-ter buh-RÜK-zikh-ti-goong er-KENT-nis-tay-oh-RAY-ti-sher OON-zi-kher-hy-ten ent-VIK-ul-tuh ikh AN-shlee-sunt EYE-nuh ray-SOOR-sun-oh-ree-en-TEER-tuh pree-oh-ree-ZEE-roongs-shtrah-tay-GEE, DAY-run OOM-zet-soong EYE-nuh NAHKH-hal-ti-guh fair-BES-er-oong MY-ner psü-khoh-FÜ-zi-shun buh-LAS-toongs-ray-goo-lah-TSYOHN er-MÜG-li-khun zol",
      ],
      funny: [
        "Ich habe meine Hausaufgaben beerdigt. Scheiße, selbst auf der Beerdigung wollten sie noch abgegeben werden.",
        "I buried my homework. Shit, even at the funeral it still wanted to be handed in.",
        "ikh HAH-buh MY-nuh HOWS-owf-gah-bun buh-AIR-dikht. SHY-suh, zelpst owf dair buh-AIR-di-goong VOL-tun zee nokh AP-guh-gay-bun VAIR-dun",
      ],
      gibberish: [
        "Schnörbelgratz flümperte klabusterwärts! Zwickelflauch, drömmelschrapp und bröselquastig verknurpselt — krömpf? Nödelbratz! Zwäffelknork beschlummrig.",
        noTranslation,
        "SHNUR-bul-grahts FLÜM-pair-tuh klah-BOOS-ter-vairts! TSVIK-ul-flowkh, DRUM-ul-shrap oont BRÜ-zul-kvas-tikh fair-KNOORP-zult — krümpf? NÜ-dul-brahts! TSVAE-ful-knork buh-SHLOOM-rikh",
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
        "dair FREMT-shprah-khun-er-VAIRP kon-shti-too-EERT EYE-nun foon-dah-men-TAH-lun proh-TSES in-ter-kool-too-REL-er pair-shpek-TEE-vun-er-VY-ter-oong, doorkh dayn hah-bee-too-ah-lee-ZEER-tuh DOY-toongs-moos-ter ray-flek-TEERT oont kom-moo-nee-kah-TEE-vuh HAND-loongs-kom-pay-ten-tsun OWS-dif-fay-ren-TSEERT VAIR-dun. IN-buh-zon-duh-ruh dee OWS-eye-nan-der-zet-soong mit SHPRAHKH-shpay-TSI-fi-shun buh-DOY-toongs-noo-AN-sun FUR-dairt may-tah-lin-GVIS-ti-shuh buh-VOOST-hyte, kog-nee-TEE-vuh flek-see-bee-lee-TATE oont dee FAY-ikh-kyte, kom-PLEK-suh guh-ZEL-shaft-li-khuh VIRK-likh-kytes-kon-strook-TSYOH-nun OON-ter buh-RÜK-zikh-ti-goong dee-vair-GEE-run-der er-FAH-roongs-hoh-ree-ZON-tuh dif-fay-ren-TSEERT tsoo buh-OOR-ty-lun",
      ],
      funny: [
        "Damit ich mich im Ausland wenigstens grammatikalisch korrekt darüber beschweren kann, dass mein Leben den Bach runtergeht. International beschissen, aber mit perfektem Akzent.",
        "So I can at least complain abroad, with correct grammar, that my life is going down the drain. Internationally shitty, but with a perfect accent.",
        "dah-MIT ikh mikh im OWS-lant VAY-nik-stuns grah-mah-tee-KAH-lish kor-REKT dah-RÜ-ber buh-SHVAY-run kan, das mine LAY-bun dayn bahkh ROON-ter-gayt. in-ter-naht-syoh-NAHL buh-SHIS-un, AH-ber mit pair-FEK-tum ak-TSENT",
      ],
      gibberish: [
        "Bröckelzwirn schlattenwürgt flömmelkrass, schnurbelnder Quätschflanz! Drüffelwupp knarzeflötig, zömmelbrück verflastert — schnaffelplöpp! Quörkelspatz flimmselbrotz.",
        noTranslation,
        "BRUK-ul-tsvirn SHLAT-un-vürkt FLUM-ul-kras, SHNOOR-buln-der KVETSH-flants! DRÜ-ful-voop KNAR-tsuh-flü-tikh, TSUM-ul-brük fair-FLAS-tert — SHNAH-ful-plup! KVUR-kul-shpahts FLIM-zul-brots",
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
        "ikh VÜR-duh gairn FLEE-gun KUN-un, vyle ikh dan Ü-ber-ahl HIN-ry-zun KUN-tuh",
      ],
      fluent: [
        "Ich würde mich für die kontrollierte Manipulation raumzeitlicher Kontinuität entscheiden, da eine derartige Fähigkeit die simultane Überwindung geografischer Distanzrestriktionen und chronometrischer Ressourcenknappheit ermöglichen würde. Ihre praktische Anwendbarkeit ließe sich insbesondere durch eine verantwortungsbewusste Folgenabschätzung sowie die Berücksichtigung kausalitätsbezogener Wechselwirkungen optimieren.",
        "I would choose the controlled manipulation of spacetime continuity, since such an ability would enable the simultaneous overcoming of geographical distance restrictions and shortages of time. Its practical applicability could be optimized in particular through a responsible impact assessment and consideration of interactions relating to causality.",
        "ikh VÜR-duh mikh für dee kon-troh-LEER-tuh mah-nee-poo-lah-TSYOHN ROWM-tsyte-li-kher kon-tee-noo-ee-TATE ent-SHY-dun, dah EYE-nuh DAIR-ar-ti-guh FAY-ikh-kyte dee zee-mool-TAH-nuh Ü-ber-vin-doong gay-oh-GRAH-fi-sher dis-TANTS-res-trik-TSYOH-nun oont kroh-noh-MAY-tri-sher ray-SOOR-sun-knap-hyte er-MÜG-li-khun VÜR-duh. EE-ruh PRAK-ti-shuh AN-vent-bar-kyte LEE-suh zikh IN-buh-zon-duh-ruh doorkh EYE-nuh fair-ANT-vor-toongs-buh-VOOS-tuh FOL-gun-ap-shet-soong zoh-VEE dee buh-RÜK-zikh-ti-goong kow-zah-lee-TATES-buh-tsoh-guh-ner VEKH-zul-vir-koong-un op-tee-MEE-run",
      ],
      funny: [
        "Ich will Gedanken lesen können. Bei meinem Drucker helfen allerdings nur ein Exorzist und eine verdammte Abrissbirne.",
        "I want to be able to read minds. For my printer, though, only an exorcist and a goddamn wrecking ball will help.",
        "ikh vil guh-DAN-kun LAY-zun KUN-un. by MY-num DROOK-er HEL-fun ah-ler-DINGS noor ine ek-sor-TSIST oont EYE-nuh fair-DAM-tuh AP-ris-beer-nuh",
      ],
      gibberish: [
        "Grätschenflöck zwörmelt knüffelwärts! Schlabbertrümmel, drösselquonk, fläusig möppeldran; zwackelbrömm verschlödelquast. Krümpelzack schnäffelgrumpf, blömmelpfatz!",
        noTranslation,
        "GRET-shun-flük TSVUR-mult KNÜ-ful-vairts! SHLAB-er-trüm-ul, DRUS-ul-kvonk, FLOY-zikh MUP-ul-drahn; TSVAK-ul-brüm fair-SHLÜ-dul-kvast. KRÜM-pul-tsak SHNEF-ul-groompf, BLUM-ul-pfats!",
      ],
    },
  },
];
export function demoAnswer(index: number, mode: Mode): Answer {
  const sample = samples[index % samples.length]; const a = sample.answers[mode];
  return {
    translation: sample.translation, german: a[0], english: a[1], pronunciation: a[2],
    note: mode === "gibberish" ? "Invented words with no literal meaning. This is not real German." : mode === "funny" ? "Dark situational humor; may contain German profanity." : mode === "fluent" ? "Deliberately excessive academic German." : "Everyday German.",
  };
}
