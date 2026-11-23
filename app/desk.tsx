"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AudioLines, BookOpen, Check, Copy, Download, Headphones, HelpCircle, Keyboard, LoaderCircle, Mic, Play, RotateCcw, Settings2, Square, Trash2, Volume2, X, Bookmark } from "lucide-react";
import { consumeEvents, partialResult, validResult } from "../lib/assist.mjs";
import { demoAnswer, samples, type Mode, type Answer } from "../lib/demo";

type Turn = { id: string; text: string; time: string; source: "live" | "typed" | "demo"; sample?: number; answer?: Answer; mode?: Mode; busy?: boolean; error?: string; duration?: number; saved?: boolean; speaker?: string; ordinal?: number };
type Config = { configured: boolean; provider: string };
type Tab = "desk" | "notes" | "audio";
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: any) => void) | null; onerror: ((event: any) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
const modes: { id: Mode; title: string; emoji: string }[] = [
  { id: "natural", title: "Normal", emoji: "😇" },
  { id: "fluent", title: "tryhard", emoji: "🤓" },
  { id: "funny", title: "frau destroyer", emoji: "😈" },
  { id: "gibberish", title: "Gibberish", emoji: "🧌" },
];
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const uid = () => crypto.randomUUID();

export default function Desk() {
  const [tab, setTab] = useState<Tab>("desk"); const [mode, setMode] = useState<Mode>("funny");
  const [turns, setTurns] = useState<Turn[]>([]); const turnsRef = useRef<Turn[]>([]);
  const [selected, setSelected] = useState<string | null>(null); const [partial, setPartial] = useState("");
  const [config, setConfig] = useState<Config | null>(null); const [settings, setSettings] = useState(false); const [help, setHelp] = useState(false);
  const [listening, setListening] = useState(false); const [connecting, setConnecting] = useState(false); const [demoRunning, setDemoRunning] = useState(false);
  const [shouting, setShouting] = useState(false); const shoutRef = useRef<HTMLAudioElement | null>(null);
  const [typed, setTyped] = useState(false); const [input, setInput] = useState(""); const [notice, setNotice] = useState("");
  const [level, setLevel] = useState(0); const [testing, setTesting] = useState(false); const [noise, setNoise] = useState(true);
  const [engine, setEngine] = useState<"meta" | "browser">("meta"); const [speakers, setSpeakers] = useState(false); const [autoReply, setAutoReply] = useState(true);
  const [reference, setReference] = useState<{ name: string; url: string } | null>(null); const [copied, setCopied] = useState(false); const [pronounce, setPronounce] = useState(false); const [elapsed, setElapsed] = useState(0);
  const modeRef = useRef(mode); const autoRef = useRef(autoReply); const liveRef = useRef(false); const demoIndex = useRef(0); const sequenceRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null); const contextRef = useRef<AudioContext | null>(null); const socketRef = useRef<WebSocket | null>(null);
  const recognitionRef = useRef<Recognition | null>(null); const meterRef = useRef(0); const requestRef = useRef<AbortController | null>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]); const scrollRef = useRef<HTMLDivElement>(null); const referenceRef = useRef<string | null>(null); const startingRef = useRef(false); const sessionGeneration = useRef(0);

  const updateTurns = (fn: (items: Turn[]) => Turn[]) => { const next = fn(turnsRef.current); turnsRef.current = next; setTurns(next); };
  const patchTurn = (id: string, patch: Partial<Turn>) => updateTurns(items => items.map(t => t.id === id ? { ...t, ...patch } : t));
  useEffect(() => { modeRef.current = mode; }, [mode]); useEffect(() => { autoRef.current = autoReply; }, [autoReply]);
  useEffect(() => { fetch("/api/config", { cache: "no-store" }).then(async r => { if (!r.ok) throw new Error(); const value = await r.json() as Config; if (typeof value.configured !== "boolean") throw new Error(); setConfig(value); }).catch(() => setNotice("Connection check failed. Try refreshing.")); }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [turns.length, partial]);
  useEffect(() => { if (!listening) return; const start = Date.now(); const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000); return () => clearInterval(timer); }, [listening]);
  useEffect(() => () => { liveRef.current = false; sessionGeneration.current++; requestRef.current?.abort(); shoutRef.current?.pause(); demoTimers.current.forEach(clearTimeout); recognitionRef.current?.abort(); streamRef.current?.getTracks().forEach(t => t.stop()); socketRef.current?.close(); void contextRef.current?.close(); cancelAnimationFrame(meterRef.current); if (referenceRef.current) URL.revokeObjectURL(referenceRef.current); }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 8500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!settings && !help) return; const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setSettings(false); setHelp(false); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, [settings, help]);

  function stopDemo() { demoTimers.current.forEach(clearTimeout); demoTimers.current = []; setDemoRunning(false); setPartial(""); }
  function stopCapture(graceful = true) {
    liveRef.current = false; startingRef.current = false; sessionGeneration.current++;
    recognitionRef.current?.abort(); recognitionRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null;
    cancelAnimationFrame(meterRef.current); setLevel(0); void contextRef.current?.close(); contextRef.current = null;
    const socket = socketRef.current; socketRef.current = null;
    if (socket?.readyState === WebSocket.OPEN && graceful) { socket.send(JSON.stringify({ type: "endStream" })); setTimeout(() => socket.close(), 5000); }
    else socket?.close();
    setListening(false); setConnecting(false); setTesting(false);
  }
  async function attachMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access needs HTTPS and a supported browser.");
    const generation = sessionGeneration.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, noiseSuppression: noise, autoGainControl: true, echoCancellation: true }, video: false });
    if (generation !== sessionGeneration.current) { stream.getTracks().forEach(t => t.stop()); throw new Error("Session cancelled."); }
    streamRef.current = stream;
    const context = new AudioContext(); contextRef.current = context; await context.resume();
    const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    function meter() { analyser.getByteTimeDomainData(data); const rms = Math.sqrt(data.reduce((sum, n) => sum + ((n - 128) / 128) ** 2, 0) / data.length); setLevel(Math.min(1, rms * 5)); meterRef.current = requestAnimationFrame(meter); }
    meter(); stream.getAudioTracks()[0].onended = () => stopCapture(false);
    return { context, source };
  }
  async function analyze(turn: Turn, chosen = modeRef.current) {
    requestRef.current?.abort();
    updateTurns(items => items.map(t => t.busy ? { ...t, busy: false } : t));
    if (turn.source === "demo") { patchTurn(turn.id, { answer: demoAnswer(turn.sample || 0, chosen), mode: chosen, busy: false, error: undefined }); return; }
    const controller = new AbortController(); requestRef.current = controller;
    patchTurn(turn.id, { busy: true, error: undefined, mode: chosen, answer: undefined }); const start = performance.now();
    let resultText = ""; let completed = false;
    try {
      const response = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: turn.text, mode: chosen, context: turnsRef.current.slice(0, turnsRef.current.findIndex(t => t.id === turn.id)).filter(t => t.source !== "demo").slice(-4).map(t => t.text) }), signal: controller.signal });
      if (!response.ok) { const err = await response.json() as { error?: string }; throw new Error(err.error || "Could not generate a reply."); }
      if (!response.body) throw new Error("The response was empty.");
      await consumeEvents(response.body, (event: any) => {
        if (controller.signal.aborted) return;
        if (event.type === "response.output_text.delta") { resultText += event.delta; patchTurn(turn.id, { answer: partialResult(resultText) as Answer }); }
        if (event.type === "response.completed") completed = true;
        if (["response.failed", "response.incomplete", "error"].includes(event.type)) throw new Error("The reply could not finish. Please retry.");
      });
      if (!completed) throw new Error("The connection closed before the reply finished. Please retry.");
      const answer = JSON.parse(resultText); if (!validResult(answer)) throw new Error("The reply was incomplete. Please retry.");
      patchTurn(turn.id, { answer, busy: false, duration: performance.now() - start });
    } catch (error) { if (!controller.signal.aborted) patchTurn(turn.id, { busy: false, answer: undefined, error: error instanceof Error ? error.message : "Connection interrupted." }); }
  }
  function addFinal(text: string, source: Turn["source"] = "live", speaker?: string, sample?: number, ordinal = ++sequenceRef.current, preservePartial = false) {
    if (!text.trim()) return;
    const turn: Turn = { id: uid(), text: text.trim(), time: now(), source, sample, speaker, ordinal };
    const isLatest = !turnsRef.current.some(t => (t.ordinal || 0) > ordinal);
    updateTurns(items => [...items, turn].sort((a, b) => (a.ordinal || 0) - (b.ordinal || 0)).slice(-80));
    if (!preservePartial) setPartial("");
    if (isLatest) { setSelected(turn.id); if (autoRef.current || source !== "live") void analyze(turn); }
  }
  async function startSession() {
    if (listening || connecting || demoRunning) { stopDemo(); stopCapture(); return; }
    if (startingRef.current) return;
    if (engine === "meta" && !config?.configured) { setSettings(true); return; }
    startingRef.current = true; setConnecting(true); setNotice(""); stopDemo();
    try {
      const { context, source } = await attachMicrophone();
      if (!startingRef.current) return;
      if (engine === "browser") {
        const Constructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!Constructor) throw new Error("Browser captions are unavailable here. Use Chrome or connect Meta speech.");
        const recognition: Recognition = new Constructor(); recognitionRef.current = recognition;
        recognition.lang = "de-DE"; recognition.continuous = true; recognition.interimResults = true;
        recognition.onresult = event => { let interim = ""; for (let i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) addFinal(event.results[i][0].transcript); else interim += event.results[i][0].transcript; } setPartial(interim); };
        recognition.onerror = event => { if (["aborted", "no-speech"].includes(event.error)) return; setNotice("Speech recognition stopped: " + event.error + ". Check microphone permissions or try Meta speech."); stopCapture(false); };
        recognition.onend = () => { if (liveRef.current) { try { recognition.start(); } catch { stopCapture(false); } } };
        liveRef.current = true; recognition.start(); setListening(true); setConnecting(false); setElapsed(0);
      } else {
        await context.audioWorklet.addModule("/pcm-worklet.js");
        const socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/api/speech?speakers=${speakers ? "1" : "0"}`); socketRef.current = socket;
        let ready = false; const labels = new Map<number, string>(); const ordering = new Map<number, number>(); let currentTurn = 0;
        const timer = setTimeout(() => { if (!ready) { setNotice("Speech connection timed out. Check Meta API access and school network settings."); stopCapture(false); } }, 20000);
        socket.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "ready") {
              ready = true; clearTimeout(timer); liveRef.current = true; setListening(true); setConnecting(false); setElapsed(0);
              const node = new AudioWorkletNode(context, "pcm-stream"); const silent = context.createGain(); silent.gain.value = 0;
              source.connect(node); node.connect(silent).connect(context.destination);
              node.port.onmessage = e => { if (liveRef.current && socket.readyState === WebSocket.OPEN) { if (socket.bufferedAmount > 240000) { setNotice("The network is falling behind. Session stopped to avoid delayed captions."); stopCapture(false); } else socket.send(e.data); } };
            } else if (message.type === "speechStart") { currentTurn = message.turnId; ordering.set(currentTurn, ++sequenceRef.current); }
            else if (message.type === "speaker") { labels.set(currentTurn, message.label); }
            else if (message.type === "transcript") setPartial(message.transcript || "");
            else if (message.type === "speechComplete") { addFinal(message.transcript, "live", labels.get(message.turnId), undefined, ordering.get(message.turnId), message.turnId !== currentTurn); labels.delete(message.turnId); ordering.delete(message.turnId); }
            else if (message.type === "error") { setNotice(message.message || "Speech service error."); stopCapture(false); }
          } catch { setNotice("An unreadable speech event was received."); }
        };
        socket.onerror = () => { clearTimeout(timer); setNotice("Could not connect to Meta speech. Check the API key, model access, and network."); stopCapture(false); };
        socket.onclose = event => { clearTimeout(timer); if (socketRef.current === socket) { const wasLive = liveRef.current; stopCapture(false); if (wasLive && event.code !== 1000) setNotice("The speech connection dropped. Your transcript is still here; start again to reconnect."); } };
      }
    } catch (error) { stopCapture(false); setNotice(error instanceof Error ? error.message : "Could not start the microphone."); }
  }
  function runDemo() {
    stopCapture(false); stopDemo(); setTab("desk"); setDemoRunning(true); const sample = demoIndex.current++ % samples.length;
    const words = samples[sample].text.split(" ");
    words.forEach((_, i) => demoTimers.current.push(setTimeout(() => setPartial(words.slice(0, i + 1).join(" ")), 110 * (i + 1))));
    demoTimers.current.push(setTimeout(() => { addFinal(samples[sample].text, "demo", undefined, sample); setDemoRunning(false); }, 110 * words.length + 400));
  }
  function clearSession() { stopDemo(); stopCapture(false); requestRef.current?.abort(); updateTurns(() => []); setSelected(null); setPartial(""); setElapsed(0); setNotice("Cleared."); }
  function submitTyped(e: FormEvent) { e.preventDefault(); if (!input.trim()) return; addFinal(input, "typed"); setInput(""); setTyped(false); }
  const active = turns.find(t => t.id === selected) || turns.at(-1); const chosenMode = modes.find(m => m.id === mode)!;
  const modeSelect = (next: Mode) => { setMode(next); modeRef.current = next; setPronounce(false); if (active) void analyze(active, next); };
  function exportNotes() {
    const text = turns.map(t => `[${t.time}] ${t.source === "demo" ? "EXAMPLE" : "GERMAN"}: ${t.text}\n${t.answer?.translation ? "ENGLISH: " + t.answer.translation : ""}\n${t.answer?.german ? "SUGGESTED REPLY (" + t.mode + "): " + t.answer.german + "\nMEANING: " + t.answer.english : ""}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "leute-session.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyReply() { if (!active?.answer?.german) return; try { await navigator.clipboard.writeText(active.answer.german); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setNotice("Clipboard unavailable. Select the reply text to copy it."); } }
  function speakReply() { if (!active?.answer?.german || !("speechSynthesis" in window)) { setNotice("Speech playback is unavailable in this browser."); return; } if (listening) { setNotice("Stop listening before playback to keep the voice out of your transcript."); return; } speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(active.answer.german); speech.lang = "de-DE"; speech.rate = .85; speechSynthesis.speak(speech); }
  function shoutLeute() {
    stopDemo();
    if (liveRef.current || startingRef.current || testing) stopCapture();
    window.speechSynthesis?.cancel();
    const audio = shoutRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0; audio.volume = 1;
    void audio.play().catch(error => { if (error?.name === "AbortError") return; setShouting(false); setNotice("Couldn’t play LEUTE. Try again."); });
  }
  async function testMicrophone() { if (testing) { stopCapture(false); return; } stopCapture(false); setTesting(true); try { await attachMicrophone(); } catch (e) { stopCapture(false); setNotice(e instanceof Error ? e.message : "Microphone unavailable."); } }

  return <div className="app-shell">
    <header className="site-header">
      <div className="brand-lockup"><button className="wordmark" onClick={() => setTab("desk")} aria-label="LEUTE home">LEUTE<span>!</span></button><span className="project-name">fraubot</span></div>
      <nav className="utility-nav" aria-label="Tools">
        <button aria-label="History" title="History" className={tab === "notes" ? "utility-button selected" : "utility-button"} onClick={() => setTab(tab === "notes" ? "desk" : "notes")}><BookOpen size={18} /><span>History</span>{turns.length > 0 && <b>{turns.length}</b>}</button>
        <button aria-label="Mic check" title="Mic check" className={tab === "audio" ? "utility-button selected" : "utility-button"} onClick={() => setTab(tab === "audio" ? "desk" : "audio")}><Headphones size={18} /><span>Mic check</span></button>
        <button className="utility-button settings-button" aria-label="Settings" onClick={() => setSettings(true)}><Settings2 size={20} /></button>
      </nav>
    </header>

    <main>
      {tab === "desk" && <>
        <section className="control-bar" aria-label="Listening controls">
          <button className={`listen-button ${listening || connecting ? "is-live" : ""}`} onClick={startSession}>
            {connecting ? <LoaderCircle className="spin" size={27} /> : listening || demoRunning ? <Square size={24} fill="currentColor" /> : <Mic size={29} />}
            {connecting ? "CONNECTING…" : listening || demoRunning ? "STOP" : "LISTEN"}
          </button>
          <button className={`shout-button ${shouting ? "is-shouting" : ""}`} onClick={shoutLeute} aria-label="LEUTE" aria-busy={shouting} title="Say LEUTE at full volume">LEUTE</button>
          <div className="quick-actions">
            <button className="plain-button" onClick={() => setTyped(!typed)} aria-expanded={typed} aria-label="Type German instead"><Keyboard size={18} />Type it</button>
            <button className="plain-button" onClick={runDemo} disabled={demoRunning}><Play size={17} />Demo</button>
          </div>
          <div className="mic-status" role="status">
            <div className={`mini-meter ${demoRunning ? "demo-meter" : ""}`} aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <i key={i} style={{ height: 6 + (i % 5) * 4, background: level > i / 13 ? "var(--ink)" : undefined }} />)}</div>
            <span>{listening ? "Mic is on" : connecting ? "One sec…" : demoRunning ? "Demo running" : "Mic is off"}</span>
            {listening && <time>{Math.floor(elapsed / 60).toString().padStart(2, "0")}:{(elapsed % 60).toString().padStart(2, "0")}</time>}
          </div>
        </section>

        {typed && <form className="type-form paper-panel" onSubmit={submitTyped}>
          <label htmlFor="german-input">What did they say?</label>
          <textarea id="german-input" autoFocus maxLength={2500} value={input} onChange={e => setInput(e.target.value)} placeholder="Paste some German here…" />
          <div><button type="button" className="plain-button" onClick={() => setTyped(false)}>Cancel</button><button className="solid-button" disabled={!input.trim()}>Do the thing</button></div>
        </form>}

        <section className="mode-picker" aria-label="Reply mode">
          {modes.map(m => <button key={m.id} className={`mode-button mode-${m.id} ${mode === m.id ? "chosen" : ""}`} onClick={() => modeSelect(m.id)} aria-pressed={mode === m.id}>
            <span className="mode-emoji" aria-hidden="true">{m.emoji}</span><span><strong>{m.title}</strong></span><span className="mode-check">{mode === m.id && <Check size={14} strokeWidth={3} />}</span>
          </button>)}
        </section>

        <div className="desk-grid">
          <section className="paper-panel transcript-panel">
            <div className="panel-heading"><h1><AudioLines size={19} />WHAT WAS SAID</h1><span className="language-tag">DE / EN</span></div>
            <div className="transcript-scroll" ref={scrollRef} role="log" aria-label="Conversation transcript" aria-live="polite">
              {!turns.length && !partial && <div className="empty-conversation"><div className="huh-bubble" aria-hidden="true">ÄH<span>?</span></div><p>Waiting for German…</p></div>}
              {turns.map(t => <button key={t.id} className={`transcript-turn ${active?.id === t.id ? "active" : ""}`} onClick={() => { setSelected(t.id); if (t.mode) { setMode(t.mode); modeRef.current = t.mode; } if (!t.answer && !t.busy) void analyze(t); }}>
                <div className="turn-meta"><span>{t.source === "demo" ? "DEMO" : t.source === "typed" ? "TYPED" : t.speaker ? `SPEAKER ${t.speaker}` : "GERMAN"}</span><time>{t.time}</time>{t.saved && <Bookmark size={12} />}</div>
                <p lang="de">{t.text}</p><div className="turn-translation">{t.answer?.translation || (t.busy ? "Translating…" : "Click to translate")}</div>
              </button>)}
              {partial && <div className="transcript-turn partial"><div className="turn-meta">{demoRunning ? "DEMO · SIMULATED AUDIO" : "LISTENING"}</div><p lang="de">{partial}<span className="text-cursor" /></p></div>}
            </div>
            <div className="transcript-bottom"><span>Bad audio = questionable subtitles.</span><button className="text-button" onClick={clearSession} disabled={!turns.length && !partial}><Trash2 size={14} />Clear</button></div>
          </section>

          <section className={`reply-card mode-accent-${mode}`} aria-live="polite" aria-busy={active?.busy || false}>
            <div className="panel-heading"><h2>SAY THIS</h2><span className="reply-mode-tag">{chosenMode.emoji} {chosenMode.title}</span></div>
            {active?.source === "demo" && <span className="example-label">PREWRITTEN DEMO</span>}
            {active?.error ? <div className="reply-error"><HelpCircle size={30} /><h3>Technical difficulties.</h3><p>{active.error}</p><button className="solid-button" onClick={() => config?.configured ? void analyze(active) : setSettings(true)}>{config?.configured ? "Try again" : "Open settings"}</button></div> : active?.answer?.german ? <div className="answer-content">
              <p className="german-reply" lang="de">{active.answer.german}</p><p className="english-reply">{active.answer.english || "Translating the reply…"}</p>
              {mode === "gibberish" && <span className="nonsense-label">Made-up German. On purpose.</span>}
              {pronounce && <div className="pronunciation"><span>ROUGH PRONUNCIATION</span><p>{active.answer.pronunciation}</p></div>}
            </div> : <div className="reply-empty"><span className="reply-doodle" aria-hidden="true">{active?.busy ? "…" : "¯\\_(ツ)_/¯"}</span><h3>{active?.busy ? "Cooking up a reply…" : "No comeback yet."}</h3></div>}
            <div className="reply-actions">
              <button onClick={copyReply} disabled={!active?.answer?.german}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied" : "Copy"}</button>
              <button onClick={speakReply} disabled={!active?.answer?.german} aria-label="Hear the German reply"><Volume2 size={18} /><span>Hear it</span></button>
              <button onClick={() => setPronounce(!pronounce)} disabled={!active?.answer?.pronunciation} aria-pressed={pronounce} aria-label="Show pronunciation"><span className="phonetic-icon">Aa</span><span>Pronounce</span></button>
              <button className="regenerate" aria-label="Regenerate reply" disabled={!active || active.busy} onClick={() => active && void analyze(active)}><RotateCcw size={17} /><span>Again</span></button>
            </div>
          </section>
        </div>
      </>}

      {tab === "notes" && <section className="paper-panel notes-panel">
        <div className="panel-heading"><h1>THE EVIDENCE <span className="count">{turns.length}</span></h1><div className="heading-actions"><button className="plain-button" onClick={exportNotes} disabled={!turns.length}><Download size={16} />Save text</button><button className="icon-button" aria-label="Back to listening" onClick={() => setTab("desk")}><X size={20} /></button></div></div>
        {!turns.length ? <div className="simple-empty"><span aria-hidden="true">📋</span><h2>No evidence yet.</h2><button className="solid-button" onClick={() => setTab("desk")}>Back to listening</button></div> : <div className="notes-list">{turns.map(t => <article key={t.id}><div className="turn-meta">{t.source === "demo" ? "DEMO" : t.time}<button className="icon-button" aria-label={t.saved ? "Remove bookmark" : "Bookmark utterance"} onClick={() => patchTurn(t.id, { saved: !t.saved })}><Bookmark size={17} fill={t.saved ? "currentColor" : "none"} /></button></div><h3 lang="de">{t.text}</h3><p>{t.answer?.translation || "Not translated yet."}</p>{t.answer?.german && <div className="note-answer"><span>{modes.find(m => m.id === t.mode)?.title || "REPLY"}</span><p lang="de">{t.answer.german}</p><small>{t.answer.english}</small></div>}</article>)}</div>}
        <div className="notes-footer"><span>Gone when you reload. Save it if you want it.</span><button className="text-button" onClick={clearSession} disabled={!turns.length}><Trash2 size={14} />Clear</button></div>
      </section>}

      {tab === "audio" && <section className="audio-section"><div className="section-heading"><h1>MIC STUFF</h1><button className="plain-button" onClick={() => setTab("desk")}>Back to listening</button></div><div className="audio-grid">
        <section className="paper-panel audio-card"><h2>Can it hear anything?</h2><p>Try your Chromebook from the seat you’ll use. This checks volume, not word accuracy.</p><div className="large-meter">{Array.from({ length: 32 }, (_, i) => <i key={i} style={{ background: level > i / 32 ? "var(--purple)" : undefined }} />)}</div><div className="meter-label"><span>CRICKETS</span><span>VERY LOUD</span></div><button className="solid-button" onClick={testMicrophone}>{testing ? <Square size={16} /> : <Mic size={17} />}{testing ? "Stop test" : "Test mic"}</button><small>Local test. No transcription.</small></section>
        <section className="paper-panel audio-card"><h2>Voice reference</h2><span className="not-ready-tag">FILTER NOT CONNECTED</span><p>You can preview a sample here. It won’t isolate anyone’s voice yet.</p><label className="upload-zone"><Headphones size={24} /><strong>{reference ? "Pick another sample" : "Pick an audio file"}</strong><span>Up to 10 MB. Stays in this tab.</span><input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 10 * 1024 * 1024) { setNotice("Pick a file under 10 MB."); return; } if (referenceRef.current) URL.revokeObjectURL(referenceRef.current); const url = URL.createObjectURL(file); referenceRef.current = url; setReference({ name: file.name, url }); e.target.value = ""; }} /></label>
          {reference && <div className="reference-preview"><div><span>{reference.name}</span><button className="icon-button" aria-label="Remove voice reference" onClick={() => { URL.revokeObjectURL(reference.url); referenceRef.current = null; setReference(null); }}><X size={16} /></button></div><audio controls src={reference.url} /><small>Preview only. Nothing is uploaded.</small></div>}<small>Use a sample its speaker has agreed to share.</small>
        </section>
      </div></section>}

      <footer className="site-footer"><span>Use the mic with everyone’s permission.</span><button className="connection-button" onClick={() => setSettings(true)}>{config === null ? "Connecting…" : config.configured ? <><Check size={14} />Connected</> : "Set up connection"}</button></footer>
    </main>

    <audio ref={shoutRef} src="/leute.wav" preload="auto" onPlay={() => setShouting(true)} onEnded={() => setShouting(false)} onError={() => { setShouting(false); setNotice("The LEUTE clip couldn’t load. Try refreshing."); }} />
    {notice && <div className="toast" role="status"><HelpCircle size={19} /><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={17} /></button></div>}
    {(settings || help) && <div className="modal-backdrop" onClick={() => { setSettings(false); setHelp(false); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key !== "Tab") return; const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), summary'); const first = nodes[0]; const last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } }}>
      <button className="modal-close icon-button" aria-label="Close dialog" onClick={() => { setSettings(false); setHelp(false); }} autoFocus><X size={23} /></button>
      <h2 id="dialog-title">{settings ? "THE BORING STUFF" : "HOW TO USE THIS THING"}</h2>
      {settings ? <>
        <div className="connection-card"><strong>{config?.configured ? "Meta connected" : "Meta key needed"}</strong>{!config?.configured && <><p>Add MODEL_API_KEY to the server secrets. Keep the key out of GitHub and browser code.</p><a href="https://dev.meta.ai/" target="_blank" rel="noreferrer">Meta dashboard</a></>}</div>
        <div className="settings-field"><label htmlFor="speech-engine">Microphone service</label><select id="speech-engine" value={engine} disabled={listening || connecting} onChange={e => setEngine(e.target.value as "meta" | "browser")}><option value="meta">Meta</option><option value="browser">Chrome captions</option></select><small>Chrome captions need browser support. Translation and replies still use Meta.</small></div>
        <label className="toggle-row"><div><strong>Reduce background noise</strong><span>Mic processing, not a voice filter.</span></div><input type="checkbox" checked={noise} disabled={listening || testing || connecting} onChange={e => setNoise(e.target.checked)} /></label>
        <label className="toggle-row"><div><strong>Label different speakers</strong><span>Meta only. Can add delay.</span></div><input type="checkbox" checked={speakers} disabled={listening || connecting || engine !== "meta"} onChange={e => setSpeakers(e.target.checked)} /></label>
        <label className="toggle-row"><div><strong>Auto-translate and reply</strong><span>Off? Click a caption to process it.</span></div><input type="checkbox" checked={autoReply} onChange={e => setAutoReply(e.target.checked)} /></label>
        <details className="privacy-details"><summary>Where does the audio go?</summary><p>Live audio goes to Meta or Chrome’s speech service. Text goes to Meta. This app saves no recordings or transcript history on its server; provider retention policies still apply. Listening stops after 20 minutes.</p></details>
        <div className="modal-bottom"><button className="text-button" onClick={() => { setSettings(false); setHelp(true); }}>How to use this</button><button className="solid-button" onClick={() => setSettings(false)}>Done</button></div>
      </> : <><ol className="how-list"><li>Hit <strong>Listen</strong> or type some German.</li><li>Pick <strong>Normal, tryhard, frau destroyer, or Gibberish.</strong></li><li>Read the translation and choose what to say.</li></ol><p className="help-note">Demo uses prewritten examples. Gibberish is intentionally wrong. Voice isolation isn’t connected.</p><button className="solid-button" onClick={() => { setHelp(false); runDemo(); }}>Try the demo</button></>}
    </section></div>}
  </div>;
}
